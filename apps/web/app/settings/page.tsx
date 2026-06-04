import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  return (
    <AppShell title="Settings">
      <section className="max-w-3xl rounded-contexta border border-border bg-white p-6">
        <h2 className="font-heading text-lg font-semibold">System Status</h2>
        <p className="mt-1 text-sm text-subtle">Read-only runtime settings for this local Contexta workspace.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            API base URL
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value={apiBaseUrl} readOnly />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Vector collection
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value="contexta_chunks" readOnly />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Supported uploads
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value="PDF and DOCX up to 50 MB" readOnly />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Answer generation
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value="DeepSeek API" readOnly />
          </label>
        </div>
      </section>
    </AppShell>
  );
}
