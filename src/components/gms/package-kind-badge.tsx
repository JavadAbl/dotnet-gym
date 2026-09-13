"use client";

import { useI18n } from "./providers";
import type { PackageKind } from "@/lib/gms/types";

/** v2 — kind badge: Exercise gates gym entry, PrivateCoaching gates coach service. */
export function PackageKindBadge({ kind }: { kind: PackageKind }) {
  const { t } = useI18n();
  const isPrivate = kind === "PrivateCoaching";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        isPrivate
          ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
          : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
      }`}
    >
      {isPrivate ? t("packages.kind.private") : t("packages.kind.exercise")}
    </span>
  );
}
