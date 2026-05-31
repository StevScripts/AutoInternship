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
    messages: [
      {
        role: "user",
        content: `You are preparing an internship application for a candidate. Generate tailored content for this specific job.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not specified"}
- Description: ${(job.descriptionRaw || "").slice(0, 2000)}

CANDIDATE:
- Name: ${profile.fullName}
- University: ${profile.university}, ${profile.degree}
- Default Graduation: ${profile.graduationDate}
- Skills: ${profile.skills.join(", ")}
- GitHub: ${profile.githubUrl}
- LinkedIn: ${profile.linkedinUrl}
- Portfolio: ${profile.portfolioUrl}

AVAILABLE RESUME SECTIONS (pick the best combination):
${sectionsText}

INSTRUCTIONS:
1. Select the best resume sections for this job (2-4 experience/project sections + always include header, education, and skills sections if available)
2. Write a concise, human-sounding cover letter (3 short paragraphs max). Do NOT use generic phrases like "I am writing to express my interest" or "I believe I would be a great fit". Be specific about why this company and role.
3. Write a personalized LinkedIn/email message to the hiring manager (2-3 sentences, eye-catching, shows you researched the company). Do NOT be generic.
4. Pick the optimal graduation date for this role. The candidate can graduate May 2027, Dec 2027, May 2028, or Aug 2028. Pick whichever best matches the role's requirements.

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
