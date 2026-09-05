"use client";

import * as React from "react";
import { Ban, ClipboardList, CircleCheck, CirclePlus, Clock, CupSoda, Package, PackagePlus, Pencil, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getWalletSnapshot,
  searchAttendance,
  searchBuffetOrders,
  searchCoachAssignments,
  searchMemberPackages,
} from "@/lib/gms/api";
import type {
  AttendanceEntry,
  Branch,
  BuffetOrder,
  CoachAssignment,
  Member,
  MemberPackage,
  MemberStatus,
  WalletSnapshot,
} from "@/lib/gms/types";
import { formatDate, formatDateTime, formatNumber, formatToman } from "@/lib/gms/jalali";
import { PackageStatusBadge, StatusBadge } from "./status-badge";
import { useI18n } from "./providers";

interface MemberDetailSheetProps {
  member: Member | null;
  branches: Branch[];
  refreshSignal: number;
  onOpenChange: (open: boolean) => void;
  onEdit: (member: Member) => void;
  onSetStatus: (member: Member, status: MemberStatus) => Promise<void>;
  onSell: (member: Member) => void;
  onTopUp: (member: Member) => void;
}

function Row({ label, value, ltr = false }: { label: string; value: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm font-medium text-start ${ltr ? "font-mono tabular-nums" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

export function MemberDetailSheet({
  member,
  branches,
  refreshSignal,
  onOpenChange,
  onEdit,
  onSetStatus,
  onSell,
  onTopUp,
}: MemberDetailSheetProps) {
  const { t, locale } = useI18n();
  const [pendingStatus, setPendingStatus] = React.useState<MemberStatus | null>(null);
  const [packages, setPackages] = React.useState<MemberPackage[] | null>(null);
  const [visits, setVisits] = React.useState<AttendanceEntry[] | null>(null);
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [coach, setCoach] = React.useState<CoachAssignment | null>(null);
  const [orders, setOrders] = React.useState<BuffetOrder[] | null>(null);

  // fetch the member's purchased packages whenever the sheet opens for a member
  React.useEffect(() => {
    if (!member) {
      setPackages(null);
      setVisits(null);
      setWallet(null);
      setCoach(null);
      setOrders(null);
      return;
    }
    let cancelled = false;
    setPackages(null);
    setVisits(null);
    setWallet(null);
    setCoach(null);
    setOrders(null);
    searchMemberPackages({ memberId: member.id, page: 1, pageSize: 20 })
      .then((result) => {
        if (!cancelled) setPackages(result.items);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    searchAttendance({ memberId: member.id, page: 1, pageSize: 5 })
      .then((result) => {
        if (!cancelled) setVisits(result.items);
      })
      .catch(() => {
        if (!cancelled) setVisits([]);
      });
    getWalletSnapshot(member.id)
      .then((snapshot) => {
        if (!cancelled) setWallet(snapshot);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    // Phase 8: active coach + last buffet orders via the member-scoped public searches.
    searchCoachAssignments({ memberId: member.id, status: "active", page: 1, pageSize: 1 })
      .then((result) => {
        if (!cancelled) setCoach(result.items[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setCoach(null);
      });
    searchBuffetOrders({ memberId: member.id, page: 1, pageSize: 3 })
      .then((result) => {
        if (!cancelled) setOrders(result.items);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [member, refreshSignal]);

  const branchName = React.useMemo(() => {
    if (!member) return "—";
    const branch = branches.find((b) => b.id === member.homeBranchId);
    if (!branch) return "—";
    return locale === "fa" ? branch.nameFa : branch.nameEn;
  }, [member, branches, locale]);

  async function handleStatus(status: MemberStatus) {
    if (!member) return;
    setPendingStatus(status);
    try {
      await onSetStatus(member, status);
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <Sheet open={Boolean(member)} onOpenChange={(open) => (open ? undefined : onOpenChange(false))}>
      <SheetContent side={locale === "fa" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-md">
        {member ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="pb-0">
              <SheetTitle className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {member.fullName.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{member.fullName}</span>
                  <span className="block text-xs font-normal font-mono text-muted-foreground" dir="ltr">
                    {member.code}
                  </span>
                </span>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 pt-1">
                <StatusBadge status={member.status} />
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-4 pb-4">
              <section>
                <h4 className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("member.detail.membership")}
                </h4>
                <dl className="divide-y rounded-lg border bg-card px-3">
                  <Row label={t("member.code")} value={member.code} ltr />
                  <Row label={t("member.homeBranch")} value={branchName} />
                  <Row label={t("member.joinDate")} value={formatDate(member.joinDateUtc, locale)} />
                  <Row label={t("member.card")} value={member.cardCode ?? t("member.notes.none")} ltr />
                </dl>
              </section>

              <section>
                <h4 className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("member.detail.contact")}
                </h4>
                <dl className="divide-y rounded-lg border bg-card px-3">
                  <Row label={t("member.phone")} value={member.phoneNumber ?? t("member.notes.none")} ltr />
                  <Row label={t("member.birthDate")} value={formatDate(member.birthDateUtc, locale)} />
                  <Row label={t("members.column.gender")} value={t(`gender.${member.gender}`)} />
                </dl>
              </section>

              <section>
                <h4 className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("member.form.notes")}
                </h4>
                <p className="min-h-16 whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm">
                  {member.notes || t("member.notes.none")}
                </p>
              </section>

              <section>
                <h4 className="flex items-center justify-between pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5" />
                    {t("wallet.title")}
                  </span>
                  {member.status === "Active" ? (
                    <button
                      type="button"
                      onClick={() => onTopUp(member)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                    >
                      <CirclePlus className="h-3 w-3" />
                      {t("wallet.topup.action")}
                    </button>
                  ) : null}
                </h4>
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{t("wallet.balance")}</p>
                    {wallet === null ? (
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
                    ) : (
                      <p className="text-lg font-bold tabular-nums">
                        {formatToman(wallet.balanceToman, locale)}
                      </p>
                    )}
                  </div>
                  {wallet && wallet.recentTransactions.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t pt-2">
                      {wallet.recentTransactions.slice(0, 3).map((transaction) => (
                        <li key={transaction.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-muted-foreground">
                            {t(`wallet.kind.${transaction.kind}`)}
                          </span>
                          <span
                            className={`shrink-0 font-medium tabular-nums ${
                              transaction.amountToman > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                            dir="ltr"
                          >
                            {transaction.amountToman > 0 ? "+" : "−"}
                            {formatToman(Math.abs(transaction.amountToman), locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : wallet && !wallet.hasAccount ? (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{t("wallet.noAccount")}</p>
                  ) : null}
                </div>
              </section>

              <section>
                <h4 className="flex items-center justify-between pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" />
                    {t("member.packages.title")}
                  </span>
                  {member.status === "Active" ? (
                    <button
                      type="button"
                      onClick={() => onSell(member)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                    >
                      <PackagePlus className="h-3 w-3" />
                      {t("member.packages.sell")}
                    </button>
                  ) : null}
                </h4>
                {packages === null ? (
                  <div className="h-16 animate-pulse rounded-lg border bg-muted/40" />
                ) : packages.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                    {t("member.packages.empty")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="rounded-lg border bg-card p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {locale === "fa" ? pkg.packageNameFa : pkg.packageNameEn}
                          </p>
                          <PackageStatusBadge status={pkg.status} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {t("sales.sessions.usage", {
                              used: formatNumber(pkg.sessionsUsed, locale),
                              total: formatNumber(pkg.sessionsTotal, locale),
                            })}
                          </span>
                          <span className="tabular-nums">
                            {pkg.isExpired && pkg.status === "Active"
                              ? t("sales.expired")
                              : `${t("sales.column.expiry")}: ${formatDate(pkg.expiresAtUtc, locale)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h4 className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {t("member.coach.title")}
                </h4>
                {coach ? (
                  <div className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{coach.coachName}</p>
                      <span className="shrink-0 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        {t("coaching.status.active")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {t("coaching.column.assignedAt")}: {formatDate(coach.assignedAtUtc, locale)}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                    {t("member.coach.none")}
                  </p>
                )}
              </section>

              <section>
                <h4 className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t("attendance.tab.history")}
                </h4>
                {visits === null ? (
                  <div className="h-16 animate-pulse rounded-lg border bg-muted/40" />
                ) : visits.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                    {t("attendance.empty.title")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visits.map((visit) => (
                      <div key={visit.id} className="rounded-lg border bg-card p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {locale === "fa" ? visit.packageNameFa : visit.packageNameEn}
                          </p>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${
                              visit.isPresent ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                            }`}
                          >
                            {visit.isPresent ? t("attendance.present") : t("attendance.left")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {t("attendance.column.checkIn")}: {formatDateTime(visit.checkInAtUtc, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h4 className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CupSoda className="h-3.5 w-3.5" />
                  {t("member.buffet.title")}
                </h4>
                {orders === null ? (
                  <div className="h-16 animate-pulse rounded-lg border bg-muted/40" />
                ) : orders.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                    {t("member.buffet.empty")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div key={order.id} className="rounded-lg border bg-card p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {order.items
                              .map((item) => `${formatNumber(item.quantity, locale)}× ${locale === "fa" ? item.nameFa : item.nameEn}`)
                              .join("، ")}
                          </p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatToman(order.totalToman, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(order.createdAtUtc, locale)} · {t(`buffet.pos.payment.${order.paymentMethod.toLowerCase()}`)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2 p-4">
              <Button variant="outline" onClick={() => onEdit(member)} className="gap-1.5">
                <Pencil className="h-4 w-4" />
                {t("member.edit")}
              </Button>
              {member.status !== "Active" ? (
                <Button
                  variant="outline"
                  className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                  onClick={() => handleStatus("Active")}
                  disabled={pendingStatus !== null}
                >
                  <CircleCheck className="h-4 w-4" />
                  {t("member.activate")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-1.5 border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300"
                  onClick={() => handleStatus("Inactive")}
                  disabled={pendingStatus !== null}
                >
                  <Ban className="h-4 w-4" />
                  {t("member.deactivate")}
                </Button>
              )}
              <Button
                variant="outline"
                className="col-span-2 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:text-red-400"
                onClick={() => handleStatus("Blocked")}
                disabled={pendingStatus !== null || member.status === "Blocked"}
              >
                <Ban className="h-4 w-4" />
                {t("member.block")}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
