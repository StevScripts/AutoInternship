import { db } from "@/lib/db";
import { jobs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusPipeline } from "@/components/status-pipeline";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Building2, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

  if (result.length === 0) notFound();
  const job = result[0];

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold truncate">{job.title}</h2>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building2 className="h-4 w-4" />
          {job.company}
        </span>
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {job.location}
          </span>
        )}
        {job.datePosted && (
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Posted {job.datePosted}
          </span>
        )}
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline ml-auto"
        >
          View Original <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <StatusPipeline currentStatus={job.status} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Match Reasoning */}
          {job.matchReasoning && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Match Analysis
                  {job.matchScore && (
                    <Badge variant="outline" className="font-mono">
                      {Math.round(Number(job.matchScore))}% match
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {job.matchReasoning}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {job.descriptionSummary || job.descriptionRaw || "No description available."}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Quick Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-mono">{job.jobType || "N/A"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remote</span>
                <span className="font-mono">{job.isRemote ? "Yes" : "No"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-mono">{job.source}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">ATS</span>
                <span className="font-mono">{job.atsPlatform || "Unknown"}</span>
              </div>
              {(job.salaryMin || job.salaryMax) && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Salary</span>
                    <span className="font-mono">
                      {job.salaryMin && `$${job.salaryMin.toLocaleString()}`}
                      {job.salaryMin && job.salaryMax && " - "}
                      {job.salaryMax && `$${job.salaryMax.toLocaleString()}`}
                      {job.salaryPeriod && ` / ${job.salaryPeriod}`}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
