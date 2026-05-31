import { db } from "@/lib/db";
import { jobs, applications } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { StatsBar } from "@/components/stats-bar";
import { JobCard } from "@/components/job-card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const res = await fetch(
      `${process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"}/api/dashboard/stats`,
      { cache: "no-store" }
    );
    return res.json();
  } catch {
    return {
      totalJobs: 0,
      todayJobs: 0,
      matchedToday: 0,
      pendingApproval: 0,
      submittedToday: 0,
      totalApplied: 0,
      lastScrapeRun: null,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  // Get pending applications with their jobs
  const pendingApps = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.status, "awaiting_approval"))
    .orderBy(desc(jobs.matchScore))
    .limit(20)
    .catch(() => []);

  // Get recently applied
  const recentApplied = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.status, "submitted"))
    .orderBy(desc(applications.submittedAt))
    .limit(10)
    .catch(() => []);

  // Get latest matched jobs
  const latestJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "matched"))
    .orderBy(desc(jobs.createdAt))
    .limit(20)
    .catch(() => []);

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-6">
      <StatsBar stats={stats} />

      <Separator />

      {/* Needs Your Approval */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Needs Your Approval</h3>
          {pendingApps.length > 0 && (
            <span className="text-xs font-mono text-primary">
              {pendingApps.length} pending
            </span>
          )}
        </div>
        {pendingApps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No applications waiting for approval. Check back after the next
            scrape run.
          </p>
        ) : (
          <div className="space-y-1">
            {pendingApps.map(({ application, job }) => (
              <JobCard
                key={application.id}
                job={job}
                applicationId={application.id}
                applicationStatus={application.status}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Applied Today */}
      {recentApplied.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Recently Applied</h3>
          <div className="space-y-1">
            {recentApplied.map(({ application, job }) => (
              <JobCard
                key={application.id}
                job={job}
                applicationId={application.id}
                applicationStatus={application.status}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Matched Jobs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Matched Jobs</h3>
          <Link
            href="/jobs"
            className="text-xs text-primary hover:underline font-mono"
          >
            View all
          </Link>
        </div>
        {latestJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No matched jobs yet. The scraper will find them for you.
          </p>
        ) : (
          <div className="space-y-1">
            {latestJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
