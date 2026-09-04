"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Ellipsis, Eye, Pencil, Plus, Search } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { searchMembers } from "@/lib/gms/api";
import type { Branch, Member, MemberStatus } from "@/lib/gms/types";
import { formatDate, formatNumber } from "@/lib/gms/jalali";
import { StatusBadge } from "./status-badge";
import { useI18n } from "./providers";

export interface MembersViewProps {
  branches: Branch[];
  onEdit: (member: Member) => void;
  onDetail: (member: Member) => void;
  onCreate: () => void;
  refreshSignal: number;
  onLoaded?: (totalCount: number) => void;
}

const PAGE_SIZE = 10;

export function MembersView({ branches, onEdit, onDetail, onCreate, refreshSignal, onLoaded }: MembersViewProps) {
  const { t, locale } = useI18n();
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<MemberStatus | "">("");
  const [branchId, setBranchId] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: Member[]; totalCount: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  // debounce search input
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
    searchMembers({
      search: search || undefined,
      status: status || undefined,
      branchId: branchId === "all" ? undefined : branchId,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setData({ items: result.items, totalCount: result.totalCount });
        setLoadError(false);
        onLoaded?.(result.totalCount);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setData({ items: [], totalCount: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, status, branchId, page, refreshSignal]);

  const branchName = React.useCallback(
    (id: string) => {
      const branch = branches.find((b) => b.id === id);
      if (!branch) return "—";
      return locale === "fa" ? branch.nameFa : branch.nameEn;
    },
    [branches, locale],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("members.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("members.subtitle")}</p>
        </div>
        <Button onClick={onCreate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          {t("members.new")}
        </Button>
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("members.search")}
            className="ps-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={status || "all"}
            onValueChange={(value) => {
              setStatus(value === "all" ? "" : (value as MemberStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t("members.status.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("members.status.all")}</SelectItem>
              <SelectItem value="Active">{t("status.Active")}</SelectItem>
              <SelectItem value="Inactive">{t("status.Inactive")}</SelectItem>
              <SelectItem value="Blocked">{t("status.Blocked")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={branchId}
            onValueChange={(value) => {
              setBranchId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("members.branch.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("members.branch.all")}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {locale === "fa" ? branch.nameFa : branch.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-24">{t("members.column.code")}</TableHead>
              <TableHead>{t("members.column.name")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("members.column.phone")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("members.column.branch")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("members.column.joinDate")}</TableHead>
              <TableHead>{t("members.column.status")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="font-medium">{t("members.empty.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("members.empty.description")}</p>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => onDetail(member)}
                >
                  <TableCell className="font-mono text-xs tabular-nums" dir="ltr">
                    {member.code}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {member.fullName.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden" dir="ltr">
                          {member.phoneNumber ?? "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell" dir="ltr">
                    {member.phoneNumber ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{branchName(member.homeBranchId)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(member.joinDateUtc, locale)}</TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <RowMenu
                      member={member}
                      onEdit={onEdit}
                      onDetail={onDetail}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* footer: count + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data ? t("members.count", { count: formatNumber(data.totalCount, locale) }) : t("common.loading")}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight className="h-4 w-4 rtl:hidden" />
            <ChevronLeft className="h-4 w-4 ltr:hidden" />
            <span className="sr-only">{t("common.prev")}</span>
          </Button>
          <span className="min-w-20 text-center text-xs text-muted-foreground">
            {t("common.page", { page: formatNumber(page, locale), total: formatNumber(totalPages, locale) })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronLeft className="h-4 w-4 rtl:hidden" />
            <ChevronRight className="h-4 w-4 ltr:hidden" />
            <span className="sr-only">{t("common.next")}</span>
          </Button>
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
          {t("common.error.load")}
        </p>
      ) : null}
    </div>
  );
}

function RowMenu({
  member,
  onEdit,
  onDetail,
  t,
}: {
  member: Member;
  onEdit: (member: Member) => void;
  onDetail: (member: Member) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={t("members.column.actions")}
        onClick={() => setOpen((v) => !v)}
      >
        <Ellipsis className="h-4 w-4" />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-9 w-36 overflow-hidden rounded-lg border bg-popover p-1 shadow-md">
            <MenuItem
              icon={<Eye className="h-3.5 w-3.5" />}
              label={t("member.detail")}
              onClick={() => {
                setOpen(false);
                onDetail(member);
              }}
            />
            <MenuItem
              icon={<Pencil className="h-3.5 w-3.5" />}
              label={t("member.edit")}
              onClick={() => {
                setOpen(false);
                onEdit(member);
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
    >
      {icon}
      {label}
    </button>
  );
}
