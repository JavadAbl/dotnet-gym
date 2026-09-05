"use client";

import * as React from "react";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  NotebookPen,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  archiveTrainingPlan,
  getCoachingSummary,
  listCoaches,
  releaseCoachAssignment,
  searchCoachAssignments,
  searchTrainingPlans,
  searchTrainingRecords,
} from "@/lib/gms/api";
import type {
  Branch,
  Coach,
  CoachAssignment,
  CoachingSummary,
  TrainingPlan,
  TrainingRecord,
} from "@/lib/gms/types";
import { formatDateTime, formatNumber } from "@/lib/gms/jalali";
import { describeError } from "./sell-package-dialog";
import { AssignCoachDialog } from "./assign-coach-dialog";
import { PlanContentDialog, PlanDialog } from "./plan-dialog";
import { RecordDialog } from "./record-dialog";
import { useAuth, useI18n } from "./providers";

const PAGE_SIZE = 10;

type Tab = "assignments" | "plans" | "records";

export function CoachingView({ branches }: { branches: Branch[] }) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;

  const isCoachRole = user.role === "coach";
  const canAssign = user.role === "admin" || user.role === "reception";
  const canCoach = user.role === "admin" || user.role === "coach";

  // Coach role: pinned to their own coachId + branch (mirrors the backend scoping).
  const scopeCoachId = isCoachRole ? user.id : undefined;
  const scopeBranchId = isCoachRole ? user.branchId ?? undefined : undefined;

  const [tab, setTab] = React.useState<Tab>("assignments");
  const [refreshBump, setRefreshBump] = React.useState(0);

  const [summary, setSummary] = React.useState<CoachingSummary | null>(null);
  const [summaryError, setSummaryError] = React.useState(false);

  // filters
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [coachFilter, setCoachFilter] = React.useState<string>("all");
  const [branchFilter, setBranchFilter] = React.useState<string>(scopeBranchId ?? "all");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  const [coaches, setCoaches] = React.useState<Coach[]>([]);

  // rows per tab
  const [assignments, setAssignments] = React.useState<CoachAssignment[] | null>(null);
  const [plans, setPlans] = React.useState<TrainingPlan[] | null>(null);
  const [records, setRecords] = React.useState<TrainingRecord[] | null>(null);
  const [rowsLoading, setRowsLoading] = React.useState(true);
  const [rowsError, setRowsError] = React.useState(false);

  // dialogs
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [viewingPlan, setViewingPlan] = React.useState<TrainingPlan | null>(null);
  const [releaseTarget, setReleaseTarget] = React.useState<CoachAssignment | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<TrainingPlan | null>(null);
  const [actingOnId, setActingOnId] = React.useState<string | null>(null);

  const refresh = () => setRefreshBump((n) => n + 1);

  // debounced search
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // coach list for the admin filter
  React.useEffect(() => {
    if (isCoachRole) return;
    listCoaches()
      .then((response) => setCoaches(response.items))
      .catch(() => setCoaches([]));
  }, [isCoachRole]);

  // summary KPIs
  React.useEffect(() => {
    let cancelled = false;
    getCoachingSummary(scopeCoachId)
      .then((value) => {
        if (!cancelled) {
          setSummary(value);
          setSummaryError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeCoachId, refreshBump]);

  // rows for the active tab
  React.useEffect(() => {
    let cancelled = false;
    setRowsLoading(true);

    const effectiveCoachId = scopeCoachId ?? (coachFilter === "all" ? undefined : coachFilter);
    const effectiveBranchId = scopeBranchId ?? (branchFilter === "all" ? undefined : branchFilter);
    const term = search || undefined;

    const done = () => {
      if (!cancelled) setRowsLoading(false);
    };

    if (tab === "assignments") {
      searchCoachAssignments({
        coachId: effectiveCoachId,
        memberId: undefined,
        branchId: effectiveBranchId,
        status: statusFilter === "all" ? "" : (statusFilter as "active" | "released"),
        search: term,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return;
          setAssignments(result.items);
          setTotalCount(result.totalCount);
          setRowsError(false);
        })
        .catch(() => {
          if (!cancelled) {
            setAssignments([]);
            setTotalCount(0);
            setRowsError(true);
          }
        })
        .finally(done);
    } else if (tab === "plans") {
      searchTrainingPlans({
        coachId: effectiveCoachId,
        memberId: undefined,
        activeOnly: false,
        search: term,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return;
          setPlans(result.items);
          setTotalCount(result.totalCount);
          setRowsError(false);
        })
        .catch(() => {
          if (!cancelled) {
            setPlans([]);
            setTotalCount(0);
            setRowsError(true);
          }
        })
        .finally(done);
    } else {
      searchTrainingRecords({
        coachId: effectiveCoachId,
        memberId: undefined,
        branchId: effectiveBranchId,
        search: term,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((result) => {
          if (cancelled) return;
          setRecords(result.items);
          setTotalCount(result.totalCount);
          setRowsError(false);
        })
        .catch(() => {
          if (!cancelled) {
            setRecords([]);
            setTotalCount(0);
            setRowsError(true);
          }
        })
        .finally(done);
    }

    return () => {
      cancelled = true;
    };
  }, [tab, page, search, coachFilter, branchFilter, statusFilter, refreshBump, scopeCoachId, scopeBranchId]);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  async function handleRelease() {
    if (!releaseTarget) return;
    setActingOnId(releaseTarget.id);
    try {
      await releaseCoachAssignment(releaseTarget.id);
      toast.success(t("coaching.release.success"));
      setReleaseTarget(null);
      refresh();
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setActingOnId(null);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setActingOnId(archiveTarget.id);
    try {
      await archiveTrainingPlan(archiveTarget.id);
      toast.success(t("coaching.plan.archived"));
      setArchiveTarget(null);
      refresh();
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setActingOnId(null);
    }
  }

  const branchName = React.useCallback(
    (id: string, row: { branchNameFa: string; branchNameEn: string }) => {
      if (!branches.some((b) => b.id === id)) return row.branchNameFa !== "—" ? row.branchNameFa : row.branchNameEn;
      const branch = branches.find((b) => b.id === id);
      return branch ? (locale === "fa" ? branch.nameFa : branch.nameEn) : "—";
    },
    [branches, locale],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const kpis = [
    { key: "coaching.kpi.activeAssignments", icon: Users, value: summary?.activeAssignments },
    { key: "coaching.kpi.activePlans", icon: BookOpenCheck, value: summary?.activePlans },
    { key: "coaching.kpi.records7d", icon: NotebookPen, value: summary?.recordsLast7Days },
    { key: "coaching.kpi.presentNow", icon: Eye, value: summary?.membersPresentNow },
  ];

  const statusBadge = (labelKey: string, tone: string) => (
    <Badge variant="secondary" className={`border-transparent font-medium hover:bg-transparent ${tone}`}>
      {t(labelKey)}
    </Badge>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("coaching.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("coaching.subtitle")}</p>
        </div>
        {canAssign ? (
          <Button onClick={() => setAssignOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <UserPlus className="h-4 w-4" />
            {t("coaching.assign.action")}
          </Button>
        ) : null}
      </div>

      {isCoachRole ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {t("coaching.coachScope.hint")}
        </p>
      ) : null}

      {/* KPI chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {t(kpi.key)}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summaryError ? "—" : summary ? formatNumber(kpi.value ?? 0, locale) : "—"}
              </p>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(value) => switchTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t("coaching.tab.assignments")}
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <BookOpenCheck className="h-3.5 w-3.5" />
            {t("coaching.tab.plans")}
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5">
            <NotebookPen className="h-3.5 w-3.5" />
            {t("coaching.tab.records")}
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
            placeholder={t("coaching.assign.member.placeholder")}
            className="ps-9"
          />
        </div>
        {!isCoachRole ? (
          <Select value={coachFilter} onValueChange={(value) => { setCoachFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("coaching.column.coach")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("coaching.filter.coach.all")}</SelectItem>
              {coaches.map((coach) => (
                <SelectItem key={coach.id} value={coach.id}>
                  {coach.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {!isCoachRole ? (
          <Select value={branchFilter} onValueChange={(value) => { setBranchFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40">
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
        ) : null}
        {tab === "assignments" ? (
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder={t("coaching.column.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("coaching.status.active")}</SelectItem>
              <SelectItem value="released">{t("coaching.status.released")}</SelectItem>
              <SelectItem value="all">{t("members.status.all")}</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {tab === "plans" && canCoach ? (
          <Button
            onClick={() => setPlanOpen(true)}
            variant="outline"
            className="gap-1.5"
          >
            <BookOpenCheck className="h-4 w-4" />
            {t("coaching.plan.action")}
          </Button>
        ) : null}
        {tab === "records" && canCoach ? (
          <Button
            onClick={() => setRecordOpen(true)}
            variant="outline"
            className="gap-1.5"
          >
            <NotebookPen className="h-4 w-4" />
            {t("coaching.record.action")}
          </Button>
        ) : null}
      </div>

      {/* tables */}
      {tab === "assignments" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>{t("coaching.column.member")}</TableHead>
                <TableHead>{t("coaching.column.coach")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("coaching.column.branch")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("coaching.column.assignedAt")}</TableHead>
                <TableHead>{t("coaching.column.status")}</TableHead>
                <TableHead className="w-12">{t("coaching.column.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsLoading && !assignments ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !assignments || assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="font-medium">{t("coaching.empty.assignments.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("coaching.empty.assignments.description")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {assignment.memberFullName.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{assignment.memberFullName}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                            {assignment.memberCode}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{assignment.coachName}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {branchName(assignment.branchId, assignment)}
                    </TableCell>
                    <TableCell className="hidden text-sm tabular-nums md:table-cell">
                      {formatDateTime(assignment.assignedAtUtc, locale)}
                    </TableCell>
                    <TableCell>
                      {assignment.releasedAtUtc === null ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {statusBadge(
                            "coaching.status.active",
                            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          )}
                          {assignment.memberIsPresent ? statusBadge(
                            "coaching.present.now",
                            "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
                          ) : null}
                          {/* v2 — live private-coaching entitlement of the member */}
                          {assignment.privateSessionsRemaining !== null &&
                          assignment.privateSessionsRemaining !== undefined ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                              {t("coaching.assign.privateRemaining", {
                                remaining: assignment.privateSessionsRemaining,
                                total: assignment.privateSessionsTotal ?? 0,
                              })}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {statusBadge(
                            "coaching.status.released",
                            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                          )}
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatDateTime(assignment.releasedAtUtc, locale)}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment.releasedAtUtc === null ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={actingOnId === assignment.id}
                          title={t("coaching.release.action")}
                          onClick={() => setReleaseTarget(assignment)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === "plans" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>{t("coaching.plan.name")}</TableHead>
                <TableHead>{t("coaching.column.member")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("coaching.column.coach")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("coaching.column.created")}</TableHead>
                <TableHead>{t("coaching.column.status")}</TableHead>
                <TableHead className="w-20">{t("coaching.column.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsLoading && !plans ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !plans || plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="font-medium">{t("coaching.empty.plans.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("coaching.empty.plans.description")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <p className="max-w-52 truncate font-medium">{plan.title}</p>
                      {plan.goal ? (
                        <p className="max-w-52 truncate text-xs text-muted-foreground">{plan.goal}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-medium">{plan.memberFullName}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                        {plan.memberCode}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{plan.coachName}</TableCell>
                    <TableCell className="hidden text-sm tabular-nums md:table-cell">
                      {formatDateTime(plan.createdAtUtc, locale)}
                    </TableCell>
                    <TableCell>
                      {plan.isActive
                        ? statusBadge(
                            "coaching.plan.active",
                            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          )
                        : statusBadge(
                            "coaching.status.archived",
                            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                          )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          title={t("coaching.plan.viewContent")}
                          onClick={() => setViewingPlan(plan)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {plan.isActive && canCoach && (user.role === "admin" || plan.coachId === user.id) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={actingOnId === plan.id}
                            title={t("coaching.plan.archive")}
                            onClick={() => setArchiveTarget(plan)}
                          >
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === "records" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>{t("coaching.column.member")}</TableHead>
                <TableHead>{t("coaching.column.summary")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("coaching.column.plan")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("coaching.column.performedAt")}</TableHead>
                <TableHead>{t("coaching.column.duration")}</TableHead>
                <TableHead>{t("coaching.column.intensity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsLoading && !records ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !records || records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="font-medium">{t("coaching.empty.records.title")}</p>
                    <p className="text-sm text-muted-foreground">{t("coaching.empty.records.description")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {record.memberFullName.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{record.memberFullName}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                            {record.memberCode}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-64 truncate text-sm">{record.summary}</p>
                      {record.note ? (
                        <p className="max-w-64 truncate text-xs text-muted-foreground">{record.note}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden max-w-40 truncate text-sm lg:table-cell">
                      {record.planTitle ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm tabular-nums md:table-cell">
                      {formatDateTime(record.performedAtUtc, locale)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {record.durationMinutes != null
                        ? t("attendance.duration.minutes", { count: formatNumber(record.durationMinutes, locale) })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.intensity ? (
                        <Badge
                          variant="secondary"
                          className={`border-transparent font-medium hover:bg-transparent ${
                            record.intensity === "High"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : record.intensity === "Medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          }`}
                        >
                          {record.intensity === "High"
                            ? t("coaching.record.intensity.high")
                            : record.intensity === "Medium"
                              ? t("coaching.record.intensity.medium")
                              : t("coaching.record.intensity.low")}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {/* pager */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rowsLoading && (assignments ?? plans ?? records) === null
            ? t("common.loading")
            : t("coaching.count", { count: formatNumber(totalCount, locale) })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || rowsLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-4 w-4 rtl:hidden" />
            <ChevronLeft className="h-4 w-4 ltr:hidden" />
            <span className="sr-only">{t("common.prev")}</span>
          </Button>
          <span className="min-w-20 text-center text-xs text-muted-foreground">
            {t("common.page", {
              page: formatNumber(page, locale),
              total: formatNumber(totalPages, locale),
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || rowsLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronLeft className="h-4 w-4 rtl:hidden" />
            <ChevronRight className="h-4 w-4 ltr:hidden" />
            <span className="sr-only">{t("common.next")}</span>
          </Button>
        </div>
      </div>

      {rowsError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
          {t("common.error.load")}
        </p>
      ) : null}

      {/* dialogs */}
      <AssignCoachDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        branches={branches}
        onAssigned={() => {
          toast.success(t("coaching.assign.success"));
          refresh();
        }}
      />

      <PlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        fixedCoachId={scopeCoachId ?? null}
        onCreated={() => {
          toast.success(t("coaching.plan.created"));
          refresh();
        }}
      />

      <RecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        fixedCoachId={scopeCoachId ?? null}
        onCreated={() => {
          toast.success(t("coaching.record.created"));
          refresh();
        }}
      />

      <PlanContentDialog plan={viewingPlan} onOpenChange={(open) => (open ? undefined : setViewingPlan(null))} />

      <AlertDialog
        open={releaseTarget !== null}
        onOpenChange={(open) => (open ? undefined : setReleaseTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("coaching.release.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {releaseTarget?.memberFullName} · {releaseTarget?.coachName}
              <br />
              {t("coaching.release.confirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("member.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actingOnId !== null}
              onClick={(event) => {
                event.preventDefault();
                void handleRelease();
              }}
            >
              {t("coaching.release.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => (open ? undefined : setArchiveTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("coaching.plan.archive.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("coaching.plan.archive.confirm.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("member.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actingOnId !== null}
              onClick={(event) => {
                event.preventDefault();
                void handleArchive();
              }}
            >
              {t("coaching.plan.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
