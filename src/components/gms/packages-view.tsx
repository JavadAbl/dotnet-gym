"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listPackages } from "@/lib/gms/api";
import type { ExercisePackage } from "@/lib/gms/types";
import { formatToman } from "@/lib/gms/jalali";
import { useI18n } from "./providers";

export function PackagesView() {
  const { t, locale } = useI18n();
  const [packages, setPackages] = React.useState<ExercisePackage[] | null>(null);
  const [branches, setBranches] = React.useState<Map<string, string>>(new Map());

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

  if (packages.length === 0) {
    return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{t("packages.empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("packages.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("packages.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => {
          const name = locale === "fa" ? pkg.nameFa : pkg.nameEn;
          return (
            <Card key={pkg.id} className="py-0">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold leading-snug">{name}</h3>
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
