"use client";

import * as React from "react";
import {
  Activity,
  Briefcase,
  ClipboardList,
  Coffee,
  ConciergeBell,
  Dumbbell,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  ReceiptText,
  ScanLine,
  ShoppingBasket,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
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

export type ViewKey =
  | "dashboard"
  | "members"
  | "attendance"
  | "sales"
  | "wallet"
  | "coaching"
  | "buffet"
  | "buffetProducts"
  | "packages"
  | "branches"
  | "users";

/** v2.3 — major UI sections; each operator lands in the section that matches their role. */
export type SectionId = "reception" | "management" | "buffet" | "coaching";

const VIEW_ICONS: Record<ViewKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  members: Users,
  attendance: ScanLine,
  sales: ReceiptText,
  wallet: Wallet,
  coaching: ClipboardList,
  buffet: Coffee,
  buffetProducts: ShoppingBasket,
  packages: Dumbbell,
  branches: MapPin,
  users: UserCog,
};

export const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
  reception: ConciergeBell,
  management: Briefcase,
  buffet: Coffee,
  coaching: ClipboardList,
};

interface SectionDef {
  id: SectionId;
  /** Roles allowed to enter this section (admin is a member of every section). */
  roles: Role[];
  /** View the section opens on. */
  home: ViewKey;
  /** Sidebar order for the section's views. */
  views: ViewKey[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: "reception",
    roles: ["admin", "reception"],
    home: "dashboard",
    views: ["dashboard", "members", "attendance", "sales", "wallet", "coaching", "buffet"],
  },
  {
    id: "management",
    roles: ["admin"],
    home: "dashboard",
    views: ["dashboard", "packages", "buffetProducts", "branches", "users"],
  },
  {
    id: "buffet",
    roles: ["admin", "buffet"],
    home: "buffet",
    views: ["buffet"],
  },
  {
    id: "coaching",
    roles: ["admin", "coach"],
    home: "coaching",
    views: ["coaching"],
  },
];

export function sectionHome(section: SectionId): ViewKey {
  return SECTIONS.find((s) => s.id === section)!.home;
}

export function AppShell({
  section,
  onSwitchSection,
  view,
  onViewChange,
  children,
}: {
  section: SectionId;
  /** v2.4 — returns to the section picker; sections are never selected inside the sidebar. */
  onSwitchSection: () => void;
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const { session, signOut } = useAuth();
  const user = session!.user;
  const currentSection = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const SectionIcon = SECTION_ICONS[currentSection.id];

  const sectionNav = currentSection.views;

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

        {/* v2.4 — current section badge; clicking it goes back to the section picker (cards at login). */}
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={onSwitchSection}
            title={t("sections.switch")}
            className="group flex w-full items-center gap-3 rounded-lg bg-emerald-600/10 px-3 py-2 text-start text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-600/20 dark:text-emerald-300"
          >
            <SectionIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{t(`sections.${currentSection.id}`)}</span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                {t(`sections.${currentSection.id}.hint`)}
              </span>
            </span>
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {sectionNav.map((key) => {
            const Icon = VIEW_ICONS[key];
            const active = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`nav.${key}`)}
              </button>
            );
          })}
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
            {/* mobile nav — grid button returns to the section picker */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                type="button"
                aria-label={t("sections.switch")}
                onClick={onSwitchSection}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              {sectionNav.map((key) => {
                const Icon = VIEW_ICONS[key];
                const active = view === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={t(`nav.${key}`)}
                    onClick={() => onViewChange(key)}
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
              {t(`sections.${section}`)} · {t(`nav.${view}`)}
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
