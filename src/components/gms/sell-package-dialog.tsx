"use client";

import * as React from "react";
import { CircleAlert, Search, Wallet } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWalletSnapshot, purchaseMemberPackage, searchMembers } from "@/lib/gms/api";
import { GmsApiError } from "@/lib/gms/demo-store";
import type {
  Branch,
  ExercisePackage,
  Member,
  MemberPackage,
  PackageKind,
  PaymentMethod,
  WalletSnapshot,
} from "@/lib/gms/types";
import { formatToman } from "@/lib/gms/jalali";
import { StatusBadge } from "./status-badge";
import { PackageKindBadge } from "./packages-view";
import { useI18n } from "./providers";

interface SellPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  packages: ExercisePackage[];
  presetMember: Member | null;
  onSold: (memberPackage: MemberPackage) => void;
}

/** Maps ProblemDetails errorCodes to localized toast text. */
export function describeError(t: (key: string) => string, error: unknown): string {
  if (error instanceof GmsApiError) {
    const localized = t(`errors.${error.errorCode}`);
    if (localized !== `errors.${error.errorCode}`) return localized;
    return error.message;
  }
  return t("common.error.save");
}

export function SellPackageDialog({
  open,
  onOpenChange,
  branches,
  packages,
  presetMember,
  onSold,
}: SellPackageDialogProps) {
  const { t, locale } = useI18n();

  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberResults, setMemberResults] = React.useState<Member[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);

  const [branchId, setBranchId] = React.useState("");
  const [packageId, setPackageId] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<PackageKind | "all">("all");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("Cash");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // reset whenever the dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedMember(presetMember);
      setMemberQuery("");
      setMemberResults([]);
      setMemberSearchOpen(false);
      setWallet(null);
      setBranchId("");
      setPackageId("");
      setKindFilter("all");
      setPaymentMethod("Cash");
      setError(null);
    }
  }, [open, presetMember]);

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
        .then((result) => {
          setMemberResults(result.items);
          setMemberSearchOpen(true);
        })
        .catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [memberQuery, open, presetMember]);

  // wallet balance for the selected member
  React.useEffect(() => {
    if (!selectedMember) {
      setWallet(null);
      return;
    }
    let cancelled = false;
    getWalletSnapshot(selectedMember.id)
      .then((snapshot) => {
        if (!cancelled) setWallet(snapshot);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMember]);

  const availablePackages = React.useMemo(
    () =>
      packages.filter(
        (p) =>
          p.isActive &&
          branchId &&
          p.branchIds.includes(branchId) &&
          (kindFilter === "all" || p.kind === kindFilter),
      ),
    [packages, branchId, kindFilter],
  );

  const selectedPackage = packages.find((p) => p.id === packageId) ?? null;
  const walletShort =
    paymentMethod === "Wallet" && selectedPackage
      ? (wallet?.balanceToman ?? 0) < selectedPackage.priceToman
      : false;
  const memberInactive = selectedMember !== null && selectedMember.status !== "Active";
  const canSubmit =
    selectedMember !== null && branchId && selectedPackage && !walletShort && !memberInactive && !submitting;

  function pickMember(member: Member) {
    setSelectedMember(member);
    setMemberSearchOpen(false);
    setMemberQuery("");
  }

  async function handleSubmit() {
    if (!selectedMember || !selectedPackage || !branchId) return;
    setSubmitting(true);
    setError(null);
    try {
      const sold = await purchaseMemberPackage({
        memberId: selectedMember.id,
        packageId: selectedPackage.id,
        branchId,
        paymentMethod,
      });
      onSold(sold);
      onOpenChange(false);
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const packageName = (p: ExercisePackage) => (locale === "fa" ? p.nameFa : p.nameEn);
  const branchName = (b: Branch) => (locale === "fa" ? b.nameFa : b.nameEn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sell.title")}</DialogTitle>
          <DialogDescription>{t("sell.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
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
                {t("sell.member.activeMemberOnly")}
              </p>
            ) : null}
          </div>

          {/* branch */}
          <div className="space-y-1.5">
            <Label>{t("sell.branch")}</Label>
            <Select
              value={branchId || undefined}
              onValueChange={(value) => {
                setBranchId(value);
                setPackageId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("sell.error.branchRequired")} />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter((b) => b.isActive)
                  .map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branchName(branch)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* package — v2: kind filter chips (Exercise vs Private coaching) */}
          <div className="space-y-1.5">
            <Label>{t("sell.package")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all", t("packages.filter.all")],
                ["Exercise", t("packages.kind.exercise")],
                ["PrivateCoaching", t("packages.kind.private")],
              ] as Array<[PackageKind | "all", string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setKindFilter(value);
                    setPackageId("");
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    kindFilter === value
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select
              value={packageId || undefined}
              onValueChange={setPackageId}
              disabled={!branchId || availablePackages.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !branchId
                      ? t("sell.package.placeholder")
                      : availablePackages.length === 0
                        ? t("sell.package.none")
                        : t("sell.package")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availablePackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {packageName(pkg)}
                    {pkg.kind === "PrivateCoaching" ? ` · ${t("packages.kind.private")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* payment method */}
          <div className="space-y-1.5">
            <Label>{t("sell.payment")}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              className="grid grid-cols-2 gap-2"
            >
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  paymentMethod === "Cash" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : ""
                }`}
              >
                <RadioGroupItem value="Cash" />
                {t("sell.payment.cash")}
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  paymentMethod === "Wallet" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : ""
                }`}
              >
                <RadioGroupItem value="Wallet" />
                <Wallet className="h-4 w-4" />
                {t("sell.payment.wallet")}
              </label>
            </RadioGroup>
            {paymentMethod === "Wallet" ? (
              wallet ? (
                <p className={`text-xs ${walletShort ? "text-destructive" : "text-muted-foreground"}`}>
                  {t("sell.walletBalance", { amount: formatToman(wallet.balanceToman, locale) })}
                  {walletShort ? ` · ${t("sell.walletInsufficient")}` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("wallet.noAccount")}</p>
              )
            ) : null}
          </div>

          {/* summary */}
          {selectedPackage ? (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <PackageKindBadge kind={selectedPackage.kind} />
                  {t("sell.summary.sessions", {
                    sessions: formatNumberSafe(selectedPackage.sessionsCount, locale),
                    days: formatNumberSafe(selectedPackage.durationDays, locale),
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{t("sell.summary.price")}</span>
                <span className="tabular-nums">{formatToman(selectedPackage.priceToman, locale)}</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("member.form.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? t("sell.submitting") : t("sell.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatNumberSafe(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(value);
}
