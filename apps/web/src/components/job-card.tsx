import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ExternalLink } from "lucide-react";
import type { Job } from "@/lib/schema";

function getStatusColor(status: string) {
  switch (status) {
    case "matched":
      return "bg-status-info/15 text-status-info border-status-info/30";
    case "awaiting_approval":
      return "bg-status-warning/15 text-status-warning border-status-warning/30";
    case "submitted":
      return "bg-status-success/15 text-status-success border-status-success/30";
    case "skipped":
      return "bg-status-neutral/15 text-status-neutral border-status-neutral/30";
    case "rejected":
    case "expired":
      return "bg-status-error/15 text-status-error border-status-error/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function timeAgo(dateStr: string | Date | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return "just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

interface JobCardProps {
  job: Job;
  applicationId?: string;
  applicationStatus?: string;
}

export function JobCard({ job, applicationId, applicationStatus }: JobCardProps) {
  const displayStatus = applicationStatus || job.status;
  const href = applicationId
    ? `/applications/${applicationId}`
    : `/jobs/${job.id}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-secondary transition-colors group"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{job.title}</span>
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${getStatusColor(displayStatus)}`}
          >
            {displayStatus.replace("_", " ")}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">{job.company}</span>
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          {job.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(job.createdAt)}
            </span>
          )}
        </div>
      </div>
      {job.matchScore && (
        <div className="shrink-0 text-right">
          <span className="text-sm font-mono font-semibold text-primary">
            {Math.round(Number(job.matchScore))}%
          </span>
        </div>
      )}
      <ExternalLink className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
