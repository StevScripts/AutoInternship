interface StatsBarProps {
  stats: {
    todayJobs: number;
    matchedToday: number;
    pendingApproval: number;
    submittedToday: number;
    totalApplied: number;
    lastScrapeRun: { startedAt: string; status: string } | null;
  };
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-card">
      <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-2xl font-semibold font-mono ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function StatsBar({ stats }: StatsBarProps) {
  const lastRun = stats.lastScrapeRun;
  const lastRunTime = lastRun
    ? new Date(lastRun.startedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <span className="text-xs text-muted-foreground font-mono">
          Last sync: {lastRunTime}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Found Today" value={stats.todayJobs} />
        <StatCard label="Matched" value={stats.matchedToday} />
        <StatCard label="Pending" value={stats.pendingApproval} accent />
        <StatCard label="Applied Today" value={stats.submittedToday} />
        <StatCard label="Total Applied" value={stats.totalApplied} />
      </div>
    </div>
  );
}
