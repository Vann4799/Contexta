import type { Metadata } from "next";
import { localePath, type Locale } from "@/lib/locale";
import { siteUrl, type PublicPath } from "@/lib/site";

export const SITE_NAME = "Contexta";

/**
 * The head for every public URL, in one table, per locale.
 *
 * A page's title and description have to describe what the page actually renders, so each entry
 * is derived from that page's own H1 and lede in the locale dictionaries (`site.*`, `landing` for
 * the home page). Changing a heading without changing the matching entry here is how a snippet
 * starts lying.
 *
 * Titles are the base only: the root layout's template appends ` — Contexta`, so keep the base
 * near 48 characters to land the rendered title inside the 50-60 the SERP shows.
 */
const PAGES: Record<PublicPath, Record<Locale, { title: string; description: string }>> = {
  "/": {
    en: {
      title: "Chat with your PDF and DOCX documents",
      description:
        "Upload a PDF or Word document, ask it questions, and get answers that cite the page and section they came from. Summaries, an API, and full corpus export."
    },
    id: {
      title: "Chat dengan dokumen PDF dan DOCX Anda",
      description:
        "Unggah PDF atau dokumen Word, ajukan pertanyaan, dan dapatkan jawaban yang menyebut halaman serta bagiannya. Ringkasan, API, dan ekspor korpus penuh."
    }
  },
  "/about": {
    en: {
      title: "About: what Contexta is and what it will not do",
      description:
        "Contexta indexes PDFs and DOCX files so you can ask them questions and get answers that point back at the page they came from. Who runs it, and why."
    },
    id: {
      title: "Tentang: apa Contexta dan apa yang tidak ia klaim",
      description:
        "Contexta mengindeks berkas PDF dan DOCX supaya Anda bisa bertanya dan mendapat jawaban yang menunjuk kembali ke halaman asalnya. Siapa yang menjalankannya."
    }
  },
  "/blog": {
    en: {
      title: "Blog: engineering notes from building Contexta",
      description:
        "Short write-ups about decisions we made, with the measurement that forced them: a deleted chart library, token budgets, a paywall the server agrees with."
    },
    id: {
      title: "Blog: catatan teknik membangun Contexta",
      description:
        "Tulisan singkat soal keputusan yang benar-benar kami ambil, bersama pengukuran yang memaksanya: pustaka chart yang dihapus, budget token, paywall."
    }
  },
  "/careers": {
    en: {
      title: "Careers: no open roles right now",
      description:
        "Contexta is run by a small independent team, and the work in flight is not something we can hand to someone we have not worked with yet."
    },
    id: {
      title: "Karier: tidak ada posisi terbuka saat ini",
      description:
        "Contexta dijalankan tim independen kecil, dan pekerjaan yang sedang berjalan bukan sesuatu yang bisa kami serahkan ke orang yang belum kami kenal."
    }
  },
  "/changelog": {
    en: {
      title: "Changelog: what shipped, newest first",
      description:
        "Written from the commits that shipped, newest first. Deployment dates, not plan dates: indexing, chat quality, billing, and the workspace redesign."
    },
    id: {
      title: "Changelog: yang berubah, terbaru lebih dulu",
      description:
        "Ditulis dari commit yang benar-benar dikirim, terbaru lebih dulu. Tanggal deploy, bukan tanggal rencana: indeks, kualitas chat, billing, workspace."
    }
  },
  "/contact": {
    en: {
      title: "Contact: how to actually reach us",
      description:
        "Contexta has no public support inbox yet. Rather than print an address nobody reads, these are the in-app routes that actually reach the product."
    },
    id: {
      title: "Kontak: cara benar-benar menghubungi kami",
      description:
        "Contexta belum punya inbox dukungan publik. Daripada mencetak alamat yang tak ada yang membaca, ini jalur in-app yang benar-benar sampai ke produk."
    }
  },
  "/docs": {
    en: {
      title: "Documentation: guides, API reference and help",
      description:
        "Everything written down about Contexta in one place: the three-step first answer, four guides, the API reference, the help centre, plans and limits."
    },
    id: {
      title: "Dokumentasi: panduan, referensi API, dan bantuan",
      description:
        "Semua yang tertulis tentang Contexta dalam satu tempat: jawaban pertama tiga langkah, empat panduan, referensi API, pusat bantuan, paket dan batas."
    }
  },
  "/docs/api": {
    en: {
      title: "API reference: retrieval you can call",
      description:
        "The same retrieval the chat uses, behind a bearer token: authentication, the /v1 endpoints, error codes, quota headers, and the MCP tools."
    },
    id: {
      title: "Referensi API: retrieval yang bisa Anda panggil",
      description:
        "Retrieval yang sama dengan yang dipakai chat, di balik bearer token: autentikasi, endpoint /v1, kode error, header kuota, dan tool MCP."
    }
  },
  "/gdpr": {
    en: {
      title: "GDPR: your data in plain operational terms",
      description:
        "What we hold, for how long, and the exact screens you can use to exercise each right: controller, processors, export, deletion, and the 90-day log window."
    },
    id: {
      title: "GDPR: data Anda dalam istilah operasional",
      description:
        "Apa yang kami simpan, berapa lama, dan layar mana yang Anda pakai untuk tiap hak: controller, processor, ekspor, penghapusan, jendela log 90 hari."
    }
  },
  "/guides": {
    en: {
      title: "Guides: upload to first answer and citations",
      description:
        "Four short, ordered steps, each ending on a screen you can open right now: upload to first answer, reading a citation, using an API key, exporting your data."
    },
    id: {
      title: "Panduan: dari unggah ke jawaban pertama",
      description:
        "Empat langkah singkat dan berurutan, masing-masing berakhir di layar yang bisa Anda buka sekarang: unggah ke jawaban, membaca sitasi, API key, ekspor."
    }
  },
  "/pricing": {
    en: {
      title: "Pricing: the five limits the server enforces",
      description:
        "Every plan gets the same product. The tiers differ in five limits the server actually enforces: documents, storage, API keys, API requests and chat messages."
    },
    id: {
      title: "Harga: lima batas yang ditegakkan server",
      description:
        "Semua paket mendapat produk yang sama. Yang membedakan lima batas yang ditegakkan server: dokumen, penyimpanan, API key, request API, dan pesan chat."
    }
  },
  "/privacy": {
    en: {
      title: "Privacy Policy: what we collect and keep",
      description:
        "What Contexta collects and why, who processes your text, how long it is kept, cookies, international transfers, and how to export or delete your data."
    },
    id: {
      title: "Kebijakan Privasi: data yang disimpan",
      description:
        "Data apa yang Contexta kumpulkan dan mengapa, siapa yang memproses teks Anda, berapa lama disimpan, cookie, transfer internasional, hak ekspor dan hapus."
    }
  },
  "/security": {
    en: {
      title: "Security: what is protected, what is not claimed",
      description:
        "Hashed API keys, row-level security, per-key quotas and scoped access, plus a plain list of what Contexta is not certified as, and cannot promise today."
    },
    id: {
      title: "Keamanan: yang terlindungi dan yang tidak diklaim",
      description:
        "API key disimpan sebagai hash, row-level security, kuota per key, dan akses bertahap — plus daftar jujur soal apa yang tidak kami klaim hari ini."
    }
  },
  "/terms": {
    en: {
      title: "Terms of Service: what an account covers",
      description:
        "The agreement for a Contexta account: acceptable use, ownership of your documents, how generated answers are treated, billing, termination and liability."
    },
    id: {
      title: "Syarat Layanan: yang Anda setujui",
      description:
        "Perjanjian untuk akun Contexta: penggunaan wajar, kepemilikan dokumen, perlakuan jawaban hasil AI, penagihan, pengakhiran akun, dan batas tanggung jawab."
    }
  }
};

