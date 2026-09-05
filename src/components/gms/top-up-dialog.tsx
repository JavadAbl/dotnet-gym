"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Plus, Search, Wallet } from "lucide-react";
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
import { searchMembers, topUpWallet } from "@/lib/gms/api";
import type { Branch, Member, TopUpResponse } from "@/lib/gms/types";
import { formatToman } from "@/lib/gms/jalali";
import { StatusBadge } from "./status-badge";
import { describeError } from "./sell-package-dialog";
import { useAuth, useI18n } from "./providers";

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  presetMember: Member | null;
  onToppedUp: (response: TopUpResponse) => void;
}

const QUICK_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000];

/** Desk cash-in: credits a member's wallet and issues a TopUp receipt (Phase 5). */
export function TopUpDialog({ open, onOpenChange, branches, presetMember, onToppedUp }: TopUpDialogProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const pinnedBranchId = user.branchId ?? null;

  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberResults, setMemberResults] = React.useState<Member[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  const [branchId, setBranchId] = React.useState<string>(pinnedBranchId ?? "");
  const [amountText, setAmountText] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TopUpResponse | null>(null);

  // reset whenever the dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedMember(presetMember);
      setMemberQuery("");
      setMemberResults([]);
      setMemberSearchOpen(false);
      setBranchId(pinnedBranchId ?? "");
      setAmountText("");
      setNote("");
      setError(null);
      setResult(null);
    }
  }, [open, presetMember, pinnedBranchId]);

  // debounced member search (only when no preset member)
  React.useEffect(() => {
    if (!open || presetMember) return;
    const handle = setTimeout(() => {
      const term = memberQuery.trim();
      if (term.length === 0) {
        setMemberResults([]);
        setMemberSearchOpen(false);
        return;
      }
      searchMembers({ search: term, page: 1, pageSize: 6 })
        .then((res) => {
          setMemberResults(res.items);
          setMemberSearchOpen(true);
        })
        .catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [memberQuery, open, presetMember]);

  const amount = Number.parseInt(amountText.replace(/[^\d]/g, ""), 10);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const memberInactive = selectedMember !== null && selectedMember.status !== "Active";
  const canSubmit = selectedMember !== null && (pinnedBranchId ?? branchId) && validAmount && !memberInactive && !submitting;

  function pickMember(member: Member) {
    setSelectedMember(member);
    setMemberSearchOpen(false);
    setMemberQuery("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMember || !validAmount) return;
    const effectiveBranchId = pinnedBranchId ?? branchId;
    if (!effectiveBranchId) {
      setError(t("sell.error.branchRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await topUpWallet(selectedMember.id, {
        amountToman: amount,
        branchId: effectiveBranchId,
        note: note.trim() || undefined,
      });
      setResult(response);
      onToppedUp(response);
      setAmountText("");
      setNote("");
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              {t("wallet.topup.title")}
            </DialogTitle>
            <DialogDescription>{t("wallet.topup.description")}</DialogDescription>
          </DialogHeader>

          {/* member */}
          <div className="space-y-1.5">
            <Label>{t("sell.member")}</Label>
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedMember.status} />
                  {!presetMember ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                      ×
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
                <Input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder={t("sell.member.placeholder")}
                  className="ps-9"
                />
                {memberSearchOpen ? (
                  <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                    {memberResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">{t("sell.member.none")}</p>
                    ) : (
                      memberResults.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => pickMember(member)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-accent"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{member.fullName}</span>
                            <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                              {member.code}
                            </span>
                          </span>
                          <StatusBadge status={member.status} />
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {memberInactive ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <CircleAlert className="h-3.5 w-3.5" />
                {t("wallet.topup.activeMemberOnly")}
              </p>
            ) : null}
          </div>

          {/* branch: reception/coach pinned to their claim, admin picks explicitly (check-in pattern) */}
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
              <Select value={branchId || undefined} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("wallet.topup.branchPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter((b) => b.isActive)
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {locale === "fa" ? branch.nameFa : branch.nameEn}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* amount */}
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount">{t("wallet.topup.amount")}</Label>
            <Input
              id="topup-amount"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="2,000,000"
              inputMode="numeric"
              dir="ltr"
              className="font-mono tabular-nums"
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmountText(String(quick))}
                  className="rounded-full border px-2.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400"
                  dir="ltr"
                >
                  {quick.toLocaleString("en-US")}
                </button>
              ))}
            </div>
          </div>

          {/* note */}
          <div className="space-y-1.5">
            <Label htmlFor="topup-note">{t("wallet.topup.note")}</Label>
            <Input
              id="topup-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("wallet.topup.note.placeholder")}
              maxLength={200}
            />
          </div>

          {result ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <CircleCheck className="h-4 w-4" />
                {t("wallet.topup.success.title")}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                {t("wallet.topup.success.balance", { amount: formatToman(result.balanceToman, locale) })}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {submitting ? t("wallet.topup.submitting") : t("wallet.topup.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
