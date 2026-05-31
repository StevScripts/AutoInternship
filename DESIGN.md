# Design

## Theme

Dark mode. Scene: a CS student checking their phone at midnight after closing their laptop lid, or glancing at a PWA during a break between classes in a dim lecture hall. The interface is a war room — status lights, queued actions, relentless forward motion. Not a cozy app, a command center.

## Color Strategy

Restrained. Tinted dark neutrals + one accent for action states.

### Palette

```
--surface-0: oklch(0.13 0.008 240)       /* deepest background — near-black, cool-blue tint */
--surface-1: oklch(0.17 0.008 240)       /* card/panel background */
--surface-2: oklch(0.22 0.007 240)       /* elevated surfaces, hover states */
--surface-3: oklch(0.28 0.006 240)       /* borders, dividers */

--text-primary: oklch(0.93 0.005 240)    /* primary text — warm off-white */
--text-secondary: oklch(0.65 0.005 240)  /* secondary labels, timestamps */
--text-tertiary: oklch(0.45 0.005 240)   /* disabled, placeholder */

--accent: oklch(0.72 0.18 165)           /* teal-green — primary actions, active states, links */
--accent-hover: oklch(0.78 0.16 165)     /* accent hover */
--accent-muted: oklch(0.30 0.06 165)     /* accent backgrounds, badges */

--status-success: oklch(0.72 0.17 155)   /* applied, confirmed */
--status-warning: oklch(0.75 0.15 75)    /* pending approval, needs review */
--status-error: oklch(0.65 0.20 25)      /* rejected, failed, expired */
--status-info: oklch(0.70 0.12 250)      /* scraped, in queue */
--status-neutral: oklch(0.50 0.01 240)   /* skipped, archived */
```

### Semantic usage
- Accent for: approve buttons, active tabs, progress indicators, links
- Status colors for: job application lifecycle (queued → matched → pre-filled → awaiting approval → submitted → responded)
- Surface layers create depth without borders where possible

## Typography

```
--font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
--font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", monospace

--text-xs: 0.75rem     /* 12px — metadata, timestamps */
--text-sm: 0.8125rem   /* 13px — secondary labels, table cells */
--text-base: 0.875rem  /* 14px — body, primary labels */
--text-lg: 1rem        /* 16px — section headers */
--text-xl: 1.25rem     /* 20px — page titles */
--text-2xl: 1.5rem     /* 24px — dashboard hero metrics */
```

Scale ratio ~1.15 (tight, dense, Linear-style). Weight contrast: 400 body, 500 labels, 600 headings. Monospace for: job IDs, company codes, status badges, counts.

## Layout

- **App shell**: fixed top bar (app name + notification bell + last sync time) + main content area. No sidebar — PWA phone-first, sidebar wastes mobile space.
- **Mobile-first**: single column, stacked cards for job listings. Swipe or tap to expand.
- **Desktop**: two-column when viewport allows — job list left, detail panel right (Linear-style split view).
- **Spacing scale**: 4px base. 8, 12, 16, 24, 32. Tight spacing overall — command center density.
- **Max content width**: 1200px on desktop. Full bleed on mobile.

## Components

### Job Card (list item)
- Company logo (tiny, 24px) + company name + role title
- Status badge (color-coded pill)
- Match score (percentage or A-F grade)
- Time since scraped (relative: "2h ago")
- Tap to expand → full detail view

### Detail View
- Job description summary (AI-generated, not full JD)
- Match reasoning ("matched on: React, TypeScript, AI experience")
- Pre-filled fields preview (what the bot filled)
- Action bar: [Approve] [Edit] [Skip]
- Recruiter info card (name, title, LinkedIn, suggested message preview)

### Status Pipeline
- Horizontal status bar or dot-stepper showing: Scraped → Matched → Pre-filled → Awaiting Approval → Submitted → Recruiter Contacted
- Current step highlighted with accent color

### Digest View (home screen)
- Today's stats: jobs found, matched, applied, pending
- Three sections: "Needs Your Approval" (urgent), "Applied Today", "All Jobs" (filterable)

## Motion

- 150ms for hover/focus transitions
- 200ms for panel open/close, card expand
- No page-load animations. Content appears instantly.
- Skeleton loading for job cards while scraping runs

## Iconography

Lucide icons. Consistent 16px stroke icons for: status, actions, navigation. No filled icons, no emoji.
