"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dumbbell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LanguageToggle } from "@/components/gms/language-toggle";
import { useAuthStore } from "@/lib/auth-store";
import type { SessionUser } from "@/lib/auth-cookies";

const DEMO_ACCOUNTS = [
  { userName: "admin", password: "Admin@123", roleKey: "demoAdmin" },
  { userName: "reception1", password: "Reception@123", roleKey: "demoReception" },
  { userName: "buffet1", password: "Buffet@123", roleKey: "demoBuffet" },
  { userName: "coach1", password: "Coach@123", roleKey: "demoCoach" },
] as const;

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrorCode(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, password }),
      });

      if (response.ok) {
        const data = (await response.json()) as { user: SessionUser };
        setUser(data.user);
        router.replace("/dashboard");
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { errorCode?: string };
      setErrorCode(body.errorCode ?? "GENERIC");
    } catch {
      setErrorCode("GENERIC");
    } finally {
      setPending(false);
    }
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUserName(account.userName);
    setPassword(account.password);
  };

  const errorMessage = errorCode
    ? t.has(`errors.${errorCode}`)
      ? t(`errors.${errorCode}` as "errors.GENERIC")
      : t("errors.GENERIC")
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 end-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Dumbbell className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("app.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>

        <Card className="w-full shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="userName">{t("login.userName")}</Label>
                <Input
                  id="userName"
                  name="userName"
                  autoComplete="username"
                  dir="ltr"
                  className="text-start"
                  placeholder={t("login.userNamePlaceholder")}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  dir="ltr"
                  className="text-start"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("login.submitting")}
                  </>
                ) : (
                  t("login.submit")
                )}
              </Button>
            </form>

            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none hover:text-foreground">
                {t("login.demoTitle")}
              </summary>
              <div className="mt-2 flex flex-col gap-1" dir="ltr">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.userName}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="flex justify-between rounded-md border px-2 py-1 font-mono text-[11px] hover:bg-accent hover:text-accent-foreground"
                  >
                    <span>
                      {account.userName} / {account.password}
                    </span>
                    <span className="text-muted-foreground">
                      {t(`login.${account.roleKey}` as "login.demoAdmin")}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
