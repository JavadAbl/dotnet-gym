"use client";

import * as React from "react";
import { MoreHorizontal, Search, UserCog, UserPlus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsers, setUserStatus } from "@/lib/gms/api";
import type { Branch, Role, SystemUser } from "@/lib/gms/types";
import { GmsApiError } from "@/lib/gms/demo-store";
import { formatDate } from "@/lib/gms/jalali";
import { useAuth, useI18n } from "./providers";
import { UserCreateDialog, UserResetPasswordDialog } from "./user-dialog";

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  reception: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  buffet: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  coach: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[role]}`}>
      {t(`role.${role}`)}
    </span>
  );
}

/** v2.1 — operator account management (admin only). */
export function UsersView() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const me = session!.user;

  const [users, setUsers] = React.useState<SystemUser[] | null>(null);
  const [branchList, setBranchList] = React.useState<Branch[]>([]);
  const [branches, setBranches] = React.useState<Map<string, string>>(new Map());
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [resetTarget, setResetTarget] = React.useState<SystemUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<SystemUser | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([listUsers(), import("@/lib/gms/api").then((m) => m.listBranches())])
      .then(([loaded, brs]) => {
        if (cancelled) return;
        setUsers(loaded);
        setBranchList(brs);
        setBranches(new Map(brs.map((b) => [b.id, locale === "fa" ? b.nameFa : b.nameEn])));
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || users === null) return users ?? [];
    return users.filter(
      (u) => u.username.toLowerCase().includes(term) || u.displayName.toLowerCase().includes(term),
    );
  }, [users, search]);

  function describeError(err: unknown): string {
    if (err instanceof GmsApiError) {
      const localized = t(`errors.${err.errorCode}`);
      return localized !== `errors.${err.errorCode}` ? localized : err.message;
    }
    return t("common.error.save");
  }

  async function handleDeactivateConfirmed() {
    if (!deactivateTarget) return;
    setBusyId(deactivateTarget.id);
    try {
      const updated = await setUserStatus(deactivateTarget.id, false);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
      toast.success(t("users.toast.deactivated", { name: updated.displayName }));
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
      setDeactivateTarget(null);
    }
  }

  async function handleActivate(user: SystemUser) {
    setBusyId(user.id);
    try {
      const updated = await setUserStatus(user.id, true);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
      toast.success(t("users.toast.activated", { name: updated.displayName }));
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  if (users === null) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("users.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="h-4 w-4" />
          {t("users.create")}
        </Button>
      </div>

      {/* search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("users.search.placeholder")}
          className="ps-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t("users.column.user")}</TableHead>
              <TableHead>{t("users.column.role")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("users.column.branch")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("users.column.createdAt")}</TableHead>
              <TableHead>{t("users.column.status")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="font-medium">{t("users.empty.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("users.empty.description")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === me.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          {user.displayName.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">
                            {user.displayName}
                            {isSelf ? (
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                                {t("users.you")}
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                            {user.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.branchId ? (branches.get(user.branchId) ?? "…") : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDate(user.createdAtUtc, locale)}</TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t("users.status.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          {t("users.status.inactive")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === user.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setResetTarget(user)}>
                            <UserCog className="h-4 w-4" />
                            {t("users.action.resetPassword")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.isActive ? (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onClick={() => setDeactivateTarget(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              {t("users.action.deactivate")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(user)}>
                              {t("users.action.activate")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branches={branchList}
        onSaved={(saved) => {
          toast.success(t("users.toast.created", { name: saved.displayName }));
          setUsers((prev) => [...(prev ?? []), saved].sort((a, b) => a.username.localeCompare(b.username)));
        }}
      />

      <UserResetPasswordDialog
        user={resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        onSaved={(saved) => {
          setUsers((prev) => prev?.map((u) => (u.id === saved.id ? saved : u)) ?? prev);
          toast.success(t("users.toast.passwordReset", { name: saved.displayName }));
        }}
      />

      <AlertDialog open={deactivateTarget !== null} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent dir={locale === "fa" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.deactivate.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.deactivate.description", { name: deactivateTarget?.displayName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("member.form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirmed} className="bg-destructive text-white hover:bg-destructive/90">
              {t("users.deactivate.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
