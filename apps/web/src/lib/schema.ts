import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── User Profile ────────────────────────────────────────────────
export const userProfile = pgTable("user_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  university: text("university").notNull(),
  degree: text("degree").notNull(),
  graduationDate: text("graduation_date").notNull(),
  gpa: numeric("gpa", { precision: 3, scale: 2 }),
  workAuth: text("work_auth").notNull().default("us_citizen"),
  willingToRelocate: boolean("willing_to_relocate").default(true),
  preferredLocations: text("preferred_locations")
    .array()
    .default(sql`'{}'`),
  skills: text("skills")
    .array()
    .notNull()
    .default(sql`'{}'`),
  rawResumeLatex: text("raw_resume_latex"),
  profileJson: jsonb("profile_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Resume Sections ─────────────────────────────────────────────
export const resumeSections = pgTable(
  "resume_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionType: text("section_type").notNull(), // experience | project | skill | education | header
    label: text("label").notNull(),
    latexContent: text("latex_content").notNull(),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'`),
    priority: integer("priority").default(50),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_resume_sections_type").on(table.sectionType),
  ]
);

// ─── Scrape Runs ─────────────────────────────────────────────────
export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("running"), // running | completed | failed | partial
    source: text("source").notNull(), // jobspy | serper | workday | nodriver
    jobsFound: integer("jobs_found").default(0),
    jobsNew: integer("jobs_new").default(0),
    jobsErrored: integer("jobs_errored").default(0),
    errorLog: text("error_log"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_scrape_runs_started").on(table.startedAt),
    index("idx_scrape_runs_status").on(table.status),
  ]
);

// ─── Jobs ────────────────────────────────────────────────────────
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Dedup
    fingerprint: text("fingerprint").notNull().unique(),

    // Core
    title: text("title").notNull(),
    company: text("company").notNull(),
    companyLogoUrl: text("company_logo_url"),
    location: text("location"),
    isRemote: boolean("is_remote").default(false),
    jobUrl: text("job_url").notNull(),
    applyUrl: text("apply_url"),
    atsPlatform: text("ats_platform"), // workday | greenhouse | lever | icims | custom

    // Details
    descriptionRaw: text("description_raw"),
    descriptionSummary: text("description_summary"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryPeriod: text("salary_period"), // hourly | monthly | yearly
    jobType: text("job_type"), // internship | co-op | new_grad | full_time

    // Dates
    datePosted: text("date_posted"),
    dateCloses: text("date_closes"),

    // Scrape metadata
    scrapeRunId: uuid("scrape_run_id").references(() => scrapeRuns.id),
    source: text("source").notNull(),
    sourceId: text("source_id"),

    // AI scoring
    matchScore: numeric("match_score", { precision: 5, scale: 2 }),
    matchReasoning: text("match_reasoning"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),

    // Lifecycle
    status: text("status").notNull().default("scraped"),
    // scraped | scored | matched | skipped | expired

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_jobs_fingerprint").on(table.fingerprint),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_created_at").on(table.createdAt),
    index("idx_jobs_company").on(table.company),
    index("idx_jobs_source").on(table.source),
  ]
);

// ─── Applications ────────────────────────────────────────────────
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" })
      .unique(),

    // Status lifecycle
    status: text("status").notNull().default("pre_filling"),
    // pre_filling | awaiting_approval | approved | submitting | submitted |
    // submission_failed | recruiter_contacted | responded | rejected | expired | skipped

    // AI content
    selectedResumeSectionIds: uuid("selected_resume_section_ids").array(),
    compiledResumeLatex: text("compiled_resume_latex"),
    compiledResumePdfUrl: text("compiled_resume_pdf_url"),
    coverLetter: text("cover_letter"),
    recruiterMessage: text("recruiter_message"),

    // Autofill snapshot
    autofillData: jsonb("autofill_data").notNull().default({}),

    // Submission tracking
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submissionScreenshotUrl: text("submission_screenshot_url"),
    submissionConfirmationId: text("submission_confirmation_id"),
    submissionError: text("submission_error"),

    // User actions
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    userNotes: text("user_notes"),

    // Graduation date used for this application
    graduationDateUsed: text("graduation_date_used"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_applications_status").on(table.status),
    index("idx_applications_job").on(table.jobId),
  ]
);

// ─── Recruiter Contacts ──────────────────────────────────────────
export const recruiterContacts = pgTable(
  "recruiter_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    title: text("title"),
    company: text("company"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    phone: text("phone"),
    source: text("source"), // linkedin_search | company_page | job_posting | manual

    // Outreach tracking
    contacted: boolean("contacted").default(false),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    contactedVia: text("contacted_via"), // linkedin | email
    response: text("response"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_recruiter_contacts_job").on(table.jobId),
  ]
);

// ─── Activity Log ────────────────────────────────────────────────
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // job | application | scrape_run
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    // scraped | scored | content_generated | approved | submitted | failed
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_activity_log_entity").on(table.entityType, table.entityId),
    index("idx_activity_log_created").on(table.createdAt),
  ]
);

// ─── Type exports ────────────────────────────────────────────────
export type UserProfile = typeof userProfile.$inferSelect;
export type NewUserProfile = typeof userProfile.$inferInsert;
export type ResumeSection = typeof resumeSections.$inferSelect;
export type NewResumeSection = typeof resumeSections.$inferInsert;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type RecruiterContact = typeof recruiterContacts.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
