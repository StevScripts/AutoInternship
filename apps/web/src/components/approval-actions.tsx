"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, X, Loader2 } from "lucide-react";

interface ApprovalActionsProps {
  applicationId: string;
  status: string;
}

export function ApprovalActions({
  applicationId,
  status,
}: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "skip" | null>(null);

  const canApprove =
    status === "awaiting_approval" || status === "pre_filling";

  async function handleAction(action: "approve" | "skip") {
    setLoading(action);
    try {
      await fetch(`/api/applications/${applicationId}/${action}`, {
        method: "POST",
      });
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setLoading(null);
    }
  }

  if (!canApprove) return null;

  return (
    <div className="flex items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            {loading === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve & Submit
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will queue the application for automatic submission on the
              next scraper run. Make sure you have reviewed all pre-filled
              information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAction("approve")}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => handleAction("skip")}
        disabled={loading !== null}
      >
        {loading === "skip" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4" />
        )}
        Skip
      </Button>
    </div>
  );
}
