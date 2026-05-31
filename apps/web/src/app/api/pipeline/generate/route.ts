import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs, applications, userProfile, resumeSections } from "@/lib/schema";
import { validateApiKey } from "@/lib/auth";
import { generateApplicationContent } from "@/lib/ai";
import { eq, and } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = (await request.json()) as { job_id?: string; batch?: boolean };

  // Get profile and resume sections
  const profiles = await db.select().from(userProfile).limit(1);
  if (profiles.length === 0) {
    return NextResponse.json({ error: "No user profile" }, { status: 400 });
  }
  const profile = profiles[0];

  const sections = await db
    .select()
    .from(resumeSections)
    .where(eq(resumeSections.isActive, true));

  // Get matched jobs that don't have applications yet
  let matchedJobs;
  if (body.job_id) {
    matchedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, body.job_id))
      .limit(1);
  } else {
    // Find matched jobs without existing applications
    const existingAppJobIds = await db
      .select({ jobId: applications.jobId })
      .from(applications);
    const existingIds = new Set(existingAppJobIds.map((a) => a.jobId));

    const allMatched = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "matched"))
      .limit(20);

    matchedJobs = allMatched.filter((j) => !existingIds.has(j.id));
  }

  let generated = 0;

  for (const job of matchedJobs) {
    try {
      const content = await generateApplicationContent(job, profile, sections);

      await db.insert(applications).values({
        jobId: job.id,
        status: "awaiting_approval",
        selectedResumeSectionIds: content.selectedSectionIds,
        coverLetter: content.coverLetter,
        recruiterMessage: content.recruiterMessage,
        graduationDateUsed: content.graduationDate,
        autofillData: content.autofillData,
      });

      generated++;
    } catch (err) {
      console.error(`Content gen failed for job ${job.id}:`, err);
    }
  }

  return NextResponse.json({ generated, total: matchedJobs.length });
}
