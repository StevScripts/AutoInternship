import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, jobs, recruiterContacts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .select({
      application: applications,
      job: jobs,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.id, id))
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const recruiters = await db
    .select()
    .from(recruiterContacts)
    .where(eq(recruiterContacts.jobId, result[0].job.id));

  return NextResponse.json({
    ...result[0],
    recruiters,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const result = await db
    .update(applications)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(applications.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
