"use client";

import * as React from "react";
import { CupSoda } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createProduct, updateProduct } from "@/lib/gms/api";
import type { Branch, BuffetProduct } from "@/lib/gms/types";
import { GmsApiError } from "@/lib/gms/demo-store";
import { useI18n } from "./providers";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  /** Null = create mode, otherwise edit the given product. */
  product: BuffetProduct | null;
  onSaved: (product: BuffetProduct, mode: "create" | "edit") => void;
}

/** Phase 7 — buffet product & per-branch price admin (admin only; locked decision #4). */
export function ProductDialog({ open, onOpenChange, branches, product, onSaved }: ProductDialogProps) {
  const { t, locale } = useI18n();
  const editing = product !== null;

  const [nameEn, setNameEn] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setNameEn(product?.nameEn ?? "");
      setNameFa(product?.nameFa ?? "");
      setIsActive(product?.isActive ?? true);
      setPrices(
        Object.fromEntries(
          branches.map((branch) => [
            branch.id,
            product ? String(product.prices.find((p) => p.branchId === branch.id)?.priceToman ?? "") : "",
          ]),
        ),
      );
      setError(null);
      setFieldErrors({});
    }
  }, [open, product, branches]);

  const activeBranches = branches.filter((b) => b.isActive);

  function parsePrice(raw: string): number | null {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const canSubmit =
    nameEn.trim().length > 0 &&
    nameFa.trim().length > 0 &&
    activeBranches.some((branch) => parsePrice(prices[branch.id] ?? "") !== null) &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const priceInputs = activeBranches
      .map((branch) => ({ branchId: branch.id, priceToman: parsePrice(prices[branch.id] ?? "") ?? 0 }))
      .filter((p) => p.priceToman > 0);

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = editing
        ? await updateProduct(product!.id, {
            nameEn: nameEn.trim(),
            nameFa: nameFa.trim(),
            isActive,
            prices: priceInputs,
          })
        : await createProduct({
            nameEn: nameEn.trim(),
            nameFa: nameFa.trim(),
            isActive,
            prices: priceInputs,
          });
      onSaved(saved, editing ? "edit" : "create");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CupSoda className="h-5 w-5 text-emerald-600" />
              {editing ? t("buffet.product.edit.title") : t("buffet.product.create.title")}
            </DialogTitle>
            <DialogDescription>{t("buffet.product.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="product-name-en">{t("buffet.product.nameEn")}</Label>
            <Input
              id="product-name-en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t("buffet.product.nameEn.placeholder")}
              maxLength={128}
              dir="ltr"
            />
            {fieldErrors.nameEn ? <p className="text-xs text-destructive">{fieldErrors.nameEn}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-name-fa">{t("buffet.product.nameFa")}</Label>
            <Input
              id="product-name-fa"
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              placeholder={t("buffet.product.nameFa.placeholder")}
              maxLength={128}
              dir="ltr"
            />
            {fieldErrors.nameFa ? <p className="text-xs text-destructive">{fieldErrors.nameFa}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("buffet.product.prices")}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {activeBranches.map((branch) => (
                <div key={branch.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`price-${branch.id}`} className="min-w-24 shrink-0 text-xs text-muted-foreground">
                      {locale === "fa" ? branch.nameFa : branch.nameEn}
                    </Label>
                    <Input
                      id={`price-${branch.id}`}
                      value={prices[branch.id] ?? ""}
                      onChange={(e) => setPrices((prev) => ({ ...prev, [branch.id]: e.target.value }))}
                      placeholder="15,000"
                      inputMode="numeric"
                      dir="ltr"
                      className="font-mono tabular-nums"
                      autoComplete="off"
                    />
                  </div>
                  {fieldErrors[`prices[${branch.id}]`] ? (
                    <p className="text-xs text-destructive">{fieldErrors[`prices[${branch.id}]`]}</p>
                  ) : null}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("common.toman")}</p>
            </div>
            {fieldErrors.prices ? <p className="text-xs text-destructive">{fieldErrors.prices}</p> : null}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="product-active" className="text-sm font-normal">
              {t("buffet.product.active")}
            </Label>
            <Switch id="product-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? t("buffet.product.submitting") : editing ? t("buffet.product.submit.edit") : t("buffet.product.submit.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
