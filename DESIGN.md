---
version: 2
name: Contexta Acid Lab
dials: ENERGY 2 / RHYTHM 2 / MOTION 2
---

# Design — Contexta

Locked design system. Semua halaman baru baca file ini dulu dan tunduk ke dia.
Amend secara sengaja — file ini aturannya, bukan catatan.

> **v2 (2026-10-06)** menggantikan v1 "Reading Room" (paper krem + Fraunces + clay).
> Arah baru diambil dari UI pipeline yang di-build owner di
> `C:/Users/M S I/contexta-dashboard`: kertas abu-kuning bergaris, Inter + JetBrains
> Mono, satu aksen acid lime, tile hitam sebagai elemen fokus, kartu shadow lembut,
> top-nav pill. v1 tidak dipakai lagi — jangan campur dua bahasa.

## System
- Kind · web app (workspace document-intelligence / RAG chat) — kini juga dashboard pipeline retrieval
- Genre · lab instrument / control panel cetak — kertas teknis + marker stabilo, bukan SaaS gradien
- Axes · paper band terang netral / sans geometris + mono / satu aksen acid lime
- Anchor · lembar kerja lab & panel instrumen (garis kisi, label kecil, angka besar) · counter-anchor · dashboard SaaS gelap bergradien
- Dark mode · tidak ada tema gelap; `night` dipakai sebagai **blok fokus di atas terang**, bukan sebagai mode

## Design Read
> Membaca ini sebagai: alat kerja harian yang mengukur pipeline RAG, dalam bahasa visual instrumen lab di kertas, dial 2 / 2 / 2.

Differentiator · kertas `#ebe8df` bergaris vertikal 80px, angka besar Inter di atas label eyebrow kecil, mono untuk semua ID/metrik, dan satu marker lime di atas tile hitam — Contexta terbaca seperti lembar ukur, bukan dashboard AI: tanpa gradien, tanpa glass, tanpa biru default.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2
Status: locked
Energi datang dari kontras (hitam pekat + lime di atas kertas) dan skala tipografi (30px vs 10.5px), bukan dari warna pelangi atau animasi berisik.

## Tokens
```css
:root {
  /* paper · permukaan terang */
  --color-paper:        #ebe8df;  /* background halaman */
  --color-paper-deep:   #e7e3d8;  /* kanvas graph */
  --color-card:         #fdfdfb;  /* permukaan kartu/panel */
  --color-paper-soft:   #f7f6f2;  /* nav pill non-aktif */
  --color-paper-chip:   #f3f0e5;  /* chip / tag / tab */
  --color-paper-line:   #ddd7cb;  /* semua border */
  --color-paper-edge:   #c9c4b6;  /* konektor abu, border dashed */

  /* ink · teks */
  --color-ink:          #131315;
  --color-ink-muted:    #68686c;  /* dinaikkan dari #6e6e72 biar lolos AA di paper */
  --color-ink-faint:    #9a9a9e;  /* HANYA dekoratif / disabled, bukan teks informasi */
  --color-rule:         rgba(19, 19, 21, 0.045); /* garis kisi vertikal */

  /* night · blok fokus */
  --color-night:        #1b1b1b;
  --color-night-raised: #2b2b2b;
  --color-night-line:   #333333;

  /* accent · acid lime. SELALU berpasangan teks di atasnya, tidak pernah teks */
  --color-accent:       #f2fb48;
  --color-accent-deep:  #d9e23a;  /* garis konektor graph */
  --color-accent-ink:   #131315;  /* teks di atas lime */
  --color-focus:        #131315;

  /* status · label teks selalu ada, warna bukan satu-satunya sinyal */
  --color-success:      #f2fb48;              /* pill: bg lime + teks ink (16.5:1) */
  --color-success-ink:  #2f6b46;              /* teks hijau di paper (5.2:1) */
  --color-success-soft: #e3edda;
  --color-success-line: rgba(47, 107, 70, 0.3);
  --color-warning:      #7c5210;              /* teks ochre di paper (5.6:1) */
  --color-warning-soft: #f4e3cd;
  --color-warning-line: rgba(124, 82, 16, 0.32);
  --color-danger:       #a3231b;              /* teks brick di paper (6.1:1) */
  --color-danger-soft:  #fadfd9;
  --color-danger-line:  rgba(163, 35, 27, 0.3);

  --font-display: "Inter", ui-sans-serif, system-ui, sans-serif; /* = sans, tanpa serif lagi */
  --font-body:    "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;

  --space-2xs: 4px;  --space-xs: 8px;  --space-s: 12px;  --space-m: 16px;
  --space-l: 24px;   --space-xl: 40px; --space-2xl: 56px;

  --text-eyebrow: 10.5px; --text-xs: 11.5px; --text-s: 12.5px;
  --text-ui: 13.5px;  --text-base: 16px;  --text-l: 20px;
  --text-metric: 30px; --text-xl: 22px;  --text-2xl: 31px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 180ms;  --dur-base: 240ms;  --dur-slow: 320ms;

  --radius-card: 16px;  /* rounded-2xl — panel & kartu besar */
  --radius-control: 8px; /* rounded-lg — tombol, pill nav, input */
  --radius-chip: 6px;   /* rounded-md — chip, tab kecil, ikon btn */
  --radius-pill: 999px;

  --shadow-card: 0 1px 0 rgba(20,20,20,0.04), 0 8px 24px -12px rgba(20,20,20,0.12);
  --shadow-node: 0 1px 2px rgba(20,20,20,0.06), 0 4px 12px -6px rgba(20,20,20,0.12);
  --shadow-root: 0 18px 40px -16px rgba(0,0,0,0.45);
}
```

