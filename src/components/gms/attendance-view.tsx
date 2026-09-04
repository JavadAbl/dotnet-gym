"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  ScanLine,
  Search,
  Users,
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
import { checkOut, getPresence, searchAttendance } from "@/lib/gms/api";
import { toast } from "sonner";
import type { AttendanceEntry, Branch, PresenceBoard } from "@/lib/gms/types";
import { formatDateTime, formatNumber } from "@/lib/gms/jalali";
import type { Locale } from "@/lib/gms/i18n";
import { describeError } from "./sell-package-dialog";
import { CheckInDialog } from "./check-in-dialog";
import { useAuth, useI18n } from "./providers";

export interface AttendanceViewProps {
  branches: Branch[];
}

const HISTORY_PAGE_SIZE = 10;
const PRESENCE_REFRESH_MS = 30_000;

function formatDuration(minutes: number, locale: Locale, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (minutes < 60) {
    return t("attendance.duration.minutes", { count: formatNumber(minutes, locale) });
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return t("attendance.duration.hours", {
    hours: formatNumber(hours, locale),
    minutes: formatNumber(rest, locale),
  });
}

export function AttendanceView({ branches }: AttendanceViewProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;

  const [tab, setTab] = React.useState<"presence" | "history">("presence");
  const [branchId, setBranchId] = React.useState<string>(user.branchId ?? "all");
  const [refreshBump, setRefreshBump] = React.useState(0);
  const [checkinOpen, setCheckinOpen] = React.useState(false);

  // ---------------------------------------------------------------- presence
  const [presence, setPresence] = React.useState<PresenceBoard | null>(null);
  const [presenceLoading, setPresenceLoading] = React.useState(true);
  const [presenceError, setPresenceError] = React.useState(false);
  const [checkingOutId, setCheckingOutId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      getPresence(branchId === "all" ? undefined : branchId)
        .then((board) => {
          if (cancelled) return;
          setPresence(board);
          setPresenceError(false);
        })
        .catch(() => {
          if (!cancelled) {
            setPresenceError(true);
            setPresence({ items: [], count: 0, visitsToday: 0 });
          }
        })
        .finally(() => {
          if (!cancelled) setPresenceLoading(false);
        });
    };
    setPresenceLoading(true);
    load();
    const interval = setInterval(load, PRESENCE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [branchId, refreshBump]);

  // ---------------------------------------------------------------- history
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [entries, setEntries] = React.useState<AttendanceEntry[] | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [historyError, setHistoryError] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  React.useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    searchAttendance({
      search: search || undefined,
      branchId: branchId === "all" ? undefined : branchId,
      page,
      pageSize: HISTORY_PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setEntries(result.items);
        setTotalCount(result.totalCount);
        setHistoryError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryError(true);
          setEntries([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, branchId, page, refreshBump]);

  async function handleCheckOut(entry: AttendanceEntry) {
    setCheckingOutId(entry.id);
    try {
      await checkOut(entry.id);
      toast.success(t("attendance.checkedOut"));
      setRefreshBump((n) => n + 1);
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setCheckingOutId(null);
    }
  }

  const branchName = React.useCallback(
    (id: string) => {
      const branch = branches.find((b) => b.id === id);
      if (!branch) return "—";
      return locale === "fa" ? branch.nameFa : branch.nameEn;
    },
    [branches, locale],
  );

  const historyTotalPages = Math.max(1, Math.ceil(totalCount / HISTORY_PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("attendance.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("attendance.subtitle")}</p>
        </div>
        <Button onClick={() => setCheckinOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <ScanLine className="h-4 w-4" />
          {t("attendance.checkIn")}
        </Button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {t("attendance.presentNow")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {presenceLoading && !presence ? "—" : formatNumber(presence?.count ?? 0, locale)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LogIn className="h-3.5 w-3.5" />
            {t("attendance.visitsToday")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {presenceLoading && !presence ? "—" : formatNumber(presence?.visitsToday ?? 0, locale)}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "presence" | "history")}>
        <TabsList>
          <TabsTrigger value="presence" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t("attendance.tab.presence")}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            {t("attendance.tab.history")}
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
            placeholder={t("attendance.filter.search")}
            className="ps-9"
          />
        </div>
        <Select
          value={branchId}
          onValueChange={(value) => {
            setBranchId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("attendance.filter.branch.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("attendance.filter.branch.all")}</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {locale === "fa" ? branch.nameFa : branch.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tab === "presence" ? (
        presenceLoading && !presence ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !presence || presence.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">{t("attendance.presence.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("attendance.presence.empty.description")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presence.items.map((entry) => (
              <PresenceCard
                key={entry.id}
                entry={entry}
                locale={locale}
                showBranch={branchId === "all"}
                branchName={branchName(entry.branchId)}
                busy={checkingOutId === entry.id}
                onCheckOut={handleCheckOut}
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("attendance.column.member")}</TableHead>
                  <TableHead>{t("attendance.column.package")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("attendance.column.branch")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("attendance.column.checkIn")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("attendance.column.checkOut")}</TableHead>
                  <TableHead>{t("attendance.column.duration")}</TableHead>
                  <TableHead>{t("attendance.column.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading && !entries ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !entries || entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="font-medium">{t("attendance.empty.title")}</p>
                      <p className="text-sm text-muted-foreground">{t("attendance.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {entry.memberFullName.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{entry.memberFullName}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                              {entry.memberCode}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-44 truncate font-medium">
                          {locale === "fa" ? entry.packageNameFa : entry.packageNameEn}
                        </p>
                        {entry.sessionsTotal != null ? (
                          <p className="tabular-nums text-xs text-muted-foreground">
                            {t("sales.sessions.usage", {
                              used: formatNumber(entry.sessionsUsed ?? 0, locale),
                              total: formatNumber(entry.sessionsTotal, locale),
                            })}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{branchName(entry.branchId)}</TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {formatDateTime(entry.checkInAtUtc, locale)}
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {entry.checkOutAtUtc ? formatDateTime(entry.checkOutAtUtc, locale) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDuration(entry.durationMinutes, locale, t)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            entry.isPresent
                              ? "gap-1.5 border-transparent bg-emerald-100 font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                              : "gap-1.5 border-transparent bg-zinc-100 font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${entry.isPresent ? "animate-pulse bg-emerald-500" : "bg-zinc-400"}`} />
                          {entry.isPresent ? t("attendance.present") : t("attendance.left")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {entries
                ? t("attendance.count", { count: formatNumber(totalCount, locale) })
                : t("common.loading")}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || historyLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronRight className="h-4 w-4 rtl:hidden" />
                <ChevronLeft className="h-4 w-4 ltr:hidden" />
                <span className="sr-only">{t("common.prev")}</span>
              </Button>
              <span className="min-w-20 text-center text-xs text-muted-foreground">
                {t("common.page", {
                  page: formatNumber(page, locale),
                  total: formatNumber(historyTotalPages, locale),
                })}
              </span>
              <Button variant="outline" size="sm" disabled={page >= historyTotalPages || historyLoading} onClick={() => setPage((p) => Math.min(historyTotalPages, p + 1))}>
                <ChevronLeft className="h-4 w-4 rtl:hidden" />
                <ChevronRight className="h-4 w-4 ltr:hidden" />
                <span className="sr-only">{t("common.next")}</span>
              </Button>
            </div>
          </div>

          {historyError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
              {t("common.error.load")}
            </p>
          ) : null}
        </>
      )}

      {presenceError && tab === "presence" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
          {t("common.error.load")}
        </p>
      ) : null}

      <CheckInDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        branches={branches}
        onCheckedIn={() => setRefreshBump((n) => n + 1)}
      />
    </div>
  );
}

function PresenceCard({
  entry,
  locale,
  showBranch,
  branchName,
  busy,
  onCheckOut,
}: {
  entry: AttendanceEntry;
  locale: Locale;
  showBranch: boolean;
  branchName: string;
  busy: boolean;
  onCheckOut: (entry: AttendanceEntry) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            {entry.memberFullName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{entry.memberFullName}</p>
            <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
              {entry.memberCode}
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="gap-1.5 border-transparent bg-emerald-100 font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {t("attendance.present")}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="truncate">{locale === "fa" ? entry.packageNameFa : entry.packageNameEn}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showBranch ? <span>{branchName}</span> : null}
          <span className="tabular-nums">
            {t("attendance.column.checkIn")}: {formatDateTime(entry.checkInAtUtc, locale)}
          </span>
          <span className="tabular-nums">
            {formatDuration(entry.durationMinutes, locale, t)}
          </span>
          {entry.sessionsRemaining != null ? (
            <span className="tabular-nums">
              {t("attendance.remaining", { count: formatNumber(entry.sessionsRemaining, locale) })}
            </span>
          ) : null}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        disabled={busy}
        onClick={() => onCheckOut(entry)}
      >
        <LogOut className="h-3.5 w-3.5" />
        {t("attendance.checkout")}
      </Button>
    </div>
  );
}
