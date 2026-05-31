import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs, applications } from "@/lib/schema";
import { validateApiKey } from "@/lib/auth";
import { sendDiscordDigest } from "@/lib/discord";
import { eq, sql, and, gte } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count today's stats
  const [foundResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(gte(jobs.createdAt, today));

  const [matchedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.status, "matched"), gte(jobs.createdAt, today)));

  const [pendingResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.status, "awaiting_approval"));

  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

  await sendDiscordDigest({
    jobsFound: Number(foundResult.count),
    jobsMatched: Number(matchedResult.count),
    jobsPending: Number(pendingResult.count),
    appUrl,
  });

  return NextResponse.json({ sent: true });
}
