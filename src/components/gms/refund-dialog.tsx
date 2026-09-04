"use client";

import * as React from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { getMemberPackage, refundMemberPackage } from "@/lib/gms/api";
import type { MemberPackage, MemberPackageDetail, PaymentMethod } from "@/lib/gms/types";
import { formatNumber, formatToman } from "@/lib/gms/jalali";
import { describeError } from "./sell-package-dialog";
import { useI18n } from "./providers";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberPackage: MemberPackage | null;
  onRefunded: (detail: MemberPackageDetail) => void;
}

export function RefundDialog({ open, onOpenChange, memberPackage, onRefunded }: RefundDialogProps) {
  const { t, locale } = useI18n();

  const [detail, setDetail] = React.useState<MemberPackageDetail | null>(null);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remaining = memberPackage
    ? Math.max(0, memberPackage.sessionsTotal - memberPackage.sessionsUsed)
    : 0;
  const suggested = memberPackage
    ? memberPackage.sessionsTotal > 0
      ? Math.floor((memberPackage.pricePaidToman * remaining) / memberPackage.sessionsTotal)
      : 0
    : 0;

  // load detail (for the original payment method) + prefill the amount whenever the target changes
  React.useEffect(() => {
    if (!open || !memberPackage) return;
    setDetail(null);
    setAmount(String(suggested));
    setReason("");
    setError(null);
    let cancelled = false;
    getMemberPackage(memberPackage.id)
      .then((loaded) => {
        if (cancelled) return;
        setDetail(loaded);
        const purchase = loaded.receipts.find((r) => r.kind === "PackagePurchase");
        if (purchase) setDetail({ ...loaded, receipts: loaded.receipts });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, memberPackage?.id]);

  const parsedAmount = Number.parseInt(amount.replace(/[^\d]/g, ""), 10);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= (memberPackage?.pricePaidToman ?? 0);
  const purchaseReceipt = detail?.receipts.find((r) => r.kind === "PackagePurchase");
  const originalMethod: PaymentMethod | null = purchaseReceipt?.paymentMethod ?? null;

  async function handleSubmit() {
    if (!memberPackage || !amountValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const refunded = await refundMemberPackage(memberPackage.id, {
        amountToman: parsedAmount,
        reason: reason.trim() || undefined,
      });
      onRefunded(refunded);
      onOpenChange(false);
    } catch (err) {
      setError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const packageName = memberPackage
    ? locale === "fa"
      ? memberPackage.packageNameFa
      : memberPackage.packageNameEn
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-destructive" />
            {t("refund.title")}
          </DialogTitle>
          <DialogDescription>{t("refund.description")}</DialogDescription>
        </DialogHeader>

        {memberPackage ? (
          <div className="space-y-4 py-1">
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{packageName}</span>
                <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {memberPackage.memberCode}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("refund.remaining", { count: formatNumber(remaining, locale) })}
              </p>
              {originalMethod ? (
                <p className="text-xs text-muted-foreground">
                  {t("refund.methodNote", {
                    method: originalMethod === "Wallet" ? t("sell.payment.wallet") : t("sell.payment.cash"),
                  })}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-amount">{t("refund.amount")}</Label>
              <Input
                id="refund-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                className="tabular-nums"
              />
              {!amountValid && amount !== "" ? (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <CircleAlert className="h-3.5 w-3.5" />
                  {t("errors.sales.refund_amount_invalid")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{formatToman(suggested, locale)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">{t("refund.reason")}</Label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("refund.reason.placeholder")}
                rows={2}
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("member.form.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amountValid || submitting}
            variant="destructive"
          >
            {submitting ? t("refund.submitting") : t("refund.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
