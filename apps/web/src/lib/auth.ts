import { NextRequest, NextResponse } from "next/server";

export function validateApiKey(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.AUTOINTERNSHIP_API_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      { error: "Server misconfigured: no API key set" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
