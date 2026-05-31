import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .update(applications)
    .set({
      status: "skipped",
      skippedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
