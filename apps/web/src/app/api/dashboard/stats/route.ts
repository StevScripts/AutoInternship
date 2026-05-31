import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs, applications, scrapeRuns } from "@/lib/schema";
import { eq, sql, gte, desc } from "drizzle-orm";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    [totalJobs],
    [todayJobs],
    [matchedToday],
    [pendingApproval],
    [submittedToday],
    [totalApplied],
    lastRun,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(jobs),
    db.select({ count: sql<number>`count(*)` }).from(jobs).where(gte(jobs.createdAt, today)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(sql`${jobs.status} = 'matched' AND ${jobs.createdAt} >= ${today}`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(eq(applications.status, "awaiting_approval")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(sql`${applications.status} = 'submitted' AND ${applications.submittedAt} >= ${today}`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(eq(applications.status, "submitted")),
    db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(1),
  ]);

  return NextResponse.json({
    totalJobs: Number(totalJobs.count),
    todayJobs: Number(todayJobs.count),
    matchedToday: Number(matchedToday.count),
    pendingApproval: Number(pendingApproval.count),
    submittedToday: Number(submittedToday.count),
    totalApplied: Number(totalApplied.count),
    lastScrapeRun: lastRun[0] || null,
  });
}
