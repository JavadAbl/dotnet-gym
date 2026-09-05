"use client";

import * as React from "react";
import { ClipboardList, Search, UserPlus, X } from "lucide-react";
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
import { createCoachAssignment, listCoaches, searchMemberPackages, searchMembers } from "@/lib/gms/api";
import type { Branch, Coach, CoachAssignment, CoachListResponse, Member, MemberPackage } from "@/lib/gms/types";
import { describeError } from "./sell-package-dialog";
import { useAuth, useI18n } from "./providers";

interface AssignCoachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  presetMember?: Member | null;
  onAssigned: (assignment: CoachAssignment) => void;
}

/** Front-desk activity (admin/reception): links an active member to a coach. */
export function AssignCoachDialog({ open, onOpenChange, branches, presetMember, onAssigned }: AssignCoachDialogProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const pinnedBranchId = user.branchId ?? null;

  const [coachList, setCoachList] = React.useState<CoachListResponse | null>(null);
  const [coachId, setCoachId] = React.useState("");

  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberResults, setMemberResults] = React.useState<Member[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  // v2 — live private-coaching entitlement of the selected member (backend gate preview).
  const [privatePackage, setPrivatePackage] = React.useState<MemberPackage | null>(null);
  const [privateLoading, setPrivateLoading] = React.useState(false);

  const [branchId, setBranchId] = React.useState(pinnedBranchId ?? "");
  const [note, setNote] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCoachId("");
      setSelectedMember(presetMember ?? null);
      setMemberQuery("");
      setMemberResults([]);
      setMemberSearchOpen(false);
      setPrivatePackage(null);
      setBranchId(pinnedBranchId ?? "");
      setNote("");
      setError(null);
      listCoaches()
        .then(setCoachList)
        .catch(() => setCoachList(null));
    } else {
      setCoachList(null);
    }
     
  }, [open, presetMember]);

  // v2 — resolve the selected member's best usable private-coach package (mirrors the backend gate).
  React.useEffect(() => {
    if (!open || !selectedMember) {
      setPrivatePackage(null);
      return;
    }
    let cancelled = false;
    setPrivateLoading(true);
    searchMemberPackages({ memberId: selectedMember.id, kind: "PrivateCoaching", status: "Active", page: 1, pageSize: 20 })
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
      })
      .finally(() => {
        if (!cancelled) setPrivateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedMember]);

  // debounced member search (active members only — backend gate mirrors it)
  React.useEffect(() => {
    if (!open || presetMember) return;
    const handle = setTimeout(() => {
      const term = memberQuery.trim();
      if (term.length === 0) {
        setMemberResults([]);
        setMemberSearchOpen(false);
        return;
      }
      searchMembers({ search: term, status: "Active", page: 1, pageSize: 6 })
        .then((result) => {
          setMemberResults(result.items);
          setMemberSearchOpen(true);
        })
        .catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [memberQuery, open, presetMember]);

  async function handleSubmit() {
    if (!coachId || !selectedMember) return;
    const effectiveBranchId = pinnedBranchId ?? branchId;
    if (!effectiveBranchId) {
      setError(t("coaching.assign.branch") + " — " + t("coaching.assign.branch.pinned"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const assignment = await createCoachAssignment({
        coachId,
        memberId: selectedMember.id,
        branchId: effectiveBranchId,
        note: note.trim() || undefined,
      });
      onAssigned(assignment);
      onOpenChange(false);
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(coachId && selectedMember && (pinnedBranchId ?? branchId) && !submitting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            {t("coaching.assign.title")}
          </DialogTitle>
          <DialogDescription>{t("coaching.assign.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* coach */}
          <div className="space-y-1.5">
            <Label>{t("coaching.assign.coach")}</Label>
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger>
                <SelectValue placeholder={coachList ? t("coaching.assign.coach.placeholder") : t("common.loading")} />
              </SelectTrigger>
              <SelectContent>
                {(coachList?.items ?? []).map((coach: Coach) => (
                  <SelectItem key={coach.id} value={coach.id}>
                    {coach.displayName}
                    {coachList?.activeAssignmentCounts[coach.id] ? (
                      <span className="ms-2 text-xs text-muted-foreground">
                        · {t("coaching.kpi.activeAssignments")}: {coachList.activeAssignmentCounts[coach.id]}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
                {coachList && coachList.items.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("coaching.assign.noCoach")}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {/* member */}
          <div className="space-y-1.5">
            <Label>{t("coaching.assign.member")}</Label>
            {selectedMember ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {selectedMember.fullName.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedMember.fullName}</p>
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {selectedMember.code}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedMember(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
                <Input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder={t("coaching.assign.member.placeholder")}
                  className="ps-9"
                />
                {memberSearchOpen && memberResults.length > 0 ? (
                  <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
                    {memberResults.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-accent"
                        onClick={() => {
                          setSelectedMember(member);
                          setMemberSearchOpen(false);
                          setMemberQuery("");
                        }}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {member.fullName.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{member.fullName}</span>
                          <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                            {member.code}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {selectedMember ? (
              privateLoading ? null : privatePackage ? (
                <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                  {t("coaching.assign.privateRemaining", {
                    remaining: privatePackage.sessionsTotal - privatePackage.sessionsUsed,
                    total: privatePackage.sessionsTotal,
                  })}
                </p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {t("coaching.assign.privateNone")}
                </p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">{t("coaching.assign.member.hint")}</p>
            )}
          </div>

          {/* branch */}
          <div className="space-y-1.5">
            <Label>{t("coaching.assign.branch")}</Label>
            {pinnedBranchId ? (
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                {(() => {
                  const branch = branches.find((b) => b.id === pinnedBranchId);
                  return branch ? (locale === "fa" ? branch.nameFa : branch.nameEn) : t("coaching.assign.branch.pinned");
                })()}
              </div>
            ) : (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("coaching.assign.branch")} />
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

          {/* note */}
          <div className="space-y-1.5">
            <Label htmlFor="assign-note">{t("coaching.assign.note")}</Label>
            <Input
              id="assign-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("coaching.assign.note.placeholder")}
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
            <ClipboardList className="h-4 w-4" />
            {submitting ? t("coaching.assign.submitting") : t("coaching.assign.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
