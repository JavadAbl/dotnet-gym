"use client";

import * as React from "react";
import type { MemberStatus } from "@/lib/gms/types";
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
