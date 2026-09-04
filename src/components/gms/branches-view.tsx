"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./status-badge";
import { listBranches } from "@/lib/gms/api";
import type { Branch } from "@/lib/gms/types";
import { useI18n } from "./providers";

export function BranchesView() {
  const { t, locale } = useI18n();
  const [branches, setBranches] = React.useState<Branch[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listBranches()
      .then((items) => {
        if (!cancelled) setBranches(items);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (branches === null) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  if (branches.length === 0) {
    return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{t("branches.empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("branches.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("branches.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {branches.map((branch) => (
          <Card key={branch.id} className="py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{locale === "fa" ? branch.nameFa : branch.nameEn}</h3>
                  <p className="text-xs text-muted-foreground">{locale === "fa" ? branch.nameEn : branch.nameFa}</p>
                </div>
                <StatusBadge status={branch.isActive ? "Active" : "Inactive"} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("branches.column.city")}</dt>
                  <dd className="font-medium">{branch.city ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("branches.column.phone")}</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">
                    {branch.phoneNumber ?? "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
