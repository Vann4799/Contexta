import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const stats = [
  { label: "Total Documents", value: "0" },
  { label: "Ready", value: "0" },
  { label: "Recent Chats", value: "0" }
];

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <section className="grid gap-4 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-contexta border border-border bg-white p-5">
            <p className="text-sm text-subtle">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 rounded-contexta border border-border bg-white">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Document Library</h2>
            <p className="mt-1 text-sm text-subtle">Upload documents to start asking grounded questions.</p>
          </div>
          <Button className="w-full sm:w-auto">Upload Document</Button>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 rounded border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">No documents yet</p>
              <p className="mt-1 text-sm text-subtle">PDF and DOCX support will be wired in the upload phase.</p>
            </div>
            <StatusPill status="processing" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
