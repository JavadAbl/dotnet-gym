"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createTrainingRecord,
  listCoaches,
  searchCoachAssignments,
  searchMemberPackages,
  searchTrainingPlans,
} from "@/lib/gms/api";
import type {
  CoachListResponse,
  CreateRecordRequest,
  MemberPackage,
  TrainingPlan,
  TrainingRecord,
} from "@/lib/gms/types";
import { describeError } from "./sell-package-dialog";
import { useAuth, useI18n } from "./providers";

interface RecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed coach context (coach role / preset from a row action); null lets admins pick. */
  fixedCoachId?: string | null;
  fixedMemberId?: string | null;
  onCreated: (record: TrainingRecord) => void;
}

interface AssignedMemberOption {
  memberId: string;
  memberName: string;
  memberCode: string;
  branchId: string;
}

/**
 * Coach craft (admin may act for any coach): logs a completed session for an assigned
 * member. Branch comes from the member's active assignment (mirrors the backend JWT pin).
 */
export function RecordDialog({ open, onOpenChange, fixedCoachId, fixedMemberId, onCreated }: RecordDialogProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const isCoachRole = user.role === "coach";
  const selfCoachId = user.id;

  const [coachList, setCoachList] = React.useState<CoachListResponse | null>(null);
  const [coachId, setCoachId] = React.useState(fixedCoachId ?? (isCoachRole ? selfCoachId : ""));
  const [members, setMembers] = React.useState<AssignedMemberOption[]>([]);
  const [memberId, setMemberId] = React.useState(fixedMemberId ?? "");
  const [membersLoading, setMembersLoading] = React.useState(false);

  const [plans, setPlans] = React.useState<TrainingPlan[]>([]);
  const [planId, setPlanId] = React.useState("none");

  // v2 — the selected member's private-coaching balance (each logged session consumes one).
  const [privatePackage, setPrivatePackage] = React.useState<MemberPackage | null>(null);

  const [summary, setSummary] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [intensity, setIntensity] = React.useState<"Low" | "Medium" | "High" | "none">("none");
  const [note, setNote] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // reset on open
  React.useEffect(() => {
    if (open) {
      setCoachId(fixedCoachId ?? (isCoachRole ? selfCoachId : ""));
      setMemberId(fixedMemberId ?? "");
      setPlanId("none");
      setSummary("");
      setDuration("");
      setIntensity("none");
      setNote("");
      setError(null);
      if (!isCoachRole && !fixedCoachId) {
        listCoaches()
          .then(setCoachList)
          .catch(() => setCoachList(null));
      }
    }
     
  }, [open, fixedCoachId, fixedMemberId]);

  // members with an ACTIVE assignment for the acting coach
  React.useEffect(() => {
    if (!open || !coachId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    searchCoachAssignments({ coachId, status: "active", page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setMembers(
          result.items.map((a) => ({
            memberId: a.memberId,
            memberName: a.memberFullName,
            memberCode: a.memberCode,
            branchId: a.branchId,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId, open]);

  // plans of the selected coach-member pair (any state — sessions may follow archived plans)
  React.useEffect(() => {
    if (!open || !coachId || !memberId) {
      setPlans([]);
      return;
    }
    let cancelled = false;
    searchTrainingPlans({ coachId, memberId, page: 1, pageSize: 100 })
      .then((result) => {
        if (!cancelled) setPlans(result.items);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId, memberId, open]);

  // v2 — private-coaching balance of the selected member (backend consumes one on save).
  React.useEffect(() => {
    if (!open || !memberId) {
      setPrivatePackage(null);
      return;
    }
    let cancelled = false;
    searchMemberPackages({ memberId, kind: "PrivateCoaching", status: "Active", page: 1, pageSize: 20 })
      .then((result) => {
        if (cancelled) return;
        const nowIso = new Date().toISOString();
        const usable = result.items
          .filter((mp) => mp.expiresAtUtc > nowIso && mp.sessionsUsed < mp.sessionsTotal)
          .sort((a, b) => (a.expiresAtUtc > b.expiresAtUtc ? 1 : -1))[0];
        setPrivatePackage(usable ?? null);
      })
      .catch(() => {
        if (!cancelled) setPrivatePackage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, open]);

  const memberExists = members.some((m) => m.memberId === memberId);
  const selectedMember = members.find((m) => m.memberId === memberId) ?? null;

  const durationRaw = duration.trim();
  const durationMinutes = durationRaw ? Number.parseInt(durationRaw, 10) : undefined;
  const durationValid =
    durationRaw === "" ||
    (durationMinutes !== undefined && !Number.isNaN(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 600);

  async function handleSubmit() {
    if (!coachId || !memberId || !memberExists || !durationValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const request: CreateRecordRequest = {
        memberId,
        summary: summary.trim(),
        durationMinutes: durationRaw ? durationMinutes : undefined,
        intensity: intensity === "none" ? undefined : intensity,
        note: note.trim() || undefined,
        // Branch of the active assignment — mirrors the backend's JWT pin for coaches.
        branchId: selectedMember?.branchId,
      };
      if (planId !== "none") request.trainingPlanId = planId;
      if (!isCoachRole) request.coachId = coachId;
      const record = await createTrainingRecord(request);
      onCreated(record);
      onOpenChange(false);
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(
    coachId && memberId && memberExists && summary.trim() && durationValid && !submitting,
  );

  const intensityLabel = (value: "Low" | "Medium" | "High") =>
    value === "Low" ? t("coaching.record.intensity.low") : value === "Medium" ? t("coaching.record.intensity.medium") : t("coaching.record.intensity.high");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-emerald-600" />
            {t("coaching.record.title")}
          </DialogTitle>
          <DialogDescription>{t("coaching.record.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* coach (admins only when not fixed) */}
          {!isCoachRole && !fixedCoachId ? (
            <div className="space-y-1.5">
              <Label>{t("coaching.plan.coach")}</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder={coachList ? t("coaching.assign.coach.placeholder") : t("common.loading")} />
                </SelectTrigger>
                <SelectContent>
                  {(coachList?.items ?? []).map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* member */}
          <div className="space-y-1.5">
            <Label>{t("coaching.record.member")}</Label>
            <Select
              value={memberExists ? memberId : ""}
              onValueChange={(value) => {
                setMemberId(value);
                setPlanId("none");
              }}
              disabled={membersLoading || members.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={membersLoading ? t("common.loading") : t("coaching.plan.member.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.memberId} value={m.memberId}>
                    {m.memberName} · <span dir="ltr">{m.memberCode}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {privatePackage ? (
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                {t("coaching.assign.privateRemaining", {
                  remaining: privatePackage.sessionsTotal - privatePackage.sessionsUsed,
                  total: privatePackage.sessionsTotal,
                })}
                {" · "}
                {t("coaching.record.privateNote")}
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {t("coaching.assign.privateNone")}
              </p>
            )}
          </div>

          {/* plan link */}
          <div className="space-y-1.5">
            <Label>{t("coaching.record.plan")}</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={plans.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={t("coaching.record.plan.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("coaching.record.plan.placeholder")}</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.title}
                    {plan.isActive ? ` · ${t("coaching.plan.active")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* summary */}
          <div className="space-y-1.5">
            <Label htmlFor="record-summary">{t("coaching.record.summary")}</Label>
            <Textarea
              id="record-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("coaching.record.summary.placeholder")}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="record-duration">{t("coaching.record.duration")}</Label>
              <Input
                id="record-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                placeholder="60"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("coaching.record.intensity")}</Label>
              <Select value={intensity} onValueChange={(value) => setIntensity(value as typeof intensity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="Low">{intensityLabel("Low")}</SelectItem>
                  <SelectItem value="Medium">{intensityLabel("Medium")}</SelectItem>
                  <SelectItem value="High">{intensityLabel("High")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="record-note">{t("coaching.record.note")}</Label>
            <Input
              id="record-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={locale === "fa" ? "…" : "…"}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("member.form.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? t("coaching.record.submitting") : t("coaching.record.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
