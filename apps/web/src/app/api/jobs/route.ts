import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const search = searchParams.get("search");

  const conditions = [];
  if (status) conditions.push(eq(jobs.status, status));
  if (search) {
    conditions.push(
      sql`(${jobs.title} ILIKE ${"%" + search + "%"} OR ${jobs.company} ILIKE ${"%" + search + "%"})`
    );
  }

  const results = await db
    .select()
    .from(jobs)
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(results);
}
