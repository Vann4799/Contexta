import type { Dictionary } from "@/locales/en";

export const id: Dictionary = {
  common: {
    language: "Bahasa",
    status: {
      ready: "Siap",
      processing: "Memproses",
      failed: "Gagal"
    },
    docTypes: {
      unclassified: "Belum diklasifikasi",
      sop: "SOP",
      policy: "Kebijakan",
      contract: "Kontrak",
      report: "Laporan",
      thesis: "Skripsi / makalah",
      reference: "Referensi",
      other: "Lainnya"
    }
  },
  shell: {
    home: "Beranda Contexta",
    primaryNav: "Navigasi utama",
    mobileNav: "Navigasi utama seluler",
    openNav: "Buka navigasi",
    accountMenu: "Menu akun",
    signedIn: "Sudah masuk",
    profile: "Profil",
    settings: "Pengaturan",
    help: "Bantuan",
    signOut: "Keluar",
    signingOut: "Sedang keluar",
    signOutFailed: "Gagal keluar.",
    checkingTitle: "Memeriksa akses",
    checkingBody: "Masuk dulu untuk membuka workspace Contexta kamu.",
    nav: {
      dashboard: "Dashboard",
      pipeline: "Pipeline",
      documents: "Dokumen",
      chat: "Chat",
      convert: "Konversi"
    }
  },
  auth: {
    emailAddress: "Alamat email",
    email: "Email",
    emailPlaceholder: "kamu@perusahaan.com",
    fullName: "Nama lengkap",
    fullNamePlaceholder: "Nama kamu",
    password: "Kata sandi",
    passwordPlaceholder: "Kata sandi",
    show: "Lihat",
    hide: "Sembunyi",
    showPassword: "Lihat kata sandi",
    hidePassword: "Sembunyikan kata sandi",
    submitting: "Memproses...",
    fallbackError: "Terjadi kesalahan. Coba lagi.",
    login: {
      button: "Masuk ke Contexta",
      error: "Isi email dan kata sandi kamu.",
      success: "Berhasil masuk. Mengarahkan ke dashboard kamu."
    },
    register: {
      button: "Buat akun Contexta",
      error: "Isi nama, email, dan kata sandi kamu.",
      success: "Akun dibuat. Cek email kamu untuk mengonfirmasi akun."
    },
    reset: {
      button: "Kirim tautan reset",
      error: "Isi email kamu.",
      success: "Tautan reset kata sandi dikirim. Cek kotak masuk kamu."
    },
    hero: {
      eyebrow: "Kecerdasan dokumen privat",
      titleLead: "Ubah dokumen privat menjadi",
      titleAccent: "keputusan yang jelas",
      titleTail: ".",
      subtitle: "Contexta menggabungkan chat RAG berdasar sumber, sitasi, dan kecerdasan dokumen dalam satu workspace yang fokus.",
      chatLabel: "Chat RAG berdasar sumber",
      chatNote: "setiap jawaban membawa sitasi per halaman",
      intelligenceLabel: "Kecerdasan dokumen",
      intelligenceNote: "ringkasan, poin penting, dan field terdeteksi",
      conversionLabel: "Konversi Markdown",
      conversionNote: "PDF dan DOCX keluar jadi teks yang mudah dipindah",
      caption: "© 2026 Contexta. Kecerdasan dokumen privat."
    },
    signIn: {
      eyebrow: "Masuk",
      title: "Selamat datang kembali",
      description: "Lanjutkan workspace kecerdasan dokumen kamu.",
      requestAccess: "Minta akses",
      forgot: "Lupa kata sandi?",
      footnote: "Akses aman untuk workspace dokumen RAG privat kamu."
    },
    registerPage: {
      eyebrow: "Dapatkan akses",
      title: "Buat akun",
      hasAccount: "Sudah punya akun?",
      signIn: "Masuk"
    },
    forgotPage: {
      eyebrow: "Pemulihan",
      title: "Reset kata sandi",
      description: "Isi email kamu dan Contexta akan mengirim tautan reset.",
      back: "Kembali ke halaman masuk"
    },
    updatePage: {
      eyebrow: "Keamanan akun",
      title: "Buat kata sandi baru",
      description: "Pilih kata sandi baru untuk akun Contexta kamu.",
      newPassword: "Kata sandi baru",
      confirmPassword: "Konfirmasi kata sandi",
      updating: "Memperbarui...",
      checkingSession: "Memeriksa sesi...",
      submit: "Perbarui kata sandi",
      requestNew: "Minta tautan reset baru",
      noSession: "Sesi reset kata sandi tidak ditemukan. Minta tautan reset baru.",
      tooShort: "Gunakan minimal 8 karakter untuk kata sandi baru kamu.",
      mismatch: "Konfirmasi kata sandi tidak cocok.",
      updated: "Kata sandi diperbarui. Mengarahkan ke Contexta.",
      failed: "Tidak bisa memperbarui kata sandi."
    },
    callback: {
      eyebrowOk: "Sesi workspace",
      eyebrowFail: "Gagal masuk",
      titleOk: "Autentikasi selesai",
      titleFail: "Kesalahan autentikasi",
      titlePending: "Menyelesaikan autentikasi",
      dashboard: "Dashboard",
      login: "Masuk",
      messages: {
        checking: "Memeriksa sesi masuk Contexta kamu.",
        done: "Autentikasi selesai. Lanjut ke dashboard kamu.",
        noSessionReturned: "Sesi autentikasi tidak dikembalikan.",
        paramsNoSession: "Parameter autentikasi ditemukan, tapi tidak ada sesi aktif.",
        noActiveSession: "Sesi masuk yang aktif tidak ditemukan.",
        failed: "Tidak bisa menyelesaikan autentikasi."
      }
    }
  },
  documents: {
    upload: {
      eyebrow: "Basis pengetahuan",
      title: "Unggah & kelola",
      description: "Tambahkan dokumen ke indeks. Format yang didukung: PDF dan DOCX.",
      docTypeLabel: "Tipe dokumen",
      refresh: "Muat ulang",
      exportWorkspace: "Ekspor workspace",
      exporting: "Mengekspor...",
      browse: "Pilih berkas",
      uploading: "Mengunggah...",
      dropTitle: "Tarik dan letakkan berkas di sini",
      dropBody: "Berkas diunggah ke workspace Anda dan diindeks otomatis untuk jawaban yang berdasar.",
      formatHint: "PDF atau DOCX · maks 50 MB",
      statusEyebrow: "Status sistem",
      storageUsed: "Penyimpanan terpakai",
      indexingQueue: "Antrean indeks",
      readyCount: "Siap",
      fileCount: (count: number) => `${count} berkas`,
      indexingNote: "PDF berukuran besar bisa butuh hingga 2 menit untuk terindeks penuh di pencarian vektor.",
      loading: "Memuat dokumen...",
      uploadingOne: "Mengunggah dokumen...",
      activityEyebrow: "Aktivitas",
      recentTitle: "Dokumen terbaru",
      showRecent: "Tampilkan terbaru",
      viewAll: "Lihat semua",
      colFile: "Nama berkas",
      colSize: "Ukuran",
      colType: "Tipe",
      colStatus: "Status",
      colActions: "Aksi",
      docTypeFor: (name: string) => `Tipe dokumen untuk ${name}`,
      retry: "Coba lagi",
      reindex: "Re-indeks",
      delete: "Hapus",
      emptyList: "Belum ada dokumen yang diunggah.",
      showing: (visible: number, total: number) => `Menampilkan ${visible} dari ${total} dokumen.`,
      deleteConfirm: (name: string) => `Hapus "${name}"? Chunk hasil indeksnya ikut terhapus.`,
      messages: {
        uploaded: (name: string) => `${name} diunggah.`,
        classified: (name: string, type: string) => `${name} diklasifikasi sebagai ${type}.`,
        deleted: (name: string) => `${name} dihapus.`,
        retried: (name: string) => `${name} masuk antrean percobaan ulang.`,
        reindexed: (name: string) => `${name} masuk antrean re-indeks.`,
        exported: (name: string) => `Mengekspor ${name}.`
      },
      health: {
        unknownLabel: "Kesehatan indeks: tidak diketahui",
        attentionLabel: "Kesehatan indeks: perlu perhatian",
        activeLabel: "Kesehatan indeks: aktif",
        unknownDetail: "Belum bisa menyimpulkan kesehatan worker.",
        staleDetail: (count: number, minutes: number) =>
          `${count} berkas pemrosesan macet lebih dari ${minutes} menit.`,
        queuedDetail: (count: number) => `${count} berkas antrean menunggu untuk mulai.`,
        processingDetail: (count: number) => `${count} berkas sedang diproses.`,
        noStaleDetail: "Tidak ada job indeks yang macet."
      },
      errors: {
        signIn: "Masuk dulu untuk melihat dan mengunggah dokumen.",
        loadFailed: "Tidak bisa memuat dokumen.",
        uploadFailed: "Tidak bisa mengunggah dokumen.",
        typeFailed: "Tidak bisa memperbarui tipe dokumen.",
        signInDelete: "Masuk dulu untuk menghapus dokumen.",
        deleteFailed: "Tidak bisa menghapus dokumen.",
        signInRetry: "Masuk dulu untuk mencoba ulang dokumen.",
        retryFailed: "Tidak bisa mencoba ulang dokumen.",
        signInReindex: "Masuk dulu untuk me-re-indeks dokumen.",
        reindexFailed: "Tidak bisa me-re-indeks dokumen.",
        signInExport: "Masuk dulu untuk mengekspor workspace Anda.",
        exportFailed: "Tidak bisa mengekspor workspace.",
        wrongFormat: "Hanya berkas PDF dan DOCX yang didukung.",
        emptyFile: "Berkas yang dipilih kosong.",
        tooLarge: "Ukuran berkas maksimal 50 MB.",
        notConfigured: "Pengunggahan dokumen belum dikonfigurasi. Silakan hubungi administrator."
      }
    },
    chunks: {
      eyebrow: "Chunk",
      title: "Baris chunk",
      zero: "0 chunk",
      range: (from: number, to: number, total: number) => `${from}\u2013${to} dari ${total}`,
      counting: "Menghitung chunk...",
      colPage: "Halaman",
      colChars: "Karakter",
      colPreview: "Pratinjau",
      loading: "Memuat chunk...",
      retry: "Coba lagi",
      empty: "Belum ada chunk tersimpan untuk dokumen ini.",
      tableTag: "tabel",
      pages: "Halaman chunk",
      previous: "Halaman chunk sebelumnya",
      next: "Halaman chunk berikutnya",
      errors: {
        signIn: "Masuk dulu untuk melihat chunk.",
        failed: "Tidak bisa memuat chunk."
      }
    },
    intelligence: {
      loading: "Memuat intelijen dokumen...",
      notFound: "Dokumen tidak ditemukan.",
      backToDocuments: "Kembali ke dokumen",
      allDocuments: "Semua dokumen",
      eyebrow: "Intelijen dokumen",
      chunkCount: (count: number) => `${count} chunk`,
      export: "Ekspor",
      exporting: "Mengekspor...",
      processingTitle: "Pengindeksan sedang berjalan",
      processingBody: "Contexta sedang mengekstrak teks dan membuat chunk yang bisa dicari. Halaman ini memuat ulang otomatis setiap beberapa detik.",
      failedTitle: "Pemrosesan gagal",
      failedBody: "Worker tidak bisa memproses dokumen ini.",
      failedBack: "Kembali ke halaman dokumen untuk mencoba ulang atau menghapusnya.",
      loadingDetails: "Memuat detail dokumen hasil pemrosesan...",
      summaryEyebrow: "Ringkasan",
      summaryTitle: "Brief otomatis",
      generating: "Membuat...",
      generateBrief: "Buat brief AI",
      aiBriefTitle: "Brief AI",
      copyBrief: "Salin brief",
      extractedEyebrow: "Hasil ekstraksi",
      keyPointsTitle: "Poin utama",
      noText: "Belum ada teks yang diekstrak.",
      entitiesEyebrow: "Entitas",
      detectedFields: "Field terdeteksi",
      names: "Nama",
      emails: "Email",
      links: "Tautan",
      noNames: "Belum ada nama terdeteksi.",
      noEmails: "Belum ada email terdeteksi.",
      noLinks: "Belum ada tautan terdeteksi.",
      askEyebrow: "Tanya",
      suggestedTitle: "Pertanyaan saran",
      notices: {
        copied: "Brief tersalin.",
        copyFailed: "Tidak bisa menyalin brief."
      },
      errors: {
        signInView: "Masuk dulu untuk melihat dokumen ini.",
        loadFailed: "Tidak bisa memuat dokumen.",
        signInBrief: "Masuk dulu untuk membuat brief AI.",
        briefFailed: "Tidak bisa membuat brief AI.",
        signInExport: "Masuk dulu untuk mengekspor dokumen ini.",
        exportFailed: "Tidak bisa mengekspor dokumen."
      }
    }
  },
  dashboard: {
    indexEyebrow: "Indeks pengetahuan",
    badgeSynced: "SINKRON",
    badgeAttention: "WASPADA",
    title: "Workspace dokumen",
    staleThreshold: (minutes: number) => `macet > ${minutes} menit`,
    healthUnknown: "kesehatan indeks tidak diketahui",
    stats: {
      documents: "Dokumen",
      ready: "Siap",
      inQueue: "Dalam antrean",
      chunks: "Chunk",
      storage: "Penyimpanan"
    },
    refresh: "Muat ulang",
    uploadDocument: "Unggah dokumen",
    convert: "Konversi",
    libraryTitle: "Pustaka dokumen",
    librarySubtitle: "Status pengindeksan di setiap berkas yang diunggah.",
    filterLabel: "Saring pustaka",
    filterPlaceholder: "Saring berdasarkan nama, tipe, status",
    colName: "Nama",
    colType: "Tipe",
    colSize: "Ukuran",
    colUploaded: "Diunggah",
    colStatus: "Status",
    colAction: "Aksi",
    loadingLibrary: "Memuat pustaka dokumen...",
    open: "Buka",
    noMatching: "Tidak ada dokumen yang cocok",
    noDocuments: "Belum ada dokumen",
    noMatchingHint: "Coba nama berkas, tipe, atau status lain.",
    noDocumentsHint: "Unggah PDF atau DOCX untuk mulai membangun basis pengetahuan yang bisa dicari.",
    showing: (visible: number, total: number) => `Menampilkan ${visible} dari ${total}`,
    showingLoading: "Menampilkan —",
    viewAll: "Lihat semua",
    recentTitle: "Analisis terbaru",
    loadingRecent: "Memuat analisis terbaru...",
    chunkCount: (count: number) => `${count} chunk`,
    uploadFirst: "Unggah dokumen untuk membuat workspace analisis pertama Anda.",
    healthTitle: "Kesehatan workspace",
    healthRow: "Kesehatan indeks",
    healthNeedsAttention: "Perlu perhatian",
    healthActive: "Aktif",
    healthUnknownValue: "Tidak diketahui",
    healthStale: (count: number, minutes: number) => `${count} macet lebih dari ${minutes} menit`,
    healthQueued: (count: number) => `${count} mengantre`,
    healthNoStale: "Tidak ada job yang macet",
    healthNoDetail: "Kesehatan indeks tidak bisa disimpulkan.",
    readyDocuments: "Dokumen siap",
    indexedChunks: "Chunk terindeks",
    nextActionsTitle: "Langkah berikutnya",
    nextActions: {
      upload: "Unggah atau kelola dokumen",
      chat: "Ajukan pertanyaan lengkap dengan sitasi",
      profile: "Tinjau pengaturan retrieval"
    },
    errors: {
      signIn: "Masuk dulu untuk melihat ringkasan dashboard.",
      failed: "Tidak bisa memuat ringkasan dashboard."
    }
  },
  profile: {
    eyebrow: "Profil Pengguna",
    userFallback: "Pengguna Contexta",
    loadingAccount: "Memuat akun...",
    loading: "Memuat...",
    emailVerified: "Email terverifikasi",
    emailNotVerified: "Email belum terverifikasi",
    displayName: "Nama tampilan",
    displayNamePlaceholder: "Isi nama tampilan Anda",
    accountEmail: "Email akun",
    save: "Simpan profil",
    saving: "Menyimpan",
    saved: "Profil diperbarui.",
    refresh: "Muat ulang",
    accountSummary: "Ringkasan Akun",
    emailLabel: "Alamat email",
    userIdLabel: "ID Pengguna",
    joined: "Bergabung",
    notAvailable: "Tidak tersedia",
    today: "Hari ini",
    yesterday: "Kemarin",
    daysAgo: (days: number) => `${days} hari lalu`,
    provider: {
      emailAndPassword: "Email & kata sandi",
      google: "Google",
      github: "GitHub",
      magicLink: "Tautan ajaib",
      oauth: "OAuth"
    },
    documentCount: (count: number) => `${count} dokumen`,
    stats: {
      documents: "Dokumen",
      chatSessions: "Sesi chat",
      indexedChunks: "Chunk terindeks",
      storageUsed: "Penyimpanan terpakai",
      documentsHelper: (ready: number, failed: number) => `${ready} siap, ${failed} gagal`,
      questions7d: (count: number) => `${count} pertanyaan dalam 7 hari terakhir`,
      chunksHelper: "Blok teks yang bisa dicari",
      storageHelper: "Total ukuran berkas yang diunggah"
    },
    activityTitle: "Aktivitas 7 hari terakhir",
    activity: {
      upload: "Unggah",
      indexing: "Indeksasi",
      chat: "Chat"
    },
    lastAt: (value: string) => `Terakhir: ${value}`,
    noActivity: "Tidak ada aktivitas pada rentang ini",
    activityError: "Angka aktivitas tidak bisa dimuat. Coba Muat ulang.",
    keysLine: {
      loading: "Memuat API key...",
      summary: (keys: number, requests: number) =>
        `${keys} kunci aktif · ${requests} permintaan dalam 14 hari terakhir`,
      error: "Pemakaian API key tidak bisa dimuat."
    },
    manageKeys: "Kelola API key",
    errors: {
      loadFailed: "Tidak bisa memuat profil.",
      saveFailed: "Tidak bisa memperbarui profil."
    }
  },
  settings: {
    eyebrow: "Pengaturan Workspace",
    title: "Kontrol sistem",
    description:
      "Konfigurasi hanya-baca untuk workspace ini. Secrets inti tetap di server API dan tidak ditampilkan di sini.",
    apiKeys: "API key",
    manageDocuments: "Kelola dokumen",
    openChat: "Buka chat",
    runtimeTitle: "Status Runtime",
    runtimeSubtitle: "Konfigurasi yang sedang dipakai aplikasi web dan API.",
    editAccessTitle: "Akses perubahan",
    editAccessHead: "Tidak ada yang bisa diubah di sini",
    editAccessBody:
      "Mengubah nilai ini berarti menyunting environment di server API lalu me-restart service-nya.",
    securityTitle: "Catatan Keamanan",
    securityBody:
      "Service role Supabase, key DeepSeek, dan kredensial database harus tetap berada di berkas `.env` backend. Aplikasi web hanya boleh menerima pengaturan publik.",
    serviceTitle: "Status Layanan",
    recheck: "Periksa ulang",
    checking: "Memeriksa",
    services: {
      api: "Layanan API",
      vector: "Vector store",
      indexing: "Antrean indeks"
    },
    words: {
      checking: "Memeriksa",
      reachable: "Terhubung",
      unreachable: "Tidak terjangkau",
      noAnswer: "Tidak menjawab",
      active: "Aktif",
      needsAttention: "Perlu perhatian"
    },
    details: {
      pingHealth: "Menguji /health",
      pingVector: "Menguji /health/vector",
      pingIndexing: "Membaca /health/indexing",
      apiUnreachable: "API tidak menjawab /health.",
      unknown: "Status tidak diketahui — tidak ada jawaban dari API.",
      vectorOk: "Qdrant melaporkan kondisi sehat.",
      vectorUnreachable: "Qdrant tidak dapat dijangkau dari API.",
      queueCounts: (queued: number, processing: number, stale: number, minutes: number) =>
        `${queued} antre, ${processing} diproses, ${stale} macet lebih dari ${minutes} menit.`
    },
    runtime: {
      apiBaseUrl: "URL dasar API",
      vectorCollection: "Koleksi vektor",
      vectorCollectionUnknown: "Tidak dilaporkan",
      supportedUploads: "Format unggahan",
      supportedUploadsValue: "PDF dan DOCX hingga 50 MB",
      answerGeneration: "Pembuatan jawaban"
    },
    capabilities: {
      authentication: "Autentikasi",
      authenticationValue: "Masuk lewat email Supabase",
      documentStorage: "Penyimpanan dokumen",
      documentStorageValue: "Supabase Storage",
      vectorSearch: "Pencarian vektor",
      vectorSearchValue: "Qdrant, dipanggil oleh API",
      privateKeys: "Kunci privat",
      privateKeysValue: "Hanya di env server, tidak pernah dikirim ke sini"
    }
  },
  developer: {
    loading: "Memuat pengaturan developer...",
    eyebrow: "Developer",
    title: "API key",
    description:
      "Akses mesin ke retrieval atas dokumen Anda yang sudah terindeks. Key dibatasi 60 permintaan per menit dan 5.000 per hari, dan setiap panggilan dicatat selama 90 hari.",
    refresh: "Muat ulang",
    createdTitle: "Salin sekarang — key ini hanya ditampilkan sekali",
    createdBody:
      "Contexta hanya menyimpan hash key, jadi key yang hilang tidak bisa diambil ulang; cabut lalu buat yang baru.",
    copy: "Salin",
    copied: "Tersalin",
    done: "Selesai",
    createTitle: "Buat key",
    nameLabel: "Nama",
    namePlaceholder: "notebook, CI, tool internal...",
    createKey: "Buat key",
    creating: "Membuat...",
    scopeLegend: "Dokumen yang boleh dibaca key ini",
    scopeAll: "Semua dokumen",
    scopeSelected: "Hanya yang dipilih",
    noReadyDocuments: "Belum ada dokumen terindeks yang bisa dipilih.",
    existingTitle: "Key yang sudah ada",
    emptyKeys: "Belum ada API key yang dibuat.",
    states: {
      active: "Aktif",
      expired: "Kedaluwarsa",
      revoked: "Dicabut"
    },
    never: "belum pernah",
    documentCount: (count: number) => `${count} dokumen`,
    createdOn: (value: string) => `dibuat ${value}`,
    lastUsedOn: (value: string) => `terakhir dipakai ${value}`,
    usage: "Pemakaian",
    hideUsage: "Sembunyikan pemakaian",
    loadingShort: "Memuat...",
    revoke: "Cabut",
    revoking: "Mencabut...",
    revokeConfirm: (name: string) =>
      `Cabut "${name}"? Klien mana pun yang memakai key ini langsung berhenti berfungsi dan key-nya tidak bisa dipulihkan.`,
    usageSummary: (total: number, days: number, allowed: number, rejected: number) =>
      `${total} permintaan dalam ${days} hari terakhir · ${allowed} diizinkan · ${rejected} ditolak`,
    dayAllowed: (count: number) => `${count} ok`,
    dayRejected: (count: number) => `${count} ditolak`,
    noRequests: "Belum ada permintaan tercatat.",
    rejectedByCause: "Ditolak karena:",
    usingTitle: "Menggunakan key",
    usingIntro:
      "Hanya retrieval — tanpa pembuatan jawaban. Kirim key sebagai bearer token; token login browser tidak diterima di sini. Referensi endpoint lengkap ada di",
    usingMcp: "Key yang sama juga berlaku di server MCP kami di",
    usingMcpTail: "untuk Claude, Cursor, atau client MCP lainnya.",
    errors: {
      signIn: "Masuk dulu untuk mengelola API key.",
      loadFailed: "Tidak bisa memuat API key.",
      needName: "Beri nama key ini, dan pilih minimal satu dokumen jika scope-nya terbatas.",
      signInCreate: "Masuk dulu untuk membuat API key.",
      createFailed: "Tidak bisa membuat API key.",
      clipboard: "Browser menolak akses clipboard. Seleksi key-nya lalu salin manual.",
      signInRevoke: "Masuk dulu untuk mencabut key ini.",
      revokeFailed: "Tidak bisa mencabut key ini.",
      signInUsage: "Masuk dulu untuk memuat data pemakaian.",
      usageFailed: "Tidak bisa memuat data pemakaian key ini."
    }
  },
  convert: {
    title: "PDF ke Markdown",
    description: "Ubah PDF menjadi Markdown bersih tanpa menambahkannya ke pustaka dokumen Anda.",
    browsePdf: "Pilih PDF",
    convert: "Konversi",
    converting: "Mengonversi...",
    dropTitle: "Tarik dan lepas PDF",
    dropBody: "Konverter menerima satu PDF setiap kali proses lalu menghasilkan Markdown untuk diprasinjau, disalin, atau diunduh.",
    maxLimit: "Maksimal 50 MB",
    clearPdf: "Hapus PDF terpilih",
    previewTitle: "Pratinjau Markdown",
    previewEmptyMeta: "Hasil konversi Markdown akan muncul di sini.",
    previewFile: (name: string, size: string) => `${name} - PDF sumber ${size}`,
    copy: "Salin",
    download: "Unduh",
    noMarkdown: "Belum ada Markdown yang dibuat.",
    notices: {
      ready: (name: string) => `${name} sudah siap.`,
      copied: "Markdown tersalin.",
      downloaded: "Unduhan Markdown dimulai."
    },
    errors: {
      wrongFormat: "Pilih berkas PDF dengan ekstensi .pdf.",
      emptyFile: "Berkas PDF yang dipilih kosong.",
      tooLarge: "Ukuran PDF maksimal 50 MB.",
      noFile: "Pilih PDF sebelum mengonversi.",
      signIn: "Masuk dulu untuk mengonversi PDF.",
      notConfigured: "Autentikasi belum dikonfigurasi. Silakan hubungi administrator.",
      failed: "Tidak bisa mengonversi PDF ke Markdown.",
      copyFailed: "Tidak bisa menyalin Markdown ke clipboard."
    }
  },
  pipeline: {
    embeddingEyebrow: "Retrieval dense hibrida",
    badgeSynced: "SINKRON",
    badgeAttention: "WASPADA",
    indexUnknown: "Model tidak dilaporkan",
    collectionUnknown: "Koleksi tidak dilaporkan",
    dimensionsNotReported: "dimensi tidak dilaporkan",
    collectionLine: (collection: string, shape: string) => `Koleksi: ${collection} - ${shape}`,
    viewsLabel: "Tampilan pipeline",
    tabs: {
      all: "Semua node",
      indexed: "Chunk terindeks",
      queue: "Antrean ingesti",
      failed: "Job gagal"
    },
    sampleEyebrow: "Sampel - belum diinstrumentasi",
    sampleLabels: {
      queryLatency: "Latensi query",
      retrievalScore: "Skor retrieval",
      hitRate: "Hit rate",
      cacheRatio: "Rasio cache"
    },
    metrics: {
      documents: "Dokumen",
      ready: "Siap",
      inQueue: "Antrean",
      chunks: "Chunk",
      storage: "Penyimpanan"
    },
    metricUnits: {
      files: "berkas",
      indexed: "terindeks",
      pending: "tertunda",
      vectors: "vektor"
    },
    clusters: {
      indexed: {
        title: "Chunk Terindeks",
        badge: "Siap",
        subtitle: (chunks: string) => `${chunks} di Qdrant`
      },
      queue: {
        title: "Antrean Ingesti",
        badge: "Langsung",
        subtitle: (queued: number, processing: number) => `${queued} antre - ${processing} diproses`
      },
      failed: {
        title: "Job Gagal",
        subtitle: (count: number) => `${count} dokumen perlu diulang`
      }
    },
    tags: {
      queued: "ANTRE",
      working: "PROSES",
      retry: "ULANGI"
    },
    rootName: "Workspace Contexta",
    activeClusters: (count: number) => `${count} aktif`,
    chunkCount: (count: number) => `${count} chunk`,
    leaf: {
      tokens: (count: string) => `[${count} tok]`,
      moreInCluster: (count: number) => `+${count} lagi di cluster ini`,
      workerError: "Galat worker",
      agoMinutes: (minutes: number) => `${minutes} mnt lalu`,
      agoHours: (hours: number) => `${hours} jam lalu`,
      agoDays: (days: number) => `${days} hari lalu`
    },
    graph: {
      ariaLabel: "Graf sinaps aktif",
      title: "Graf Sinaps Aktif",
      zoomIn: "Perbesar",
      zoomOut: "Perkecil",
      reset: "Reset",
      nodes: (count: number) => `Node: ${count}`,
      empty: "Tidak ada node di tampilan ini - pilih tab lain atau unggah dokumen.",
      hint: "geser untuk pan - buka berkas untuk membentangkan chunk",
      knowledgeRoot: "Akar Pengetahuan",
      clustersLabel: "Cluster",
      documentsLabel: "Dokumen"
    },
    fan: {
      expand: (count: number) => `Bentangkan ${count} posisi chunk`,
      collapse: "Lipat posisi chunk",
      position: (position: string, total: string) =>
        `Posisi chunk ${position} dari ${total} - teks lengkapnya ada di dalam dokumen`,
      openDocument: "Buka dokumen untuk membaca semua chunk",
      more: "lain",
      chunk: "chunk",
      point: (arms: number) => `${arms} titik vektor`
    },
    timeline: {
      ranges: {
        d24h: "24 jam terakhir",
        d7d: "7 hari terakhir",
        d30d: "30 hari terakhir"
      },
      noEvents: "Tidak ada unggahan pada rentang ini.",
      plotted: (count: number, rangeLabel: string) => `${count} unggahan dipetakan pada rentang ${rangeLabel}.`,
      ingested: "Masuk:",
      pending: (count: number) => `${count} tertunda`
    },
    errors: {
      signIn: "Masuk dulu untuk melihat dinamika pipeline.",
      failed: "Tidak bisa memuat dinamika pipeline."
    }
  },
  // Kunci = pesan persis dari server; nilainya terjemahan untuk UI.
  // Pesan yang tidak ada di daftar ini tampil apa adanya, tidak dibuat-buat diterjemahkan.
  errors: {
    server: {
      "uploaded file is too large": "Berkas yang diunggah terlalu besar.",
      "uploaded file must be a PDF": "Berkas harus berformat PDF.",
      "uploaded file must not be empty": "Berkas yang diunggah kosong.",
      "unsupported upload file type": "Tipe berkas tersebut tidak didukung.",
      "unsupported upload content type": "Tipe konten tersebut tidak didukung.",
      "filename extension must match upload content type": "Ekstensi berkas harus cocok dengan tipe kontennya.",
      "filename must be a safe basename": "Nama berkas tersebut tidak diizinkan.",
      "No extractable text found": "Tidak ada teks yang bisa diekstrak dari berkas ini.",
      "Stored file is no longer available": "Berkas asli dokumen ini sudah tidak tersedia di penyimpanan.",
      "Indexing failed unexpectedly. Please retry.": "Indeksing gagal secara tak terduga. Coba lagi, dan hubungi dukungan jika terus terjadi.",
      "Unsupported document type": "Tipe dokumen ini tidak didukung.",
      "Vector point count did not match chunk count": "Jumlah vektor yang diindeks tidak cocok dengan jumlah chunk.",
      "Document storage is not configured": "Penyimpanan dokumen belum dikonfigurasi di server.",
      "Document extractor is not configured": "Pengekstrak dokumen belum dikonfigurasi di server.",
      "Embedding provider is not configured": "Provider embedding belum dikonfigurasi di server.",
      "Vector store is not configured": "Penyimpanan vektor belum dikonfigurasi di server.",
      "document not found": "Dokumen tersebut sudah tidak ada.",
      "only failed documents can be retried": "Hanya dokumen berstatus gagal yang bisa diulang.",
      "only ready documents can be re-indexed": "Hanya dokumen yang sudah terindeks yang bisa di-re-indeks.",
      "document metadata cannot be edited while indexing is running":
        "Metadata tidak bisa diubah saat dokumen masih diindeks.",
      "document has no processed chunks": "Dokumen ini belum punya chunk untuk dibaca.",
      "document has no indexed chunks to export yet": "Dokumen ini belum punya chunk terindeks untuk diekspor.",
      "format must be md or jsonl": "Format ekspor harus md atau jsonl.",
      "chat session is not accessible": "Sesi chat tersebut tidak bisa diakses.",
      "api key not found": "API key tersebut sudah tidak ada.",
      "Invalid authentication token": "Token login tidak lagi valid.",
      "Invalid login credentials": "Kombinasi email dan password salah.",
      "Email not confirmed": "Email ini belum dikonfirmasi.",
      "User already registered": "Akun dengan email ini sudah terdaftar.",
      "Password should be at least 6 characters.": "Password harus minimal 6 karakter.",
      "Unable to validate email address: invalid format": "Format email tersebut tidak valid.",
      "For security, password login is not allowed for this user.":
        "Login dengan password tidak diizinkan untuk akun ini demi keamanan.",
      "Request timed out. Please try again.": "Waktu permintaan habis. Coba lagi.",
      "Unable to reach the API.": "API tidak dapat dihubungi.",
      "Unable to load documents.": "Tidak bisa memuat dokumen.",
      "Unable to load document.": "Tidak bisa memuat dokumen.",
      "Unable to load document intelligence.": "Tidak bisa memuat intelligence dokumen.",
      "Unable to load document chunks.": "Tidak bisa memuat chunk dokumen.",
      "Unable to load indexing health.": "Tidak bisa memuat status ingests.",
      "Unable to upload document.": "Gagal mengunggah dokumen.",
      "Unable to delete document.": "Gagal menghapus dokumen.",
      "Unable to delete this document.": "Dokumen ini tidak bisa dihapus.",
      "Unable to retry document.": "Gagal mengulang dokumen.",
      "Unable to retry this document.": "Dokumen ini tidak bisa diulang.",
      "Unable to re-index this document.": "Dokumen ini tidak bisa di-re-indeks.",
      "Unable to remove the indexed chunks for this document.": "Chunk terindeks dokumen ini tidak bisa dihapus.",
      "Unable to remove the stored file for this document.": "Berkas tersimpan dokumen ini tidak bisa dihapus.",
      "Unable to clear the previous indexing attempt for this document.":
        "Proses indeks sebelumnya tidak bisa dibersihkan.",
      "Unable to update document metadata.": "Tidak bisa memperbarui metadata dokumen.",
      "Document metadata was saved, but the search index is still stale.":
        "Metadata tersimpan, tetapi indeks pencarian masih basi.",
      "Unable to export.": "Gagal memulai ekspor.",
      "Unable to convert PDF to Markdown.": "Gagal mengonversi PDF ke Markdown.",
      "Markdown conversion service is unavailable.": "Layanan konversi Markdown tidak tersedia.",
      "Unable to answer question.": "Jawaban gagal dibuat.",
      "DeepSeek returned an empty answer. Try a content-generating model such as deepseek-v4-pro.":
        "Model mengembalikan jawaban kosong. Coba lagi.",
      "DEEPSEEK_API_KEY is not configured": "Layanan jawaban belum dikonfigurasi.",
      "Unable to generate AI brief.": "Ringkasan AI gagal dibuat.",
      "Unable to load chat sessions.": "Tidak bisa memuat sesi chat.",
      "Unable to load chat messages.": "Tidak bisa memuat pesan chat.",
      "Unable to create chat session.": "Tidak bisa memulai sesi chat.",
      "Unable to load account summary.": "Tidak bisa memuat ringkasan akun.",
      "Unable to load API keys.": "Tidak bisa memuat API key.",
      "Unable to create an API key.": "Tidak bisa membuat API key.",
      "Unable to revoke this key.": "Tidak bisa mencabut key ini.",
      "Unable to load key usage.": "Tidak bisa memuat pemakaian key."
    }
  },
  chat: {
    askAbout: "Tanya tentang",
    chooseDocumentToStart: "Pilih dokumen untuk mulai",
    conversationHistory: "Riwayat percakapan",
    newChat: "Chat baru",
    sourcesTitle: "Sumber",
    loading: "Memuat chat...",
    pickDocumentFirst: "Pilih dokumen yang mau kamu analisa, lalu kita lanjut ke percakapan.",
    readyBefore: "Siap, kita bedah",
    readyAfter: ". Tulis pertanyaan pertama kamu, misalnya minta ringkasan, poin penting, atau data tertentu dari dokumen ini.",
    chooseDocument: "Pilih dokumen",
    readyCount: (count: number) => `${count} dokumen siap dianalisa`,
    searchPlaceholder: "Cari nama dokumen...",
    noReadyDocuments: "Belum ada dokumen ready. Upload atau tunggu proses indexing selesai dulu.",
    noMatch: "Tidak ada dokumen yang cocok.",
    select: "Pilih",
    thinking: "Contexta sedang memproses...",
    cancelHelper: "AI sedang memproses... klik kotak berputar untuk membatalkan.",
    chattingWith: (filename: string) => `Chat dengan ${filename}`,
    chooseOneHelper: "Pilih satu dokumen di chat untuk mulai.",
    askPlaceholderWithDoc: "Tanya Contexta tentang dokumen ini...",
    askPlaceholderNoDoc: "Pilih dokumen dulu...",
    emptyAnswer: "Maaf, Contexta belum menerima jawaban yang bisa ditampilkan. Coba kirim ulang pertanyaannya.",
    answerCancelled: "Jawaban dibatalkan.",
    source: "Sumber",
    page: (pageNumber: number) => `hlm. ${pageNumber}`,
    pageUnknown: "halaman tidak diketahui",
    score: (value: string) => `Skor ${value}`,
    openSource: (marker: number, label: string) => `Buka sumber ${marker}: ${label}`,
    sourceDrawer: "Panel sumber",
    send: "Kirim pesan",
    cancelResponse: "Batalkan jawaban",
    close: "Tutup",
    closeOverlay: "Tutup overlay panel sumber",
    citationsEmpty: "Sitasi dan potongan konteks akan muncul di sini setelah jawaban tiba.",
    errors: {
      signInToLoadChat: "Masuk dulu untuk memuat chat.",
      signInToLoadHistory: "Masuk dulu untuk memuat riwayat chat.",
      signInToCreateChat: "Masuk dulu untuk membuat chat.",
      signInToAsk: "Masuk dulu untuk bertanya.",
      chooseDocumentBeforeAsking: "Pilih satu dokumen yang sudah ready sebelum bertanya.",
      unableToLoadChat: "Chat tidak bisa dimuat.",
      unableToLoadMessages: "Pesan chat tidak bisa dimuat.",
      unableToCreateChat: "Chat baru tidak bisa dibuat.",
      unableToAnswer: "Pertanyaan tidak bisa dijawab."
    }
  },
  help: {
    eyebrow: "Bantuan Contexta",
    title: "Panduan workspace",
    intro:
      "Tempat cepat untuk memahami alur Contexta, cara bertanya ke dokumen, dan apa yang harus dicek kalau upload atau chat terasa bermasalah.",
    manageDocuments: "Kelola dokumen",
    openChat: "Buka chat",
    steps: {
      upload: {
        title: "Upload dokumen",
        description: "Masuk ke Documents, pilih PDF atau DOCX, lalu tunggu status berubah menjadi Ready."
      },
      chat: {
        title: "Pilih dokumen di Chat",
        description: "Satu percakapan membahas satu dokumen. Pilih dokumen lebih dulu supaya jawaban tidak tercampur."
      },
      ask: {
        title: "Tanya dengan spesifik",
        description: "Minta ringkasan, hitung baris/nama, cari metrik tertinggi, atau bandingkan isi dokumen."
      }
    },
    troubleshooting: {
      title: "Pemecahan masalah",
      subtitle: "Masalah yang paling sering muncul saat memakai Contexta lokal.",
      items: {
        stuck: {
          problem: "Dokumen lama di Processing",
          answer: "Pastikan API, worker, dan Qdrant Docker sedang jalan. Klik Refresh di Documents untuk cek status terbaru."
        },
        slow: {
          problem: "Chat terasa lama",
          answer: "Pertanyaan analitik pada dokumen besar butuh ekstraksi konteks dan panggilan LLM. Kalau terlalu lama, batalkan lalu tanyakan lebih spesifik."
        },
        numbers: {
          problem: "Jawaban perlu angka akurat",
          answer: "Gunakan pertanyaan eksplisit seperti 'hitung total baris untuk nama X' atau 'postingan dengan Like tertinggi'. Jawaban berasal dari model yang membaca chunk yang diambil, jadi untuk angka yang harus akurat, minta daftar barisnya dan cek ulang ke sumbernya."
        },
        convert: {
          problem: "Convert PDF ke Markdown gagal",
          answer: "Coba PDF yang tidak rusak dan tidak terenkripsi. Convert memakai extractor yang sama dengan yang membangun indeks dokumen, jadi markdown inilah teks yang dijawab Contexta."
        }
      }
    },
    examples: {
      title: "Contoh pertanyaan",
      summary: "Ringkas dokumen ini dalam 5 poin.",
      problem: "Apa masalah utama dan solusi yang ditawarkan dokumen ini?",
      topCreator: "Siapa creator dengan view paling tinggi?",
      countPosts: "Hitung total postingan untuk nama ISA.",
      topLiked: "Postingan mana yang punya like paling tinggi?",
      insights: "Buatkan daftar insight yang bisa dipakai untuk keputusan bisnis."
    }
  }
};
