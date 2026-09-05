"use client";

import * as React from "react";
import { BookOpenCheck } from "lucide-react";
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
import { createTrainingPlan, listCoaches, searchCoachAssignments } from "@/lib/gms/api";
import type { CoachListResponse, CreatePlanRequest, TrainingPlan } from "@/lib/gms/types";
import { describeError } from "./sell-package-dialog";
import { useAuth, useI18n } from "./providers";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed coach context (coach role / preset from a row action); null lets admins pick. */
  fixedCoachId?: string | null;
  fixedMemberId?: string | null;
  onCreated: (plan: TrainingPlan) => void;
}

interface AssignedMemberOption {
  memberId: string;
  memberName: string;
  memberCode: string;
  branchId: string;
}

/**
 * Coach craft (admin may act for any coach): writes a plan for an assigned member.
 * The backend archives the author's previous active plan for the pair automatically.
 */
export function PlanDialog({ open, onOpenChange, fixedCoachId, fixedMemberId, onCreated }: PlanDialogProps) {
  const { t } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const isCoachRole = user.role === "coach";
  const selfCoachId = user.id;

  const [coachList, setCoachList] = React.useState<CoachListResponse | null>(null);
  const [coachId, setCoachId] = React.useState(fixedCoachId ?? (isCoachRole ? selfCoachId : ""));
  const [members, setMembers] = React.useState<AssignedMemberOption[]>([]);
  const [memberId, setMemberId] = React.useState(fixedMemberId ?? "");
  const [membersLoading, setMembersLoading] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [content, setContent] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // reset on open
  React.useEffect(() => {
    if (open) {
      setCoachId(fixedCoachId ?? (isCoachRole ? selfCoachId : ""));
      setMemberId(fixedMemberId ?? "");
      setTitle("");
      setGoal("");
      setContent("");
      setError(null);
      if (!isCoachRole && !fixedCoachId) {
        listCoaches()
          .then(setCoachList)
          .catch(() => setCoachList(null));
      }
    }
     
  }, [open, fixedCoachId, fixedMemberId]);

  // members with an ACTIVE assignment for the acting coach (backend gate mirrors it)
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

  const memberExists = members.some((m) => m.memberId === memberId);

  async function handleSubmit() {
    if (!coachId || !memberId) return;
    setSubmitting(true);
    setError(null);
    try {
      const request: CreatePlanRequest = {
        memberId,
        title: title.trim(),
        goal: goal.trim() || undefined,
        content: content,
      };
      if (!isCoachRole) request.coachId = coachId;
      const plan = await createTrainingPlan(request);
      onCreated(plan);
      onOpenChange(false);
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(coachId && memberId && memberExists && title.trim() && content.trim() && !submitting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-emerald-600" />
            {t("coaching.plan.title")}
          </DialogTitle>
          <DialogDescription>{t("coaching.plan.description")}</DialogDescription>
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

          {/* member (active assignments of the acting coach) */}
          <div className="space-y-1.5">
            <Label>{t("coaching.plan.member")}</Label>
            <Select
              value={memberExists ? memberId : ""}
              onValueChange={setMemberId}
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
            <p className="text-xs text-muted-foreground">{t("coaching.plan.member.hint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-title">{t("coaching.plan.name")}</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("coaching.plan.name.placeholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-goal">{t("coaching.plan.goal")}</Label>
            <Input
              id="plan-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("coaching.plan.goal.placeholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-content">{t("coaching.plan.content")}</Label>
            <Textarea
              id="plan-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("coaching.plan.content.placeholder")}
              rows={7}
              className="min-h-32"
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
            {submitting ? t("coaching.plan.submitting") : t("coaching.plan.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only plan content viewer (pre-wrap). */
export function PlanContentDialog({
  plan,
  onOpenChange,
}: {
  plan: TrainingPlan | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={plan !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-emerald-600" />
            {plan?.title}
          </DialogTitle>
          {plan?.goal ? <DialogDescription>{plan.goal}</DialogDescription> : null}
        </DialogHeader>
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed" dir="auto">
          {plan?.content}
        </pre>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("checkin.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