## Type
- Display · `Inter` · judul halaman & angka metrik — weight 600, `tracking-tight`, tidak untuk badan teks
- Body · `Inter` · semua UI, chat, form, tabel · 400/500/600
- Mono · `JetBrains Mono` · ID indeks, nama file/chunk, token count, skor, timestamp, nilai metrik kecil
- Eyebrow · `Inter` 10.5px / 600 / `tracking-[0.12em]` / `--color-ink-muted` · label di atas angka stat — satu-satunya tempat uppercase boleh
- Fallback logic · dimuat via `next/font` (bukan `<link>`) jadi ada class variable `--font-sans` / `--font-mono`; fallback system saat lambat

## Layout
- Grid · top-nav satu baris + kolom `max-w-[1440px]`, padding `px-3 sm:px-4`, antar blok `gap-3`
- Surface · panel = `.surface` (card, radius 16px, border `--color-paper-line`, `--shadow-card`) di atas kertas bergaris
- Measure · jawaban chat & preview dokumen max 68ch; metrik pakai grid 2→3→5 kolom
- Section rhythm · `--space-s` antar blok dalam panel, `--space-l` antar panel, `--space-xl` header ke konten
- Focal rule · satu tile `night` per layar sebagai titik fokus (avatar, root node, badge metrik) — lebih dari satu = tidak ada yang fokus
- Latar · garis vertikal 1px tiap 80px di `body` (`--color-rule`); `dot-grid` hanya untuk area kosong/kanvas

## Components
- Card / surface · `--color-card` + border `--color-paper-line` + `--shadow-card`, radius `--radius-card`
- Primary control · fill `--color-night`, teks `#fdfdfb`, radius `--radius-control`, `--shadow-node`; hover `--color-night-raised`
- Accent control · fill `--color-accent`, teks `--color-accent-ink` — khusus CTA utama & badge status aktif, maksimal satu per layar
- Secondary control · fill `--color-paper-soft`, border transparan → `--color-paper-line` saat hover, teks `--color-ink`
- Pill nav / tab · h-9 (nav) / h-7 (tab); aktif = `--color-card` + border + `--shadow-node`, non-aktif = `--color-paper-soft` / `--color-paper-chip`
- Chip · `--color-paper-chip`, radius `--radius-chip`, teks `--text-xs` mono bila berupa ID/angka
- Badge · lime = aktif/tersinkron; `night` = penanda teknis; tidak pernah gradien
- Divider · 1px `--color-paper-line` (di atas night pakai `--color-night-line`)
- Focus · `focus-visible:ring-2 ring-ink/80 ring-offset-2 ring-offset-paper` — wajib di semua interaktif
- Status · Ready = lime bg + ink teks, Processing = `night` bg + lime teks, Failed = `--color-danger` di `--color-danger-soft`; selalu ada label kata
- Data viz · konektor kurva S: trunk `--color-accent-deep` 2.25px + jalur abu 4px, branch `--color-paper-edge` → `--color-ink` saat hover; garis putus-putus beranimasi = aliran hidup
- Avatar · lingkaran `--color-night` ring putih 2px + titik dalam lime

