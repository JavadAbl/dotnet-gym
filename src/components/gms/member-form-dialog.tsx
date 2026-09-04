"use client";

import * as React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GmsApiError, createMember, updateMember } from "@/lib/gms/api";
import type { Branch, Gender, Member } from "@/lib/gms/types";
import { useI18n } from "./providers";

export interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  /** When provided the dialog edits this member; otherwise it creates a new one. */
  member?: Member | null;
  onSaved: (member: Member, mode: "create" | "edit") => void;
}

interface FormState {
  fullName: string;
  phoneNumber: string;
  gender: Gender;
  birthDate: string; // yyyy-mm-dd
  homeBranchId: string;
  cardCode: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  phoneNumber: "",
  gender: "Unknown",
  birthDate: "",
  homeBranchId: "",
  cardCode: "",
  notes: "",
};

function toForm(member: Member): FormState {
  return {
    fullName: member.fullName,
    phoneNumber: member.phoneNumber ?? "",
    gender: member.gender,
    birthDate: member.birthDateUtc ? member.birthDateUtc.slice(0, 10) : "",
    homeBranchId: member.homeBranchId,
    cardCode: member.cardCode ?? "",
    notes: member.notes ?? "",
  };
}

export function MemberFormDialog({ open, onOpenChange, branches, member, onSaved }: MemberFormDialogProps) {
  const { t, locale } = useI18n();
  const isEdit = Boolean(member);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(member ? toForm(member) : EMPTY_FORM);
      setFieldErrors({});
    }
  }, [open, member]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateLocal(): boolean {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = t("member.form.validation.name");
    if (!form.homeBranchId) errors.homeBranchId = t("member.form.validation.branch");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateLocal()) return;
    setSubmitting(true);
    try {
      const model = {
        fullName: form.fullName,
        phoneNumber: form.phoneNumber.trim() || null,
        gender: form.gender,
        birthDate: form.birthDate || null,
        homeBranchId: form.homeBranchId,
        cardCode: form.cardCode.trim() || null,
        notes: form.notes.trim() || null,
      };
      const saved = isEdit && member ? await updateMember(member.id, model) : await createMember(model);
      onSaved(saved, isEdit ? "edit" : "create");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof GmsApiError && Object.keys(err.fieldErrors).length > 0) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          mapped[field] = messages.join(" ");
        }
        setFieldErrors(mapped);
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  }

  const genderOptions: Array<{ value: Gender; label: string }> = [
    { value: "Unknown", label: t("gender.Unknown") },
    { value: "Male", label: t("gender.Male") },
    { value: "Female", label: t("gender.Female") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("member.form.edit.title") : t("member.form.create.title")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("member.form.edit.description") : t("member.form.create.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="member-fullName">{t("member.form.fullName")} *</Label>
            <Input
              id="member-fullName"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              placeholder={t("member.form.fullName.placeholder")}
              maxLength={200}
            />
            {fieldErrors.fullName ? <p className="text-xs font-medium text-destructive">{fieldErrors.fullName}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-phone">{t("member.form.phone")}</Label>
              <Input
                id="member-phone"
                value={form.phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
                placeholder={t("member.form.phone.placeholder")}
                dir="ltr"
                inputMode="tel"
                maxLength={20}
              />
              {fieldErrors.phoneNumber ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.phoneNumber}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-gender">{t("member.form.gender")}</Label>
              <Select value={form.gender} onValueChange={(value) => setField("gender", value as Gender)}>
                <SelectTrigger id="member-gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {genderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-birthDate">{t("member.form.birthDate")}</Label>
              <Input
                id="member-birthDate"
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setField("birthDate", e.target.value)}
                dir="ltr"
              />
              {fieldErrors.birthDate ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.birthDate}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>{t("member.form.branch")} *</Label>
              <Select value={form.homeBranchId} onValueChange={(value) => setField("homeBranchId", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("members.branch.all")} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {locale === "fa" ? branch.nameFa : branch.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.homeBranchId ? (
                <p className="text-xs font-medium text-destructive">{fieldErrors.homeBranchId}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-card">{t("member.form.card")}</Label>
            <Input
              id="member-card"
              value={form.cardCode}
              onChange={(e) => setField("cardCode", e.target.value)}
              placeholder={t("member.form.card.placeholder")}
              dir="ltr"
              maxLength={64}
            />
            {fieldErrors.cardCode ? <p className="text-xs font-medium text-destructive">{fieldErrors.cardCode}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-notes">{t("member.form.notes")}</Label>
            <Textarea
              id="member-notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
              {submitting
                ? t("member.form.submitting")
                : isEdit
                  ? t("member.form.submit.edit")
                  : t("member.form.submit.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
