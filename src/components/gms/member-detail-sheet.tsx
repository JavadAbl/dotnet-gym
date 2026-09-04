"use client";

import * as React from "react";
import { Ban, CircleCheck, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Branch, Member, MemberStatus } from "@/lib/gms/types";
import { formatDate } from "@/lib/gms/jalali";
import { StatusBadge } from "./status-badge";
import { useI18n } from "./providers";

interface MemberDetailSheetProps {
  member: Member | null;
  branches: Branch[];
  onOpenChange: (open: boolean) => void;
  onEdit: (member: Member) => void;
  onSetStatus: (member: Member, status: MemberStatus) => Promise<void>;
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

export function MemberDetailSheet({ member, branches, onOpenChange, onEdit, onSetStatus }: MemberDetailSheetProps) {
  const { t, locale } = useI18n();
  const [pendingStatus, setPendingStatus] = React.useState<MemberStatus | null>(null);

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

              <section className="rounded-lg border border-dashed p-3">
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {t("member.packages.placeholder.title")}
                </h4>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("member.packages.placeholder")}
                </p>
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
