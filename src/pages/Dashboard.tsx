import { AppShell } from "@/components/layout";
import { DashboardOverview, CapabilitySnapshot, DreamJobCards } from "@/components/dashboard";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your career progress overview.
          </p>
        </div>

        <DashboardOverview />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DreamJobCards />
          </div>
          <div>
            <CapabilitySnapshot />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
