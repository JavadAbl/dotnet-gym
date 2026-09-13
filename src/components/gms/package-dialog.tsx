"use client";

import * as React from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createPackage } from "@/lib/gms/api";
import type { Branch, ExercisePackage, PackageKind } from "@/lib/gms/types";
import { GmsApiError } from "@/lib/gms/demo-store";
import { useI18n } from "./providers";
import { PackageKindBadge } from "./package-kind-badge";

interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onSaved: (pkg: ExercisePackage) => void;
}

function parseIntOrNull(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** v2 — admin package creation (global definition + per-branch grants), mirrors POST /catalog/packages. */
export function PackageDialog({ open, onOpenChange, branches, onSaved }: PackageDialogProps) {
  const { t, locale } = useI18n();

  const [nameEn, setNameEn] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [kind, setKind] = React.useState<PackageKind>("Exercise");
  const [sessions, setSessions] = React.useState("");
  const [durationDays, setDurationDays] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [branchIds, setBranchIds] = React.useState<string[]>([]);
  const [isActive, setIsActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setNameEn("");
      setNameFa("");
      setKind("Exercise");
      setSessions("");
      setDurationDays("");
      setPrice("");
      setBranchIds([]);
      setIsActive(true);
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  const activeBranches = branches.filter((b) => b.isActive);
  const sessionsValue = parseIntOrNull(sessions);
  const durationValue = parseIntOrNull(durationDays);
  const priceValue = parseIntOrNull(price);

  const canSubmit =
    nameEn.trim().length > 0 &&
    nameFa.trim().length > 0 &&
    sessionsValue !== null &&
    sessionsValue <= 1000 &&
    durationValue !== null &&
    durationValue <= 3650 &&
    priceValue !== null &&
    branchIds.length > 0 &&
    !submitting;

  function toggleBranch(branchId: string) {
    setBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await createPackage({
        nameEn: nameEn.trim(),
        nameFa: nameFa.trim(),
        kind,
        sessionsCount: sessionsValue ?? 0,
        durationDays: durationValue ?? 0,
        priceToman: priceValue ?? 0,
        branchIds,
        isActive,
      });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof GmsApiError) {
        const localized = t(`errors.${err.errorCode}`);
        setError(localized !== `errors.${err.errorCode}` ? localized : err.message);
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          mapped[field] = messages[0] ?? "";
        }
        setFieldErrors(mapped);
      } else {
        setError(t("common.error.save"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const kindChips: Array<{ value: PackageKind; label: string; hint: string }> = [
    { value: "Exercise", label: t("packages.kind.exercise"), hint: t("packages.form.kind.exerciseHint") },
    { value: "PrivateCoaching", label: t("packages.kind.private"), hint: t("packages.form.kind.privateHint") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-emerald-600" />
              {t("packages.create.title")}
            </DialogTitle>
            <DialogDescription>{t("packages.create.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="package-name-en">{t("packages.form.nameEn")}</Label>
            <Input
              id="package-name-en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t("packages.form.nameEn.placeholder")}
              maxLength={128}
              dir="ltr"
            />
            {fieldErrors.nameEn ? <p className="text-xs text-destructive">{fieldErrors.nameEn}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="package-name-fa">{t("packages.form.nameFa")}</Label>
            <Input
              id="package-name-fa"
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              placeholder={t("packages.form.nameFa.placeholder")}
              maxLength={128}
              dir="rtl"
            />
            {fieldErrors.nameFa ? <p className="text-xs text-destructive">{fieldErrors.nameFa}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("packages.form.kind")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {kindChips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setKind(chip.value)}
                  className={`space-y-1 rounded-lg border p-3 text-start transition-colors ${
                    kind === chip.value
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
                      : "bg-card hover:bg-accent"
                  }`}
                >
                  <span className="block text-sm font-semibold">{chip.label}</span>
                  <span className="block text-xs text-muted-foreground">{chip.hint}</span>
                </button>
              ))}
            </div>
            {fieldErrors.kind ? <p className="text-xs text-destructive">{fieldErrors.kind}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="package-sessions">{t("packages.form.sessions")}</Label>
              <Input
                id="package-sessions"
                value={sessions}
                onChange={(e) => setSessions(e.target.value)}
                placeholder="30"
                inputMode="numeric"
                dir="ltr"
                className="font-mono tabular-nums"
                autoComplete="off"
              />
              {fieldErrors.sessionsCount ? (
                <p className="text-xs text-destructive">{fieldErrors.sessionsCount}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="package-duration">{t("packages.form.duration")}</Label>
              <Input
                id="package-duration"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="60"
                inputMode="numeric"
                dir="ltr"
                className="font-mono tabular-nums"
                autoComplete="off"
              />
              {fieldErrors.durationDays ? (
                <p className="text-xs text-destructive">{fieldErrors.durationDays}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="package-price">{t("packages.form.price")}</Label>
            <Input
              id="package-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="15,000,000"
              inputMode="numeric"
              dir="ltr"
              className="font-mono tabular-nums"
              autoComplete="off"
            />
            {fieldErrors.priceToman ? <p className="text-xs text-destructive">{fieldErrors.priceToman}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("packages.form.branches")}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {activeBranches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={branchIds.includes(branch.id)}
                    onCheckedChange={() => toggleBranch(branch.id)}
                  />
                  <span>{locale === "fa" ? branch.nameFa : branch.nameEn}</span>
                </label>
              ))}
              {activeBranches.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("packages.form.noBranches")}</p>
              ) : null}
            </div>
            {fieldErrors.branchIds ? <p className="text-xs text-destructive">{fieldErrors.branchIds}</p> : null}
            {Object.entries(fieldErrors)
              .filter(([field]) => field.startsWith("branchIds["))
              .map(([field, message]) => (
                <p key={field} className="text-xs text-destructive">
                  {message}
                </p>
              ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="package-active" className="text-sm font-normal">
                {t("packages.form.active")}
              </Label>
              <PackageKindBadge kind={kind} />
            </div>
            <Switch id="package-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? t("packages.form.submitting") : t("packages.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
