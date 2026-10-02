"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config";

/** Switches the NEXT_LOCALE cookie and refreshes server-rendered content. */
export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const other: Locale = locale === "fa" ? "en" : "fa";

  const switchLocale = () => {
    document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      disabled={pending}
      className="gap-2 text-muted-foreground"
      aria-label={t("language")}
    >
      <Languages className="size-4" />
      <span className="text-sm">{t("language")}</span>
    </Button>
  );
}

export { LOCALES };
