import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, jobs } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const conditions = [];
  if (status) conditions.push(eq(applications.status, status));

  const results = await db
    .select({
      application: applications,
      job: jobs,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    .orderBy(desc(applications.createdAt))
    .limit(limit);

  return NextResponse.json(results);
}
