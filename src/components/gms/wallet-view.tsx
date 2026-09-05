"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListOrdered,
  Plus,
  Search,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import { listWalletAccounts, listWalletTransactions } from "@/lib/gms/api";
import type {
  Branch,
  TopUpResponse,
  WalletAccountRow,
  WalletAccountsPage,
  WalletTransaction,
} from "@/lib/gms/types";
import { formatDateTime, formatNumber, formatToman } from "@/lib/gms/jalali";
import type { Locale } from "@/lib/gms/i18n";
import { TopUpDialog } from "./top-up-dialog";
import { useI18n } from "./providers";

export interface WalletViewProps {
  branches: Branch[];
  refreshSignal: number;
}

const PAGE_SIZE = 10;

const LEDGER_KINDS: Array<WalletTransaction["kind"]> = [
  "TopUp",
  "PackagePurchase",
  "PackageRefund",
  "BuffetPurchase",
];

export function WalletView({ branches, refreshSignal }: WalletViewProps) {
  const { t, locale } = useI18n();

  const [tab, setTab] = React.useState<"accounts" | "ledger">("accounts");
  const [refreshBump, setRefreshBump] = React.useState(0);
  const [topupOpen, setTopupOpen] = React.useState(false);

  // ---------------------------------------------------------------- accounts
  const [accountSearchInput, setAccountSearchInput] = React.useState("");
  const [accountSearch, setAccountSearch] = React.useState("");
  const [accountPage, setAccountPage] = React.useState(1);
  const [accounts, setAccounts] = React.useState<WalletAccountsPage | null>(null);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [accountsError, setAccountsError] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setAccountSearch(accountSearchInput.trim());
      setAccountPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [accountSearchInput]);

  React.useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    listWalletAccounts({ search: accountSearch || undefined, page: accountPage, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setAccounts(result);
        setAccountsError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAccountsError(true);
          setAccounts(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountSearch, accountPage, refreshBump, refreshSignal]);

  // ---------------------------------------------------------------- ledger
  const [ledgerMember, setLedgerMember] = React.useState<WalletAccountRow | null>(null);
  const [ledgerKind, setLedgerKind] = React.useState<string>("all");
  const [ledgerPage, setLedgerPage] = React.useState(1);
  const [transactions, setTransactions] = React.useState<WalletTransaction[] | null>(null);
  const [ledgerTotalCount, setLedgerTotalCount] = React.useState(0);
  const [ledgerLoading, setLedgerLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ledgerMember) {
      setTransactions(null);
      setLedgerTotalCount(0);
      return;
    }
    let cancelled = false;
    setLedgerLoading(true);
    listWalletTransactions(ledgerMember.memberId, {
      kind: ledgerKind === "all" ? undefined : (ledgerKind as WalletTransaction["kind"]),
      page: ledgerPage,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setTransactions(result.items);
        setLedgerTotalCount(result.totalCount);
      })
      .catch(() => {
        if (!cancelled) {
          setTransactions([]);
          setLedgerTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ledgerMember, ledgerKind, ledgerPage, refreshBump, refreshSignal]);

  function openLedger(account: WalletAccountRow) {
    setLedgerMember(account);
    setLedgerKind("all");
    setLedgerPage(1);
    setTab("ledger");
  }

  function handleToppedUp(response: TopUpResponse) {
    toast.success(t("wallet.topup.success.toast"));
    setRefreshBump((n) => n + 1);
    // Reflect the fresh state in the ledger tab if it is open for the same member.
    if (ledgerMember && ledgerMember.memberId === response.memberId) {
      setLedgerMember({ ...ledgerMember });
    }
  }

  const accountTotalPages = Math.max(1, Math.ceil((accounts?.totalCount ?? 0) / PAGE_SIZE));
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerTotalCount / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("wallet.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("wallet.subtitle")}</p>
        </div>
        <Button
          onClick={() => setTopupOpen(true)}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("wallet.topup.action")}
        </Button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {t("wallet.stat.accounts")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {accountsLoading && !accounts ? "—" : formatNumber(accounts?.totalCount ?? 0, locale)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WalletIcon className="h-3.5 w-3.5" />
            {t("wallet.stat.totalBalance")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {accountsLoading && !accounts ? "—" : formatToman(accounts?.totalBalanceToman ?? 0, locale)}
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as "accounts" | "ledger");
          if (value === "accounts") setAccountPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="accounts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t("wallet.tab.accounts")}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            {t("wallet.tab.ledger")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "accounts" ? (
        <>
          {/* toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
              <Input
                value={accountSearchInput}
                onChange={(e) => setAccountSearchInput(e.target.value)}
                placeholder={t("wallet.filter.search")}
                className="ps-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("wallet.column.member")}</TableHead>
                  <TableHead>{t("wallet.column.balance")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("wallet.column.lastActivity")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsLoading && !accounts ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !accounts || accounts.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center">
                      <p className="font-medium">{t("wallet.accounts.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("wallet.accounts.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.items.map((account) => (
                    <TableRow key={account.memberId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {account.memberFullName.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{account.memberFullName}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                              {account.memberCode}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatToman(account.balanceToman, locale)}
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {account.lastActivityAtUtc ? formatDateTime(account.lastActivityAtUtc, locale) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openLedger(account)}
                          >
                            <ListOrdered className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t("wallet.action.viewLedger")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {accounts
                ? t("wallet.accounts.count", { count: formatNumber(accounts.totalCount, locale) })
                : t("common.loading")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={accountPage <= 1 || accountsLoading}
                onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight className="h-4 w-4 rtl:hidden" />
                <ChevronLeft className="h-4 w-4 ltr:hidden" />
                <span className="sr-only">{t("common.prev")}</span>
              </Button>
              <span className="min-w-20 text-center text-xs text-muted-foreground">
                {t("common.page", {
                  page: formatNumber(accountPage, locale),
                  total: formatNumber(accountTotalPages, locale),
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={accountPage >= accountTotalPages || accountsLoading}
                onClick={() => setAccountPage((p) => Math.min(accountTotalPages, p + 1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:hidden" />
                <ChevronRight className="h-4 w-4 ltr:hidden" />
                <span className="sr-only">{t("common.next")}</span>
              </Button>
            </div>
          </div>

          {accountsError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
              {t("common.error.load")}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {/* ledger toolbar: member chip + kind filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {ledgerMember ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {ledgerMember.memberFullName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ledgerMember.memberFullName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {ledgerMember.memberCode}
                  </p>
                </div>
                <span className="ms-auto shrink-0 text-sm font-semibold tabular-nums">
                  {formatToman(ledgerMember.balanceToman, locale)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setLedgerMember(null)}>
                  ×
                </Button>
              </div>
            ) : (
              <p className="flex-1 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                {t("wallet.ledger.pickMember")}
              </p>
            )}
            <Select
              value={ledgerKind}
              onValueChange={(value) => {
                setLedgerKind(value);
                setLedgerPage(1);
              }}
              disabled={!ledgerMember}
            >
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder={t("wallet.filter.kind.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("wallet.filter.kind.all")}</SelectItem>
                {LEDGER_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t(`wallet.kind.${kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="hidden md:table-cell">{t("wallet.column.date")}</TableHead>
                  <TableHead>{t("wallet.column.kind")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("wallet.column.note")}</TableHead>
                  <TableHead>{t("wallet.column.amount")}</TableHead>
                  <TableHead>{t("wallet.column.balanceAfter")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!ledgerMember ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <p className="font-medium">{t("wallet.ledger.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("wallet.ledger.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : ledgerLoading && !transactions ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !transactions || transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <p className="font-medium">{t("wallet.ledger.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("wallet.ledger.noRows.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <LedgerRow key={transaction.id} transaction={transaction} locale={locale} t={t} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {ledgerMember ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {transactions
                  ? t("wallet.ledger.count", { count: formatNumber(ledgerTotalCount, locale) })
                  : t("common.loading")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage <= 1 || ledgerLoading}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="h-4 w-4 rtl:hidden" />
                  <ChevronLeft className="h-4 w-4 ltr:hidden" />
                  <span className="sr-only">{t("common.prev")}</span>
                </Button>
                <span className="min-w-20 text-center text-xs text-muted-foreground">
                  {t("common.page", {
                    page: formatNumber(ledgerPage, locale),
                    total: formatNumber(ledgerTotalPages, locale),
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage >= ledgerTotalPages || ledgerLoading}
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                >
                  <ChevronLeft className="h-4 w-4 rtl:hidden" />
                  <ChevronRight className="h-4 w-4 ltr:hidden" />
                  <span className="sr-only">{t("common.next")}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <TopUpDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        branches={branches}
        presetMember={null}
        onToppedUp={handleToppedUp}
      />
    </div>
  );
}

function LedgerRow({
  transaction,
  locale,
  t,
}: {
  transaction: WalletTransaction;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const credit = transaction.amountToman > 0;
  return (
    <TableRow>
      <TableCell className="hidden tabular-nums md:table-cell">
        {formatDateTime(transaction.createdAtUtc, locale)}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            transaction.kind === "TopUp"
              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
              : transaction.kind === "PackageRefund"
                ? "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
          }
        >
          {t(`wallet.kind.${transaction.kind}`)}
        </Badge>
      </TableCell>
      <TableCell className="hidden max-w-48 truncate text-muted-foreground lg:table-cell">
        {transaction.note ?? "—"}
      </TableCell>
      <TableCell
        className={`font-semibold tabular-nums ${credit ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
      >
        <span className="inline-flex items-center gap-1" dir="ltr">
          {credit ? <ArrowDownLeft className="h-3.5 w-3.5 rtl:rotate-180" /> : <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-180" />}
          {credit ? "+" : "−"}
          {formatToman(Math.abs(transaction.amountToman), locale)}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">{formatToman(transaction.balanceAfter, locale)}</TableCell>
    </TableRow>
  );
}
