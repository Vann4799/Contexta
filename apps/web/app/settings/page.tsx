import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { Bot, Database, FileUp, HardDrive, KeyRound, Server, ShieldCheck, SlidersHorizontal } from "lucide-react";

export default function SettingsPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const runtimeItems = [
    { label: "API base URL", value: apiBaseUrl, icon: Server },
    { label: "Vector collection", value: "contexta_chunks", icon: Database },
    { label: "Supported uploads", value: "PDF and DOCX up to 50 MB", icon: FileUp },
    { label: "Answer generation", value: "DeepSeek API", icon: Bot }
  ];

  const capabilityItems = [
    { label: "Authentication", value: "Supabase email sign-in", icon: ShieldCheck },
    { label: "Document storage", value: "Supabase Storage", icon: HardDrive },
    { label: "Vector search", value: "Local Qdrant via Docker", icon: Database },
    { label: "Private keys", value: "Stored in server env only", icon: KeyRound }
  ];

  return (
    <AppShell>
      <div className="space-y-3">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Workspace Settings</p>
            <h2 className="mt-2 text-[26px] font-semibold text-ink">System controls</h2>
            <p className="mt-2 max-w-2xl text-[13px] text-ink-muted">
              Read-only configuration for this local Contexta workspace. Core secrets stay on the API server and are not exposed here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center justify-center rounded-card border border-paper-line bg-paper-card px-4 text-[13px] font-semibold text-ink transition hover:border-ink hover:text-ink" href="/documents">
              Manage documents
            </Link>
            <Link className="inline-flex h-10 items-center justify-center rounded-card border border-ink bg-night px-4 text-[13px] font-semibold text-white transition hover:bg-night-raised" href="/chat">
              Open chat
            </Link>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-12">
          <article className="rounded-card border border-paper-line bg-paper-card p-6 lg:col-span-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-paper-chip text-ink">
                <SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-ink">Runtime Status</h3>
                <p className="mt-1 text-[13px] text-ink-muted">Configuration currently used by the web app and API.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {runtimeItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-control border border-paper-line bg-paper p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                      <Icon className="h-4 w-4 text-ink" strokeWidth={2.1} aria-hidden="true" />
                      {item.label}
                    </div>
                    <div className="mt-3 rounded-control border border-paper-line bg-paper-card px-3 py-2 text-[13px] text-ink-muted">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="space-y-4 lg:col-span-4">
            <article className="rounded-card border border-paper-line bg-paper-card p-5">
              <h3 className="text-[17px] font-semibold text-ink">Mode</h3>
              <div className="mt-4 rounded-control border border-success-line bg-success-soft p-4">
                <p className="text-[13px] font-semibold text-success-ink">Single-user phase</p>
                <p className="mt-1 text-[13px] text-success-ink">
                  Workspace is optimized for local development and one owner account.
                </p>
              </div>
            </article>

            <article className="rounded-card border border-paper-line bg-paper-card p-5">
              <h3 className="text-[17px] font-semibold text-ink">Security Note</h3>
              <p className="mt-3 text-[13px] leading-6 text-ink-muted">
                Supabase service role, DeepSeek key, and database credentials must stay in backend `.env` files. The web app should only receive public client settings.
              </p>
            </article>
          </aside>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {capabilityItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-card border border-paper-line bg-paper-card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-card bg-paper-chip text-ink">
                  <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{item.label}</h3>
                <p className="mt-1 text-[13px] text-ink-muted">{item.value}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-card border border-paper-line bg-paper-card p-6">
          <h3 className="text-[17px] font-semibold text-ink">Operational Checklist</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {["API server running on port 8001", "Qdrant Docker container active", "Supabase project keys configured"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-card border border-paper-line bg-paper px-4 py-3 text-[13px] text-ink">
                <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