## Motion
- Stance · gerak kecil yang menandakan "alat ini hidup", bukan dekorasi
- Primitives · `animate-dash` (aliran konektor, linear tak terbatas), `animate-pulse-dot` (status hidup, 1.8s), transisi `transform`/`opacity` ≤240ms `--ease-out` pada pill & kartu
- Reduced-motion · matikan `animate-dash` dan `animate-pulse-dot`, sisakan opacity ≤150ms

## Decisions
- **color** · kertas netral + hitam pekat + satu lime karena produknya mengukur (metrik, status, graph) — butuh penanda, bukan nuansa
- **type** · Inter untuk segala hal struktural, JetBrains Mono untuk segala hal yang berupa data; serif dibuang karena v1 sudah bukan arah produk
- **layout** · top-nav pill menggantikan sidebar: halaman pipeline & dashboard butuh lebar penuh, dan nav horizontal bikin satu titik fokus per layar
- **spacing** · `gap-3` antar panel supaya layar 1440px tetap muat banyak tanpa terasa padat
- **radius** · tiga angka (16/8/6) — kartu, kontrol, chip; tidak ada keputusan radius per komponen
- **elevation** · shadow lembut dua lapis, bukan hairline-only: kartu harus terasa melayang di atas kertas bergaris
- **accent** · lime hanya di atas hitam atau sebagai teks-nya-hitam; di paper kontrasnya 1.09:1 jadi tidak pernah jadi warna teks
- **night-blocks** · tile gelap dipakai sebagai focal point, maksimal satu per layar

## Do's and Don'ts
- Do · angka metrik `tabular-nums` + `tracking-tight` + `--text-metric`
- Do · semua ID / nama file / skor / timestamp pakai mono
- Do · eyebrow uppercase 10.5px hanya untuk label stat & section kecil
- Do · status pakai label kata, bukan warna saja
- Don't · teks `--color-accent` / lime di atas paper (kontras 1.09:1)
- Don't · `--color-ink-faint` untuk teks informasi (2.29:1) — disabled atau ornamen saja
- Don't · Fraunces / serif, clay `#…45 hue`, hairline-only card — semua milik v1
- Don't · Tailwind `blue-*`, `emerald-*`, `green-*`, `red-*`, `amber-*` — pakai token
- Don't · hex baru di komponen; kalau butuh warna, tambah token di file ini dulu
- Don't · gradien, backdrop-blur glass, aurora/mesh, shadow keras satu arah
- Don't · `transition-all` — sebut propertinya

## Exports
Yang aktif di-pake: `apps/web/tokens.css` (import di `app/globals.css`) + nilai
token di-echo di `apps/web/tailwind.config.ts` (`theme.extend.colors /
fontFamily / borderRadius / boxShadow`). Jangan edit `tokens.css` tangan — ubah
`:root` di file ini lalu sinkronkan.

**Jembatan migrasi v1→v2 (fase B–I):** `tailwind.config.ts` masih mengekspor
nama lama (`background surface muted soft border primary accent accent-strong
accent-soft accent-ink ink subtle success warning danger`) yang menunjuk ke nilai
v2, supaya halaman yang belum dirombak tetap terbaca benar. Hapus blok alias itu
di Fase I setelah sweep kelas lama selesai, dan ganti pemakaian `--font-display`
serif bila masih ada.

## Variants
- Dark (belum di-wire, disiapkan) · paper `#141416`, paper-deep `#1b1b1b`, card `#232325`, paper-soft `#2b2b2b`, paper-chip `#333336`, paper-line `#3a3a3e`, ink `#f1efe8`, ink-muted `#a9a9ae`, accent tetap `#f2fb48` dengan teks `#131315`. Diaktifkan lewat `[data-theme="dark"]`.
- Print / export dokumen · buang garis kisi, `--color-card` jadi putih, shadow mati, mono dipertahankan.
