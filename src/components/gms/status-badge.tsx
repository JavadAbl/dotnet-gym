"use client";

import * as React from "react";
import type { MemberPackageStatus, MemberStatus } from "@/lib/gms/types";
import { useI18n } from "./providers";
import { Badge } from "@/components/ui/badge";

const STYLES: Record<MemberStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  Inactive: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300",
  Blocked: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
};

const DOT: Record<MemberStatus, string> = {
  Active: "bg-emerald-500",
  Inactive: "bg-zinc-400",
  Blocked: "bg-red-500",
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className={`gap-1.5 border-transparent font-medium ${STYLES[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {t(`status.${status}`)}
    </Badge>
  );
}

const PKG_STYLES: Record<MemberPackageStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  Frozen: "bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300",
  Refunded: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
};

const PKG_DOT: Record<MemberPackageStatus, string> = {
  Active: "bg-emerald-500",
  Frozen: "bg-sky-500",
  Refunded: "bg-amber-500",
};

export function PackageStatusBadge({ status }: { status: MemberPackageStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className={`gap-1.5 border-transparent font-medium ${PKG_STYLES[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${PKG_DOT[status]}`} />
      {t(`pkg.status.${status}`)}
    </Badge>
  );
}
