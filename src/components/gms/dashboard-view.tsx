"use client";

import * as React from "react";
import { Dumbbell, MapPin, ScanLine, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listBranches, listPackages, searchMembers } from "@/lib/gms/api";
import { useI18n } from "./providers";

interface Stats {
  totalMembers: number;
  activeMembers: number;
  branches: number;
  packages: number;
}

export function DashboardView({
  onOpenAttendance,
  onOpenWallet,
}: {
  onOpenAttendance: () => void;
  onOpenWallet: () => void;
}) {
  const { t, locale } = useI18n();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [all, active, branches, packages] = await Promise.all([
          searchMembers({ page: 1, pageSize: 1 }),
          searchMembers({ page: 1, pageSize: 1, status: "Active" }),
          listBranches(),
          listPackages(),
        ]);
        if (cancelled) return;
        setStats({
          totalMembers: all.totalCount,
          activeMembers: active.totalCount,
          branches: branches.length,
          packages: packages.length,
        });
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { key: "dashboard.totalMembers", icon: Users, value: stats?.totalMembers, tone: "bg-emerald-600" },
    { key: "dashboard.activeMembers", icon: ShieldCheck, value: stats?.activeMembers, tone: "bg-teal-600" },
    { key: "dashboard.branches", icon: MapPin, value: stats?.branches, tone: "bg-amber-600" },
    { key: "dashboard.packages", icon: Dumbbell, value: stats?.packages, tone: "bg-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.welcome")} 👋</h2>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} className="py-0">
              <CardContent className="flex items-center gap-4 p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.tone} text-white`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  {card.value === undefined && !error ? (
                    <Skeleton className="mb-1 h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold tabular-nums">
                      {card.value === undefined ? "—" : new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(card.value)}
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{t(card.key)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        {t("dashboard.phaseNote")}
        <button type="button" onClick={onOpenAttendance} className="mx-1 font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
          {t("nav.attendance")}
        </button>
        <span className="mx-1">·</span>
        <button type="button" onClick={onOpenWallet} className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
          {t("nav.wallet")}
        </button>
      </div>
    </div>
  );
}
