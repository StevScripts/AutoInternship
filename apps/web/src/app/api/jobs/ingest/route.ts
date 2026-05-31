import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { validateApiKey } from "@/lib/auth";
import { sql } from "drizzle-orm";

interface IngestJob {
  fingerprint: string;
  title: string;
  company: string;
  company_logo_url?: string;
  location?: string;
  is_remote?: boolean;
  job_url: string;
  apply_url?: string;
  ats_platform?: string;
  description_raw?: string;
  salary_min?: number;
  salary_max?: number;
  salary_period?: string;
  job_type?: string;
  date_posted?: string;
  source: string;
  source_id?: string;
  scrape_run_id?: string;
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    scrape_run_id?: string;
    jobs: IngestJob[];
  };

  if (!body.jobs || !Array.isArray(body.jobs)) {
    return NextResponse.json({ error: "Missing jobs array" }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;

  for (const j of body.jobs) {
    try {
      await db
        .insert(jobs)
        .values({
          fingerprint: j.fingerprint,
          title: j.title,
          company: j.company,
          companyLogoUrl: j.company_logo_url || null,
          location: j.location || null,
          isRemote: j.is_remote || false,
          jobUrl: j.job_url,
          applyUrl: j.apply_url || null,
          atsPlatform: j.ats_platform || null,
          descriptionRaw: j.description_raw || null,
          salaryMin: j.salary_min || null,
          salaryMax: j.salary_max || null,
          salaryPeriod: j.salary_period || null,
          jobType: j.job_type || null,
          datePosted: j.date_posted || null,
          source: j.source,
          sourceId: j.source_id || null,
          scrapeRunId: j.scrape_run_id || body.scrape_run_id || null,
        })
        .onConflictDoUpdate({
          target: jobs.fingerprint,
          set: { updatedAt: sql`now()` },
        });
      inserted++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ inserted, skipped, total: body.jobs.length });
}
