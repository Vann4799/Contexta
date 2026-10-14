import type { Dictionary } from "@/locales/en";

export const id: Dictionary = {
  common: {
    language: "Bahasa",
    scrollHint: "Geser tabel ke samping untuk melihat semua kolom",
    status: {
      ready: "Siap",
      processing: "Memproses",
      failed: "Gagal",
      trashed: "Sampah"
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
    closeNav: "Tutup navigasi",
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
    searchPlaceholder: "Cari halaman...",
    notifications: "Notifikasi",
    noNotifications: "Tidak ada notifikasi baru",
    recentDocs: "Dokumen terbaru",
    noRecentDocs: "Belum ada dokumen terbaru",
    viewAllDocs: "Lihat semua",
    upgradeTitle: "Contexta masih beta",
    upgradeBody: "Free satu-satunya paket yang dibuka hari ini. Pro dan Enterprise menyusul setelah beta.",
    upgradeCta: "Lihat paket",
    secondaryNav: "Sekunder",
    nav: {
      dashboard: "Dashboard",
      pipeline: "Pipeline",
      documents: "Dokumen",
      chat: "Chat",
      convert: "Konversi",
      apiKeys: "Kunci API",
      usage: "Pemakaian",
      billing: "Penagihan",
      integrations: "Integrasi",
      activity: "Aktivitas",
      trash: "Sampah"
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
    oauth: {
      divider: "atau",
      google: "Lanjut dengan Google"
    },
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
    },
    verifyEmail: {
      eyebrow: "Verifikasi email",
      title: "Cek kotak masuk kamu",
      description: (email: string) => `Kami mengirim tautan konfirmasi ke ${email}. Klik tautan untuk mengaktifkan akun kamu.`,
      resend: "Kirim ulang email verifikasi",
      resending: "Mengirim...",
      resent: "Email verifikasi dikirim. Cek kotak masuk kamu.",
      resendFailed: "Tidak bisa mengirim ulang email verifikasi.",
      verified: "Email terverifikasi! Mengarahkan ke dashboard kamu.",
      backToLogin: "Kembali ke halaman masuk",
      wrongEmail: "Email salah? Masuk dengan akun lain."
    },
    onboarding: {
      welcome: {
        eyebrow: "Selamat datang",
        title: (name: string) => `Mari mulai, ${name}`,
        description: "Siapkan workspace kamu dalam kurang dari satu menit.",
        skip: "Lewati dulu"
      },
      steps: {
        upload: {
          title: "Unggah dokumen pertama",
          description: "Seret dan lepas file PDF atau DOCX. Contexta akan mengekstrak teks, membuat indeks pencarian, dan menyiapkannya untuk chat AI."
        },
        chat: {
          title: "Tanyakan pertanyaan",
          description: "Chat dengan dokumen kamu menggunakan bahasa alami. Setiap jawaban dilengkapi sitasi per halaman."
        },
        explore: {
          title: "Jelajahi kecerdasan",
          description: "Dapatkan ringkasan otomatis, poin penting, dan deteksi field untuk setiap dokumen yang kamu unggah."
        }
      },
      continue: "Lanjut",
      finish: "Ke dashboard",
      step: (current: number, total: number) => `Langkah ${current} dari ${total}`
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
      uploadingFiles: "Mengunggah berkas",
      dropTitle: "Tarik dan letakkan berkas di sini",
      dropBody: "Berkas diunggah ke workspace Anda dan diindeks otomatis untuk jawaban yang berdasar.",
      uploadingBody: "Dokumen Anda sedang diunggah dan akan diindeks otomatis.",
      uploadedLabel: "Terunggah",
      transferredPercent: (percent: number) => `${percent}%`,
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
      trash: "Pindah ke sampah",
      restore: "Pulihkan",
      permanentDelete: "Hapus permanen",
      trashTitle: "Sampah",
      trashDescription: "Dokumen di sampah disimpan 30 hari sebelum dihapus permanen.",
      trashEmpty: "Sampah kosong.",
      backToDocuments: "Kembali ke dokumen",
      emptyList: "Belum ada dokumen yang diunggah.",
      showing: (visible: number, total: number) => `Menampilkan ${visible} dari ${total} dokumen.`,
      deleteConfirm: (name: string) => `Hapus "${name}"? Chunk hasil indeksnya ikut terhapus.`,
      trashConfirm: (name: string) => `Pindahkan "${name}" ke sampah?`,
      restoreConfirm: (name: string) => `Pulihkan "${name}"?`,
      permanentDeleteConfirm: (name: string) => `Hapus permanen "${name}"? Tindakan ini tidak bisa dibatalkan.`,
      messages: {
        uploaded: (name: string) => `${name} diunggah.`,
        classified: (name: string, type: string) => `${name} diklasifikasi sebagai ${type}.`,
        deleted: (name: string) => `${name} dihapus.`,
        trashed: (name: string) => `${name} dipindahkan ke sampah.`,
        restored: (name: string) => `${name} dipulihkan.`,
        permanentlyDeleted: (name: string) => `${name} dihapus permanen.`,
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
        signInTrash: "Masuk dulu untuk memindahkan dokumen ke sampah.",
        trashFailed: "Tidak bisa memindahkan dokumen ke sampah.",
        signInRestore: "Masuk dulu untuk memulihkan dokumen.",
        restoreFailed: "Tidak bisa memulihkan dokumen.",
        signInPermanentDelete: "Masuk dulu untuk menghapus permanen dokumen.",
        permanentDeleteFailed: "Tidak bisa menghapus permanen dokumen.",
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
      dates: "Tanggal",
      money: "Nilai / angka",
      noNames: "Belum ada nama terdeteksi.",
      noEmails: "Belum ada email terdeteksi.",
      noLinks: "Belum ada tautan terdeteksi.",
      noDates: "Belum ada tanggal terdeteksi.",
      noMoney: "Belum ada angka terdeteksi.",
      extractiveNote:
        "Ringkasan ini masih kutipan mentah dari bagian awal dokumen. Buat brief AI agar seluruh isi dibaca.",
      modelNote: (coverage: number) => `Brief AI membaca ${Math.round(coverage * 100)}% isi dokumen.`,
      truncatedNote: "Brief terpotong di batas token model.",
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
    },
    activityTitle: "Aktivitas",
    activitySubtitle: "14 hari terakhir",
    activityUploads: "Unggahan",
    activityIndexed: "Terindeks",
    activityChats: "Chat",
    statusTitle: "Status dokumen",
    statusSubtitle: "Distribusi di seluruh pustaka",
    statusReady: "Siap",
    statusProcessing: "Memproses",
    statusFailed: "Gagal",
    statusUploaded: "Diunggah",
    heatmapTitle: "Peta kontribusi",
    heatmapSubtitle: "Dokumen yang ditambahkan per hari",
    docTypesTitle: "Jenis dokumen",
    docTypesSubtitle: "Rincian klasifikasi",
    metricSessions: "Sesi",
    metricApiKeys: "Kunci API",
    metricApiReqs: "Permintaan API (14h)",
    metricTopType: "Jenis terbanyak",
    noActivity: "Belum ada aktivitas",
    noTypes: "Belum ada dokumen yang diklasifikasi"
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
    security: {
      title: "Kata sandi & keamanan",
      addPasswordTitle: "Tambah kata sandi",
      addPasswordBody: "Buat kata sandi agar bisa login dengan email dan kata sandi — selain Google.",
      addPasswordButton: "Tambah kata sandi",
      changePasswordTitle: "Ubah kata sandi",
      changePasswordBody: "Tautan reset akan dikirim ke email Anda. Ikuti tautan untuk memilih kata sandi baru.",
      changePasswordButton: "Ubah kata sandi",
      sending: "Mengirim...",
      sent: "Tautan reset terkirim. Cek inbox Anda.",
      sendFailed: "Tidak bisa mengirim tautan reset."
    },
    errors: {
      loadFailed: "Tidak bisa memuat profil.",
      saveFailed: "Tidak bisa memperbarui profil.",
      deleteFailed: "Tidak bisa menghapus akun.",
      exportFailed: "Tidak bisa mengekspor data Anda."
    },
    dangerZone: {
      title: "Zona bahaya",
      description: "Tindakan ini permanen dan tidak bisa dibatalkan.",
      exportData: "Ekspor data saya",
      exporting: "Mengekspor...",
      exportHelper: "Unduh berkas JSON berisi dokumen, chat, dan key Anda.",
      deleteAccount: "Hapus akun",
      deleting: "Menghapus...",
      deleteHelper: "Hapus permanen akun Anda beserta semua data terkait.",
      confirmTitle: "Anda yakin?",
      confirmBody: "Ini akan menghapus permanen akun, dokumen, riwayat chat, API key, dan semua data lainnya. Tidak bisa dibatalkan.",
      confirmAction: "Ya, hapus akun saya",
      cancel: "Batal"
    }
  },
  settings: {
    eyebrow: "Pengaturan Workspace",
    title: "Pengaturan",
    description:
      "Kelola preferensi dan konfigurasi workspace kamu.",
    apiKeys: "API key",
    manageDocuments: "Kelola dokumen",
    profileSectionTitle: "Profil",
    profileSectionDesc: "Perbarui nama tampilan dan detail akun kamu.",
    displayName: "Nama tampilan",
    displayNamePlaceholder: "Masukkan nama tampilan",
    save: "Simpan perubahan",
    saving: "Menyimpan",
    saved: "Profil diperbarui.",
    saveFailed: "Gagal menyimpan profil.",
    languageSectionTitle: "Bahasa",
    languageSectionDesc: "Pilih bahasa preferensi untuk antarmuka.",
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
  apiDocs: {
    eyebrow: "Referensi",
    title: "Dokumentasi API",
    description: "API REST publik untuk akses programatik ke dokumen kamu yang sudah terindeks.",
    baseUrl: "URL dasar",
    authentication: "Autentikasi",
    endpoints: "Endpoint",
    retrieve: "Pencarian semantik",
    retrieveDesc: "Mengembalikan chunk dokumen yang paling dekat dengan pertanyaan. Tanpa panggilan LLM — hanya retrieval.",
    listDocuments: "Daftar dokumen",
    listDocumentsDesc: "Daftar dokumen yang boleh dibaca key ini.",
    exportDocument: "Ekspor dokumen",
    exportDocumentDesc: "Teks terindeks lengkap satu dokumen, dalam format Markdown atau JSONL.",
    inspectKey: "Inspeksi key",
    inspectKeyDesc: "Info key pemanggil: nama, scope, batas, dan sisa kuota.",
    rateLimits: "Batas rate",
    rateLimitsDesc: "60 permintaan/menit · 5.000 permintaan/hari. Sisa kuota ada di header setiap respons.",
    errors: "Kode error",
    mcp: "Server MCP",
    mcpDesc: "Key yang sama berlaku sebagai server MCP untuk Claude Desktop, Cursor, atau client MCP lainnya.",
    keyScoping: "Scope key",
    keyScopingDesc: "Key bisa dibatasi ke subset dokumen. Permintaan di luar scope mengembalikan kosong.",
    field: "Field",
    type: "Tipe",
    default: "Default",
    notes: "Catatan",
    required: "wajib",
    code: "Kode",
    http: "HTTP",
    meaning: "Arti",
    tool: "Tool",
    returns: "Mengembalikan",
    viewFullDocs: "Referensi endpoint lengkap",
    here: "di sini",
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
      "uploaded file is too large": "Berkas yang diunggah terlalu besar. Maksimal 50 MB.",
      "Unable to store the uploaded document.": "Berkas gagal disimpan. Silakan unggah ulang.",
      "Unable to register the uploaded document.": "Hasil unggah gagal dicatat. Silakan unggah ulang.",
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
      "The AI answer was not a readable brief. Try again.":
        "Jawaban AI tidak bisa dibaca sebagai brief. Coba lagi.",
      "This document has no readable text. A scanned PDF or an image-only file has no text layer to summarize.":
        "Dokumen ini tidak punya teks yang bisa dibaca. PDF hasil scan atau berkas gambar tidak punya lapisan teks untuk dirangkum.",
      "Unable to load chat sessions.": "Tidak bisa memuat sesi chat.",
      "Unable to load chat messages.": "Tidak bisa memuat pesan chat.",
      "Unable to create chat session.": "Tidak bisa memulai sesi chat.",
      "Unable to load account summary.": "Tidak bisa memuat ringkasan akun.",
      "Unable to load API keys.": "Tidak bisa memuat API key.",
      "Unable to create an API key.": "Tidak bisa membuat API key.",
      "Unable to revoke this key.": "Tidak bisa mencabut key ini.",
      "Unable to load key usage.": "Tidak bisa memuat pemakaian key.",
      "The uploaded file is corrupt or unreadable.": "Berkas yang diunggah rusak atau tidak bisa dibaca."
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
    insufficientContext: "Konteks dokumen tidak cukup untuk menjawab pertanyaan tersebut. Coba unggah dokumen yang lebih relevan atau ubah kalimat pertanyaannya.",
    answerCancelled: "Jawaban dibatalkan.",
    truncatedNotice: "Jawaban ini kena batas panjang model dan bisa berhenti di tengah kalimat. Persempit pertanyaannya lalu tanya lagi bagian yang kurang.",
    source: "Sumber",
    page: (pageNumber: number) => `hlm. ${pageNumber}`,
    pageUnknown: "halaman tidak diketahui",
    score: (value: string) => `Relevansi ${value}`,
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
  },
  usage: {
    eyebrow: "Pemakaian API",
    title: "Ringkasan pemakaian kunci",
    subtitle: "Pantau permintaan di semua kunci API Anda.",
    refresh: "Muat ulang",
    noKeys: "Belum ada kunci API.",
    noKeysHint: "Buat kunci di Pengaturan → Developer untuk mulai menggunakan API.",
    goToKeys: "Ke kunci API",
    totalRequests: "Total permintaan",
    allowed: "Diizinkan",
    rejected: "Ditolak",
    activeKeys: "Kunci aktif",
    period: (days: number) => `${days} hari terakhir`,
    dailyBreakdown: "Rincian harian",
    dailySubtitle: "Permintaan diizinkan vs ditolak per hari",
    tapHint: "Ketuk batang untuk melihat angka pasti.",
    noData: "Belum ada permintaan tercatat pada periode ini.",
    perKeyTitle: "Pemakaian per kunci",
    perKeySubtitle: "Permintaan dikelompokkan per kunci API",
    keyName: "Kunci",
    keyTrend: "Tren 14 hari",
    keyRequests: "Permintaan",
    keyAllowed: "Diizinkan",
    keyRejected: "Ditolak",
    keyLastUsed: "Terakhir dipakai",
    never: "Belum pernah",
    revoked: "Dicabut",
    loading: "Memuat data pemakaian...",
    errors: {
      signIn: "Masuk dulu untuk melihat pemakaian API.",
      failed: "Tidak bisa memuat data pemakaian."
    }
  },
  activity: {
    eyebrow: "Aktivitas Workspace",
    title: "Event terbaru",
    refresh: "Segarkan",
    noActivity: "Belum ada aktivitas"
  },
  billing: {
    eyebrow: "Penagihan",
    title: "Paket & penagihan",
    subtitle: "Kelola langganan Anda dan pantau pemakaian terhadap batas paket.",
    refresh: "Segarkan",
    currentPlan: "Paket saat ini",
    freePlan: "Gratis",
    subscriptionStatus: "Langganan",
    noSubscription: "Belum ada langganan aktif — Anda di paket Gratis.",
    periodStart: "Awal periode",
    periodEnd: "Akhir periode",
    cancelAtPeriodEnd: "Berakhir di akhir periode",
    usageTitle: "Pemakaian periode ini",
    usageSubtitle: "Seberapa banyak batas paket yang sudah terpakai",
    documents: "Dokumen",
    storage: "Penyimpanan",
    apiKeys: "Kunci API",
    apiRequests: "Permintaan API hari ini",
    chatMessages: "Pesan chat hari ini",
    overLimit: "Melebihi batas",
    ofLimit: (used: number, max: number) => `${used} / ${max}`,
    plansTitle: "Paket tersedia",
    plansSubtitle: "Contexta masih beta — Free satu-satunya paket yang dibuka untuk pendaftaran",
    soon: "Segera",
    ctaSoon: "Belum dibuka",
    overLimitHint:
      "Free satu-satunya paket yang dibuka selama beta, jadi menghapus dokumen adalah cara membebaskan ruang hari ini.",
    priceMonthly: (price: number) => price === 0 ? "Gratis" : `$${price}/bln`,
    priceYearly: (price: number) => price === 0 ? "Gratis" : `$${price}/thn`,
    perMonth: "/bln",
    perYear: "/thn",
    current: "Saat ini",
    upgrade: "Upgrade",
    downgrade: "Ganti",
    features: "Yang termasuk",
    limitDocuments: (n: number) => `${n} dokumen`,
    limitStorage: (bytes: number) => {
      if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))} GB penyimpanan`;
      return `${Math.round(bytes / (1024 * 1024))} MB penyimpanan`;
    },
    limitApiKeys: (n: number) => `${n} kunci API`,
    limitApiRequests: (n: number) => `${n.toLocaleString()} req API/hari`,
    limitChatMessages: (n: number) => `${n.toLocaleString()} pesan chat/hari`,
    comingSoon: "Stripe checkout segera hadir",
    securePayment: "Tidak ada kartu yang diambil selama Contexta berada dalam beta",
    errors: {
      signIn: "Masuk dulu untuk melihat penagihan.",
      loadFailed: "Tidak bisa memuat status penagihan.",
      plansFailed: "Tidak bisa memuat paket."
    }
  },
  paywall: {
    documentsTitle: "Batas dokumen tercapai",
    documentsBody: "Free menampung 10 dokumen selama beta. Menghapus salah satunya adalah cara bisa mengunggah lagi hari ini.",
    apiKeysTitle: "Batas API key tercapai",
    apiKeysBody: "Free menerbitkan 2 API key selama beta. Cabut yang tidak kamu pakai untuk membuat yang baru.",
    chatTitle: "Batas chat harian tercapai",
    chatBody: "Jatah chat harian kamu sudah terpakai. Jatahnya reset setiap tengah malam UTC.",
    cta: "Lihat paket",
    currentPlan: "Paket saat ini",
    usage: "Pemakaian",
    close: "Tutup",
    documentsUsage: (used: number, max: number) => `${used} dari ${max} dokumen`,
    apiKeysUsage: (used: number, max: number) => `${used} dari ${max} API key`,
    chatUsage: (used: number, max: number) => `${used} dari ${max} pesan hari ini`,
  },
  integrations: {
    eyebrow: "Integrasi",
    title: "Layanan terhubung",
    subtitle: "Hubungkan Contexta ke alat favorit Anda untuk sinkronisasi dokumen dan notifikasi.",
    refresh: "Segarkan",
    connected: "Terhubung",
    disconnected: "Belum terhubung",
    error: "Error",
    connect: "Hubungkan",
    disconnect: "Putuskan",
    connecting: "Menghubungkan...",
    disconnecting: "Memutuskan...",
    scopes: "Izin",
    connectedAs: (name: string) => `Terhubung sebagai ${name}`,
    lastSynced: (value: string) => `Terakhir sinkron ${value}`,
    connectedSuccess: "Integrasi berhasil dihubungkan.",
    connectedError: "Gagal menghubungkan integrasi. Coba lagi.",
    confirmDisconnect: (name: string) => `Putuskan ${name}? Anda perlu otorisasi ulang untuk menghubungkan kembali.`,
    errors: {
      signIn: "Masuk dulu untuk mengelola integrasi.",
      loadFailed: "Tidak bisa memuat integrasi.",
      connectFailed: "Tidak bisa menghubungkan integrasi ini.",
      disconnectFailed: "Tidak bisa memutus integrasi ini."
    }
  },
  legal: {
    terms: {
      eyebrow: "Legal",
      title: "Syarat Layanan",
      effectiveDate: "Berlaku: 10 Oktober 2026",
      lastUpdated: "Terakhir diperbarui: 10 Oktober 2026",
      sections: {
        acceptance: {
          title: "1. Penerimaan Syarat",
          body: "Dengan mengakses atau menggunakan Contexta (\"Layanan\"), Anda menyetujui untuk terikat oleh Syarat Layanan ini. Jika tidak setuju, jangan gunakan Layanan. Contexta disediakan oleh Contexta (\"kami\")."
        },
        description: {
          title: "2. Deskripsi Layanan",
          body: "Contexta adalah platform Retrieval-Augmented Generation (RAG) yang memungkinkan pengguna mengunggah dokumen, mengindeks kontennya menggunakan vector embedding, dan berinteraksi dengan pengetahuan yang telah diindeks melalui chat bahasa alami. Layanan ini mencakup penyimpanan dokumen, tanya jawab berbasis AI, akses API, dan alat konversi dokumen."
        },
        accounts: {
          title: "3. Akun & Autentikasi",
          body: "Anda bertanggung jawab menjaga keamanan kredensial akun Anda. Anda tidak boleh membagikan API key atau token autentikasi kepada pihak yang tidak berwenang. Anda harus memberikan informasi pendaftaran yang akurat. Anda tidak boleh membuat akun untuk tujuan melanggar syarat ini atau hukum yang berlaku."
        },
        acceptableUse: {
          title: "4. Penggunaan yang Dapat Diterima",
          body: "Anda tidak boleh: mengunggah dokumen yang berisi konten ilegal atau konten yang melanggar hak pihak ketiga; menggunakan Layanan untuk menghasilkan konten yang fitnah, pelecehan, atau berbahaya; mencoba mendapatkan akses tidak sah ke Layanan atau sistem terkait; menggunakan Layanan untuk permintaan otomatis bervolume tinggi melebihi batas paket Anda; membalik rekayasa, dekompilasi, atau membongkar bagian manapun dari Layanan."
        },
        content: {
          title: "5. Konten Anda",
          body: "Anda mempertahankan kepemilikan dokumen yang Anda unggah ke Contexta. Dengan mengunggah konten, Anda memberikan kami lisensi terbatas untuk menyimpan, memproses, dan mengindeks dokumen Anda semata-mata untuk menyediakan Layanan. Kami tidak menggunakan konten yang Anda unggah untuk melatih model atau menyediakan layanan kepada pengguna lain. Anda bertanggung jawab untuk memastikan Anda memiliki hak untuk mengunggah dan memproses dokumen Anda."
        },
        aiGenerated: {
          title: "6. Jawaban yang Dihasilkan AI",
          body: "Jawaban yang dihasilkan oleh Contexta diproduksi oleh model bahasa besar dan mungkin mengandung kesalahan, kelalaian, atau ketidakakuratan. Konten yang dihasilkan AI tidak boleh diandalkan sebagai nasihat profesional. Anda bertanggung jawab untuk memverifikasi informasi sebelum menindaklanjutinya. Kami tidak menjamin keakuratan, kelengkapan, atau kesesuaian jawaban yang dihasilkan AI."
        },
        billing: {
          title: "7. Penagihan & Paket",
          body: "Layanan ini saat ini diberikan gratis selama masa beta, dan belum ada paket berbayar yang bisa dibeli — paket berbayar segera hadir. Saat paket berbayar tersedia, penagihannya bulanan atau tahunan seperti yang ditampilkan pada saat pembelian, dan biaya tidak dapat dikembalikan kecuali diwajibkan oleh hukum. Kami dapat mengubah harga dengan pemberitahuan minimal 30 hari sebelum perubahan berlaku. Kegagalan membayar dapat mengakibatkan penangguhan atau penghentian akun Anda."
        },
        termination: {
          title: "8. Penghentian",
          body: "Anda dapat menghapus akun Anda kapan saja melalui pengaturan Profil. Kami dapat menangguhkan atau menghentikan akun Anda jika Anda melanggar syarat ini, jika diwajibkan oleh hukum, atau karena tidak bayar berkepanjangan. Setelah penghentian, hak Anda untuk menggunakan Layanan segera berakhir. Kami akan menyimpan data Anda selama 30 hari setelah penghentian sebelum penghapusan permanen, kecuali diwajibkan oleh hukum untuk menyimpannya lebih lama."
        },
        liability: {
          title: "9. Pembatasan Tanggung Jawab",
          body: "Layanan ini disediakan \"sebagaimana adanya\" tanpa jaminan dalam bentuk apapun. Sepanjang diizinkan oleh hukum, kami tidak bertanggung jawab atas kerusakan tidak langsung, insidental, khusus, konsekuensial, atau punitif, termasuk namun tidak terbatas pada kehilangan data, keuntungan, atau peluang bisnis, yang timbul dari penggunaan Layanan."
        },
        changes: {
          title: "10. Perubahan Syarat",
          body: "Kami dapat memperbarui Syarat ini dari waktu ke waktu. Perubahan material akan diberitahukan melalui email atau melalui Layanan minimal 14 hari sebelum berlaku. Penggunaan Layanan yang berlanjut setelah perubahan berlaku merupakan penerimaan atas syarat yang diperbarui."
        },
        contact: {
          title: "11. Kontak",
          body: "Untuk pertanyaan tentang Syarat ini, silakan hubungi kami melalui Layanan atau di alamat email yang disediakan di aplikasi."
        }
      }
    },
    privacy: {
      eyebrow: "Legal",
      title: "Kebijakan Privasi",
      effectiveDate: "Berlaku: 10 Oktober 2026",
      lastUpdated: "Terakhir diperbarui: 10 Oktober 2026",
      sections: {
        overview: {
          title: "1. Gambaran Umum",
          body: "Kebijakan Privasi ini menjelaskan bagaimana Contexta (\"kami\") mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda saat Anda menggunakan Layanan kami. Kami berkomitmen untuk melindungi privasi Anda dan menangani data Anda secara transparan."
        },
        dataCollected: {
          title: "2. Data yang Kami Kumpulkan",
          body: "Data akun: alamat email, nama tampilan, penyedia autentikasi. Data dokumen: file yang Anda unggah (PDF, DOCX), teks yang diekstrak, vector embedding, dan metadata. Data penggunaan: pesan chat, permintaan API, timestamp, dan log interaksi. Data teknis: alamat IP, jenis browser, informasi perangkat, dan cookie."
        },
        dataUse: {
          title: "3. Bagaimana Kami Menggunakan Data Anda",
          body: "Kami menggunakan data Anda untuk: menyediakan dan memelihara Layanan; mengindeks dokumen Anda dan menghasilkan jawaban AI; memproses permintaan API Anda; mengirimkan notifikasi terkait layanan; mendeteksi dan mencegah penyalahgunaan atau masalah keamanan; meningkatkan Layanan berdasarkan pola penggunaan agregat yang dianonimkan. Kami tidak menjual data pribadi Anda kepada pihak ketiga."
        },
        dataSharing: {
          title: "4. Berbagi Data & Pihak Ketiga",
          body: "Kami hanya berbagi data dengan: penyedia layanan yang memproses data atas nama kami (hosting, pengiriman email, pemrosesan pembayaran); penyedia model AI (DeepSeek) untuk menghasilkan jawaban — konten dokumen Anda dikirim sebagai konteks untuk kueri Anda; otoritas hukum ketika diwajibkan oleh hukum atau untuk melindungi hak kami. Semua pemroses pihak ketiga terikat secara kontraktual untuk melindungi data Anda."
        },
        dataRetention: {
          title: "5. Retensi Data",
          body: "Data akun disimpan selama masa aktif akun Anda ditambah 30 hari setelah penghapusan. Data dokumen dan vector embedding dihapus dalam waktu 30 hari setelah penghapusan akun atau penghapusan dokumen. Log permintaan API disimpan selama 90 hari. Analitik agregat yang dianonimkan dapat disimpan tanpa batas waktu."
        },
        yourRights: {
          title: "6. Hak Anda (GDPR)",
          body: "Jika Anda berada di European Economic Area, Anda memiliki hak untuk: mengakses data pribadi Anda; memperbaiki data yang tidak akurat; meminta penghapusan data Anda (\"hak untuk dilupakan\"); membatasi atau menolak pemrosesan; portabilitas data — mengekspor data Anda dalam format yang dapat dibaca mesin; menarik persetujuan kapan saja. Untuk menggunakan hak-hak ini, gunakan fitur ekspor data dan penghapusan akun di pengaturan Profil Anda, atau hubungi kami langsung."
        },
        cookies: {
          title: "7. Cookie",
          body: "Kami menggunakan cookie esensial dan penyimpanan lokal untuk mempertahankan sesi Anda, mengingat preferensi Anda (seperti bahasa), dan menyediakan fungs inti. Kami tidak menggunakan cookie pelacakan atau cookie iklan pihak ketiga. Anda dapat mengontrol cookie melalui pengaturan browser Anda, tetapi menonaktifkannya dapat memengaruhi fungsionalitas Layanan."
        },
        security: {
          title: "8. Keamanan",
          body: "Kami menerapkan langkah-langkah keamanan standar industri termasuk enkripsi dalam transmisi (TLS), penyimpanan terenkripsi, kontrol akses, dan tinjauan keamanan berkala. Namun, tidak ada sistem yang sepenuhnya aman, dan kami tidak dapat menjamin keamanan absolut data Anda."
        },
        international: {
          title: "9. Transfer Data Internasional",
          body: "Data Anda dapat diproses dan disimpan di negara di luar tempat tinggal Anda. Ketika data ditransfer secara internasional, kami memastikan perlindungan yang tepat sudah berlaku, seperti Klausul Kontraktual Standar atau keputusan kecukupan."
        },
        children: {
          title: "10. Privasi Anak",
          body: "Layanan ini tidak ditujukan untuk pengguna di bawah 16 tahun. Kami tidak dengan sengaja mengumpulkan data pribadi dari anak-anak. Jika Anda yakin seorang anak telah memberikan data pribadi kepada kami, silakan hubungi kami dan kami akan menghapusnya."
        },
        changes: {
          title: "11. Perubahan Kebijakan Ini",
          body: "Kami dapat memperbarui Kebijakan Privasi ini secara berkala. Perubahan material akan dikomunikasikan melalui email atau notifikasi dalam aplikasi minimal 14 hari sebelum berlaku."
        },
        contact: {
          title: "12. Kontak",
          body: "Untuk pertanyaan terkait privasi atau untuk menggunakan hak data Anda, hubungi kami melalui Layanan atau di alamat email yang disediakan di aplikasi."
        }
      }
    },
    backToHome: "Kembali ke beranda",
    readTerms: "Syarat Layanan",
    readPrivacy: "Kebijakan Privasi"
  },
  site: {
    nav: {
      signIn: "Masuk",
      getStarted: "Mulai",
      links: [
        { label: "Harga", href: "/pricing" },
        { label: "Dokumentasi", href: "/docs" },
        { label: "Changelog", href: "/changelog" }
      ]
    },
    footer: {
      tagline: "Intelijen dokumen yang bisa Anda tanya. Unggah PDF, chat dengan sitasi, dan panggil retrieval yang sama dari kode Anda sendiri.",
      rights: "© 2026 Contexta. Hak cipta dilindungi.",
      contactCta: "Hubungi kami",
      columns: {
        product: "Produk",
        company: "Perusahaan",
        resources: "Sumber daya",
        legal: "Legal"
      },
      links: {
        features: "Fitur",
        howItWorks: "Cara kerja",
        pricing: "Harga",
        changelog: "Changelog",
        about: "Tentang",
        blog: "Blog",
        careers: "Karier",
        contact: "Kontak",
        documentation: "Dokumentasi",
        apiReference: "Referensi API",
        guides: "Panduan",
        support: "Dukungan",
        privacy: "Privasi",
        terms: "Syarat",
        security: "Keamanan",
        gdpr: "GDPR"
      }
    },
    pricing: {
      eyebrow: "Harga",
      title: "Anda hanya membayar untuk ruang gerak",
      lede:
        "Semua paket mendapat produk yang sama. Yang membedakan adalah lima batas yang benar-benar ditegakkan server: dokumen, penyimpanan, API key, request API per hari, dan pesan chat per hari.",
      rows: {
        documents: "Dokumen",
        storage: "Penyimpanan",
        apiKeys: "API key",
        apiRequests: "Request API / hari",
        chatMessages: "Pesan chat / hari"
      },
      names: {
        free: "Free",
        pro: "Pro",
        enterprise: "Enterprise"
      },
      blurbs: {
        free: "Cukup untuk mengindeks setumpuk makalah nyata dan menguji apakah jawabannya tahan diperiksa.",
        pro: "Paket kerja: beberapa ratus dokumen, ruang untuk kebiasaan chat harian, dan key untuk tooling Anda sendiri.",
        enterprise: "Produk yang sama, plafon lebih besar — untuk korpus yang terus bertambah."
      },
      perMonth: "/bulan",
      perYear: "per tahun, ditagih tahunan",
      freeForever: "Gratis selamanya",
      popularBadge: "Paling dipilih",
      ctaFree: "Buat akun",
      ctaPaid: "Pilih di Billing",
      soonBadge: "Segera",
      ctaSoon: "Belum dibuka",
      betaNote:
        "Contexta sedang dalam beta: Free adalah satu-satunya paket yang dibuka untuk pendaftaran, dan kartu tidak diambil. Harga di bawah adalah harga paket berbayar saat rilis nanti.",
      includedTitle: "Ada di semua paket",
      included: [
        "Chat yang berpijak pada dokumen Anda sendiri, dengan sitasi dokumen, halaman, dan bagian",
        "Brief tersimpan per dokumen: ringkasan, poin penting, orang, tanggal, dan nominal",
        "Unggah PDF dan DOCX dengan progres indeksing yang nyata",
        "Konversi Markdown dan ekspor korpus penuh sebagai Markdown atau JSONL",
        "API key personal untuk endpoint retrieval /v1 dan server MCP",
        "Masuk lewat email atau Google, dengan pengelolaan password untuk keduanya",
        "Trash, restore, log aktivitas, dan notifikasi in-app",
        "Seluruh antarmuka dalam Bahasa Inggris atau Indonesia"
      ],
      faqTitle: "Pertanyaan yang benar-benar ditanyakan",
      faq: [
        {
          question: "Apa yang terjadi saat saya menabrak batas?",
          answer:
            "Gerbangnya menghentikan aksi baru — unggahan, pembuatan key, atau pesan chat — dan memberi tahu batas mana yang tercapai. Tidak ada dokumen yang sudah Anda unggah ikut terhapus, jadi menghapus dokumen adalah cara untuk bergerak lagi saat paket berbayar belum dibuka."
        },
        {
          question: "Bisakah saya ganti paket nanti?",
          answer:
            "Belum. Free adalah satu-satunya paket yang dibuka selama beta, dan checkout menolak paket lain supaya tidak mengambil uang tanpa memberi apa pun. Pro dan Enterprise dibuka setelah batas di atas ditegakkan server dan billing benar-benar memetakan pembayaran ke paket itu."
        },
        {
          question: "Apakah kartu saya disimpan?",
          answer:
            "Tidak ada kartu yang diambil hari ini, karena Free satu-satunya paket yang dibuka. Saat paket berbayar rilis, detail kartu tetap di Stripe dan Contexta hanya menyimpan status langganan beserta paketnya."
        }
      ]
    },
    changelog: {
      eyebrow: "Changelog",
      title: "Yang berubah",
      lede: "Ditulis dari commit yang benar-benar dikirim, terbaru lebih dulu. Tanggalnya adalah tanggal deploy, bukan tanggal rencana.",
      entries: [
        {
          date: "2026-10-14",
          title: "Pro dan Enterprise berpindah ke Soon",
          body:
            "Sebuah audit menanyakan apa yang sebenarnya dilakukan tiap batas yang diiklankan, dan menemukan checkout bisa mengambil uang sementara tidak ada yang menulis langganan dan tidak ada server yang menegakkan plafon paket. /billing/checkout kini menjawab 409 plan_not_available untuk tier yang tidak bisa dipenuhi, seluruh halaman harga melabeli tier itu Soon, dan angka-angka karangan di landing page dihapus. Contexta berjalan sebagai beta di Free sampai pembayaran dan batas terhubung penuh."
        },
        {
          date: "2026-10-14",
          title: "Chart yang bisa dipakai dengan jempol",
          body:
            "Dashboard berhenti mengirim library chart: kedua chart kini digambar sebagai SVG biasa dan bundle terbesar di /dashboard turun dari 314 kB ke 170 kB. Chart padat merespons seretan di sepanjang kolom alih-alih tap presisi, kontrol form minimal 16 px di ponsel supaya iOS berhenti melakukan zoom halaman, dan tabel lebar kini memberi tahu bahwa mereka bisa digeser."
        },
        {
          date: "2026-10-13",
          title: "Brief membaca seluruh dokumen",
          body:
            "Panel Intelligence dulu meringkas dari chunk pertama saja. Sekarang ia mengambil sampel jendela yang tersebar di seluruh korpus, menggabungkannya jadi satu brief, dan menerbitkan coverage yang berhasil dibaca. Hasilnya disimpan bersama dokumen, jadi membuka ulang halaman tidak memakan biaya."
        },
        {
          date: "2026-10-13",
          title: "Jawaban berhenti kehabisan budget",
          body:
            "Dua 502 di produksi diperbaiki. Jawaban JSON yang terpotong kini diselamatkan, bukan dibuang, dan request brief tidak lagi membiarkan model menghabiskan seluruh token budget untuk reasoning tersembunyi sebelum menulis apa pun."
        },
        {
          date: "2026-10-13",
          title: "Unggahan selesai",
          body:
            "Embedding dibatch 128, kegagalan indeksing transien retry tiga kali dengan backoff, panggilan storage timeout di 300 s dengan pesan yang terbaca, dan bar unggah melaporkan byte nyata alih-alih animasi berdetak."
        },
        {
          date: "2026-10-13",
          title: "Kualitas retrieval dan skor yang jujur",
          body:
            "Jawaban chat kini menjalankan ambang relevansi dan budget prompt, dan angka relevansi yang ditampilkan adalah skor fusi sebagai persentase utuh. Saat materi yang retrieved terlalu tipis untuk menjawab, workspace mengatakannya alih-alih menghasilkan paragraf yang tampak yakin."
        },
        {
          date: "2026-10-11",
          title: "Perangkat billing mendarat",
          body:
            "Stripe checkout disambungkan ke tier paket dan paywall yang muncul di gerbang alih-alih banner dekoratif, bersama verifikasi email dan alur onboarding untuk pengguna baru. Batasnya sendiri masih hanya diperiksa di browser — entri di atas menutup celah itu."
        },
        {
          date: "2026-10-10",
          title: "Masuk dengan Google",
          body:
            "Google OAuth berdampingan dengan email dan password, plus pengelolaan password di profil sehingga salah satu metode masuk bisa menyetel atau mengganti password."
        },
        {
          date: "2026-10-09",
          title: "Workspace jadi aplikasi sidebar",
          body:
            "Dashboard didesain ulang dengan chart aktivitas, halaman usage khusus, API key pindah ke halamannya sendiri, dan trash, notifikasi, serta log aktivitas disambungkan ke data nyata."
        },
        {
          date: "2026-10-07",
          title: "Retrieval jadi API dan server MCP",
          body:
            "Pemilik bisa membuat dan mencabut API key, endpoint /v1 melayani retrieval, daftar dokumen, dan ekspor, dan key yang sama berlaku sebagai kredensial MCP untuk tiga tool Contexta."
        }
      ]
    },
    about: {
      eyebrow: "Tentang",
      title: "Produk kecil untuk membaca dokumen Anda sendiri",
      lede:
        "Contexta mengindeks berkas PDF dan DOCX supaya Anda bisa bertanya dan mendapat jawaban yang menunjuk kembali ke halaman asalnya.",
      sections: [
        {
          title: "Apa itu Contexta",
          body:
            "Workspace dan layanan retrieval dalam satu produk. Anda mengunggah dokumen, Contexta memotong dan mengindeksnya, lalu tiga hal membaca indeks itu: chat, brief otomatis di setiap dokumen, dan API key yang bisa Anda panggil dari kode Anda sendiri."
        },
        {
          title: "Bagaimana jawaban dibentuk",
          body:
            "Pertanyaan Anda di-embed dan juga dicari sebagai kata kunci; dua daftar hasil itu difusi dengan reciprocal rank fusion sehingga tidak satu arm pun bisa menang sendiri; chunk yang lolos dimasukkan ke prompt sesuai budget; dan model menjawab dari konteks itu saja. Setiap sitasi membawa dokumen, halaman, dan judul bagian asalnya."
        },
        {
          title: "Yang menolak ia lakukan",
          body:
            "Ia tidak melatih model dengan dokumen Anda, tidak menambal kekosongan dengan pengetahuan umum lalu menyajikannya sebagai sumber, dan tidak menampilkan angka relevansi yang tidak bisa dibuktikan oleh sebuah chunk. Saat retrieval tipis, jawabannya menyatakan dokumen tidak memuatnya."
        },
        {
          title: "Bagaimana ia dijalankan",
          body:
            "Produk independen, dihosting di infrastruktur yang kami operasikan sendiri: front end Next.js, layanan FastAPI, worker indeksing Python terpisah, Postgres dengan row-level security, dan vector store yang kami jalankan sendiri. Harga dalam dolar utuh dan batasnya dipublikasikan di halaman harga."
        }
      ],
      stackTitle: "Stack-nya, dengan bahasa sederhana",
      stack: [
        "Front end Next.js 15, di-deploy di Vercel",
        "Layanan FastAPI plus worker indeksing Python terpisah",
        "Supabase Postgres dengan row-level security di semua tabel",
        "Qdrant sebagai vector store, di server kami sendiri",
        "Model embedding lewat OpenRouter, DeepSeek untuk jawaban",
        "Stripe untuk langganan"
      ]
    },
    blog: {
      eyebrow: "Blog",
      title: "Catatan dari membangunnya",
      lede: "Tulisan singkat soal keputusan yang benar-benar kami ambil, bersama pengukuran yang memaksanya.",
      posts: [
        {
          date: "2026-10-14",
          title: "Kami menghapus library chart demi donut 130 piksel",
          excerpt: "Satu dependency hampir separuh bundle dashboard, dan hanya membeli dua bentuk.",
          body: [
            "Di ponsel dengan jaringan dibatasi, dashboard butuh 4,1 detik untuk menggambar chart-nya. Waterfall-nya tidak ambigu: 388 kB JavaScript, dan sekitar 130 kB di antaranya adalah library chart yang dipakai untuk satu donut dan satu bar chart. Recharts juga merepotkan soal target sentuh — empat belas kolom di dalam kartu 300 piksel berarti sekitar 21 piksel per tap, yang bukan ukuran kontrol untuk jempol.",
            "Kedua chart kini digambar tangan sebagai SVG. Karena library-nya kami ganti sendiri, interaksinya juga bisa diubah: menyeret melewati chart menggeser seleksi tanpa perlu tap presisi, dan skala sumbunya mengikuti data alih-alih selalu mentok di sepuluh. Chunk terbesar di /dashboard turun dari 314 kB ke 170 kB. Pelajaran yang kami pegang: ukur bundle-nya sebelum membelanya."
          ]
        },
        {
          date: "2026-10-13",
          title: "Model yang menghabiskan seluruh budget untuk berpikir",
          excerpt: "502 dengan pesan error yang tampak masuk akal, penyebabnya token yang tidak pernah kami hitung.",
          body: [
            "Brief dokumen mulai gagal di produksi dengan jawaban kosong. Request-nya benar, retrieval-nya benar, dan model habis memakai seluruh max_tokens untuk reasoning tersembunyi tanpa mengembalikan konten sama sekali. Logika retry kami tidak menolong: lima panggilan @ 42 detik sudah melewatkan timeout client.",
            "Dua perubahan memperbaikinya. Pembuatan brief berjalan dengan thinking dimatikan, dan respons yang datang terpotong kini diselamatkan — field yang sudah terbentuk kita pertahankan dan jawabannya ditandai terpotong, bukan dibuang. Pelajaran yang lebih dalam soal testing: test suite yang men-stub generator jawaban tidak pernah menyentuh token budget, jadi jalur berbayar harus diukur live, dan mengukur berarti menghitung karakter terhadap teks sumber, bukan menunggu status 200."
          ]
        },
        {
          date: "2026-10-11",
          title: "Paywall yang sepakat dengan server",
          excerpt: "Gerbang UI dan gerbang API membaca satu tabel, atau banner itu bohong.",
          body: [
            "Banner upgrade sudah ada sebelum batas mana pun ada. Menyambungkan billing berarti memilih lima angka yang benar-benar penting — dokumen, penyimpanan, key, request API per hari, pesan chat per hari — dan membuat API menjawab setiap mutasi dengan kode over-limit spesifik yang bisa dirender front end sebagai modal.",
            "Urutan itulah yang layak dinyatakan: tentukan batas di satu tempat, tegakkan di layanan, dan biarkan antarmuka hanya melaporkan apa yang dikatakan server. Paywall yang menyala sebelum server menolak adalah bug yang dirasakan pengguna sebagai kebohongan."
          ]
        }
      ]
    },
    careers: {
      eyebrow: "Karier",
      title: "Tidak ada posisi terbuka saat ini",
      lede:
        "Contexta dijalankan tim independen kecil, dan pekerjaan yang sedang berjalan bukan sesuatu yang bisa kami serahkan ke orang yang belum pernah kami ajak kerja bareng. Itu berubah saat memang perlu berubah.",
      lookingTitle: "Seperti apa pekerjaannya",
      looking: [
        "Kualitas retrieval: fusi, jendela chunk, dan eval set yang diukur terhadap dokumen nyata, bukan pertanyaan contoh",
        "Kontrol biaya inferensi: token budget, penyelamatan respons terpotong, kuota harian yang bertahan di trafik produksi",
        "Operasi self-hosted: container, terminasi TLS, migration yang di-apply ke database live",
        "Pekerjaan front end yang dinilai dari ponsel dengan jaringan dibatasi, bukan dev server di desktop"
      ],
      howTitle: "Kalau Anda tetap ingin ngobrol",
      howBody:
        "Tidak ada formulir lamaran dan kami tidak akan berpura-pura ada. Halaman kontak mencantumkan jalur in-app yang benar-benar sampai ke kami, dan menceritakan apa yang sudah Anda kirimkan jauh lebih bernilai daripada surat lamaran.",
      cta: "Ke halaman kontak"
    },
    contact: {
      eyebrow: "Kontak",
      title: "Cara menghubungi kami",
      lede:
        "Contexta belum punya inbox dukungan publik atau issue tracker. Daripada mencetak alamat yang tidak ada yang membacanya, ini jalur yang benar-benar sampai ke produk.",
      channelsTitle: "Jalur in-app",
      channels: [
        {
          title: "Bantuan dan troubleshooting",
          body: "Bagaimana indeksing, chat, dan konversi seharusnya berperilaku, plus masalah yang paling sering muncul.",
          cta: "Buka Bantuan",
          href: "/help"
        },
        {
          title: "Paket, billing, dan invoice",
          body: "Layar billing menampilkan paket Anda saat ini dan pemakaian tiap batas. Free satu-satunya paket yang dibuka selama beta.",
          cta: "Buka Billing",
          href: "/billing"
        },
        {
          title: "Data Anda, ekspor dan penghapusan",
          body: "Ekspor seluruh korpus, hapus satu dokumen, atau tutup akun dari profil Anda.",
          cta: "Buka Profil",
          href: "/profile"
        },
        {
          title: "API key dan integrasi",
          body: "Buat atau cabut key dan tinjau trafik retrieval terbaru di halaman API key.",
          cta: "Buka API key",
          href: "/api-keys"
        }
      ],
      securityTitle: "Melaporkan masalah keamanan",
      securityBody:
        "Untuk saat ini gunakan jalur in-app yang sama, dan sertakan request terkecil yang mereproduksinya. Halaman Keamanan menjelaskan apa yang terlindungi dan apa yang tidak, jadi Anda bisa membedakan temuan nyata dari celah yang sudah kami akui.",
      securityCta: "Baca halaman keamanan"
    },
    docs: {
      eyebrow: "Dokumentasi",
      title: "Mulai dari sini",
      lede: "Semua yang tertulis tentang Contexta ada di satu tempat, dan semuanya menunjuk ke halaman yang benar-benar ada.",
      startTitle: "Jawaban pertama dalam tiga langkah",
      start: [
        "Buat akun — email dan password, atau Masuk dengan Google — lalu verifikasi alamatnya",
        "Unggah PDF atau DOCX di Dokumen dan tunggu statusnya sampai Ready",
        "Buka Chat, pilih dokumen itu, dan tanyakan sesuatu yang spesifik; jawabannya menyitasi halaman dan bagian yang dipakai"
      ],
      startCta: "Buat akun",
      cardsTitle: "Jelajahi",
      cards: [
        {
          title: "Referensi API",
          description: "Autentikasi, endpoint /v1, kode error, header kuota, dan tool MCP.",
          cta: "Buka referensi",
          href: "/docs/api"
        },
        {
          title: "Panduan",
          description: "Dari unggah ke jawaban pertama, membaca sitasi, memakai key, dan mengambil kembali data Anda.",
          cta: "Buka panduan",
          href: "/guides"
        },
        {
          title: "Pusat bantuan",
          description: "Cara workspace berperilaku dan apa yang perlu diperiksa saat unggahan atau chat bermasalah.",
          cta: "Buka bantuan",
          href: "/help"
        },
        {
          title: "Paket dan batas",
          description: "Lima angka yang ditegakkan server, per tier.",
          cta: "Lihat harga",
          href: "/pricing"
        },
        {
          title: "Keamanan",
          description: "Apa yang terlindungi, bagaimana key disimpan, dan batas dari yang bisa kami janjikan hari ini.",
          cta: "Baca keamanan",
          href: "/security"
        },
        {
          title: "Data Anda dan GDPR",
          description: "Hak yang bisa Anda jalankan, cara menjalankannya in-app, dan siapa yang memproses teks Anda.",
          cta: "Baca GDPR",
          href: "/gdpr"
        }
      ]
    },
    api: {
      eyebrow: "Referensi API",
      title: "Retrieval yang bisa Anda panggil",
      lede:
        "Retrieval yang sama dengan yang dipakai chat, di balik bearer token. Referensi ini publik; layar pengelolaan key yang live ada di workspace Anda.",
      keysCta: "Kelola API key",
      mcpNote:
        "Satu key melayani keduanya: endpoint HTTP dan tool MCP Contexta menerima kredensial yang sama."
    },
    guides: {
      eyebrow: "Panduan",
      title: "Empat hal yang layak diketahui",
      lede: "Langkah singkat dan berurutan. Setiap panduan berakhir di layar yang bisa Anda buka sekarang juga.",
      guides: [
        {
          title: "Dari unggah ke jawaban pertama",
          description: "Yang terjadi antara memilih berkas dan bertanya tentangnya.",
          steps: [
            "Dokumen → unggah PDF atau DOCX. Barisnya menampilkan Processing sementara worker memotong dan meng-embed.",
            "Tunggu sampai Ready. Statusnya dibaca dari server, jadi me-refresh itu jujur, bukan kosmetik.",
            "Chat → pilih dokumen. Satu percakapan sengaja hanya mencakup satu dokumen, supaya jawaban tidak tercampur.",
            "Tanyakan sesuatu yang spesifik: ringkas, hitung baris, cari nilai tertinggi, atau bandingkan dua bagian."
          ],
          cta: "Buka Dokumen",
          href: "/documents"
        },
        {
          title: "Membaca sebuah sitasi",
          description: "Cara memeriksa jawaban alih-alih mempercayainya.",
          steps: [
            "Setiap jawaban mencantumkan chunk yang dipakai, bernomor. Memilih salah satunya membuka bagian itu beserta nomor halaman dan jalur bagiannya.",
            "Relevansi ditampilkan sebagai persentase dari plafon fusi retrieval, bukan cosine mentah. Relevansi rendah berarti korpus tipis untuk pertanyaan itu.",
            "Kalau jawaban harus memuat angka persis, minta barisnya didaftarkan dan periksa terhadap sumbernya.",
            "Saat tidak ada yang memenuhi ambang, Contexta menyatakan dokumen tidak memuatnya alih-alih menjawab dari pengetahuan umum."
          ],
          cta: "Buka Chat",
          href: "/chat"
        },
        {
          title: "Memakai API key Anda",
          description: "Key dibuat sekali, ditampilkan sekali, dan disimpan sebagai hash.",
          steps: [
            "API key → buat key, beri nama yang masih Anda kenali saat mencabutnya nanti.",
            "Salin segera — di sisi kami hanya prefix dan empat karakter terakhir yang disimpan.",
            "Kirim sebagai bearer token ke endpoint retrieval /v1; kredensial yang sama berlaku untuk tool MCP.",
            "Pantau halaman usage untuk panggilan yang lolos versus yang ditolak; penolakan kuota mengembalikan 429 beserta alasannya."
          ],
          cta: "Buka API key",
          href: "/api-keys"
        },
        {
          title: "Mengambil kembali data Anda",
          description: "Ekspor sebelum menghapus, dan periksa apa yang tersisa.",
          steps: [
            "Konversikan dokumen ke Markdown untuk mendapat teks persis yang dipakai Contexta menjawab.",
            "Ekspor seluruh korpus sebagai Markdown atau JSONL dari panel dokumen; JSONL mempertahankan batas chunk dan metadata.",
            "Menghapus dokumen mengeluarkan berkasnya dari storage dan membuang chunk-nya dari indeks.",
            "Menghapus akun di Profil menghapus workspace: dokumen, key, dan riwayat yang menyertainya."
          ],
          cta: "Buka Profil",
          href: "/profile"
        }
      ]
    },
    security: {
      eyebrow: "Keamanan",
      title: "Yang terlindungi, dan yang tidak kami klaim",
      lede:
        "Contexta produk kecil di infrastruktur yang kami operasikan sendiri. Halaman ini sengaja spesifik di kedua paruh kalimat itu.",
      measuresTitle: "Sudah berlaku hari ini",
      measures: [
        {
          title: "API key disimpan sebagai hash",
          body:
            "Kami menyimpan hash plus prefix dan empat karakter terakhir. Plaintext ditampilkan sekali saat pembuatan dan tidak bisa dipulihkan setelahnya."
        },
        {
          title: "Row-level security di database",
          body:
            "Policy Postgres membatasi baris ke akun yang terautentikasi, jadi token satu workspace tidak bisa membaca dokumen, langganan, atau notifikasi milik workspace lain."
        },
        {
          title: "Kuota di setiap jalur berbayar",
          body:
            "Batas request per menit dan per hari untuk setiap key, plus budget harian untuk jawaban chat dan brief dokumen. Penolakan mengembalikan 429 dengan alasan dan tercatat di log."
        },
        {
          title: "Key dengan scope",
          body:
            "Sebuah key bisa dibatasi ke subset dokumen. Permintaan untuk materi di luar subset mengembalikan hasil kosong, dan ekspor menjawab 404."
        },
        {
          title: "TLS di mana-mana, trafik API tercatat",
          body:
            "Web app disajikan lewat HTTPS dan API menterminasi TLS di depan layanan. Panggilan API dicatat bersama status respons dan dibersihkan setelah 90 hari."
        },
        {
          title: "Autentikasi lewat Supabase Auth",
          body:
            "Token diverifikasi terhadap kunci provider, alamat email harus terverifikasi, dan masuk dengan Google bersifat opsional di samping email dan password."
        }
      ],
      disclosureTitle: "Melaporkan masalah",
      disclosureBody:
        "Gunakan jalur di halaman kontak dan sertakan request terkecil yang mereproduksinya. Belum ada bug bounty dan tidak ada perjanjian disclosure yang ditandatangani — kami lebih memilih mengatakannya daripada menyiratkan program yang tidak kami jalankan.",
      limitsTitle: "Yang tidak bisa kami janjikan",
      limits: [
        "Tidak ada SOC 2, ISO 27001, atau sertifikasi serupa, dan tidak ada catatan penetration test oleh pihak ketiga",
        "Menjawab sebuah pertanyaan mengirim teks yang retrieved ke model pihak ketiga (DeepSeek, dan model OpenRouter untuk embedding); kami tidak memakai dokumen Anda untuk melatih apa pun, tetapi teks itu memang keluar dari infrastruktur kami untuk menghasilkan jawaban",
        "Penghapusan akun menghapus data workspace Anda; legal hold dan jendela log API 90 hari dinyatakan di halaman GDPR alih-alih disembunyikan"
      ],
      cta: "Opsi kontak"
    },
    gdpr: {
      eyebrow: "GDPR",
      title: "Data Anda, dalam istilah operasional yang jelas",
      lede:
        "Apa yang kami pegang, berapa lama, dan layar persis yang bisa Anda pakai untuk menjalankan setiap hak. Tanpa surat formalitas.",
      controllerTitle: "Siapa yang bertanggung jawab",
      controllerBody:
        "Contexta dioperasikan oleh tim di balik contexta.my.id, yang berperan sebagai controller atas data di workspace Anda. Belum ada badan hukum terpisah maupun DPO yang bisa ditujukan; halaman kontak mencantumkan jalur yang sampai ke operatornya.",
      rightsTitle: "Hak dan cara menggunakannya",
      rights: [
        {
          title: "Akses",
          body: "Profil → ekspor data Anda, atau unduh seluruh korpus sebagai Markdown atau JSONL dari panel dokumen."
        },
        {
          title: "Perbaikan",
          body: "Perbaiki detail akun di Profil. Konten dokumen diperbaiki dengan menghapus dan mengunggah ulang berkasnya, yang membangun kembali indeksnya."
        },
        {
          title: "Penghapusan",
          body: "Hapus dokumen untuk mengeluarkan berkas dan chunk-nya, atau hapus akun di Profil untuk menghapus workspace."
        },
        {
          title: "Portabilitas",
          body: "Ekspor tersedia dalam dua format machine-readable dan tidak perlu menghubungi kami."
        },
        {
          title: "Pembatasan pemrosesan",
          body: "Cabut API key dan keluarkan dokumen yang tidak ingin diquery. Retrieval hanya melihat apa yang masih terindeks."
        },
        {
          title: "Menolak dan menarik persetujuan",
          body: "Putuskan koneksi masuk Google atau sebuah integrasi, matikan cookie non-esensial di banner, atau tutup akun."
        }
      ],
      retentionTitle: "Berapa lama hal-hal bertahan",
      retention: [
        "Dokumen dan chunk-nya: sampai Anda menghapusnya, atau sampai akun ditutup",
        "Log panggilan API: dibersihkan setelah 90 hari oleh job worker terjadwal",
        "Riwayat chat: disimpan bersama workspace Anda dan dihapus besertanya"
      ],
      subprocessorsTitle: "Siapa lagi yang memprosesnya",
      subprocessors: [
        { name: "Supabase", role: "Database Postgres, autentikasi, dan penyimpanan berkas" },
        { name: "Vercel", role: "Menyajikan aplikasi web" },
        { name: "Qdrant", role: "Indeks vektor, berjalan di server kami sendiri" },
        { name: "OpenRouter", role: "Panggilan model embedding untuk indeksing dan pencarian" },
        { name: "DeepSeek", role: "Pembuatan jawaban dan brief dari konteks yang retrieved" },
        { name: "Stripe", role: "Pemrosesan pembayaran, untuk paket yang dibuka setelah beta" }
      ],
      note:
        "Halaman ini menggambarkan cara produk bekerja hari ini. Bila berbeda dengan Kebijakan Privasi, Kebijakan itulah dokumen legalnya dan halaman ini adalah dokumen operasionalnya."
    }
  },
  cookieConsent: {
    message: "Kami menggunakan cookie esensial untuk menjaga Anda tetap masuk dan mengingat preferensi Anda. Tanpa cookie pelacakan atau iklan.",
    accept: "Terima",
    learnMore: "Pelajari lebih lanjut"
  }
};
