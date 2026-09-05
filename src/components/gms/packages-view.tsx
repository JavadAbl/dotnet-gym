"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listPackages } from "@/lib/gms/api";
import type { ExercisePackage, PackageKind } from "@/lib/gms/types";
import { formatToman } from "@/lib/gms/jalali";
import { useI18n } from "./providers";

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

export function PackagesView() {
  const { t, locale } = useI18n();
  const [packages, setPackages] = React.useState<ExercisePackage[] | null>(null);
  const [branches, setBranches] = React.useState<Map<string, string>>(new Map());
  const [kindFilter, setKindFilter] = React.useState<PackageKind | "all">("all");

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([listPackages(), import("@/lib/gms/api").then((m) => m.listBranches())])
      .then(([pkgs, brs]) => {
        if (cancelled) return;
        setPackages(pkgs);
        setBranches(new Map(brs.map((b) => [b.id, locale === "fa" ? b.nameFa : b.nameEn])));
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (packages === null) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }

  const filtered = packages.filter((p) => kindFilter === "all" || p.kind === kindFilter);

  if (filtered.length === 0) {
    return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{t("packages.empty")}</p>;
  }

  const kindFilters: Array<{ value: PackageKind | "all"; label: string }> = [
    { value: "all", label: t("packages.filter.all") },
    { value: "Exercise", label: t("packages.kind.exercise") },
    { value: "PrivateCoaching", label: t("packages.kind.private") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("packages.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("packages.subtitle")}</p>
      </div>

      {/* v2 — kind filter chips */}
      <div className="flex flex-wrap gap-2">
        {kindFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setKindFilter(filter.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              kindFilter === filter.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((pkg) => {
          const name = locale === "fa" ? pkg.nameFa : pkg.nameEn;
          return (
            <Card key={pkg.id} className="py-0">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold leading-snug">{name}</h3>
                      <PackageKindBadge kind={pkg.kind} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pkg.sessionsCount} {t("common.sessions")} · {pkg.durationDays} {t("common.days")}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {formatToman(pkg.priceToman, locale)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {pkg.branchIds.map((branchId) => (
                    <span
                      key={branchId}
                      className="rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {branches.get(branchId) ?? "…"}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
