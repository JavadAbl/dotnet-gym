"use client";

import * as React from "react";
import { Toaster, toast } from "sonner";
import { listBranches, listPackages, setMemberStatus } from "@/lib/gms/api";
import type { Branch, ExercisePackage, Member, MemberPackage, MemberStatus } from "@/lib/gms/types";
import { AppShell, type ViewKey } from "@/components/gms/app-shell";
import { AttendanceView } from "@/components/gms/attendance-view";
import { BranchesView } from "@/components/gms/branches-view";
import { UsersView } from "@/components/gms/users-view";
import { BuffetView } from "@/components/gms/buffet-view";
import { CoachingView } from "@/components/gms/coaching-view";
import { DashboardView } from "@/components/gms/dashboard-view";
import { LoginView } from "@/components/gms/login-view";
import { MemberDetailSheet } from "@/components/gms/member-detail-sheet";
import { MemberFormDialog } from "@/components/gms/member-form-dialog";
import { MembersView } from "@/components/gms/members-view";
import { PackagesView } from "@/components/gms/packages-view";
import { RefundDialog } from "@/components/gms/refund-dialog";
import { SalesView } from "@/components/gms/sales-view";
import { SellPackageDialog } from "@/components/gms/sell-package-dialog";
import { TopUpDialog } from "@/components/gms/top-up-dialog";
import { WalletView } from "@/components/gms/wallet-view";
import { GmsProviders, useAuth, useI18n } from "@/components/gms/providers";

export default function Page() {
  return (
    <GmsProviders>
      <Toaster position="top-center" richColors />
      <Gate />
    </GmsProviders>
  );
}

/** Login gate: shows the login view until a valid session exists. */
function Gate() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return session ? <Workspace /> : <LoginView />;
}

/** Authenticated area: shell + client-side view switching (single-route constraint). */
function Workspace() {
  const { t } = useI18n();
  const [view, setView] = React.useState<ViewKey>("dashboard");
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [packages, setPackages] = React.useState<ExercisePackage[]>([]);
  const [membersRefresh, setMembersRefresh] = React.useState(0);
  const [salesRefresh, setSalesRefresh] = React.useState(0);
  const [walletRefresh, setWalletRefresh] = React.useState(0);
  const [buffetRefresh, setBuffetRefresh] = React.useState(0);

  // dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [detailMember, setDetailMember] = React.useState<Member | null>(null);
  const [sellOpen, setSellOpen] = React.useState(false);
  const [sellPresetMember, setSellPresetMember] = React.useState<Member | null>(null);
  const [refundTarget, setRefundTarget] = React.useState<MemberPackage | null>(null);
  const [topupOpen, setTopupOpen] = React.useState(false);
  const [topupPresetMember, setTopupPresetMember] = React.useState<Member | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listBranches()
      .then((items) => {
        if (!cancelled) setBranches(items);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    listPackages()
      .then((items) => {
        if (!cancelled) setPackages(items);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditingMember(null);
    setFormOpen(true);
  }

  function openEdit(member: Member) {
    setEditingMember(member);
    setFormOpen(true);
  }

  function openSell(member?: Member) {
    setSellPresetMember(member ?? null);
    setSellOpen(true);
  }

  async function handleSetStatus(member: Member, status: MemberStatus) {
    try {
      const updated = await setMemberStatus(member.id, status);
      setDetailMember(updated);
      setMembersRefresh((n) => n + 1);
      toast.success(t("member.statusChanged"));
    } catch {
      toast.error(t("common.error.save"));
    }
  }

  function handleSaved(member: Member, mode: "create" | "edit") {
    setMembersRefresh((n) => n + 1);
    setDetailMember(null);
    toast.success(mode === "create" ? t("member.created") : t("member.updated"));
    void member;
  }

  function handleSold(sold: MemberPackage) {
    toast.success(t("sell.created"));
    setSalesRefresh((n) => n + 1);
    setMembersRefresh((n) => n + 1);
    void sold;
  }

  function handleRefunded() {
    toast.success(t("sales.refunded"));
    setSalesRefresh((n) => n + 1);
    setMembersRefresh((n) => n + 1);
  }

  function openTopUp(member?: Member) {
    setTopupPresetMember(member ?? null);
    setTopupOpen(true);
  }

  function handleToppedUp() {
    toast.success(t("wallet.topup.success.toast"));
    setWalletRefresh((n) => n + 1);
    setMembersRefresh((n) => n + 1);
  }

  return (
    <AppShell view={view} onViewChange={setView}>
      {view === "dashboard" ? (
        <DashboardView
          onOpenAttendance={() => setView("attendance")}
          onOpenBuffet={() => setView("buffet")}
          onOpenCoaching={() => setView("coaching")}
          onCreateMember={openCreate}
          onSell={() => openSell()}
          onTopUp={() => openTopUp()}
        />
      ) : null}
      {view === "members" ? (
        <MembersView
          branches={branches}
          onEdit={openEdit}
          onDetail={setDetailMember}
          onCreate={openCreate}
          refreshSignal={membersRefresh}
        />
      ) : null}
      {view === "attendance" ? <AttendanceView branches={branches} /> : null}
      {view === "sales" ? (
        <SalesView
          branches={branches}
          onSell={() => openSell()}
          onRefund={setRefundTarget}
          refreshSignal={salesRefresh}
        />
      ) : null}
      {view === "wallet" ? (
        <WalletView branches={branches} refreshSignal={walletRefresh} />
      ) : null}
      {view === "coaching" ? <CoachingView branches={branches} /> : null}
      {view === "buffet" ? <BuffetView branches={branches} refreshSignal={buffetRefresh} /> : null}
      {view === "packages" ? <PackagesView /> : null}
      {view === "branches" ? <BranchesView /> : null}
      {view === "users" ? <UsersView /> : null}

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        branches={branches}
        member={editingMember}
        onSaved={handleSaved}
      />

      <MemberDetailSheet
        member={detailMember}
        branches={branches}
        refreshSignal={membersRefresh}
        onOpenChange={(open) => (open ? undefined : setDetailMember(null))}
        onEdit={(member) => {
          setDetailMember(null);
          openEdit(member);
        }}
        onSetStatus={handleSetStatus}
        onSell={(member) => {
          setDetailMember(null);
          openSell(member);
        }}
        onTopUp={(member) => {
          setDetailMember(null);
          openTopUp(member);
        }}
      />

      <SellPackageDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        branches={branches}
        packages={packages}
        presetMember={sellPresetMember}
        onSold={handleSold}
      />

      <RefundDialog
        open={refundTarget !== null}
        onOpenChange={(open) => (open ? undefined : setRefundTarget(null))}
        memberPackage={refundTarget}
        onRefunded={handleRefunded}
      />

      <TopUpDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        branches={branches}
        presetMember={topupPresetMember}
        onToppedUp={handleToppedUp}
      />
    </AppShell>
  );
}
