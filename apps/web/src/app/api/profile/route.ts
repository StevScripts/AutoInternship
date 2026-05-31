import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfile } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const profiles = await db.select().from(userProfile).limit(1);
  if (profiles.length === 0) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }
  return NextResponse.json(profiles[0]);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const profiles = await db.select().from(userProfile).limit(1);

  if (profiles.length === 0) {
    const result = await db.insert(userProfile).values(body).returning();
    return NextResponse.json(result[0]);
  }

  const result = await db
    .update(userProfile)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(userProfile.id, profiles[0].id))
    .returning();

  return NextResponse.json(result[0]);
}
