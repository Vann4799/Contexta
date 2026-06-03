import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <section className="max-w-3xl rounded-contexta border border-border bg-white p-6">
        <h2 className="font-heading text-lg font-semibold">Workspace Settings</h2>
        <p className="mt-1 text-sm text-subtle">Supabase and DeepSeek settings will be connected in later phases.</p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            API base URL
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value="http://localhost:8000" readOnly />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Vector collection
            <input className="h-10 rounded border border-border px-3 text-sm font-normal text-subtle outline-none focus:border-primary" value="contexta_chunks" readOnly />
          </label>
        </div>
        <div className="mt-6">
          <Button variant="secondary">Save Changes</Button>
        </div>
      </section>
    </AppShell>
  );
}
