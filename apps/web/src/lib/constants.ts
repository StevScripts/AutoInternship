export const MATCH_SCORE_THRESHOLD = 70;

export const JOB_STATUSES = [
  "scraped",
  "scored",
  "matched",
  "skipped",
  "expired",
] as const;

export const APPLICATION_STATUSES = [
  "pre_filling",
  "awaiting_approval",
  "approved",
  "submitting",
  "submitted",
  "submission_failed",
  "recruiter_contacted",
  "responded",
  "rejected",
  "expired",
  "skipped",
] as const;

export const STATUS_PIPELINE = [
  { key: "scraped", label: "Scraped" },
  { key: "matched", label: "Matched" },
  { key: "awaiting_approval", label: "Pre-filled" },
  { key: "approved", label: "Approved" },
  { key: "submitted", label: "Submitted" },
  { key: "recruiter_contacted", label: "Contacted" },
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
