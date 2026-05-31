import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resumeSections } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const sections = await db
    .select()
    .from(resumeSections)
    .orderBy(desc(resumeSections.priority));
  return NextResponse.json(sections);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await db.insert(resumeSections).values(body).returning();
  return NextResponse.json(result[0]);
}
