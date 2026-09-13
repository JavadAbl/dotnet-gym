"use client";

import * as React from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPackages } from "@/lib/gms/api";
import type { Branch, ExercisePackage, PackageKind } from "@/lib/gms/types";
import { formatToman } from "@/lib/gms/jalali";
import { useAuth, useI18n } from "./providers";
import { PackageDialog } from "./package-dialog";
import { PackageKindBadge } from "./package-kind-badge";

/** v2 — kind badge moved to package-kind-badge.tsx; re-exported for existing consumers. */
export { PackageKindBadge };

export function PackagesView() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const isAdmin = session?.user.role === "admin";
  const [packages, setPackages] = React.useState<ExercisePackage[] | null>(null);
  const [branchList, setBranchList] = React.useState<Branch[]>([]);
  const [branches, setBranches] = React.useState<Map<string, string>>(new Map());
  const [kindFilter, setKindFilter] = React.useState<PackageKind | "all">("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [reloadBump, setReloadBump] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([listPackages(), import("@/lib/gms/api").then((m) => m.listBranches())])
      .then(([pkgs, brs]) => {
        if (cancelled) return;
        setPackages(pkgs);
        setBranchList(brs);
        setBranches(new Map(brs.map((b) => [b.id, locale === "fa" ? b.nameFa : b.nameEn])));
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, reloadBump]);

  if (packages === null) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  }

  const filtered = packages.filter((p) => kindFilter === "all" || p.kind === kindFilter);

  const kindFilters: Array<{ value: PackageKind | "all"; label: string }> = [
    { value: "all", label: t("packages.filter.all") },
    { value: "Exercise", label: t("packages.kind.exercise") },
    { value: "PrivateCoaching", label: t("packages.kind.private") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("packages.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("packages.subtitle")}</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <PackagePlus className="h-4 w-4" />
            {t("packages.create")}
          </Button>
        ) : null}
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

      {filtered.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{t("packages.empty")}</p>
      ) : (
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
                        {!pkg.isActive ? (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                            {t("packages.inactive")}
                          </span>
                        ) : null}
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
      )}

      <PackageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branches={branchList}
        onSaved={(saved) => {
          const name = locale === "fa" ? saved.nameFa : saved.nameEn;
          toast.success(t("packages.created", { name }));
          setKindFilter(saved.kind);
          setReloadBump((n) => n + 1);
        }}
      />
    </div>
  );
}
