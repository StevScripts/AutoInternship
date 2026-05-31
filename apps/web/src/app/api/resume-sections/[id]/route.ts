import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resumeSections } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const result = await db
    .update(resumeSections)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(resumeSections.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }
  return NextResponse.json(result[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(resumeSections).where(eq(resumeSections.id, id));
  return NextResponse.json({ deleted: true });
}
