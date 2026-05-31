"use client";

import { cn } from "@/lib/utils";
import { STATUS_PIPELINE } from "@/lib/constants";

interface StatusPipelineProps {
  currentStatus: string;
}

export function StatusPipeline({ currentStatus }: StatusPipelineProps) {
  const currentIndex = STATUS_PIPELINE.findIndex(
    (s) => s.key === currentStatus
  );

  return (
    <div className="flex items-center gap-1">
      {STATUS_PIPELINE.map((step, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  isPast && "bg-status-success",
                  isCurrent && "bg-primary",
                  !isPast && !isCurrent && "bg-muted"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-mono",
                  isCurrent
                    ? "text-primary font-medium"
                    : isPast
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STATUS_PIPELINE.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 mb-4",
                  isPast ? "bg-status-success" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
