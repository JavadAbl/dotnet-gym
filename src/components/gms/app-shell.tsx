"use client";

import * as React from "react";
import { Activity, Dumbbell, LayoutDashboard, Languages, LogOut, MapPin, ReceiptText, ScanLine, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDemoMode } from "@/lib/gms/api";
import type { Role } from "@/lib/gms/types";
import { useAuth, useI18n } from "./providers";

export type ViewKey = "dashboard" | "members" | "attendance" | "sales" | "wallet" | "packages" | "branches";

const NAV: Array<{ key: ViewKey; icon: React.ComponentType<{ className?: string }>; group: "operations" | "setup"; staff: Role[] }> = [
  { key: "dashboard", icon: LayoutDashboard, group: "operations", staff: ["admin", "reception", "buffet", "coach"] },
  { key: "members", icon: Users, group: "operations", staff: ["admin", "reception", "buffet", "coach"] },
  { key: "attendance", icon: ScanLine, group: "operations", staff: ["admin", "reception", "buffet", "coach"] },
  { key: "sales", icon: ReceiptText, group: "operations", staff: ["admin", "reception", "buffet", "coach"] },
  { key: "wallet", icon: Wallet, group: "operations", staff: ["admin", "reception"] },
  { key: "packages", icon: Dumbbell, group: "setup", staff: ["admin", "reception", "buffet", "coach"] },
  { key: "branches", icon: MapPin, group: "setup", staff: ["admin", "reception", "buffet", "coach"] },
];

export function AppShell({
  view,
  onViewChange,
  children,
}: {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const { session, signOut } = useAuth();
  const user = session!.user;

  const groups: Array<{ id: "operations" | "setup"; label: string }> = [
    { id: "operations", label: t("nav.groups.operations") },
    { id: "setup", label: t("nav.groups.setup") },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — first in flex order, so it sits on the start side (right in RTL) automatically */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-card md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            G
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{t("app.title")}</p>
            <p className="text-xs text-muted-foreground">{t("app.subtitle")}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {NAV.filter((item) => item.group === group.id).map((item) => {
                  const Icon = item.icon;
                  const active = view === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onViewChange(item.key)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t(`nav.${item.key}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={isDemoMode ? "secondary" : "default"} className="gap-1.5">
              <Activity className="h-3 w-3" />
              {isDemoMode ? t("mode.demo") : t("mode.live")}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {isDemoMode ? t("mode.demoHint") : `${t("mode.liveHint")} ${"NEXT_PUBLIC_GMS_API_BASE"}`}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
            {/* mobile nav */}
            <div className="flex items-center gap-1 md:hidden">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={t(`nav.${item.key}`)}
                    onClick={() => onViewChange(item.key)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <h1 className="hidden truncate text-sm font-semibold text-muted-foreground md:block">
              {t(`nav.${view}`)}
            </h1>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
                className="gap-1.5"
              >
                <Languages className="h-4 w-4" />
                {locale === "fa" ? "EN" : "فا"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {user.displayName.slice(0, 1)}
                    </span>
                    <span className="hidden max-w-28 truncate sm:inline">{user.displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-medium">{user.displayName}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {t(`role.${user.role}`)} · {user.username}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="mt-auto border-t px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
          {t("app.title")} · {isDemoMode ? t("mode.demo") : t("mode.live")}
        </footer>
      </div>
    </div>
  );
}
