// Background service worker — handles Claude API calls

const CLAUDE_MODEL = "claude-sonnet-4-6";

async function getApiKey() {
  const { anthropicApiKey } = await chrome.storage.local.get("anthropicApiKey");
  return anthropicApiKey || "";
}

async function getProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  return profile || {};
}

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("No Anthropic API key configured. Open the extension popup to set it.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].type === "text" ? data.content[0].text : "";
}

// Generate answers for detected form fields
async function generateFieldAnswers(fields, jobDescription, pageUrl) {
  const profile = await getProfile();

  const systemPrompt = `You fill out job application forms for a college student. Your answers must sound like a real person typed them, not an AI.

CANDIDATE:
- Name: ${profile.fullName || ""}
- Email: ${profile.email || ""}
- Phone: ${profile.phone || ""}
- LinkedIn: ${profile.linkedin || ""}
- GitHub: ${profile.github || ""}
- Portfolio: ${profile.portfolio || ""}
- University: ${profile.university || ""}
- Degree: ${profile.degree || ""}
- Graduation: ${profile.graduationDate || ""}
- GPA: ${profile.gpa || ""}
- Work Auth: US Citizen (no sponsorship needed)
- Skills: ${(profile.skills || []).join(", ")}

RULES FOR ANSWERS:
- For yes/no questions about work authorization or sponsorship: always "Yes" for authorized, "No" for sponsorship
- For GPA: only provide if explicitly required, use "${profile.gpa || "3.5"}"
- For graduation date: "${profile.graduationDate || "May 2028"}" but adjust if the role needs a different timeline
- For "Why do you want to work here" type questions: write 2-3 sentences that are specific to THIS company. Show curiosity about their work, reference a real project you've built that relates. Sound like a student, not a corporate applicant.
- For cover letters: under 200 words, specific to THIS role, no AI-sounding language
- For short answer questions: be direct, specific, use real project names and numbers
- NEVER use: leverage, utilize, passionate, innovative, dynamic, driven, spearhead, harness
- Use contractions (I'm, I've, don't)
- Vary sentence length

IMPORTANT: For fields you can fill from profile data (name, email, phone, etc.), just return the exact value. Only use AI generation for open-ended questions.`;

  const fieldList = fields
    .map((f, i) => `[${i}] Label: "${f.label}" | Type: ${f.type} | Options: ${f.options || "none"} | Current value: "${f.currentValue || ""}"`)
    .join("\n");

  const userPrompt = `Fill out these job application fields. The job posting is at: ${pageUrl}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

FORM FIELDS:
${fieldList}

For each field, respond with ONLY a JSON array matching the field indices:
[
  { "index": 0, "value": "Stevin George", "source": "profile" },
  { "index": 1, "value": "steving2006@gmail.com", "source": "profile" },
  { "index": 2, "value": "Because your team's work on...", "source": "ai" }
]

"source" is either "profile" (direct data) or "ai" (generated answer).
Only include fields you can fill. Skip fields that need file uploads or are already correctly filled.`;

  const text = await callClaude(systemPrompt, userPrompt);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]);
}

// Generate a cover letter for the current job
async function generateCoverLetter(jobDescription, pageUrl) {
  const profile = await getProfile();

  const systemPrompt = `You write cover letters that sound like a real college student wrote them.

BANNED WORDS: delve, leverage, utilize, harness, streamline, foster, navigate, bolster, showcase, facilitate, spearhead, empower, optimize, pivotal, robust, innovative, seamless, cutting-edge, multifaceted, groundbreaking, transformative, holistic, dynamic, comprehensive, passionate, self-starter, results-driven, proven track record

TONE: A smart student who genuinely admires the company's work and wants to learn from them. Show confidence through specific evidence, not bold claims. Growth mindset. Respectful, not presumptuous.

RULES:
- Under 200 words, 2-3 short paragraphs
- Don't start more than one paragraph with "I"
- Use contractions
- No em dashes
- Open with something specific about the company
- Reference actual projects by name
- Close with thanks and openness to discuss, NOT a meeting request
- Every sentence must be specific to THIS role`;

  const userPrompt = `Write a cover letter for this job.

JOB: ${pageUrl}
DESCRIPTION: ${jobDescription.slice(0, 2000)}

CANDIDATE: ${profile.fullName}, ${profile.university}, ${profile.degree}
Skills: ${(profile.skills || []).join(", ")}
GitHub: ${profile.github}
Portfolio: ${profile.portfolio}

Return ONLY the cover letter text, no JSON wrapper.`;

  return await callClaude(systemPrompt, userPrompt);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_ANSWERS") {
    generateFieldAnswers(message.fields, message.jobDescription, message.pageUrl)
      .then((answers) => sendResponse({ success: true, answers }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }

  if (message.type === "GENERATE_COVER_LETTER") {
    generateCoverLetter(message.jobDescription, message.pageUrl)
      .then((coverLetter) => sendResponse({ success: true, coverLetter }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_PROFILE") {
    getProfile().then((profile) => sendResponse({ profile }));
    return true;
  }
});
