import type { Metadata } from "next";
import { DashboardClient } from "@/components/gms/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard — GMS",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
