"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Search,
  Snowflake,
  RotateCcw,
  Sun,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  freezeMemberPackage,
  listReceipts,
  searchMemberPackages,
  unfreezeMemberPackage,
} from "@/lib/gms/api";
import { toast } from "sonner";
import type { Branch, MemberPackage, MemberPackageStatus, Receipt } from "@/lib/gms/types";
import { formatDate, formatDateTime, formatNumber, formatToman } from "@/lib/gms/jalali";
import type { Locale } from "@/lib/gms/i18n";
import { PackageStatusBadge } from "./status-badge";
import { describeError } from "./sell-package-dialog";
import { useI18n } from "./providers";

export interface SalesViewProps {
  branches: Branch[];
  onSell: () => void;
  onRefund: (memberPackage: MemberPackage) => void;
  refreshSignal: number;
}

const PAGE_SIZE = 10;

export function SalesView({ branches, onSell, onRefund, refreshSignal }: SalesViewProps) {
  const { t, locale } = useI18n();

  const [tab, setTab] = React.useState<"packages" | "receipts">("packages");
  const [refreshBump, setRefreshBump] = React.useState(0);

  // package filters
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<MemberPackageStatus | "">("");
  const [branchId, setBranchId] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [packages, setPackages] = React.useState<MemberPackage[] | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // receipts
  const [receiptKind, setReceiptKind] = React.useState<string>("all");
  const [receiptPage, setReceiptPage] = React.useState(1);
  const [receipts, setReceipts] = React.useState<Receipt[] | null>(null);
  const [receiptCount, setReceiptCount] = React.useState(0);
  const [receiptsLoading, setReceiptsLoading] = React.useState(false);
  const [receiptError, setReceiptError] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchMemberPackages({
      search: search || undefined,
      status: status || undefined,
      branchId: branchId === "all" ? undefined : branchId,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setPackages(result.items);
        setTotalCount(result.totalCount);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setPackages([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, status, branchId, page, refreshSignal, refreshBump]);

  React.useEffect(() => {
    if (tab !== "receipts") return;
    let cancelled = false;
    setReceiptsLoading(true);
    listReceipts({
      branchId: branchId === "all" ? undefined : branchId,
      kind: receiptKind === "all" ? undefined : receiptKind,
      page: receiptPage,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setReceipts(result.items);
        setReceiptCount(result.totalCount);
        setReceiptError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setReceiptError(true);
          setReceipts([]);
          setReceiptCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setReceiptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, branchId, receiptKind, receiptPage, refreshSignal, refreshBump]);

  const branchName = React.useCallback(
    (id: string) => {
      const branch = branches.find((b) => b.id === id);
      if (!branch) return "—";
      return locale === "fa" ? branch.nameFa : branch.nameEn;
    },
    [branches, locale],
  );

  async function handleFreeze(pkg: MemberPackage) {
    setBusyId(pkg.id);
    try {
      await freezeMemberPackage(pkg.id);
      toast.success(t("sales.frozen"));
      setPage(1);
      setRefreshBump((n) => n + 1);
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnfreeze(pkg: MemberPackage) {
    setBusyId(pkg.id);
    try {
      await unfreezeMemberPackage(pkg.id);
      toast.success(t("sales.unfrozen"));
      setPage(1);
      setRefreshBump((n) => n + 1);
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setBusyId(null);
    }
  }

  const packageTotalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const receiptTotalPages = Math.max(1, Math.ceil(receiptCount / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("sales.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("sales.subtitle")}</p>
        </div>
        <Button onClick={onSell} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <PackagePlus className="h-4 w-4" />
          {t("sales.new")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "packages" | "receipts")}>
        <TabsList>
          <TabsTrigger value="packages" className="gap-1.5">
            <PackageCheck className="h-3.5 w-3.5" />
            {t("sales.tab.packages")}
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-1.5">
            <ReceiptText className="h-3.5 w-3.5" />
            {t("sales.tab.receipts")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("sales.filter.search")}
            className="ps-9"
          />
        </div>
        <div className="flex gap-2">
          {tab === "packages" ? (
            <Select
              value={status || "all"}
              onValueChange={(value) => {
                setStatus(value === "all" ? "" : (value as MemberPackageStatus));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder={t("sales.filter.status.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("sales.filter.status.all")}</SelectItem>
                <SelectItem value="Active">{t("pkg.status.Active")}</SelectItem>
                <SelectItem value="Frozen">{t("pkg.status.Frozen")}</SelectItem>
                <SelectItem value="Refunded">{t("pkg.status.Refunded")}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={receiptKind}
              onValueChange={(value) => {
                setReceiptKind(value);
                setReceiptPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder={t("sales.filter.kind.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("sales.filter.kind.all")}</SelectItem>
                <SelectItem value="PackagePurchase">{t("wallet.kind.PackagePurchase")}</SelectItem>
                <SelectItem value="PackageRefund">{t("wallet.kind.PackageRefund")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select
            value={branchId}
            onValueChange={(value) => {
              setBranchId(value);
              setPage(1);
              setReceiptPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("sales.filter.branch.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("sales.filter.branch.all")}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {locale === "fa" ? branch.nameFa : branch.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tab === "packages" ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("sales.column.member")}</TableHead>
                  <TableHead>{t("sales.column.package")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("sales.column.branch")}</TableHead>
                  <TableHead>{t("sales.column.sessions")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("sales.column.expiry")}</TableHead>
                  <TableHead>{t("sales.column.status")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !packages ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !packages || packages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="font-medium">{t("sales.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("sales.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  packages.map((pkg) => (
                    <PackageRow
                      key={pkg.id}
                      pkg={pkg}
                      locale={locale}
                      branchName={branchName(pkg.branchId)}
                      busy={busyId === pkg.id}
                      onFreeze={handleFreeze}
                      onUnfreeze={handleUnfreeze}
                      onRefund={onRefund}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {packages
                ? t("sales.count", { count: formatNumber(totalCount, locale) })
                : t("common.loading")}
            </p>
            <Pager
              page={page}
              totalPages={packageTotalPages}
              disabled={loading}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(packageTotalPages, p + 1))}
              labelPage={t("common.page", {
                page: formatNumber(page, locale),
                total: formatNumber(packageTotalPages, locale),
              })}
              t={t}
            />
          </div>

          {loadError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
              {t("common.error.load")}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="hidden md:table-cell">{t("sales.column.date")}</TableHead>
                  <TableHead>{t("sales.column.member")}</TableHead>
                  <TableHead>{t("sales.column.kind")}</TableHead>
                  <TableHead>{t("sales.column.method")}</TableHead>
                  <TableHead>{t("sales.column.price")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("sales.column.package")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptsLoading && !receipts ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !receipts || receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <p className="font-medium">{t("sales.receipts.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("sales.receipts.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {formatDateTime(receipt.createdAtUtc, locale)}
                      </TableCell>
                      <TableCell>
                        <p className="truncate font-medium">{receipt.memberFullName}</p>
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
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {receipt.kind === "PackagePurchase"
                            ? t("wallet.kind.PackagePurchase")
                            : t("wallet.kind.PackageRefund")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {receipt.paymentMethod === "Wallet"
                          ? t("sell.payment.wallet")
                          : t("sell.payment.cash")}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatToman(receipt.amountToman, locale)}</TableCell>
                      <TableCell className="hidden max-w-48 truncate lg:table-cell">
                        {locale === "fa" ? receipt.packageNameFa : receipt.packageNameEn}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {receipts
                ? t("sales.receipts.count", { count: formatNumber(receiptCount, locale) })
                : t("common.loading")}
            </p>
            <Pager
              page={receiptPage}
              totalPages={receiptTotalPages}
              disabled={receiptsLoading}
              onPrev={() => setReceiptPage((p) => Math.max(1, p - 1))}
              onNext={() => setReceiptPage((p) => Math.min(receiptTotalPages, p + 1))}
              labelPage={t("common.page", {
                page: formatNumber(receiptPage, locale),
                total: formatNumber(receiptTotalPages, locale),
              })}
              t={t}
            />
          </div>

          {receiptError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
              {t("common.error.load")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PackageRow({
  pkg,
  locale,
  branchName,
  busy,
  onFreeze,
  onUnfreeze,
  onRefund,
}: {
  pkg: MemberPackage;
  locale: Locale;
  branchName: string;
  busy: boolean;
  onFreeze: (pkg: MemberPackage) => void;
  onUnfreeze: (pkg: MemberPackage) => void;
  onRefund: (pkg: MemberPackage) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const packageName = locale === "fa" ? pkg.packageNameFa : pkg.packageNameEn;
  const canFreeze = pkg.status === "Active" && !pkg.isExpired;
  const canUnfreeze = pkg.status === "Frozen";
  const canRefund = pkg.status === "Active" || pkg.status === "Frozen";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            {pkg.memberFullName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{pkg.memberFullName}</p>
            <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
              {pkg.memberCode}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="max-w-44 truncate font-medium">{packageName}</p>
        <p className="tabular-nums text-xs text-muted-foreground">{formatToman(pkg.pricePaidToman, locale)}</p>
      </TableCell>
      <TableCell className="hidden lg:table-cell">{branchName}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${pkg.sessionsTotal > 0 ? Math.min(100, (pkg.sessionsUsed / pkg.sessionsTotal) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {t("sales.sessions.usage", {
              used: formatNumber(pkg.sessionsUsed, locale),
              total: formatNumber(pkg.sessionsTotal, locale),
            })}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatDate(pkg.expiresAtUtc, locale)}</span>
          {pkg.isExpired && pkg.status === "Active" ? (
            <Badge variant="outline" className="text-[10px] text-destructive">
              {t("sales.expired")}
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <PackageStatusBadge status={pkg.status} />
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <div className="relative flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t("sales.column.actions")}
            disabled={busy || (!canFreeze && !canUnfreeze && !canRefund)}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Ellipsis className="h-4 w-4" />
          </Button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute z-40 mt-9 w-40 overflow-hidden rounded-lg border bg-popover p-1 shadow-md">
                {canFreeze ? (
                  <MenuButton
                    icon={<Snowflake className="h-3.5 w-3.5" />}
                    label={t("sales.action.freeze")}
                    onClick={() => {
                      setMenuOpen(false);
                      onFreeze(pkg);
                    }}
                  />
                ) : null}
                {canUnfreeze ? (
                  <MenuButton
                    icon={<Sun className="h-3.5 w-3.5" />}
                    label={t("sales.action.unfreeze")}
                    onClick={() => {
                      setMenuOpen(false);
                      onUnfreeze(pkg);
                    }}
                  />
                ) : null}
                {canRefund ? (
                  <MenuButton
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    label={t("sales.action.refund")}
                    destructive
                    onClick={() => {
                      setMenuOpen(false);
                      onRefund(pkg);
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
        destructive ? "text-red-700 focus:text-red-700 dark:text-red-400" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Pager({
  page,
  totalPages,
  disabled,
  onPrev,
  onNext,
  labelPage,
  t,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  labelPage: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1 || disabled} onClick={onPrev}>
        <ChevronRight className="h-4 w-4 rtl:hidden" />
        <ChevronLeft className="h-4 w-4 ltr:hidden" />
        <span className="sr-only">{t("common.prev")}</span>
      </Button>
      <span className="min-w-20 text-center text-xs text-muted-foreground">{labelPage}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages || disabled} onClick={onNext}>
        <ChevronLeft className="h-4 w-4 rtl:hidden" />
        <ChevronRight className="h-4 w-4 ltr:hidden" />
        <span className="sr-only">{t("common.next")}</span>
      </Button>
    </div>
  );
}
