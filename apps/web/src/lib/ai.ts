import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile, ResumeSection, Job } from "./schema";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

// ─── Job Scoring ─────────────────────────────────────────────────

interface JobScore {
  score: number;
  reasoning: string;
}

export async function scoreJobs(
  jobsToScore: Pick<Job, "id" | "title" | "company" | "location" | "descriptionRaw" | "jobType">[],
  profile: UserProfile
): Promise<Record<string, JobScore>> {
  const jobList = jobsToScore
    .map(
      (j, i) =>
        `[${i}] "${j.title}" at ${j.company} (${j.location || "Unknown"})${j.jobType ? ` [${j.jobType}]` : ""}\nDescription excerpt: ${(j.descriptionRaw || "").slice(0, 500)}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are scoring internship job listings for a candidate. Score each job 0-100 based on how well it matches the candidate's profile.

CANDIDATE PROFILE:
- Name: ${profile.fullName}
- University: ${profile.university}, ${profile.degree}
- Graduation: ${profile.graduationDate}
- Skills: ${profile.skills.join(", ")}
- Work Authorization: ${profile.workAuth === "us_citizen" ? "US Citizen (no sponsorship needed)" : profile.workAuth}

JOBS TO SCORE:
${jobList}

For each job, evaluate:
1. Skills match (do the required skills align with the candidate's skills?)
2. Experience level match (is this appropriate for a junior/intern?)
3. Education match (CS degree relevance)
4. Overall fit

Respond with ONLY a JSON object mapping job index to score and reasoning:
{
  "0": { "score": 85, "reasoning": "Strong match: React, TypeScript align with candidate skills. Entry-level role fits intern profile." },
  "1": { "score": 40, "reasoning": "Requires 3+ years experience, not suitable for intern." }
}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, JobScore>;

  // Map back to job IDs
  const result: Record<string, JobScore> = {};
  jobsToScore.forEach((job, i) => {
    if (parsed[String(i)]) {
      result[job.id] = parsed[String(i)];
    }
  });

  return result;
}

// ─── Content Generation ──────────────────────────────────────────

interface GeneratedContent {
  selectedSectionIds: string[];
  coverLetter: string;
  recruiterMessage: string;
  graduationDate: string;
  autofillData: Record<string, string>;
}

export async function generateApplicationContent(
  job: Job,
  profile: UserProfile,
  availableSections: ResumeSection[]
): Promise<GeneratedContent> {
  const sectionsText = availableSections
    .map((s) => `[${s.id}] ${s.sectionType}: "${s.label}" — keywords: ${s.keywords.join(", ")}`)
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You write cover letters and recruiter messages that sound like a real college student wrote them, not an AI.

BANNED WORDS — never use any of these:
delve, leverage, utilize, harness, streamline, underscore, foster, navigate, bolster, showcase, facilitate, spearhead, empower, optimize, unleash, unlock, elevate, illuminate, pivotal, robust, innovative, seamless, cutting-edge, multifaceted, groundbreaking, transformative, holistic, crucial, dynamic, comprehensive, noteworthy, remarkable, invaluable, landscape, realm, tapestry, synergy, paradigm, beacon, cornerstone, catalyst, nexus, furthermore, moreover, consequently, passionate, self-starter, results-driven, detail-oriented, proven track record

BANNED PHRASES — never write anything resembling these:
- "I am writing to express my interest..."
- "I believe I would be a great fit..."
- "I am excited to apply for..."
- "I am passionate about..."
- "With my proven track record..."
- "I would welcome the opportunity..."
- "I am confident that my skills..."
- "Thank you for considering my application"
- "In today's rapidly evolving..."
- "Not only X, but also Y"
- Any "rule of three" adjective lists (e.g., "innovative, transformative, and groundbreaking")

STRUCTURAL RULES:
- Do NOT start more than one paragraph with "I"
- Vary sentence length. Some short. Others longer and more detailed.
- Use contractions (I'm, I've, don't, can't, isn't)
- No em dashes. Use commas or periods instead.
- No summary paragraph at the end
- Paragraphs should be different lengths, not uniform
- Sound like a real email someone would actually send

TONE — this is critical. The tone must be:
- A smart student who genuinely admires the company's work and wants to LEARN from them
- NOT a senior engineer talking to a peer. NOT someone doing the company a favor.
- Show quiet confidence through specific evidence (projects, numbers), not through bold claims
- Never say "I am confident" or "I am the ideal candidate" or "I know I can excel"
- Instead of claiming competence, just describe what you built. The evidence IS the confidence.
- Show genuine curiosity about the company's work, not just your own accomplishments
- Frame projects as proof of your interest, not as reasons you deserve the job
- Growth mindset: "this project taught me X, and I want to deepen that at your company"
- Respectful, not presumptuous. You're applying, not negotiating.

CLOSING RULES — for cover letters:
- NEVER ask for a meeting slot or call. That's presumptuous for an intern.
- NEVER say "I look forward to hearing from you" (generic and passive)
- DO say something like "I'd be happy to discuss my background further" or "Thank you for your time"
- Express enthusiasm about contributing to a specific team/project
- Keep the closing to one sentence. Don't overthink it.

VOICE — write as a UCF CS junior who:
- Has won hackathons and built real AI projects
- Is genuinely curious about the company's technical work
- References specific projects by name with real details
- Shows eagerness to learn and contribute, not to impress
- Doesn't overthink formality but also isn't overly casual`,
    messages: [
      {
        role: "user",
        content: `Write application content for this specific job. Every sentence must contain something specific to THIS role or THIS company that couldn't appear in any other cover letter.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not specified"}
- Description: ${(job.descriptionRaw || "").slice(0, 2000)}

MY BACKGROUND:
- Name: ${profile.fullName}
- School: ${profile.university}, ${profile.degree}
- Graduating: ${profile.graduationDate}
- Skills: ${profile.skills.join(", ")}
- GitHub: ${profile.githubUrl}
- LinkedIn: ${profile.linkedinUrl}
- Portfolio: ${profile.portfolioUrl}

RESUME SECTIONS (pick the best ones for this job):
${sectionsText}

TASKS:
1. Pick 2-4 resume sections that best match this job's requirements (plus header/education/skills if available)
2. Write a cover letter (under 200 words, 2-3 short paragraphs). Open with something specific about the company or role that shows you did research. Reference your projects as evidence of genuine interest in this area, not as a flex. Show you want to learn from this team. Close with one sentence of thanks and openness to discuss further. Do NOT ask for a meeting or call.
3. Write a LinkedIn/email message to the hiring manager (2-3 sentences max). Show genuine curiosity about their team's work, connect it briefly to something you've built, and express interest in the role. Be respectful, not pushy. Don't sound like a cold sales email.
4. Pick graduation date from: May 2027, Dec 2027, May 2028, Aug 2028. Whichever fits the role timeline best.

Respond with ONLY a JSON object:
{
  "selectedSectionIds": ["uuid1", "uuid2"],
  "coverLetter": "...",
  "recruiterMessage": "...",
  "graduationDate": "May 2028",
  "autofillData": {
    "full_name": "${profile.fullName}",
    "email": "${profile.email}",
    "phone": "${profile.phone}",
    "linkedin": "${profile.linkedinUrl}",
    "github": "${profile.githubUrl}",
    "portfolio": "${profile.portfolioUrl}",
    "university": "${profile.university}",
    "degree": "${profile.degree}",
    "graduation_date": "...",
    "work_authorization": "US Citizen",
    "sponsorship_required": "No",
    "gpa": "${profile.gpa || ""}"
  }
}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response for content generation");
  }

  return JSON.parse(jsonMatch[0]) as GeneratedContent;
}
