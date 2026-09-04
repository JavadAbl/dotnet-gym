"use client";

import * as React from "react";
import { isDemoMode, login as apiLogin } from "@/lib/gms/api";
import { translate, type Locale } from "@/lib/gms/i18n";
import type { Session } from "@/lib/gms/types";

const SESSION_KEY = "gms.session";
const LOCALE_KEY = "gms.locale";

// ---------------------------------------------------------------- i18n

interface I18nContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------- auth

interface AuthContextValue {
  session: Session | null;
  initializing: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function GmsProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("fa");
  const [session, setSession] = React.useState<Session | null>(null);
  const [initializing, setInitializing] = React.useState(true);

  // restore session + locale
  React.useEffect(() => {
    try {
      const storedLocale = window.localStorage.getItem(LOCALE_KEY);
      if (storedLocale === "fa" || storedLocale === "en") setLocaleState(storedLocale);

      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Session;
        if (parsed.expiresAt > Date.now()) {
          setSession(parsed);
        } else {
          window.localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setInitializing(false);
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }, []);

  // keep <html> direction/lang in sync (fa is RTL-first)
  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  }, [locale]);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const signIn = React.useCallback(async (username: string, password: string) => {
    const response = await apiLogin(username, password);
    const nextSession: Session = {
      token: response.accessToken,
      expiresAt: Date.now() + response.expiresInSeconds * 1000,
      user: response.user,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const signOut = React.useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const i18nValue = React.useMemo<I18nContextValue>(
    () => ({ locale, dir: locale === "fa" ? "rtl" : "ltr", setLocale, t }),
    [locale, setLocale, t],
  );

  const authValue = React.useMemo<AuthContextValue>(
    () => ({ session, initializing, signIn, signOut }),
    [session, initializing, signIn, signOut],
  );

  return (
    <I18nContext.Provider value={i18nValue}>
      <AuthContext.Provider value={authValue}>
        {children}
        <span className="hidden" data-demo-mode={String(isDemoMode)} />
      </AuthContext.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside GmsProviders");
  return ctx;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside GmsProviders");
  return ctx;
}
