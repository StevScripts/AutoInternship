import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { JobCard } from "@/components/job-card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const allJobs = await db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(100)
    .catch(() => []);

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold">All Jobs</h2>
        <span className="text-xs font-mono text-muted-foreground">
          {allJobs.length} total
        </span>
      </div>

      {allJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No jobs scraped yet. Run the scraper to populate this list.
        </p>
      ) : (
        <div className="space-y-1">
          {allJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </main>
  );
}
