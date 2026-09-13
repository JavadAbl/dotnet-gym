"use client";

import * as React from "react";
import { KeyRound, UserCog } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createUser, resetUserPassword } from "@/lib/gms/api";
import type { Branch, Role, SystemUser } from "@/lib/gms/types";
import { GmsApiError } from "@/lib/gms/demo-store";
import { useI18n } from "./providers";

const ROLES: Role[] = ["admin", "reception", "buffet", "coach"];

interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onSaved: (user: SystemUser) => void;
}

/** v2.1 — operator account creation (admin only), mirrors POST /identity/users. */
export function UserCreateDialog({ open, onOpenChange, branches, onSaved }: UserCreateDialogProps) {
  const { t, locale } = useI18n();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [role, setRole] = React.useState<Role>("reception");
  const [branchId, setBranchId] = React.useState<string>("none");
  const [isActive, setIsActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setDisplayName("");
      setRole("reception");
      setBranchId("none");
      setIsActive(true);
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  const activeBranches = branches.filter((b) => b.isActive);
  const usernameValid = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(username.trim().toLowerCase()) && username.trim().length >= 3;
  const canSubmit =
    usernameValid &&
    password.length >= 8 &&
    displayName.trim().length > 0 &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const saved = await createUser({
        username: username.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        role,
        branchId: branchId === "none" ? null : branchId,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-emerald-600" />
              {t("users.create.title")}
            </DialogTitle>
            <DialogDescription>{t("users.create.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="user-username">{t("users.form.username")}</Label>
            <Input
              id="user-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("users.form.username.placeholder")}
              maxLength={64}
              dir="ltr"
              className="font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t("users.form.username.hint")}</p>
            {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-password">{t("users.form.password")}</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
              dir="ltr"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t("users.form.password.hint")}</p>
            {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-display-name">{t("users.form.displayName")}</Label>
            <Input
              id="user-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("users.form.displayName.placeholder")}
              maxLength={128}
            />
            {fieldErrors.displayName ? <p className="text-xs text-destructive">{fieldErrors.displayName}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("users.form.role")}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.role ? <p className="text-xs text-destructive">{fieldErrors.role}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t("users.form.branch")}</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger id="user-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("users.form.branch.none")}</SelectItem>
                {activeBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {locale === "fa" ? branch.nameFa : branch.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("users.form.branch.hint")}</p>
            {fieldErrors.branchId ? <p className="text-xs text-destructive">{fieldErrors.branchId}</p> : null}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="user-active" className="text-sm font-normal">
              {t("users.form.active")}
            </Label>
            <Switch id="user-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? t("users.form.submitting") : t("users.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface UserResetPasswordDialogProps {
  user: SystemUser | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: SystemUser) => void;
}

/** v2.1 — password reset (admin only), mirrors POST /identity/users/{id}/password. */
export function UserResetPasswordDialog({ user, onOpenChange, onSaved }: UserResetPasswordDialogProps) {
  const { t, locale } = useI18n();
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setPassword("");
      setError(null);
    }
  }, [user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await resetUserPassword(user.id, password);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof GmsApiError ? err.message : t("common.error.save"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir={locale === "fa" ? "rtl" : "ltr"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              {t("users.reset.title")}
            </DialogTitle>
            <DialogDescription>
              {t("users.reset.description", { name: user?.displayName ?? "" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="user-new-password">{t("users.reset.newPassword")}</Label>
            <Input
              id="user-new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
              dir="ltr"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{t("users.form.password.hint")}</p>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("member.form.cancel")}
            </Button>
            <Button type="submit" disabled={password.length < 8 || submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? t("users.form.submitting") : t("users.reset.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
