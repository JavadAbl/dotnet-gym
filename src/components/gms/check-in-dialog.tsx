"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, LogIn, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkIn } from "@/lib/gms/api";
import type { AttendanceEntry, Branch } from "@/lib/gms/types";
import { formatNumber } from "@/lib/gms/jalali";
import { describeError } from "./sell-package-dialog";
import { useAuth, useI18n } from "./providers";

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onCheckedIn: (entry: AttendanceEntry) => void;
}

type CheckInResult =
  | { kind: "success"; entry: AttendanceEntry }
  | { kind: "error"; message: string };

/** The card-swipe gate: stays open for rapid successive swipes (reception flow). */
export function CheckInDialog({ open, onOpenChange, branches, onCheckedIn }: CheckInDialogProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const pinnedBranchId = user.branchId ?? null;

  const [cardCode, setCardCode] = React.useState("");
  const [branchId, setBranchId] = React.useState<string>(pinnedBranchId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<CheckInResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // reset the swipe box (but keep the last result visible until the dialog closes)
  React.useEffect(() => {
    if (open) {
      setCardCode("");
      const handle = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(handle);
    }
    setResult(null);
    return undefined;
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const effectiveBranchId = pinnedBranchId ?? branchId;
    if (!cardCode.trim()) {
      inputRef.current?.focus();
      return;
    }
    if (!effectiveBranchId) {
      setResult({ kind: "error", message: t("sell.error.branchRequired") });
      return;
    }

    setSubmitting(true);
    try {
      const entry = await checkIn({ cardCode: cardCode.trim(), branchId: effectiveBranchId });
      setResult({ kind: "success", entry });
      onCheckedIn(entry);
      setCardCode("");
    } catch (error) {
      setResult({ kind: "error", message: describeError(t, error) });
      setCardCode("");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-emerald-600" />
              {t("checkin.title")}
            </DialogTitle>
            <DialogDescription>{t("checkin.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="checkin-card">{t("checkin.card")}</Label>
            <Input
              id="checkin-card"
              ref={inputRef}
              value={cardCode}
              onChange={(e) => setCardCode(e.target.value)}
              placeholder={t("checkin.card.placeholder")}
              autoComplete="off"
              dir="ltr"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("checkin.branch")}</Label>
            {pinnedBranchId ? (
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                {(() => {
                  const branch = branches.find((b) => b.id === pinnedBranchId);
                  return branch ? (locale === "fa" ? branch.nameFa : branch.nameEn) : t("checkin.branch.pinned");
                })()}
              </div>
            ) : (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("attendance.filter.branch.all")} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {locale === "fa" ? branch.nameFa : branch.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {result?.kind === "success" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950" dir={locale === "fa" ? "rtl" : "ltr"}>
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <CircleCheck className="h-4 w-4" />
                {t("checkin.success.title")} · {result.entry.memberFullName}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                {locale === "fa" ? result.entry.packageNameFa : result.entry.packageNameEn}
                {" · "}
                {t("checkin.success.remaining", {
                  count: formatNumber(result.entry.sessionsRemaining ?? 0, locale),
                })}
              </p>
            </div>
          ) : null}

          {result?.kind === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
                <CircleAlert className="h-4 w-4" />
                {t("checkin.error.title")}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">{result.message}</p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{t("checkin.hint")}</p>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("checkin.close")}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <LogIn className="h-4 w-4" />
              {submitting ? t("checkin.submitting") : t("checkin.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
