"use client";

import * as React from "react";
import { Activity, ArrowLeft, ArrowRight, Languages, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/gms/api";
import { SECTIONS, SECTION_ICONS, type SectionId } from "./app-shell";
import { useAuth, useI18n } from "./providers";

/**
 * v2.4 — section picker shown right after login.
 * Each role-gated section renders as a large card; entering a card opens the
 * section in the app shell with its own scoped sidebar. Sections are no longer
 * selectable from inside the sidebar.
 */

const SECTION_CARD_STYLES: Record<SectionId, { tile: string; ring: string }> = {
  reception: { tile: "bg-emerald-600", ring: "hover:border-emerald-600/50 hover:shadow-emerald-600/10" },
  management: { tile: "bg-indigo-600", ring: "hover:border-indigo-600/50 hover:shadow-indigo-600/10" },
  buffet: { tile: "bg-amber-500", ring: "hover:border-amber-500/50 hover:shadow-amber-500/10" },
  coaching: { tile: "bg-sky-600", ring: "hover:border-sky-600/50 hover:shadow-sky-600/10" },
};

export function SectionPicker({ onEnter }: { onEnter: (section: SectionId) => void }) {
  const { t, locale, setLocale } = useI18n();
  const { session, signOut } = useAuth();
  const user = session!.user;

  const allowed = SECTIONS.filter((section) => section.roles.includes(user.role));
  const ForwardArrow = locale === "fa" ? ArrowLeft : ArrowRight;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* top bar — the user is signed in but has not entered a section yet */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white">
              G
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{t("app.title")}</p>
              <p className="truncate text-xs text-muted-foreground">{t("app.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isDemoMode ? "secondary" : "default"} className="hidden gap-1.5 sm:inline-flex">
              <Activity className="h-3 w-3" />
              {isDemoMode ? t("mode.demo") : t("mode.live")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
              className="gap-1.5"
            >
              <Languages className="h-4 w-4" />
              {locale === "fa" ? "EN" : "فا"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 md:px-6">
        <div className="w-full max-w-3xl">
          <div className="pb-8 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t("sections.pickTitle")}</h1>
            <p className="pt-2 text-sm text-muted-foreground md:text-base">
              {t("sections.pickSubtitle", { name: user.displayName })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
            {allowed.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              const styles = SECTION_CARD_STYLES[section.id];
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onEnter(section.id)}
                  className={`group flex flex-col rounded-2xl border bg-card p-6 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${styles.ring}`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${styles.tile}`}
                    >
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold">{t(`sections.${section.id}`)}</span>
                      <span className="block text-sm text-muted-foreground">{t(`sections.${section.id}.hint`)}</span>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-wrap items-start gap-1.5 pt-5">
                    {section.views.map((key) => (
                      <span
                        key={key}
                        className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      >
                        {t(`nav.${key}`)}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t pt-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {t("sections.enter")}
                    <ForwardArrow className="h-4 w-4 transition-transform ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        {t("app.title")} · {isDemoMode ? t("mode.demo") : t("mode.live")}
      </footer>
    </div>
  );
}
