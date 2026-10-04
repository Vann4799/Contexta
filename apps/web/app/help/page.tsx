import Link from "next/link";
import { AlertTriangle, Bot, CircleHelp, FileText, LifeBuoy, MessageSquareText, RefreshCw, Server } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const workflowSteps = [
  {
    title: "Upload dokumen",
    description: "Masuk ke Documents, pilih PDF atau DOCX, lalu tunggu status berubah menjadi Ready.",
    icon: FileText
  },
  {
    title: "Pilih dokumen di Chat",
    description: "Satu percakapan membahas satu dokumen. Pilih dokumen lebih dulu supaya jawaban tidak tercampur.",
    icon: MessageSquareText
  },
  {
    title: "Tanya dengan spesifik",
    description: "Minta ringkasan, hitung baris/nama, cari metrik tertinggi, atau bandingkan isi dokumen.",
    icon: Bot
  }
];

const troubleshootingItems = [
  {
    problem: "Dokumen lama di Processing",
    answer: "Pastikan API, worker, dan Qdrant Docker sedang jalan. Klik Refresh di Documents untuk cek status terbaru.",
    icon: RefreshCw
  },
  {
    problem: "Chat terasa lama",
    answer: "Pertanyaan analitik pada dokumen besar butuh ekstraksi konteks dan panggilan LLM. Kalau terlalu lama, batalkan lalu tanyakan lebih spesifik.",
    icon: AlertTriangle
  },
  {
    problem: "Jawaban perlu angka akurat",
    answer: "Gunakan pertanyaan eksplisit seperti 'hitung total baris untuk nama X' atau 'posting dengan Like tertinggi'. Contexta memakai jalur hitung deterministik untuk pola tabel umum.",
    icon: CircleHelp
  },
  {
    problem: "Convert PDF ke Markdown gagal",
    answer: "Coba PDF yang tidak rusak dan tidak terenkripsi. Tool convert memakai MarkItDown di API lokal.",
    icon: Server
  }
];

const exampleQuestions = [
  "Ringkas dokumen ini dalam 5 poin.",
  "Apa masalah utama dan solusi yang ditawarkan dokumen ini?",
  "Siapa creator dengan view paling tinggi?",
  "Hitung total postingan untuk nama ISA.",
  "Postingan mana yang punya like paling tinggi?",
  "Buatkan daftar insight yang bisa dipakai untuk keputusan bisnis."
];

export default function HelpPage() {
  return (
    <AppShell title="Help">
      <div className="space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Contexta Help</p>
            <h2 className="mt-2 title-rule font-heading text-3xl font-semibold text-ink">Panduan workspace</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">
              Tempat cepat untuk memahami alur Contexta, cara bertanya ke dokumen, dan apa yang harus dicek kalau upload atau chat terasa bermasalah.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center justify-center rounded border border-border bg-surface px-4 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary" href="/documents">
              Manage documents
            </Link>
            <Link className="inline-flex h-10 items-center justify-center rounded border border-primary bg-primary px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong" href="/chat">
              Open chat
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded border border-border bg-surface p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-contexta bg-accent-soft text-primary">
                  <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-subtle">{step.description}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-12">
          <article className="rounded border border-border bg-surface p-6 lg:col-span-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-contexta bg-accent-soft text-primary">
                <LifeBuoy className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold text-ink">Troubleshooting</h3>
                <p className="mt-1 text-sm text-subtle">Masalah yang paling sering muncul saat memakai Contexta lokal.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {troubleshootingItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.problem} className="rounded border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Icon className="h-4 w-4 text-primary" strokeWidth={2.1} aria-hidden="true" />
                      {item.problem}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-subtle">{item.answer}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="space-y-4 lg:col-span-5">
            <article className="rounded border border-border bg-surface p-5">
              <h3 className="font-heading text-xl font-semibold text-ink">Contoh pertanyaan</h3>
              <div className="mt-4 space-y-2">
                {exampleQuestions.map((question) => (
                  <div key={question} className="rounded border border-border bg-background px-4 py-3 text-sm text-ink">
                    {question}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded border border-border bg-surface p-5">
              <h3 className="font-heading text-xl font-semibold text-ink">Runtime lokal</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                  <span className="text-subtle">Web</span>
                  <span className="font-mono text-xs text-ink">localhost:3000</span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                  <span className="text-subtle">API</span>
                  <span className="font-mono text-xs text-ink">127.0.0.1:8001</span>
                </div>
                <div className="flex items-center justify-between rounded bg-muted px-3 py-2">
                  <span className="text-subtle">Vector DB</span>
                  <span className="font-mono text-xs text-ink">Qdrant Docker</span>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
