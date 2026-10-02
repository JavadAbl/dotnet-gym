"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Sandwich,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LanguageToggle } from "@/components/gms/language-toggle";
import { useAuthStore } from "@/lib/auth-store";
import type { SessionUser } from "@/lib/auth-cookies";

type SectionKey = "admin" | "reception" | "buffet" | "coach";

const SECTIONS: Record<SectionKey, { icon: LucideIcon }> = {
  admin: { icon: LayoutDashboard },
  reception: { icon: ClipboardList },
  buffet: { icon: Sandwich },
  coach: { icon: UserCog },
};

export function DashboardClient() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, setUser, clear } = useAuthStore();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<SessionUser> => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { errorCode?: string };
        throw Object.assign(new Error(body.errorCode ?? "GENERIC"), { errorCode: body.errorCode });
      }
      const data = (await response.json()) as { user: SessionUser };
      return data.user;
    },
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) setUser(meQuery.data);
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.error) {
      const code = (meQuery.error as { errorCode?: string }).errorCode;
      if (code === "AUTH_UNAUTHENTICATED" || code === "AUTH_INVALID_REFRESH_TOKEN") {
        clear();
        router.replace("/");
      }
    }
  }, [meQuery.error, clear, router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clear();
    router.replace("/");
  };

  if (meQuery.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Dumbbell className="size-8 animate-pulse" />
          <p className="text-sm">{t("common.loading")}</p>
        </div>
      </main>
    );
  }

  if (meQuery.isError) {
    const code = (meQuery.error as { errorCode?: string }).errorCode ?? "GENERIC";
    const isAuthError = code === "AUTH_UNAUTHENTICATED" || code === "AUTH_INVALID_REFRESH_TOKEN";

    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Alert variant={isAuthError ? "default" : "destructive"} className="max-w-md">
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              {isAuthError
                ? t("common.sessionExpired")
                : t.has(`errors.${code}`)
                  ? t(`errors.${code}` as "errors.GENERIC")
                  : t("errors.GENERIC")}
            </span>
            {isAuthError ? (
              <Button size="sm" onClick={() => router.replace("/")}>
                {t("login.submit")}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => meQuery.refetch()}>
                {t("common.retry")}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const me = user ?? meQuery.data!;
  const visibleSections = (Object.keys(SECTIONS) as SectionKey[]).filter(
    (key) => me.roles.includes("Admin") || me.roles.includes(key.charAt(0).toUpperCase() + key.slice(1)),
  );

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Dumbbell className="size-4" />
            </div>
            <span className="font-bold">{t("app.name")}</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t("dashboard.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <section className="mb-8 flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("dashboard.welcome", { name: me.fullName })}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("dashboard.signedInAs")}</span>
            {me.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {t.has(`roles.${role.toLowerCase()}.label`)
                  ? t(`roles.${role.toLowerCase()}.label` as "roles.admin.label")
                  : role}
              </Badge>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("dashboard.sectionsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("dashboard.sectionsSubtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {visibleSections.map((key) => {
              const { icon: Icon } = SECTIONS[key];
              return (
                <Card key={key} className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      {t(`roles.${key}.label` as "roles.admin.label")}
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0">
                      {t(`roles.${key}.comingSoon` as "roles.admin.comingSoon")}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t(`roles.${key}.description` as "roles.admin.description")}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto max-w-5xl px-4 py-3 text-center text-xs text-muted-foreground">
          {t("app.name")} · {t("app.shortName")} · {locale.toUpperCase()}
        </div>
      </footer>
    </div>
  );
}
