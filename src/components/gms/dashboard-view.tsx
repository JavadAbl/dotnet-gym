"use client";

import * as React from "react";
import {
  BadgeDollarSign,
  Banknote,
  CirclePlus,
  ClipboardList,
  Coffee,
  CupSoda,
  Dumbbell,
  Package,
  PackagePlus,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getBuffetSummary,
  getCoachingSummary,
  getPresence,
  getSalesSummary,
  listReceipts,
  listWalletAccounts,
  searchMembers,
} from "@/lib/gms/api";
import type {
  BuffetSummary,
  CoachingSummary,
  PresenceBoard,
  Receipt,
  SalesSummary,
} from "@/lib/gms/types";
import { formatDateTime, formatNumber, formatToman } from "@/lib/gms/jalali";
import { useAuth, useI18n } from "./providers";

interface KpiState {
  totalMembers: number | null;
  activeMembers: number | null;
  presentNow: number | null;
  visitsToday: number | null;
  activePackages: number | null;
  walletHeld: number | null;
}

interface DashboardViewProps {
  onOpenAttendance: () => void;
  onOpenBuffet: () => void;
  onOpenCoaching: () => void;
  onCreateMember: () => void;
  onSell: () => void;
  onTopUp: () => void;
}

/** Phase 8 — role-aware dashboard + reports. KPI set follows the viewer's duties. */
export function DashboardView({
  onOpenAttendance,
  onOpenBuffet,
  onOpenCoaching,
  onCreateMember,
  onSell,
  onTopUp,
}: DashboardViewProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const isManagement = user.role === "admin" || user.role === "reception";
  const isBuffet = user.role === "buffet";
  const isCoach = user.role === "coach";
  const pinnedBranchId = user.branchId ?? null;

  const [tab, setTab] = React.useState<"overview" | "reports">("overview");
  const [refreshBump, setRefreshBump] = React.useState(0);

  const [kpi, setKpi] = React.useState<KpiState | null>(null);
  const [sales, setSales] = React.useState<SalesSummary | null>(null);
  const [buffet, setBuffet] = React.useState<BuffetSummary | null>(null);
  const [coaching, setCoaching] = React.useState<CoachingSummary | null>(null);
  const [failed, setFailed] = React.useState(false);

  // ---------------------------------------------------------------- overview data (role-scoped calls)
  React.useEffect(() => {
    let cancelled = false;
    const branchArg = pinnedBranchId ?? undefined;

    async function load() {
      const [members, active, presence, salesSummary, wallet, buffetSummary, coachingSummary] =
        await Promise.allSettled([
          isCoach ? (Promise.resolve({ totalCount: null }) as Promise<{ totalCount: number | null }>) : searchMembers({ page: 1, pageSize: 1 }),
          isCoach || isBuffet
            ? (Promise.resolve({ totalCount: null }) as Promise<{ totalCount: number | null }>)
            : searchMembers({ page: 1, pageSize: 1, status: "Active" }),
          getPresence(branchArg),
          isManagement ? getSalesSummary(branchArg) : (Promise.resolve(null) as Promise<SalesSummary | null>),
          isManagement
            ? listWalletAccounts({ page: 1, pageSize: 1 })
            : (Promise.resolve(null) as Promise<{ totalBalanceToman: number } | null>),
          isCoach ? (Promise.resolve(null) as Promise<BuffetSummary | null>) : getBuffetSummary(branchArg),
          isCoach ? getCoachingSummary() : (Promise.resolve(null) as Promise<CoachingSummary | null>),
        ]);

      if (cancelled) return;

      const value = (result: PromiseSettledResult<unknown>, fallback: unknown) =>
        result.status === "fulfilled" ? result.value : fallback;

      const membersRes = value(members, { totalCount: null }) as { totalCount: number | null };
      const activeRes = value(active, { totalCount: null }) as { totalCount: number | null };
      const presenceRes = value(presence, null) as PresenceBoard | null;
      const salesRes = value(salesSummary, null) as SalesSummary | null;
      const walletRes = value(wallet, null) as { totalBalanceToman: number } | null;
      const buffetRes = value(buffetSummary, null) as BuffetSummary | null;
      const coachingRes = value(coachingSummary, null) as CoachingSummary | null;

      const anyFailed =
        members.status === "rejected" &&
        presence.status === "rejected" &&
        salesSummary.status === "rejected";

      setKpi({
        totalMembers: membersRes?.totalCount ?? null,
        activeMembers: activeRes?.totalCount ?? null,
        presentNow: presenceRes?.count ?? null,
        visitsToday: presenceRes?.visitsToday ?? null,
        activePackages: salesRes ? salesRes.activePackages : isCoach && coachingRes ? coachingRes.activeAssignments : null,
        walletHeld: walletRes ? walletRes.totalBalanceToman : null,
      });
      setSales(salesRes);
      setBuffet(buffetRes);
      setCoaching(coachingRes);
      setFailed(anyFailed);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isBuffet, isCoach, isManagement, pinnedBranchId, refreshBump]);

  // ---------------------------------------------------------------- reports data (management only)
  const [receipts, setReceipts] = React.useState<Receipt[] | null>(null);
  React.useEffect(() => {
    if (tab !== "reports" || !isManagement) return;
    let cancelled = false;
    setReceipts(null);
    listReceipts({ page: 1, pageSize: 5, branchId: pinnedBranchId ?? undefined })
      .then((result) => {
        if (!cancelled) setReceipts(result.items);
      })
      .catch(() => {
        if (!cancelled) setReceipts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, isManagement, pinnedBranchId, refreshBump]);

  // ---------------------------------------------------------------- KPI card sets (role-aware workspaces)
  const fmt = (value: number | null | undefined) =>
    value === null || value === undefined
      ? failed
        ? "—"
        : undefined // undefined ⇒ skeleton
      : formatNumber(value, locale);

  const fmtMoney = (value: number | null | undefined) =>
    value === null || value === undefined
      ? failed
        ? "—"
        : undefined
      : formatToman(value, locale);

  const primaryCards: Array<{ label: string; icon: typeof Users; value: string | undefined; tone: string }> = isCoach
    ? [
        { label: t("coaching.kpi.activeAssignments"), icon: Users, value: fmt(coaching?.activeAssignments ?? null), tone: "bg-emerald-600" },
        { label: t("coaching.kpi.activePlans"), icon: ClipboardList, value: fmt(coaching?.activePlans ?? null), tone: "bg-teal-600" },
        { label: t("coaching.kpi.records7d"), icon: Dumbbell, value: fmt(coaching?.recordsLast7Days ?? null), tone: "bg-sky-600" },
        { label: t("attendance.presentNow"), icon: ScanLine, value: fmt(kpi?.presentNow ?? null), tone: "bg-amber-600" },
      ]
    : isBuffet
      ? [
          { label: t("attendance.presentNow"), icon: ScanLine, value: fmt(kpi?.presentNow ?? null), tone: "bg-emerald-600" },
          { label: t("attendance.visitsToday"), icon: Users, value: fmt(kpi?.visitsToday ?? null), tone: "bg-teal-600" },
          { label: t("buffet.kpi.ordersToday"), icon: CupSoda, value: fmt(buffet?.ordersToday ?? null), tone: "bg-amber-600" },
          { label: t("buffet.kpi.revenueToday"), icon: ReceiptText, value: fmtMoney(buffet?.revenueTodayToman ?? null), tone: "bg-violet-600" },
        ]
      : [
          { label: t("dashboard.totalMembers"), icon: Users, value: fmt(kpi?.totalMembers ?? null), tone: "bg-emerald-600" },
          { label: t("dashboard.activeMembers"), icon: ShieldCheck, value: fmt(kpi?.activeMembers ?? null), tone: "bg-teal-600" },
          { label: t("attendance.presentNow"), icon: ScanLine, value: fmt(kpi?.presentNow ?? null), tone: "bg-amber-600" },
          { label: t("attendance.visitsToday"), icon: ReceiptText, value: fmt(kpi?.visitsToday ?? null), tone: "bg-sky-600" },
        ];

  const secondaryCards: Array<{ label: string; icon: typeof Users; value: string | undefined; tone: string }> = isCoach
    ? []
    : isBuffet
      ? [
          { label: t("buffet.kpi.cashToday"), icon: Banknote, value: fmtMoney(buffet?.cashRevenueTodayToman ?? null), tone: "bg-amber-600" },
          { label: t("buffet.kpi.walletToday"), icon: WalletIcon, value: fmtMoney(buffet?.walletRevenueTodayToman ?? null), tone: "bg-violet-600" },
        ]
      : [
          { label: t("dashboard.activePackages"), icon: Package, value: fmt(kpi?.activePackages ?? null), tone: "bg-rose-600" },
          { label: t("dashboard.revenueToday"), icon: BadgeDollarSign, value: fmtMoney(sales?.packageRevenueTodayToman ?? null), tone: "bg-emerald-600" },
          { label: t("dashboard.walletHeld"), icon: WalletIcon, value: fmtMoney(kpi?.walletHeld ?? null), tone: "bg-violet-600" },
          { label: t("buffet.kpi.revenueToday"), icon: CupSoda, value: fmtMoney(buffet?.revenueTodayToman ?? null), tone: "bg-amber-600" },
        ];

  const quickActions: Array<{ label: string; icon: typeof Users; action: () => void; primary?: boolean }> =
    isCoach
      ? [{ label: t("dashboard.qa.coaching"), icon: ClipboardList, action: onOpenCoaching, primary: true }]
      : isBuffet
        ? [{ label: t("dashboard.qa.pos"), icon: Coffee, action: onOpenBuffet, primary: true }]
        : [
            { label: t("dashboard.qa.newMember"), icon: CirclePlus, action: onCreateMember, primary: true },
            { label: t("dashboard.qa.sell"), icon: PackagePlus, action: onSell },
            { label: t("dashboard.qa.topup"), icon: WalletIcon, action: onTopUp },
            { label: t("dashboard.qa.checkin"), icon: ScanLine, action: onOpenAttendance },
            { label: t("dashboard.qa.pos"), icon: Coffee, action: onOpenBuffet },
            { label: t("dashboard.qa.coaching"), icon: ClipboardList, action: onOpenCoaching },
          ];

  const renderCard = (card: { label: string; icon: typeof Users; value: string | undefined; tone: string }) => {
    const Icon = card.icon;
    return (
      <Card key={card.label} className="py-0">
        <CardContent className="flex items-center gap-3 p-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone} text-white`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            {card.value === undefined ? (
              <Skeleton className="mb-1 h-6 w-20" />
            ) : (
              <p className="truncate text-lg font-bold tabular-nums">{card.value}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{card.label}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------- reports rows (management only)
  const reportRows: Array<{ label: string; value: string; icon: typeof Users }> = isManagement && sales
    ? [
        { label: t("attendance.visitsToday"), icon: ScanLine, value: formatNumber(kpi?.visitsToday ?? 0, locale) },
        { label: t("wallet.kind.PackagePurchase"), icon: ReceiptText, value: formatToman(sales.packageRevenueTodayToman, locale) },
        { label: t("dashboard.reports.cashShare"), icon: Banknote, value: formatToman(sales.packageRevenueCashTodayToman, locale) },
        { label: t("dashboard.reports.walletShare"), icon: WalletIcon, value: formatToman(sales.packageRevenueWalletTodayToman, locale) },
        { label: t("wallet.kind.TopUp"), icon: WalletIcon, value: formatToman(sales.topUpsTodayToman, locale) },
        { label: t("wallet.kind.PackageRefund"), icon: ReceiptText, value: formatToman(sales.refundsTodayToman, locale) },
        ...(buffet
          ? [
              { label: t("buffet.kpi.ordersToday"), icon: CupSoda, value: formatNumber(buffet.ordersToday, locale) },
              { label: t("buffet.kpi.revenueToday"), icon: CupSoda, value: formatToman(buffet.revenueTodayToman, locale) },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.welcome")} 👋</h2>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")} · {t(`role.${user.role}`)}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">{t("dashboard.tab.overview")}</TabsTrigger>
          {isManagement ? <TabsTrigger value="reports">{t("dashboard.tab.reports")}</TabsTrigger> : null}
        </TabsList>
      </Tabs>

      {tab === "overview" ? (
        <>
          {/* quick actions */}
          <div className="flex flex-wrap gap-2">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  type="button"
                  onClick={qa.action}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    qa.primary
                      ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {qa.label}
                </button>
              );
            })}
          </div>

          {failed ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {t("common.error.load")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {primaryCards.map(renderCard)}
          </div>

          {secondaryCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {secondaryCards.map(renderCard)}
            </div>
          ) : null}

          {isManagement && sales ? (
            <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              {t("dashboard.reports.monthLine", {
                revenue: formatToman(sales.packageRevenueMonthToman, locale),
                refunds: formatToman(sales.refundsMonthToman, locale),
              })}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              {t("dashboard.phaseNote")}
              <button type="button" onClick={onOpenBuffet} className="mx-1 font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
                {t("nav.buffet")}
              </button>
              <span className="mx-1">·</span>
              <button type="button" onClick={onOpenAttendance} className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
                {t("nav.attendance")}
              </button>
            </div>
          )}
        </>
      ) : null}

      {tab === "reports" && isManagement ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card">
              <p className="border-b px-4 py-3 text-sm font-semibold">{t("dashboard.reports.today")}</p>
              <ul className="divide-y px-4">
                {reportRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums" dir="auto">
                        {row.value}
                      </span>
                    </li>
                  );
                })}
                {!sales && !failed ? <Skeleton className="my-2 h-8 w-full" /> : null}
              </ul>
            </div>

            <div className="rounded-lg border bg-card">
              <p className="border-b px-4 py-3 text-sm font-semibold">{t("dashboard.reports.thisMonth")}</p>
              <ul className="divide-y px-4">
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    {t("dashboard.reports.monthRevenue")}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" dir="auto">
                    {sales ? formatToman(sales.packageRevenueMonthToman, locale) : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    {t("dashboard.reports.monthRefunds")}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" dir="auto">
                    {sales ? formatToman(sales.refundsMonthToman, locale) : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <WalletIcon className="h-4 w-4 text-muted-foreground" />
                    {t("dashboard.walletHeld")}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" dir="auto">
                    {kpi?.walletHeld !== null && kpi?.walletHeld !== undefined ? formatToman(kpi.walletHeld, locale) : "—"}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* recent receipts */}
          <div className="overflow-hidden rounded-lg border">
            <p className="border-b px-4 py-3 text-sm font-semibold">{t("dashboard.reports.recentReceipts")}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.column.member")}</TableHead>
                  <TableHead>{t("sales.column.kind")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("sales.column.method")}</TableHead>
                  <TableHead>{t("sales.column.price")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("sales.column.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts === null ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      {t("dashboard.reports.receiptsEmpty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        <p className="truncate text-sm font-medium">{receipt.memberFullName}</p>
                        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {receipt.memberCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            receipt.kind === "PackagePurchase"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                              : receipt.kind === "TopUp"
                                ? "bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
                                : receipt.kind === "BuffetPurchase"
                                  ? "bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300"
                                  : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {t(`wallet.kind.${receipt.kind}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {t(`buffet.pos.payment.${receipt.paymentMethod.toLowerCase()}`)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">
                        {formatToman(receipt.amountToman, locale)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatDateTime(receipt.createdAtUtc, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
