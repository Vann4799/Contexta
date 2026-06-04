import { AppShell } from "@/components/app-shell";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <DashboardInsights />
    </AppShell>
  );
}
