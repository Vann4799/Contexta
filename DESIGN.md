---
version: 1
name: Contexta Reading Room
dials: ENERGY 1 / RHYTHM 1 / MOTION 2
---

# Design — Contexta

Locked design system. Semua halaman baru baca file ini dulu dan tunduk ke dia.
Amend secara sengaja — file ini aturannya, bukan catatan.

## System
- Kind · web app (workspace document-intelligence / RAG chat) untuk profesional yang "ngobrol" sama dokumennya
- Genre · editorial print — ruang baca, bukan dashboard
- Axes · paper band terang hangat / display serif / accent clay
- Anchor · majalah cetak editorial · counter-anchor · kertas arsip & alat ukur fisik (bentuk non-software)
- Dark mode · terang utama; token dark disiapkan di `## Variants`, belum di-wire

## Design Read
> Membaca ini sebagai: web app kerja untuk membaca & menanyai dokumen, dalam bahasa visual ruang baca cetak, dial 1 / 1 / 2.

Differentiator · Fraunces di atas kertas hangat, garis hairline, satu aksen clay — Contexta terbaca seperti ruang baca cetak untuk dokumen lu, bukan dashboard AI: tanpa label uppercase mono, tanpa kartu shadow abu-abu, tanpa biru default.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 2
Status: locked
Kalem di kedua sumbu adalah keputusan: identitas datang dari tipografi, paper hangat, dan clay — bukan dari komposisi berani.

## Tokens
```css
:root {
  --color-paper:      oklch(0.97 0.012 85);
  --color-paper-2:    oklch(0.945 0.014 85);
  --color-ink:        oklch(0.25 0.012 70);
  --color-ink-2:      oklch(0.45 0.014 70);
  --color-rule:       oklch(0.25 0.012 70 / 0.14);
  --color-accent:     oklch(0.52 0.13 45);
  --color-accent-soft: oklch(0.52 0.13 45 / 0.12);
  --color-accent-ink: oklch(0.97 0.012 85);
  --color-focus:      oklch(0.52 0.13 45);

  --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-body:    "Public Sans", system-ui, -apple-system, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, Consolas, monospace;

  --space-2xs: 4px;  --space-xs: 8px;  --space-s: 12px;  --space-m: 16px;
  --space-l: 24px;   --space-xl: 40px; --space-2xl: 56px;

  --text-xs: 12px;  --text-s: 14px;  --text-base: 16px;
  --text-l: 20px;   --text-xl: 25px; --text-2xl: 31px; --text-display: 40px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 180ms;  --dur-base: 240ms;  --dur-slow: 320ms;

  --radius-card: 4px;  --radius-pill: 999px;  --radius-input: 4px;
}
```

## Type
- Display · `Fraunces` · judul halaman & judul jawaban AI (h1–h2), tidak untuk kontrol · 2 weight (SemiBold, Regular)
- Body · `Public Sans` · semua teks UI, chat, form, tabel · 3 weight (400/500/600)
- Mono · `JetBrains Mono` · markdown preview, kode, ID dokumen · sudah dimuat via Google Fonts
- Fallback logic · system-ui dipakai lebih dulu saat jaringan lambat; Georgia menggantikan Fraunces; budget total 5 file font

## Layout
- Grid · app shell: sidebar nav desktop (240px) + bottom nav mobile; konten satu kolom
- Measure · jawaban chat & preview dokumen max 68ch; halaman max 1100px
- Section rhythm · `--space-l` antar blok dalam halaman, `--space-xl` antar section
- Focal rule · satu focal point per layar: di Chat = kolom percakapan; di Documents = daftar dokumen; dashboard = panel utama

## Components
- Card · border hairline `--color-rule` di atas `--color-paper-2`; tanpa shadow (shadow hanya elemen mengambang: drawer, popover, bubble chat)
- Primary control · fill `--color-accent`, teks `--color-accent-ink`, `--radius-input`, padding `--space-xs --space-m`
- Secondary control · outline 1px `--color-ink` transparan, teks `--color-ink` — beda struktur dari primary, bukan cuma beda hue
- Divider · hairline 1px `--color-rule`, tanpa gradasi
- Focus · ring 2px `--color-focus` offset 2px — wajib di semua interaktif
- Identity motif · double hairline rule di bawah H1 setiap halaman (gestur editorial print)

## Motion
- Stance · 1–2 reveal primitives, semuanya kalem
- Primitives · fade-up ≤200ms saat konten masuk; crossfade state (upload → ready); shimmer tipis untuk loading LLM
- Reduced-motion · ≤150 ms opacity crossfade, tanpa transform

## Decisions
- **color** · paper hangat + ink gelap hangat karena produknya membaca dokumen — mata harus nyaman di teks panjang, bukan kanvas dingin
- **type** · Fraunces jadi identitas ruang baca cetak; Public Sans pendukung diam supaya transkrip chat tetap enak dibaca kecil
- **layout** · satu kolom + measure 68ch karena jawaban RAG adalah long-form reading, bukan grid widget
- **spacing** · skala 4pt kompak karena ini alat kerja harian, bukan landing marketing
- **radius** · satu angka 4px ala form cetak — tidak ada keputusan radius per komponen
- **motion** · MOTION 2 halus karena latency LLM butuh feedback lembut, bukan arcade
- **accent** · satu hue clay (tinta terracotta) hanya untuk kontrol utama, link, dan sitasi — tidak pernah jadi background section

## Do's and Don'ts
- Do · sentence case untuk semua label & status (Ready, Processing) — bukan UPPERCASE mono (ilfeel owner)
- Do · `font-variant-numeric: tabular-nums` untuk angka stat & tabel hitungan
- Do · empty state pakai diagram garis manual (digambar, bukan AI-generated illustration)
- Don't · Tailwind `blue-600` + Inter sebagai identitas (diganti clay + Fraunces/Public Sans)
- Don't · label mono uppercase mikro ala HUD (hard no dari owner)
- Don't · kartu putih rounded + `shadow-soft` di atas abu — default Tailwind SaaS (ilfeel owner)
- Don't · hex lavender hard-coded (`#f9f9ff`, `#dce2f3`, `#dbe1ff`, `#f4f6ff`) — semua warna lewat token
- Don't · backdrop-blur glass, radial bloom, aurora/mesh gradient
- Don't · gradient blue→purple pada apapun; `transition-all` — sebut propertinya

## Exports
`tokens.css`, `tailwind.theme.css`, `tokens.json`, `shadcn.vars.css` — dihasilkan
`scripts/export_design.mjs`, di `apps/web/`. Yang aktif di-pake cuma `tokens.css`
(import di `app/globals.css`) + nilai token di-echo di `tailwind.config.ts`
`theme.extend.colors/fontFamily`. Jangan edit export tangan — ubah `:root` di
file ini lalu generate ulang. Bundle lama `public/contexta.css` + script
`build:css` sudah dihapus (double-CSS warisan, Next compile `globals.css` sendiri).

## Variants
- Dark (disiapkan, belum di-wire) · paper oklch(0.22 0.01 70), paper-2 oklch(0.26 0.012 70), ink oklch(0.93 0.008 85), ink-2 oklch(0.72 0.012 70), rule oklch(0.93 0.008 85 / 0.18), accent oklch(0.72 0.11 50), accent-ink oklch(0.22 0.01 70). Diaktifkan lewat `[data-theme="dark"]` saat wiring.