/** `%s — Contexta`, the template the root layout applies to every child title. */
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

// Same file and dimensions as app/opengraph-image.tsx. Declaring it here rather than relying on
// the file-based tag: a segment that sets its own `openGraph` object does not inherit it.
const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — your documents, understood by AI`
};

const OG_LOCALE: Record<Locale, string> = { en: "en_US", id: "id_ID" };

/** The pages search should see. Everything else under app/ is noindex by the root default. */
export function pageMeta(path: PublicPath, locale: Locale = "en"): Metadata {
  const copy = PAGES[path][locale];

  const canonical = localePath(path, locale);
  const ogTitle = `${copy.title} — ${SITE_NAME}`;

  return {
    title: copy.title,
    description: copy.description,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      // Every public page exists in both languages, so each one declares the pair. x-default is
      // English because that is what a visitor with no language signal gets.
      languages: {
        en: localePath(path, "en"),
        id: localePath(path, "id"),
        "x-default": localePath(path, "en")
      }
    },
    openGraph: {
      type: "website",
      url: `${siteUrl()}${canonical}`,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      title: ogTitle,
      description: copy.description,
      images: [SHARE_IMAGE]
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: copy.description,
      images: [SHARE_IMAGE]
    }
  };
}

/**
 * For a layout that has indexed children of its own (/docs -> /docs/api). A parent that declares
 * `title` as a plain string becomes the title template for its descendants, so the child's
 * rendered title loses ` — Contexta`. Re-declaring it as an explicit branch keeps the suffix.
 */
export function branchMeta(path: PublicPath, locale: Locale = "en"): Metadata {
  return { ...pageMeta(path, locale), title: { default: PAGES[path][locale].title, template: TITLE_TEMPLATE } };
}
