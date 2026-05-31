import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs, userProfile } from "@/lib/schema";
import { validateApiKey } from "@/lib/auth";
import { scoreJobs } from "@/lib/ai";
import { eq, sql } from "drizzle-orm";
import { MATCH_SCORE_THRESHOLD } from "@/lib/constants";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  // Get user profile
  const profiles = await db.select().from(userProfile).limit(1);
  if (profiles.length === 0) {
    return NextResponse.json({ error: "No user profile configured" }, { status: 400 });
  }
  const profile = profiles[0];

  // Get unscored jobs
  let unscoredJobs;
  try {
    unscoredJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "scraped"))
      .limit(10);
  } catch (err) {
    console.error("Failed to fetch unscored jobs:", err);
    return NextResponse.json({ error: "DB query failed", detail: String(err) }, { status: 500 });
  }

  if (unscoredJobs.length === 0) {
    return NextResponse.json({ scored: 0, matched: 0, skipped: 0, debug: "no unscored jobs found" });
  }

  let scored = 0;
  let matched = 0;
  let skipped = 0;

  // Process in batches of 5
  for (let i = 0; i < unscoredJobs.length; i += 5) {
    const batch = unscoredJobs.slice(i, i + 5);

    try {
      const scores = await scoreJobs(batch, profile);

      for (const job of batch) {
        const result = scores[job.id];
        if (!result) continue;

        const isMatch = result.score >= MATCH_SCORE_THRESHOLD;
        await db
          .update(jobs)
          .set({
            matchScore: String(result.score),
            matchReasoning: result.reasoning,
            scoredAt: new Date(),
            status: isMatch ? "matched" : "skipped",
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id));

        scored++;
        if (isMatch) matched++;
        else skipped++;
      }
    } catch (err) {
      console.error("Scoring batch failed:", err);
      return NextResponse.json({ scored, matched, skipped, error: String(err), batchIndex: i });
    }
  }

  return NextResponse.json({ scored, matched, skipped });
}
