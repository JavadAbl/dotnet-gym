"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GmsApiError } from "@/lib/gms/api";
import { useAuth, useI18n } from "./providers";

const DEMO_ACCOUNTS = [
  { username: "admin", password: "Admin@123", roleKey: "role.admin", sectionKey: "sections.management" },
  { username: "reception.north", password: "Operator@123", roleKey: "role.reception", sectionKey: "sections.reception" },
  { username: "buffet.north", password: "Operator@123", roleKey: "role.buffet", sectionKey: "sections.buffet" },
  { username: "coach.north", password: "Operator@123", roleKey: "role.coach", sectionKey: "sections.coaching" },
];

export function LoginView() {
  const { t, locale } = useI18n();
  const { signIn } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      if (err instanceof GmsApiError && err.errorCode === "identity.invalid_credentials") {
        setError(t("login.invalid"));
      } else if (err instanceof GmsApiError && err.errorCode === "identity.user_inactive") {
        setError(t("login.inactive"));
      } else {
        setError(t("login.error"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-background px-4 dark:from-emerald-950/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg shadow-emerald-600/20">
            G
          </div>
          <h1 className="text-2xl font-bold">{t("app.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("login.description")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("login.title")}</CardTitle>
            <CardDescription>{locale === "fa" ? "GMS" : "سامانه مدیریت باشگاه"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t("login.username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
                {submitting ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("login.demoAccounts")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.username}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs" dir="ltr">
                    {account.username} / {account.password}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(account.roleKey)} · {t(account.sectionKey)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword(account.password);
                  }}
                >
                  {t("login.useAccount")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
