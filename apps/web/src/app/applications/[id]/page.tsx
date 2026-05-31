"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPipeline } from "@/components/status-pipeline";
import { ApprovalActions } from "@/components/approval-actions";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  MapPin,
  Copy,
  Check,
  User,
} from "lucide-react";

interface ApplicationData {
  application: {
    id: string;
    status: string;
    coverLetter: string | null;
    recruiterMessage: string | null;
    autofillData: Record<string, string>;
    graduationDateUsed: string | null;
  };
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    jobUrl: string;
    matchScore: string | null;
    matchReasoning: string | null;
    descriptionRaw: string | null;
  };
  recruiters: {
    id: string;
    name: string;
    title: string | null;
    linkedinUrl: string | null;
    email: string | null;
  }[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const [data, setData] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/applications/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4">
        <p className="text-muted-foreground">Application not found.</p>
      </main>
    );
  }

  const { application, job, recruiters } = data;

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold truncate">{job.title}</h2>
        <Badge variant="outline" className="shrink-0">
          {application.status.replace(/_/g, " ")}
        </Badge>
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
        {job.matchScore && (
          <span className="font-mono text-primary">
            {Math.round(Number(job.matchScore))}% match
          </span>
        )}
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline ml-auto"
        >
          View Posting <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <StatusPipeline currentStatus={application.status} />

      <ApprovalActions
        applicationId={application.id}
        status={application.status}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Match Reasoning */}
          {job.matchReasoning && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Why This Matched</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {job.matchReasoning}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cover Letter */}
          {application.coverLetter && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Cover Letter</CardTitle>
                  <CopyButton text={application.coverLetter} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {application.coverLetter}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pre-filled Data */}
          {application.autofillData &&
            Object.keys(application.autofillData).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Pre-filled Application Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(application.autofillData).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between text-sm gap-4"
                      >
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-right truncate">
                          {value}
                        </span>
                      </div>
                    )
                  )}
                  {application.graduationDateUsed && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Graduation Date (tailored)
                        </span>
                        <span className="font-mono text-primary">
                          {application.graduationDateUsed}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
        </div>

        <div className="space-y-4">
          {/* Recruiter Message */}
          {application.recruiterMessage && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recruiter Message</CardTitle>
                  <CopyButton text={application.recruiterMessage} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {application.recruiterMessage}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recruiter Contacts */}
          {recruiters.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recruiter Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recruiters.map((r) => (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.name}</span>
                    </div>
                    {r.title && (
                      <p className="text-xs text-muted-foreground pl-5">
                        {r.title}
                      </p>
                    )}
                    {r.linkedinUrl && (
                      <a
                        href={r.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline pl-5 block"
                      >
                        LinkedIn Profile
                      </a>
                    )}
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="text-xs text-primary hover:underline pl-5 block"
                      >
                        {r.email}
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
