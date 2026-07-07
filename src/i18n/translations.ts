// src/i18n/translations.ts
//
// Kamus terjemahan untuk seluruh alur wizard (bagian yang menghasilkan
// pendapatan) + label inti lainnya. Halaman marketing (Hero/Features/
// Pricing/Footer) dan halaman legal belum diterjemahkan di tahap ini —
// menyusul di tahap berikutnya.
//
// Struktur "id" adalah sumber kebenaran bentuk data; "en" harus punya
// SEMUA key yang sama (dijaga oleh type Translations di bawah).

const id = {
  common: {
    next: "Lanjut →",
    back: "← Kembali",
    edit: "Edit",
    langToggle: "EN",
  },

  chooseAnalysisType: {
    greeting: "Halo, saya Beemo.",
    subtitle: "Pilih dulu jenis analisis yang Anda butuhkan.",
    newTitle: "Analisis Bisnis Baru",
    newDesc:
      "Untuk Anda yang belum memiliki usaha. Cocok untuk validasi ide bisnis, mengetahui potensi pasar, target pelanggan, dan strategi memulai usaha.",
    runningTitle: "Analisis Bisnis Berjalan",
    runningDesc:
      "Untuk usaha yang sudah beroperasi. Cocok untuk mengetahui posisi dibanding kompetitor, peluang pertumbuhan, dan rekomendasi peningkatan performa.",
  },

  chatWizard: {
    greeting: "Halo, saya Beemo.",
    subtitleNew: "Menganalisis rencana bisnis baru Anda.",
    subtitleRunning: "Menganalisis bisnis Anda yang sudah berjalan.",
  },

  stepOne: {
    stepLabel: "STEP 1 OF 5",
    namaLabel: "Nama Anda",
    namaPlaceholder: "Contoh : Michael Aldo",
    namaHelper: "Hanya huruf, minimal 3 karakter, tanpa angka/simbol/huruf berulang.",
    emailLabel: "Email Anda",
    emailPlaceholder: "Contoh : nama@email.com",
    emailHelper: "Bukti pembayaran Anda akan dikirim ke email ini.",
    profesiLabel: "Profesi Anda",
    profesiPlaceholder: "Founder, Owner, Manager...",
    profesiHelper: "Hanya huruf, minimal 3 karakter, tidak boleh profesi ilegal/negatif (mis. pencuri, hacker).",
    namaBisnisLabel: "Nama Bisnis/Brand Anda",
    namaBisnisPlaceholder: "Contoh : King Rawon & King Juice Premium",
    jenisBisnisLabel: "Jenis Bisnis Anda",
    jenisBisnisPlaceholder: "Coffee Shop, Kontraktor, Retail...",
    jenisBisnisHelper: "Hanya huruf, minimal 3 karakter, tanpa angka/simbol/huruf berulang.",
    formError: "Periksa kembali kolom yang ditandai ⚠ sebelum lanjut.",
  },

  stepTwo: {
    stepLabel: "STEP 2 OF 5",
    lokasiLabelNew: "Lokasi Rencana Bisnis Anda",
    lokasiLabelRunning: "Lokasi Bisnis Anda",
    lokasiPlaceholder: "Contoh : Sukun, Kota Malang",
    lokasiHelper: "Sertakan kecamatan/kota (minimal 2 kata), jangan disingkat/asal ketik.",
    targetPelangganLabel: "Target Pelanggan Anda",
    targetPelangganPlaceholder: "Contoh : Mahasiswa dan pekerja muda usia 18-30 tahun di sekitar kampus...",
    targetPelangganHelper: "Ceritakan siapa calon pelanggan utama Anda.",
    rencanaLaunchingLabel: "Rencana Kapan Launching",
    rencanaLaunchingHelper:
      "Perkiraan saja tidak apa-apa — ini membantu kami menyusun apa saja yang perlu disiapkan sebelum hari peluncuran.",
    sejakKapanLabel: "Sejak Kapan Bisnis Berjalan",
    sejakKapanHelper: "Pilih tanggal mulai bisnis Anda beroperasi (tidak boleh tanggal yang belum terjadi).",
    modalAwalLabel: "Estimasi Modal Awal",
    omsetLabel: "Rata-rata Omset Bulanan Saat Ini",
    omsetPlaceholderNew: "Contoh : Rp10.000.000,-",
    omsetPlaceholderRunning: "Contoh : Rp15.000.000,-",
    omsetHelper: "Cukup ketik angkanya, format Rupiah otomatis menyesuaikan.",
    formError: "Periksa kembali kolom yang ditandai ⚠ sebelum lanjut.",
  },

  stepThree: {
    stepLabel: "STEP 3 OF 5",
    tantanganLabelNew: "Tantangan Terbesar dalam Merintis Bisnis Ini",
    tantanganLabelRunning: "Tantangan Terbesar Bisnis Anda",
    tantanganPlaceholderNew:
      "Contoh : Modal terbatas untuk sewa tempat strategis dan belum punya jaringan supplier terpercaya...",
    tantanganPlaceholderRunning:
      "Contoh : Penjualan menurun karena kualitas produk tidak konsisten sejak bulan kedua buka...",
    helper: "Ceritakan sedetail mungkin (minimal 2 kata), jangan asal ketik.",
    targetLabel: "Target / Harapan Bisnis Anda",
    targetPlaceholderNew:
      "Contoh : Ingin buka dan langsung ramai pelanggan dalam 3 bulan pertama, balik modal dalam setahun...",
    targetPlaceholderRunning:
      "Contoh : Ingin omset naik 2x lipat dalam 6 bulan dengan menjangkau pelanggan mahasiswa...",
    formError: "Periksa kembali kolom yang ditandai ⚠ sebelum lanjut.",
  },

  stepFour: {
    stepLabel: "STEP 4 OF 5",
    title: "Cerita & Visi Anda",
    intro:
      "Ceritakan kondisi Anda saat ini, impian terbesar yang ingin dicapai, dan bagaimana Anda memandang bisnis. Dari cerita Anda, saya akan membantu menyusun strategi yang paling sesuai untuk mencapai tujuan tersebut.",
    placeholder: "Tulis dengan bahasa Anda sendiri, sesantai mengobrol dengan konsultan yang Anda percaya...",
    helper: "Semakin jujur dan detail cerita Anda, semakin tepat sasaran strategi yang bisa kami susun.",
    formError: "Cerita Anda masih terlalu singkat — coba ceritakan lebih lengkap sebelum lanjut.",
  },

  stepReview: {
    stepLabel: "STEP 5 OF 5 — KONFIRMASI DATA",
    intro:
      "Cek dulu data di bawah sebelum diproses. Pastikan semuanya sudah benar, karena hasil analisis akan mengikuti data yang Anda isi.",
    identitasTitle: "Identitas",
    namaLabel: "Nama",
    profesiLabel: "Profesi",
    namaBisnisLabel: "Nama Bisnis/Brand",
    jenisBisnisLabel: "Jenis Bisnis",
    lokasiKondisiTitle: "Lokasi & Kondisi Bisnis",
    lokasiLabel: "Lokasi",
    targetPelangganLabel: "Target Pelanggan",
    rencanaLaunchingLabel: "Rencana Launching",
    sejakKapanLabel: "Sejak Kapan Berjalan",
    modalAwalLabel: "Estimasi Modal Awal",
    omsetLabel: "Omset Bulanan Saat Ini",
    tantanganTargetTitle: "Tantangan & Target",
    tantanganLabel: "Tantangan Terbesar",
    targetLabel: "Target/Harapan",
    ceritaVisiTitle: "Cerita & Visi Anda",
    botError: "Verifikasi gagal. Mohon isi ulang formulir secara manual, lalu coba lagi.",
    submitLabel: "🚀 Proses Analisis Sekarang",
    submitLoading: "Memproses Analisis...",
    submitHelper: "Pastikan data sudah benar sebelum lanjut",
  },

  loadingAI: {
    title: "Beemo sedang menganalisis bisnis Anda",
    steps: [
      "Menganalisis kondisi bisnis...",
      "Membandingkan dengan kompetitor...",
      "Mencari peluang pasar...",
      "Menyusun rekomendasi strategi...",
    ],
  },

  previewReport: {
    eyebrow: "Hasil Analisa (Gratis)",
    errorFallback: "Analisis AI belum berhasil dibuat.",
    errorNote: "Kami tidak menampilkan hasil karangan — silakan coba lagi.",
    retryButton: "🔄 Coba Analisis Lagi",
    restartLink: "Mulai analisis baru",
    scoreLabelNew: "Skor Kesiapan Bisnis",
    scoreLabelRunning: "Skor Kesehatan Bisnis",
    checklistTitle: "AI Sudah Menganalisa",
    checklist: ["Kondisi Bisnis", "Peluang", "Target", "SWOT", "Kompetitor", "Strategi Marketing", "Rencana 30 Hari", "Ide Pengembangan"],
    summaryTitle: "Ringkasan Singkat",
    findingsTitle: "Temuan Penting",
    strengthsTitle: "Yang Sudah Baik",
    improvementsTitle: "Yang Perlu Diperbaiki",
    opportunityTitle: "Peluang",
    swotTitle: "Analisa SWOT",
    swotDesc: "Tersedia lengkap di laporan PRO/PLATINUM.",
    competitorTitle: "Analisa Kompetitor",
    competitorDesc: "Identifikasi kompetitor tersedia di laporan berbayar.",
    planTitle: "Rencana 30 Hari",
    planDesc: "Roadmap langkah demi langkah tersedia di laporan berbayar.",
    unlockEyebrow: "🔒 Unlock Laporan Lengkap",
    unlockTitle: "Pilih Paket yang Sesuai Kebutuhan Anda",
    unlockSubtitle: "Dua pilihan paket untuk analisis bisnis yang lebih mendalam dan siap Anda terapkan.",
    proAudience: "Untuk UMKM & Bisnis Mikro",
    proChecklist: [
      "Business Intelligence Report lengkap (PDF)",
      "SWOT, Market Analysis & Competitor Analysis",
      "Target Harian, Target Omzet & Break Even",
      "SOP & To-Do List operasional",
      "Konsultasi Chat Beemo selama 7 hari",
    ],
    proButton: "🔓 Unlock PRO",
    platinumAudience: "Untuk Perusahaan & Keputusan Strategis",
    platinumChecklist: [
      "Semua fitur PRO",
      "Business Workspace & Dashboard lengkap",
      "Growth Plan & Marketing Assets",
      "Template Website & Branding",
      "Konsultasi Chat Beemo selama 30 hari",
    ],
    platinumButton: "🔓 Unlock PLATINUM",
    footerNote: "🔒 Hasil analisis akan tersedia langsung dalam format PDF yang siap diunduh.",
    unlockCta: "Buka Laporan Lengkap",
    swotMock: [
      "Kekuatan utama dari sisi produk dan operasional bisnis Anda",
      "Kelemahan yang perlu segera diperhatikan",
      "Peluang pasar yang belum banyak dimanfaatkan",
      "Ancaman dari kompetitor yang perlu diwaspadai",
    ],
    competitorMock: [
      "Beberapa kompetitor teridentifikasi di sekitar lokasi Anda",
      "Perbandingan posisi dan kekuatan masing-masing",
      "Celah pasar yang berpotensi bisa Anda manfaatkan",
    ],
    planMock: [
      "Minggu 1: fokus pada langkah persiapan awal",
      "Minggu 2: eksekusi strategi prioritas",
      "Minggu 3-4: evaluasi dan penyesuaian",
    ],
  },

  paymentPage: {
    backButton: "← Kembali ke Beranda",
    unlockTitle: "Unlock Laporan",
    description: "Setelah pembayaran berhasil, laporan lengkap Anda akan langsung tersedia dalam format PDF.",
    bisnisLabel: "Bisnis",
    namaLabel: "Nama",
    emailLabel: "Email tujuan laporan",
    totalLabel: "Total",
    missingDataWarning:
      "Data bisnis tidak ditemukan. Sebaiknya mulai dari analisis gratis dulu supaya laporan yang kami kirim sesuai dengan bisnis Anda.",
    payButton: "Bayar",
    payButtonLoading: "Memproses...",
    paymentErrorGeneric: "Pembayaran gagal. Silakan coba lagi.",
    paymentErrorNetwork: "Terjadi kesalahan. Silakan coba lagi.",
    footerNote: "Setelah pembayaran berhasil, laporan lengkap Anda akan langsung tersedia dalam format PDF.",
  },

  navbar: {
    tagline: "Konsultan Bisnis AI Anda",
    beranda: "Beranda",
    fiturAI: "Fitur AI",
    paketBisnis: "Paket Bisnis",
    tentangKami: "Tentang Kami",
  },

  hero: {
    badge: "🔥 Harga Beta Terbatas",
    title: "Mulai Perjalanan Menuju Omzet Rp100 Juta Pertamamu.",
    subtitle:
      "Dapatkan analisis AI, peluang pasar, peta kompetitor, dan strategi bisnis yang siap diterapkan dalam hitungan menit.",
    ctaButton: "🚀 Mulai Analisis Bisnis Gratis!!",
    beemoGreeting: "Halo, saya Beemo.",
    beemoDesc:
      "Ceritakan bisnis Anda. Saya akan membantu menganalisis kondisi bisnis, menemukan peluang pasar, mempelajari kompetitor, dan menyusun rekomendasi yang dapat langsung digunakan.",
    badge1: "Laporan Profesional",
    badge2: "Data Bisnis Aman",
    badge3: "Hasil dalam Beberapa Menit",
    badge4: "Untuk UMKM, Startup & Perusahaan",
  },

  features: {
    eyebrow: "Fitur AI",
    title: "Semua Analisis Bisnis yang Anda Butuhkan dalam Satu Platform",
    subtitle:
      "Mulai dari memahami kondisi bisnis hingga menyusun strategi, semuanya tersedia dalam satu laporan profesional.",
    items: [
      {
        icon: "📊",
        title: "Memahami Kondisi Bisnis",
        desc: "Ketahui kekuatan, kelemahan, peluang, dan tantangan bisnis Anda dalam satu laporan.",
      },
      {
        icon: "🎯",
        title: "Mempelajari Kompetitor",
        desc: "Pahami keunggulan pesaing dan temukan cara agar bisnis Anda lebih unggul.",
      },
      {
        icon: "🧭",
        title: "Menemukan Peluang Pasar",
        desc: "Identifikasi peluang baru yang masih dapat dimanfaatkan untuk mengembangkan bisnis.",
      },
      {
        icon: "🗺️",
        title: "Menentukan Strategi",
        desc: "Dapatkan rekomendasi langkah yang dapat langsung diterapkan sesuai kondisi bisnis Anda.",
      },
    ],
  },

  pricing: {
    badge: "🔥 Harga Beta Terbatas",
    title: "Pilih Laporan yang Tepat untuk Bisnis Anda",
    subtitle:
      "Dua pilihan laporan yang dirancang untuk menjawab kebutuhan bisnis Anda, dari analisis praktis hingga strategi tingkat eksekutif.",
    proTitle: "Laporan Praktis untuk Aksi Nyata",
    proDesc: "Cocok untuk UMKM, toko, kuliner, jasa, online shop, freelancer, dan bisnis mikro.",
    proChecklist: [
      "Business Intelligence Report lengkap (PDF & tampilan interaktif)",
      "SWOT, Market Analysis & Competitor Analysis",
      "Target Harian, Target Omzet & Break Even",
      "SOP & To-Do List operasional",
      "Strategi Marketing yang bisa langsung diterapkan",
      "Konsultasi Chat Beemo selama 7 hari",
    ],
    platinumTitle: "Analisis Mendalam untuk Keputusan Strategis",
    platinumDesc: "Cocok untuk perusahaan, startup, investor, pemilik bisnis besar, dan pengambil keputusan.",
    platinumIncludesNote: "Semua di PRO, ditambah:",
    platinumChecklist: [
      "Semua fitur PRO",
      "Business Workspace & Dashboard yang lebih lengkap",
      "Growth Plan & Marketing Assets",
      "Template Website & Branding",
      "Competitor Workspace & Roadmap bisnis",
      "Konsultasi Chat Beemo selama 30 hari",
    ],
    badges: [
      { icon: "📊", title: "Analisis Berbasis Data", desc: "Keputusan berdasarkan data, bukan asumsi." },
      { icon: "🧠", title: "AI + Business Intelligence", desc: "Teknologi AI dan BI untuk insight yang akurat." },
      { icon: "⚡", title: "Cepat & Praktis", desc: "Siap dalam hitungan menit, langsung bisa digunakan." },
      { icon: "🎯", title: "Strategi yang Dapat Diterapkan", desc: "Fokus pada rekomendasi yang realistis dan relevan." },
      { icon: "🛡️", title: "Terpercaya & Profesional", desc: "Sumber data valid, analisis mendalam, kualitas terjamin." },
      { icon: "👥", title: "Untuk Semua Pelaku Usaha", desc: "Dari UMKM hingga perusahaan besar di seluruh Indonesia." },
    ],
    ctaButton: "🚀 Mulai Analisis Bisnis Sekarang",
    ctaSubtext: "Pilih paket yang sesuai dengan kebutuhan Anda. Investasi kecil untuk keputusan besar.",
  },

  footer: {
    copyright: "© 2026 THE HIVE - Powered by Beemo AI",
    privacyPolicy: "Kebijakan Privasi",
    terms: "Syarat & Ketentuan",
    refundPolicy: "Kebijakan Refund",
    shareToFriend: "Bagikan ke Teman",
  },

  chatFlow: {
    greeting:
      "👋 Halo! Saya Beemo AI dari THE HIVE. Siap membantu kamu memahami bisnis, menganalisis kompetitor, dan menemukan peluang terbaik.\n\nSebelum mulai, boleh kenalan dulu? Siapa nama kamu?",
    askEmail: "Senang kenalan denganmu, {nama}! 😊 Boleh minta emailmu? Nanti saya pakai untuk kirim saran dan insight pengembangan bisnismu ke sana.",
    askProfesi: "Baik. Sekarang, kamu berperan sebagai apa di bisnis ini? (misalnya Founder, Owner, Manager)",
    askNamaBisnis: "Terima kasih, {profesi} — apa nama bisnis atau brand kamu?",
    askJenisBisnis: "{namaBisnis}, nama yang menarik. Bisnis ini bergerak di bidang apa? (misalnya Coffee Shop, Retail, Jasa Konsultasi)",
    askLokasiNew: "Baik. Sekarang soal lokasi — di mana rencana lokasi bisnis kamu?",
    askLokasiRunning: "Baik. Sekarang soal lokasi — di mana lokasi bisnis kamu sekarang?",
    askTargetPelanggan: "Siapa target pelanggan utama yang kamu bidik?",
    askRencanaLaunching: "Kira-kira kapan rencana launching-nya? Perkiraan saja tidak apa-apa.",
    askSejakKapan: "Sejak kapan bisnis ini mulai berjalan?",
    askModalAwal: "Berapa estimasi modal awal yang kamu siapkan?",
    askOmset: "Berapa rata-rata omset bulanan bisnis kamu saat ini?",
    askTantanganNew: "Sekarang bagian penting — apa tantangan terbesar yang kamu hadapi dalam merintis {namaBisnis}?",
    askTantanganRunning: "Sekarang bagian penting — apa tantangan terbesar {namaBisnis} saat ini?",
    askTarget: "Dimengerti. Apa target atau harapan besar kamu untuk bisnis ini dalam 6-12 bulan ke depan?",
    askCeritaVisi:
      "Terakhir, {nama} — boleh cerita lebih personal? Ceritakan kondisi kamu saat ini, impian terbesar yang ingin dicapai, dan bagaimana kamu memandang bisnis ini. Dari cerita kamu, saya akan bantu susun strategi yang paling sesuai.",
    summaryIntro: "Terima kasih banyak, {nama}. 🙏 Ceritamu sangat membantu. Ini ringkasan yang saya tangkap — cek dulu sebelum saya mulai analisis:",
    phaseKenal: "Mengenal Bisnis",
    phaseKondisi: "Memahami Kondisi",
    phaseTarget: "Menentukan Target",
    phaseStrategi: "Menyusun Strategi",
    phaseSelesai: "Menyelesaikan Analisis",
    progressLabel: "Pertanyaan {current} dari {total}",
    editLabel: "Edit",
    sendPlaceholder: "Ketik jawabanmu di sini...",
    sendHint: "Tekan Enter untuk mengirim",
    invalidNudge: "Sepertinya jawabannya masih terlalu singkat — boleh ceritakan sedikit lebih detail?",
    invalidEmailNudge: "Sepertinya format emailnya belum tepat, boleh dicek kembali?",
    invalidDateFutureNudge: "Tanggal tersebut sudah lewat — boleh pilih tanggal ke depan?",
    invalidDatePastNudge: "Tanggal tersebut ada di masa depan — boleh pilih tanggal yang sudah terjadi?",
    invalidGenericNudge: "Sepertinya masih ada yang perlu diperbaiki, boleh dicek kembali?",
    botError: "Sepertinya ada yang tidak biasa saat mengisi formulir ini. Mohon isi ulang secara manual.",
    submitLabel: "🚀 Proses Analisis Sekarang",
    submitLoading: "Memproses Analisis...",
    submitHelper: "Pastikan data sudah benar sebelum lanjut",
    identitasTitle: "Identitas",
    namaLabel: "Nama",
    profesiLabel: "Profesi",
    namaBisnisLabel: "Nama Bisnis/Brand",
    jenisBisnisLabel: "Jenis Bisnis",
    lokasiKondisiTitle: "Lokasi & Kondisi Bisnis",
    lokasiLabel: "Lokasi",
    targetPelangganLabel: "Target Pelanggan",
    rencanaLaunchingLabel: "Rencana Launching",
    sejakKapanLabel: "Sejak Kapan Berjalan",
    modalAwalLabel: "Estimasi Modal Awal",
    omsetLabel: "Omset Bulanan Saat Ini",
    tantanganTargetTitle: "Tantangan & Target",
    tantanganLabel: "Tantangan Terbesar",
    targetLabel: "Target/Harapan",
    ceritaVisiTitle: "Cerita & Visi",
  },

  aboutPage: {
    badge: "Tentang Kami",
    heroTitlePrefix: "AI Business Consultant Pertama yang Dibangun untuk",
    heroTitleHighlight: "Bisnis Indonesia",
    heroDesc:
      "THE HIVE membantu pemilik usaha memahami kondisi bisnis, menemukan peluang pasar, mempelajari kompetitor, hingga menyusun strategi bisnis berbasis AI dan Business Intelligence.",
    heroCta: "Pelajari Filosofi Kami",
    accordion: {
      visi: {
        title: "Visi Kami",
        content:
          "Kami percaya bahwa setiap pelaku usaha berhak memiliki akses terhadap analisis bisnis kelas profesional. THE HIVE hadir untuk menghilangkan kesenjangan tersebut dengan menghadirkan Artificial Intelligence dan Business Intelligence yang membantu setiap keputusan bisnis menjadi lebih cerdas, lebih cepat, dan lebih berdampak. Visi kami adalah menjadi platform AI Business Intelligence paling dipercaya di Indonesia yang mengubah data menjadi keputusan, keputusan menjadi pertumbuhan, dan pertumbuhan menjadi masa depan bisnis yang lebih baik.",
      },
      misi: {
        title: "Misi Kami",
        items: [
          {
            title: "Menghadirkan Analisis Bisnis Profesional untuk Semua",
            text: "Kami percaya bahwa setiap pelaku usaha berhak mendapatkan akses terhadap analisis bisnis berkualitas. Karena itu, kami membangun teknologi yang mampu menyederhanakan proses analisis tanpa mengurangi kedalaman insight yang diberikan.",
          },
          {
            title: "Mengubah Data Menjadi Keputusan yang Bernilai",
            text: "Kami mengolah berbagai informasi bisnis menjadi rekomendasi yang jelas, terukur, dan dapat langsung digunakan, sehingga setiap keputusan didasarkan pada data, bukan sekadar asumsi.",
          },
          {
            title: "Membantu Bisnis Bertumbuh Secara Berkelanjutan",
            text: "THE HIVE tidak hanya membantu menyelesaikan masalah hari ini, tetapi juga membantu pelaku usaha melihat peluang baru, memahami risiko, dan menyusun strategi pertumbuhan jangka panjang.",
          },
          {
            title: "Menggabungkan Artificial Intelligence dan Business Intelligence",
            text: "Kami mengintegrasikan kecerdasan buatan dengan pendekatan Business Intelligence agar setiap laporan tidak hanya cepat dihasilkan, tetapi juga relevan, mudah dipahami, dan memiliki nilai praktis.",
          },
          {
            title: "Terus Belajar, Terus Berkembang",
            text: "Kami berkomitmen untuk terus meningkatkan kualitas AI, memperluas sumber data, serta menyempurnakan metode analisis agar THE HIVE selalu memberikan insight yang semakin akurat seiring berkembangnya dunia bisnis.",
          },
          {
            title: "Membangun Ekosistem Keputusan Bisnis Indonesia",
            text: "Kami ingin menjadi mitra berpikir bagi jutaan pelaku usaha Indonesia, membantu mereka memahami bisnisnya lebih dalam, mengambil keputusan yang lebih baik, dan menciptakan dampak nyata bagi pertumbuhan ekonomi nasional.",
          },
        ],
      },
      kenapaDibuat: {
        title: "Kenapa THE HIVE Dibuat?",
        content:
          "THE HIVE lahir dari keyakinan bahwa keputusan bisnis terbaik selalu dimulai dari data, bukan dugaan. Kami percaya setiap pelaku usaha, mulai dari UMKM hingga perusahaan besar, berhak mendapatkan analisis bisnis yang akurat tanpa harus memiliki tim konsultan atau kemampuan teknis yang rumit. Melalui perpaduan Artificial Intelligence (AI) dan analisis bisnis modern, THE HIVE membantu Anda memahami kondisi usaha, mengenali peluang pasar, menganalisis kompetitor, serta mengambil keputusan dengan lebih percaya diri. Tujuan kami sederhana: membuat analisis bisnis profesional menjadi lebih cepat, mudah, dan terjangkau agar semakin banyak bisnis di Indonesia dapat tumbuh secara berkelanjutan.",
      },
      filosofiNama: {
        title: 'Filosofi Nama "THE HIVE"',
        paragraphs: [
          "THE HIVE bukan sekadar nama, tetapi sebuah filosofi. Terinspirasi dari cara lebah bekerja dalam satu ekosistem yang penuh disiplin, kolaborasi, dan kecerdasan, setiap bagian memiliki peran untuk menghasilkan sesuatu yang bernilai. Begitu pula THE HIVE yang menggabungkan berbagai sumber data, analisis, dan teknologi AI menjadi satu sistem yang mampu memberikan pemahaman bisnis secara menyeluruh.",
          "Seperti lebah yang mengubah nektar menjadi madu, THE HIVE mengubah ribuan data menjadi wawasan yang mudah dipahami dan siap digunakan. Hasilnya bukan sekadar angka atau grafik, melainkan rekomendasi yang membantu pelaku usaha mengambil keputusan lebih cepat, lebih tepat, dan lebih percaya diri untuk mengembangkan bisnisnya.",
        ],
      },
      mengapaHarus: {
        title: "Mengapa Harus THE HIVE?",
        items: [
          { title: "Business Intelligence yang Berorientasi Keputusan" },
          { title: "Artificial Intelligence yang Memahami Konteks Bisnis" },
          { title: "Dibangun Khusus untuk Pelaku Usaha Indonesia" },
          { title: "Laporan Profesional yang Siap Digunakan" },
          { title: "Rekomendasi yang Dapat Langsung Diterapkan" },
          { title: "Dibangun untuk Menjadi Mitra Bisnis, Bukan Sekadar AI" },
        ],
      },
      nilaiKami: {
        title: "Nilai yang Kami Pegang",
        items: [
          { title: "Data adalah Dasar Setiap Keputusan" },
          { title: "Insight Harus Bisa Diterapkan" },
          { title: "Dibangun untuk Bisnis Indonesia" },
          { title: "Menjadi Partner, Bukan Sekadar AI" },
          { title: "Terus Belajar dan Berkembang" },
          { title: "Integritas di Atas Segalanya" },
        ],
      },
    },
    founder: {
      eyebrow: "Tentang Pendiri",
      heading: "Dibangun oleh Seseorang yang Percaya Bahwa Setiap Bisnis Berhak Bertumbuh",
      paragraphs: [
        "THE-HIVE didirikan oleh A. Aldo Sucahyono, seorang profesional yang menghabiskan bertahun-tahun mendampingi dunia bisnis, mulai dari sektor perbankan hingga pengembangan strategi usaha umkm ataupun korporasi.",
        "Dari pengalaman tersebut, ia menyadari bahwa banyak keputusan bisnis gagal bukan karena kurangnya semangat, melainkan karena minimnya akses terhadap analisis yang tepat.",
        "Berangkat dari keyakinan bahwa teknologi seharusnya membantu, bukan menggantikan manusia, ia membangun THE HIVE sebagai platform yang menggabungkan Artificial Intelligence dan Business Intelligence agar setiap pelaku usaha—baik UMKM, startup, maupun perusahaan—dapat memperoleh analisis bisnis profesional yang sebelumnya hanya dapat diakses oleh organisasi besar.",
      ],
      quote:
        "\"Saya percaya, keputusan yang lebih baik akan melahirkan bisnis yang lebih kuat. Dan bisnis yang lebih kuat akan membawa dampak yang lebih besar bagi Indonesia.\"",
      badge: "— Founder of THE HIVE",
      linkedinLabel: "Lihat LinkedIn →",
      name: "A. Aldo Sucahyono",
      role: "Founder of THE HIVE",
    },
    coreValuesLabel: "Nilai yang Kami Pegang",
    coreValues: [
      { icon: "📊", title: "Data Before Opinion", desc: "Keputusan yang baik selalu dimulai dari data." },
      { icon: "🧩", title: "Simple but Powerful", desc: "Analisis yang baik tidak harus rumit untuk dipahami." },
      { icon: "🚀", title: "Actionable Insight", desc: "Setiap rekomendasi harus dapat diterapkan." },
      { icon: "📈", title: "Continuous Improvement", desc: "AI akan terus belajar, berkembang, dan menjadi lebih cerdas." },
    ],
    quote: {
      line1: "Mengubah Data Menjadi Keputusan.",
      line2: "Mengubah Keputusan Menjadi Pertumbuhan.",
      footer: "— THE HIVE",
    },
  },

  legal: {
    privacy: {
      title: "Kebijakan Privasi",
      lastUpdated: "Terakhir diperbarui: Juli 2026",
      intro:
        "THE HIVE - kami menghargai privasi Anda. Kebijakan ini menjelaskan data apa saja yang kami kumpulkan, bagaimana data itu diproses, dan hak Anda atas data tersebut, sesuai dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) Indonesia.",
      s1: {
        heading: "1. Data yang Kami Kumpulkan",
        items: [
          "Data identitas: nama, profesi",
          "Data bisnis: nama bisnis, jenis bisnis, lokasi, sejak kapan berjalan atau rencana bisnis baru, target pelanggan, estimasi omset/modal",
          "Data naratif: tantangan bisnis dan target/harapan yang Anda tuliskan sendiri",
          "Data transaksi: status dan bukti pembayaran (nomor referensi transaksi), diproses oleh mitra payment gateway kami — kami tidak menyimpan detail kartu/rekening Anda",
          "Data teknis: alamat IP dan jenis perangkat, digunakan semata untuk keamanan sistem dan mencegah penyalahgunaan",
        ],
      },
      s2: {
        heading: "2. Dasar & Tujuan Pemrosesan Data",
        intro: "Kami memproses data Anda berdasarkan persetujuan yang Anda berikan saat mengisi formulir, untuk tujuan:",
        items: [
          "Menghasilkan analisis bisnis yang Anda minta (gratis maupun berbayar)",
          "Memproses dan mengonfirmasi pembayaran laporan lengkap",
          "Menghubungi Anda terkait status laporan atau dukungan pelanggan",
          "Meningkatkan akurasi dan kualitas metodologi analisis kami secara agregat (tanpa mengidentifikasi Anda secara personal)",
        ],
        noteBold: "tidak pernah menjual",
        noteBefore: "Kami",
        noteAfter: "data Anda kepada pihak ketiga untuk kepentingan periklanan, dan tidak menggunakan data bisnis Anda untuk kepentingan pesaing Anda.",
      },
      s3: {
        heading: "3. Pihak Ketiga yang Terlibat",
        intro: "Untuk menjalankan layanan, data Anda dapat diproses oleh pemroses data berikut, sebatas yang diperlukan untuk fungsinya masing-masing:",
        items: [
          { label: "Penyedia layanan AI", text: "(Anthropic) — memproses data bisnis Anda untuk menghasilkan analisis" },
          { label: "Payment gateway", text: "— memproses transaksi pembayaran Anda secara aman" },
          { label: "Penyedia hosting & database", text: "— menyimpan data Anda secara terenkripsi" },
          { label: "Google Places API", text: "(jika relevan dengan jenis bisnis Anda) — digunakan untuk mencari data kompetitor publik berdasarkan lokasi yang Anda berikan, bukan data pribadi Anda" },
        ],
      },
      s4: {
        heading: "4. Keamanan Data",
        text: "Kami menerapkan enkripsi saat transmisi data (HTTPS), pembatasan akses internal, dan pemantauan sistem untuk mencegah akses tidak sah. Namun perlu dipahami tidak ada sistem yang 100% bebas risiko — kami akan segera menginformasikan Anda apabila terjadi insiden keamanan yang berdampak pada data Anda, sesuai kewajiban UU PDP.",
      },
      s5: {
        heading: "5. Berapa Lama Data Disimpan",
        text: "Data bisnis dan hasil analisis Anda disimpan selama akun/riwayat Anda aktif, agar Anda bisa mengunduh ulang laporan kapan saja. Data akan dihapus dari sistem kami paling lambat 30 hari setelah Anda mengajukan permintaan penghapusan.",
      },
      s6: {
        heading: "6. Hak Anda Sebagai Subjek Data",
        items: [
          "Meminta salinan data yang kami simpan tentang Anda",
          "Meminta koreksi data yang tidak akurat atau tidak lengkap",
          "Meminta penghapusan data Anda (\"hak untuk dilupakan\")",
          "Menarik persetujuan penggunaan data kapan saja, tanpa mempengaruhi keabsahan pemrosesan sebelumnya",
          "Mengajukan keberatan atas keputusan yang dibuat semata berdasarkan pemrosesan otomatis",
        ],
      },
      s7: {
        heading: "7. Anak di Bawah Umur",
        text: "Layanan kami ditujukan untuk pelaku usaha berusia 18 tahun ke atas. Kami tidak dengan sengaja mengumpulkan data dari anak di bawah umur.",
      },
      s8: {
        heading: "8. Perubahan Kebijakan",
        text: "Kami dapat memperbarui kebijakan ini sewaktu-waktu mengikuti perkembangan layanan atau regulasi. Perubahan material akan diinformasikan melalui halaman ini dengan tanggal pembaruan terbaru.",
      },
      s9: {
        heading: "9. Kontak",
        text: "Pertanyaan, permintaan data, atau keluhan seputar privasi dapat disampaikan melalui email resmi THE HIVE.",
      },
    },
    terms: {
      title: "Syarat & Ketentuan",
      lastUpdated: "Terakhir diperbarui: Juli 2026",
      intro: "Dengan mengakses atau menggunakan THE HIVE, Anda dianggap telah membaca, memahami, dan menyetujui syarat & ketentuan berikut secara penuh.",
      s1: {
        heading: "1. Tentang Layanan",
        before: "THE HIVE adalah platform analisis bisnis berbasis kecerdasan buatan (AI) yang menghasilkan laporan analisis berdasarkan data yang Anda masukkan sendiri. Laporan ini bersifat",
        bold: "rekomendasi awal untuk membantu pengambilan keputusan",
        after: ", dan bukan merupakan nasihat hukum, keuangan, akuntansi, atau bisnis yang mengikat secara profesional.",
      },
      s2: {
        heading: "2. Kelayakan Pengguna",
        text: "Layanan ini ditujukan untuk individu berusia 18 tahun ke atas yang memiliki kapasitas hukum untuk mengikatkan diri pada perjanjian ini, baik sebagai perorangan maupun mewakili badan usaha.",
      },
      s3: {
        heading: "3. Akurasi Data & Tanggung Jawab Pengguna",
        text: "Kualitas dan akurasi hasil analisis sangat bergantung pada kelengkapan dan kejujuran data yang Anda masukkan. Anda bertanggung jawab penuh atas kebenaran data yang diberikan. THE HIVE tidak bertanggung jawab atas kerugian yang timbul dari keputusan bisnis yang diambil berdasarkan data yang tidak akurat, tidak lengkap, atau menyesatkan.",
      },
      s4: {
        heading: "4. Pembayaran & Harga",
        text: "Laporan lengkap tersedia setelah pembayaran berhasil dikonfirmasi melalui mitra payment gateway resmi kami. Harga yang berlaku adalah harga yang tertera pada saat transaksi dilakukan, dan dapat berubah sewaktu-waktu untuk transaksi berikutnya (termasuk penyesuaian harga setelah masa beta berakhir sesuai informasi di halaman Paket Bisnis).",
      },
      s5: {
        heading: "5. Penggunaan yang Dilarang",
        items: [
          "Memasukkan data palsu, menyesatkan, atau data milik pihak lain tanpa izin",
          "Mencoba meretas, membebani sistem secara berlebihan (spam), atau menyalahgunakan celah teknis",
          "Menggunakan bot atau automasi untuk mengakses layanan tanpa izin tertulis",
          "Menggunakan layanan untuk tujuan ilegal atau melanggar hak pihak ketiga",
          "Menjual kembali atau mendistribusikan ulang laporan kami secara komersial tanpa izin",
        ],
      },
      s6: {
        heading: "6. Hak Kekayaan Intelektual",
        text: "Laporan analisis yang Anda terima menjadi hak Anda untuk digunakan dalam keperluan bisnis Anda sendiri. Sistem, kode, desain, metodologi analisis, dan merek THE HIVE tetap menjadi hak milik eksklusif kami dan dilindungi hukum kekayaan intelektual yang berlaku.",
      },
      s7: {
        heading: "7. Batasan Tanggung Jawab",
        text: "Sepanjang diizinkan oleh hukum yang berlaku, THE HIVE tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau kerugian konsekuensial lain yang timbul dari penggunaan layanan ini. Tanggung jawab kami, jika ada, dibatasi maksimal sebesar jumlah yang Anda bayarkan untuk layanan terkait.",
      },
      s8: {
        heading: "8. Hukum yang Berlaku",
        text: "Syarat & ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia. Setiap perselisihan akan diupayakan diselesaikan secara musyawarah terlebih dahulu sebelum menempuh jalur hukum.",
      },
      s9: {
        heading: "9. Perubahan Layanan & Ketentuan",
        text: "Kami dapat memperbarui fitur, harga, atau ketentuan ini sewaktu-waktu sesuai perkembangan produk. Perubahan material akan diinformasikan melalui halaman ini.",
      },
    },
    refund: {
      title: "Kebijakan Refund",
      lastUpdated: "Terakhir diperbarui: Juli 2026",
      intro: "Karena laporan analisis bisnis dihasilkan secara khusus (personalisasi) berdasarkan data yang Anda masukkan sendiri dan bersifat produk digital, kami menerapkan kebijakan refund yang jelas sebagai berikut.",
      tableHeaders: { situation: "Situasi", eligible: "Berhak Refund?" },
      rows: [
        { situation: "Pembayaran berhasil, tapi laporan gagal dibuat karena kesalahan sistem kami", eligible: "Ya, refund penuh", highlighted: true },
        { situation: "Laporan berhasil dibuat, tapi isinya kosong/error/tidak sesuai data yang dimasukkan", eligible: "Ya, refund penuh", highlighted: true },
        { situation: "Laporan berhasil dibuat dengan benar, tapi Anda berubah pikiran", eligible: "Tidak", highlighted: false },
        { situation: "Data yang Anda masukkan ternyata salah/tidak lengkap dari pihak Anda sendiri", eligible: "Tidak", highlighted: false },
        { situation: "Pembayaran ganda (double charge) karena kegagalan sistem", eligible: "Ya, kelebihan dikembalikan", highlighted: true },
      ],
      howToTitle: "Cara Mengajukan Refund",
      steps: [
        "Hubungi kami melalui email resmi dalam waktu maksimal 3 hari sejak transaksi",
        "Sertakan bukti pembayaran (nomor referensi/invoice) dan penjelasan kendala yang dialami",
        "Tim kami akan meninjau pengajuan Anda maksimal 3 hari kerja",
        "Jika disetujui, dana dikembalikan ke metode pembayaran asal dalam 7-14 hari kerja (mengikuti kebijakan payment gateway)",
      ],
    },
  },

  referral: {
    eyebrow: "Bagikan THE HIVE",
    title: "Kenalkan THE HIVE ke Teman Anda",
    subtitle: "Punya teman atau kenalan yang sedang mau buka usaha atau mengembangkan bisnisnya? Bagikan THE HIVE supaya mereka bisa coba analisis gratisnya.",
    shareText: "Sebelum buka atau kembangkan usaha, cek dulu peluangnya di THE HIVE — analisis bisnis berbasis AI, gratis untuk mulai.",
    copyLabel: "Salin",
    copiedLabel: "Tersalin!",
    whatsappLabel: "📲 Bagikan lewat WhatsApp",
  },
};

export type Translations = typeof id;

const en: Translations = {
  common: {
    next: "Next →",
    back: "← Back",
    edit: "Edit",
    langToggle: "ID",
  },

  chooseAnalysisType: {
    greeting: "Hi, I'm Beemo.",
    subtitle: "First, pick the type of analysis you need.",
    newTitle: "New Business Analysis",
    newDesc:
      "For those who don't have a business yet. Great for validating an idea, understanding market potential, target customers, and a launch strategy.",
    runningTitle: "Running Business Analysis",
    runningDesc:
      "For a business that's already operating. Great for understanding your position against competitors, growth opportunities, and performance recommendations.",
  },

  chatWizard: {
    greeting: "Hi, I'm Beemo.",
    subtitleNew: "Analyzing your new business plan.",
    subtitleRunning: "Analyzing your running business.",
  },

  stepOne: {
    stepLabel: "STEP 1 OF 5",
    namaLabel: "Your Name",
    namaPlaceholder: "e.g. Michael Aldo",
    namaHelper: "Letters only, minimum 3 characters, no numbers/symbols/repeated letters.",
    emailLabel: "Your Email",
    emailPlaceholder: "e.g. name@email.com",
    emailHelper: "Your payment receipt will be sent to this email.",
    profesiLabel: "Your Profession",
    profesiPlaceholder: "Founder, Owner, Manager...",
    profesiHelper: "Letters only, minimum 3 characters, no illegal/negative professions (e.g. thief, hacker).",
    namaBisnisLabel: "Your Business/Brand Name",
    namaBisnisPlaceholder: "e.g. King Rawon & King Juice Premium",
    jenisBisnisLabel: "Your Business Type",
    jenisBisnisPlaceholder: "Coffee Shop, Contractor, Retail...",
    jenisBisnisHelper: "Letters only, minimum 3 characters, no numbers/symbols/repeated letters.",
    formError: "Please check the fields marked ⚠ before continuing.",
  },

  stepTwo: {
    stepLabel: "STEP 2 OF 5",
    lokasiLabelNew: "Planned Business Location",
    lokasiLabelRunning: "Your Business Location",
    lokasiPlaceholder: "e.g. Sukun, Malang City",
    lokasiHelper: "Include the district/city (minimum 2 words), don't abbreviate or type carelessly.",
    targetPelangganLabel: "Your Target Customers",
    targetPelangganPlaceholder: "e.g. College students and young workers aged 18-30 near campus...",
    targetPelangganHelper: "Tell us who your main prospective customers are.",
    rencanaLaunchingLabel: "Planned Launch Date",
    rencanaLaunchingHelper:
      "An estimate is fine — this helps us map out what needs preparing before launch day.",
    sejakKapanLabel: "Operating Since",
    sejakKapanHelper: "Pick the date your business started operating (cannot be a future date).",
    modalAwalLabel: "Estimated Starting Capital",
    omsetLabel: "Average Monthly Revenue",
    omsetPlaceholderNew: "e.g. Rp10,000,000",
    omsetPlaceholderRunning: "e.g. Rp15,000,000",
    omsetHelper: "Just type the number, the currency format adjusts automatically.",
    formError: "Please check the fields marked ⚠ before continuing.",
  },

  stepThree: {
    stepLabel: "STEP 3 OF 5",
    tantanganLabelNew: "Biggest Challenge in Starting This Business",
    tantanganLabelRunning: "Your Business's Biggest Challenge",
    tantanganPlaceholderNew:
      "e.g. Limited capital to rent a strategic location and no trusted supplier network yet...",
    tantanganPlaceholderRunning:
      "e.g. Sales have declined due to inconsistent product quality since the second month of opening...",
    helper: "Describe it in as much detail as you can (at least 2 words), don't type carelessly.",
    targetLabel: "Your Business Target / Hopes",
    targetPlaceholderNew:
      "e.g. Want to open and immediately attract customers within the first 3 months, break even within a year...",
    targetPlaceholderRunning:
      "e.g. Want revenue to double within 6 months by reaching student customers...",
    formError: "Please check the fields marked ⚠ before continuing.",
  },

  stepFour: {
    stepLabel: "STEP 4 OF 5",
    title: "Your Story & Vision",
    intro:
      "Tell us about your current situation, the biggest dream you want to achieve, and how you see business. From your story, I'll help craft the strategy that fits your goals best.",
    placeholder: "Write in your own words, as relaxed as chatting with a consultant you trust...",
    helper: "The more honest and detailed your story, the more targeted the strategy we can build.",
    formError: "Your story is still a bit short — tell us more before continuing.",
  },

  stepReview: {
    stepLabel: "STEP 5 OF 5 — CONFIRM YOUR DATA",
    intro:
      "Review the data below before we process it. Make sure everything is correct, since the analysis will follow exactly what you enter.",
    identitasTitle: "Identity",
    namaLabel: "Name",
    profesiLabel: "Profession",
    namaBisnisLabel: "Business/Brand Name",
    jenisBisnisLabel: "Business Type",
    lokasiKondisiTitle: "Location & Business Condition",
    lokasiLabel: "Location",
    targetPelangganLabel: "Target Customers",
    rencanaLaunchingLabel: "Planned Launch",
    sejakKapanLabel: "Operating Since",
    modalAwalLabel: "Estimated Starting Capital",
    omsetLabel: "Current Monthly Revenue",
    tantanganTargetTitle: "Challenge & Target",
    tantanganLabel: "Biggest Challenge",
    targetLabel: "Target/Hopes",
    ceritaVisiTitle: "Your Story & Vision",
    botError: "Verification failed. Please fill in the form manually, then try again.",
    submitLabel: "🚀 Run the Analysis Now",
    submitLoading: "Processing Analysis...",
    submitHelper: "Make sure your data is correct before continuing",
  },

  loadingAI: {
    title: "Beemo is analyzing your business",
    steps: [
      "Analyzing business condition...",
      "Comparing with competitors...",
      "Finding market opportunities...",
      "Building strategy recommendations...",
    ],
  },

  previewReport: {
    eyebrow: "Free Analysis Result",
    errorFallback: "The AI analysis couldn't be generated.",
    errorNote: "We won't show made-up results — please try again.",
    retryButton: "🔄 Try Analysis Again",
    restartLink: "Start a new analysis",
    scoreLabelNew: "Business Readiness Score",
    scoreLabelRunning: "Business Health Score",
    checklistTitle: "AI Has Analyzed",
    checklist: ["Business Condition", "Opportunity", "Target", "SWOT", "Competitors", "Marketing Strategy", "30-Day Plan", "Growth Ideas"],
    summaryTitle: "Quick Summary",
    findingsTitle: "Key Findings",
    strengthsTitle: "What's Working",
    improvementsTitle: "What Needs Work",
    opportunityTitle: "Opportunity",
    swotTitle: "SWOT Analysis",
    swotDesc: "Available in full in the PRO/PLATINUM report.",
    competitorTitle: "Competitor Analysis",
    competitorDesc: "Competitor identification is available in the paid report.",
    planTitle: "30-Day Plan",
    planDesc: "A step-by-step roadmap is available in the paid report.",
    unlockEyebrow: "🔒 Unlock Full Report",
    unlockTitle: "Choose the Plan That Fits Your Needs",
    unlockSubtitle: "Two plan options for a deeper business analysis you can put into action.",
    proAudience: "For SMEs & Micro Businesses",
    proChecklist: [
      "Full Business Intelligence Report (PDF)",
      "SWOT, Market Analysis & Competitor Analysis",
      "Daily Target, Revenue Target & Break-Even Point",
      "SOP & operational To-Do List",
      "7 days of Beemo AI chat consultation",
    ],
    proButton: "🔓 Unlock PRO",
    platinumAudience: "For Companies & Strategic Decisions",
    platinumChecklist: [
      "Everything in PRO",
      "Fuller Business Workspace & Dashboard",
      "Growth Plan & Marketing Assets",
      "Website & Branding templates",
      "30 days of Beemo AI chat consultation",
    ],
    platinumButton: "🔓 Unlock PLATINUM",
    footerNote: "🔒 Your analysis result will be available directly as a ready-to-download PDF.",
    unlockCta: "Open Full Report",
    swotMock: [
      "Key strengths in your product and operations",
      "Weaknesses that need attention soon",
      "Market opportunities not yet fully tapped",
      "Competitive threats worth watching",
    ],
    competitorMock: [
      "Several competitors identified near your location",
      "A comparison of positioning and strengths",
      "A market gap you could potentially capture",
    ],
    planMock: [
      "Week 1: focus on initial preparation",
      "Week 2: execute priority strategy",
      "Weeks 3-4: evaluate and adjust",
    ],
  },

  paymentPage: {
    backButton: "← Back to Home",
    unlockTitle: "Unlock Report",
    description: "Once payment succeeds, your full report will be immediately available as a PDF.",
    bisnisLabel: "Business",
    namaLabel: "Name",
    emailLabel: "Report delivery email",
    totalLabel: "Total",
    missingDataWarning:
      "Business data not found. It's best to start with the free analysis first so the report we generate matches your business.",
    payButton: "Pay",
    payButtonLoading: "Processing...",
    paymentErrorGeneric: "Payment failed. Please try again.",
    paymentErrorNetwork: "Something went wrong. Please try again.",
    footerNote: "Once payment succeeds, your full report will be immediately available as a PDF.",
  },

  navbar: {
    tagline: "Your AI Business Consultant",
    beranda: "Home",
    fiturAI: "AI Features",
    paketBisnis: "Plans",
    tentangKami: "About Us",
  },

  hero: {
    badge: "🔥 Limited Beta Pricing",
    title: "Start Your Journey to Your First Rp100 Million Revenue.",
    subtitle:
      "Get AI-powered analysis, market opportunities, a competitor map, and a ready-to-execute business strategy in minutes.",
    ctaButton: "🚀 Start Your Free Business Analysis!!",
    beemoGreeting: "Hi, I'm Beemo.",
    beemoDesc:
      "Tell me about your business. I'll help analyze your business condition, find market opportunities, study competitors, and put together recommendations you can use right away.",
    badge1: "Professional Report",
    badge2: "Your Data Stays Safe",
    badge3: "Results in Minutes",
    badge4: "For SMEs, Startups & Enterprises",
  },

  features: {
    eyebrow: "AI Features",
    title: "Every Business Analysis You Need in One Platform",
    subtitle:
      "From understanding your business condition to building a strategy, it's all in one professional report.",
    items: [
      {
        icon: "📊",
        title: "Understand Your Business Condition",
        desc: "Know the strengths, weaknesses, opportunities, and challenges of your business in one report.",
      },
      {
        icon: "🎯",
        title: "Study Your Competitors",
        desc: "Understand your competitors' advantages and find ways to outperform them.",
      },
      {
        icon: "🧭",
        title: "Find Market Opportunities",
        desc: "Identify untapped opportunities you can use to grow your business.",
      },
      {
        icon: "🗺️",
        title: "Define Your Strategy",
        desc: "Get recommended steps you can put into action right away, tailored to your business.",
      },
    ],
  },

  pricing: {
    badge: "🔥 Limited Beta Pricing",
    title: "Choose the Right Report for Your Business",
    subtitle:
      "Two report options built for your business needs, from practical analysis to executive-level strategy.",
    proTitle: "A Practical Report for Real Action",
    proDesc: "Great for SMEs, shops, F&B, services, online shops, freelancers, and micro businesses.",
    proChecklist: [
      "Full Business Intelligence Report (PDF & interactive view)",
      "SWOT, Market Analysis & Competitor Analysis",
      "Daily Target, Revenue Target & Break-Even Point",
      "SOP & operational To-Do List",
      "Marketing strategy you can apply right away",
      "7 days of Beemo AI chat consultation",
    ],
    platinumTitle: "Deep Analysis for Strategic Decisions",
    platinumDesc: "Great for companies, startups, investors, business owners, and decision makers.",
    platinumIncludesNote: "Everything in PRO, plus:",
    platinumChecklist: [
      "Everything in PRO",
      "Fuller Business Workspace & Dashboard",
      "Growth Plan & Marketing Assets",
      "Website & Branding templates",
      "Competitor Workspace & business Roadmap",
      "30 days of Beemo AI chat consultation",
    ],
    badges: [
      { icon: "📊", title: "Data-Driven Analysis", desc: "Decisions based on data, not assumptions." },
      { icon: "🧠", title: "AI + Business Intelligence", desc: "AI and BI technology for accurate insight." },
      { icon: "⚡", title: "Fast & Practical", desc: "Ready in minutes, usable right away." },
      { icon: "🎯", title: "Actionable Strategy", desc: "Focused on realistic, relevant recommendations." },
      { icon: "🛡️", title: "Trusted & Professional", desc: "Valid data sources, in-depth analysis, guaranteed quality." },
      { icon: "👥", title: "For Every Business Owner", desc: "From SMEs to large companies, everywhere." },
    ],
    ctaButton: "🚀 Start Your Business Analysis Now",
    ctaSubtext: "Choose the plan that fits your needs. A small investment for a big decision.",
  },

  footer: {
    copyright: "© 2026 THE HIVE - Powered by Beemo AI",
    privacyPolicy: "Privacy Policy",
    terms: "Terms & Conditions",
    refundPolicy: "Refund Policy",
    shareToFriend: "Share with a Friend",
  },

  chatFlow: {
    greeting:
      "👋 Hi! I'm Beemo AI from THE HIVE. Ready to help you understand your business, analyze competitors, and find the best opportunities.\n\nBefore we start, let's get acquainted — what's your name?",
    askEmail: "Nice to meet you, {nama}! 😊 Could I get your email? I'll use it to send you suggestions and insights for your business.",
    askProfesi: "Good. Now, what's your role in this business? (e.g. Founder, Owner, Manager)",
    askNamaBisnis: "Thank you, {profesi} — what's the name of your business or brand?",
    askJenisBisnis: "{namaBisnis}, a fitting name. What industry is this business in? (e.g. Coffee Shop, Retail, Consulting)",
    askLokasiNew: "Good. Now about location — where's your business planned to be located?",
    askLokasiRunning: "Good. Now about location — where is your business located right now?",
    askTargetPelanggan: "Who's your main target customer?",
    askRencanaLaunching: "When are you planning to launch? An estimate is fine.",
    askSejakKapan: "Since when has this business been running?",
    askModalAwal: "What's your estimated starting capital?",
    askOmset: "What's your average monthly revenue right now?",
    askTantanganNew: "Now for the important part — what's the biggest challenge you're facing in starting {namaBisnis}?",
    askTantanganRunning: "Now for the important part — what's the biggest challenge {namaBisnis} is facing right now?",
    askTarget: "Understood. What's your biggest target or hope for this business in the next 6-12 months?",
    askCeritaVisi:
      "Last one, {nama} — mind sharing something more personal? Tell me about your current situation, the biggest dream you want to achieve, and how you see business. From your story, I'll help craft the strategy that fits you best.",
    summaryIntro: "Thank you very much, {nama}. 🙏 Your story really helps. Here's what I've gathered — please review it before I start the analysis:",
    phaseKenal: "Getting to Know Your Business",
    phaseKondisi: "Understanding the Situation",
    phaseTarget: "Defining the Target",
    phaseStrategi: "Building the Strategy",
    phaseSelesai: "Finishing the Analysis",
    progressLabel: "Question {current} of {total}",
    editLabel: "Edit",
    sendPlaceholder: "Type your answer here...",
    sendHint: "Press Enter to send",
    invalidNudge: "That answer seems a bit brief — could you share a little more detail?",
    invalidEmailNudge: "That email format doesn't look quite right, could you check it again?",
    invalidDateFutureNudge: "That date has already passed — could you choose a date in the future?",
    invalidDatePastNudge: "That date is in the future — could you choose a date that has already happened?",
    invalidGenericNudge: "Something still needs adjusting there, could you check again?",
    botError: "Something unusual happened while filling this form. Please fill it in manually.",
    submitLabel: "🚀 Run the Analysis Now",
    submitLoading: "Processing Analysis...",
    submitHelper: "Make sure your data is correct before continuing",
    identitasTitle: "Identity",
    namaLabel: "Name",
    profesiLabel: "Profession",
    namaBisnisLabel: "Business/Brand Name",
    jenisBisnisLabel: "Business Type",
    lokasiKondisiTitle: "Location & Business Condition",
    lokasiLabel: "Location",
    targetPelangganLabel: "Target Customers",
    rencanaLaunchingLabel: "Planned Launch",
    sejakKapanLabel: "Operating Since",
    modalAwalLabel: "Estimated Starting Capital",
    omsetLabel: "Current Monthly Revenue",
    tantanganTargetTitle: "Challenge & Target",
    tantanganLabel: "Biggest Challenge",
    targetLabel: "Target/Hopes",
    ceritaVisiTitle: "Story & Vision",
  },

  aboutPage: {
    badge: "About Us",
    heroTitlePrefix: "The First AI Business Consultant Built for",
    heroTitleHighlight: "Indonesian Businesses",
    heroDesc:
      "THE HIVE helps business owners understand their business condition, find market opportunities, study competitors, and build strategies powered by AI and Business Intelligence.",
    heroCta: "Learn Our Philosophy",
    accordion: {
      visi: {
        title: "Our Vision",
        content:
          "We believe every business owner deserves access to professional-grade business analysis. THE HIVE exists to close that gap by bringing Artificial Intelligence and Business Intelligence together to make every business decision smarter, faster, and more impactful. Our vision is to become Indonesia's most trusted AI Business Intelligence platform — turning data into decisions, decisions into growth, and growth into a better future for every business.",
      },
      misi: {
        title: "Our Mission",
        items: [
          {
            title: "Bringing Professional Business Analysis to Everyone",
            text: "We believe every business owner deserves access to quality business analysis. That's why we build technology that simplifies the analysis process without sacrificing the depth of insight it delivers.",
          },
          {
            title: "Turning Data into Valuable Decisions",
            text: "We process business information into clear, measurable, ready-to-use recommendations, so every decision is grounded in data rather than assumption.",
          },
          {
            title: "Helping Businesses Grow Sustainably",
            text: "THE HIVE doesn't just solve today's problems — it helps business owners spot new opportunities, understand risk, and build long-term growth strategies.",
          },
          {
            title: "Combining Artificial Intelligence and Business Intelligence",
            text: "We integrate artificial intelligence with a Business Intelligence approach so every report is not only generated quickly, but also relevant, easy to understand, and practically valuable.",
          },
          {
            title: "Always Learning, Always Improving",
            text: "We're committed to continuously improving our AI quality, expanding our data sources, and refining our analysis methods so THE HIVE keeps delivering more accurate insight as the business world evolves.",
          },
          {
            title: "Building Indonesia's Business Decision Ecosystem",
            text: "We want to be a thinking partner for millions of Indonesian business owners — helping them understand their business more deeply, make better decisions, and create real impact for national economic growth.",
          },
        ],
      },
      kenapaDibuat: {
        title: "Why Was THE HIVE Built?",
        content:
          "THE HIVE was born from the belief that the best business decisions always start with data, not guesswork. We believe every business owner, from SMEs to large enterprises, deserves accurate business analysis without needing a team of consultants or complex technical skills. Through a blend of Artificial Intelligence (AI) and modern business analysis, THE HIVE helps you understand your business condition, recognize market opportunities, analyze competitors, and make decisions with greater confidence. Our goal is simple: make professional business analysis faster, easier, and more affordable so more businesses across Indonesia can grow sustainably.",
      },
      filosofiNama: {
        title: 'The Philosophy Behind "THE HIVE"',
        paragraphs: [
          "THE HIVE is more than just a name — it's a philosophy. Inspired by how bees work within one disciplined, collaborative, and intelligent ecosystem, where every part has a role in producing something valuable. THE HIVE works the same way, combining various data sources, analysis, and AI technology into one system capable of delivering a complete understanding of a business.",
          "Just as bees turn nectar into honey, THE HIVE turns thousands of data points into insight that's easy to understand and ready to use. The result isn't just numbers or charts — it's recommendations that help business owners make decisions faster, more accurately, and with more confidence to grow their business.",
        ],
      },
      mengapaHarus: {
        title: "Why Choose THE HIVE?",
        items: [
          { title: "Decision-Oriented Business Intelligence" },
          { title: "Artificial Intelligence That Understands Business Context" },
          { title: "Built Specifically for Indonesian Business Owners" },
          { title: "Professional, Ready-to-Use Reports" },
          { title: "Recommendations You Can Apply Right Away" },
          { title: "Built to Be a Business Partner, Not Just an AI" },
        ],
      },
      nilaiKami: {
        title: "The Values We Hold",
        items: [
          { title: "Data Is the Foundation of Every Decision" },
          { title: "Insight Must Be Actionable" },
          { title: "Built for Indonesian Business" },
          { title: "Being a Partner, Not Just an AI" },
          { title: "Always Learning and Improving" },
          { title: "Integrity Above All" },
        ],
      },
    },
    founder: {
      eyebrow: "About the Founder",
      heading: "Built by Someone Who Believes Every Business Deserves to Grow",
      paragraphs: [
        "THE HIVE was founded by A. Aldo Sucahyono, a professional who spent years working alongside the business world, from banking to developing business strategy for SMEs and corporations alike.",
        "From that experience, he realized many business decisions fail not from a lack of drive, but from a lack of access to the right analysis.",
        "Believing that technology should help, not replace, people, he built THE HIVE as a platform that combines Artificial Intelligence and Business Intelligence so every business owner — whether SME, startup, or enterprise — can access professional business analysis that was once only available to large organizations.",
      ],
      quote:
        "\"I believe better decisions build stronger businesses. And stronger businesses create a greater impact for Indonesia.\"",
      badge: "— Founder of THE HIVE",
      linkedinLabel: "View LinkedIn →",
      name: "A. Aldo Sucahyono",
      role: "Founder of THE HIVE",
    },
    coreValuesLabel: "The Values We Hold",
    coreValues: [
      { icon: "📊", title: "Data Before Opinion", desc: "A good decision always starts with data." },
      { icon: "🧩", title: "Simple but Powerful", desc: "Good analysis doesn't have to be complicated to understand." },
      { icon: "🚀", title: "Actionable Insight", desc: "Every recommendation should be something you can apply." },
      { icon: "📈", title: "Continuous Improvement", desc: "Our AI keeps learning, evolving, and getting smarter." },
    ],
    quote: {
      line1: "Turning Data Into Decisions.",
      line2: "Turning Decisions Into Growth.",
      footer: "— THE HIVE",
    },
  },

  legal: {
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: July 2026",
      intro:
        "THE HIVE - we respect your privacy. This policy explains what data we collect, how it's processed, and your rights over that data, in accordance with Indonesia's Law No. 27 of 2022 on Personal Data Protection (UU PDP).",
      s1: {
        heading: "1. Data We Collect",
        items: [
          "Identity data: name, profession",
          "Business data: business name, business type, location, how long it's been running or new business plans, target customers, estimated revenue/capital",
          "Narrative data: business challenges and goals/hopes you write yourself",
          "Transaction data: payment status and proof (transaction reference number), processed by our payment gateway partner — we don't store your card/account details",
          "Technical data: IP address and device type, used solely for system security and abuse prevention",
        ],
      },
      s2: {
        heading: "2. Basis & Purpose of Data Processing",
        intro: "We process your data based on the consent you give when filling out the form, for the purposes of:",
        items: [
          "Generating the business analysis you requested (free or paid)",
          "Processing and confirming payment for the full report",
          "Contacting you about report status or customer support",
          "Improving the accuracy and quality of our analysis methodology in aggregate (without identifying you personally)",
        ],
        noteBold: "never sell",
        noteBefore: "We",
        noteAfter: "your data to third parties for advertising purposes, and do not use your business data for the benefit of your competitors.",
      },
      s3: {
        heading: "3. Third Parties Involved",
        intro: "To run our service, your data may be processed by the following data processors, only to the extent required for their respective functions:",
        items: [
          { label: "AI service provider", text: "(Anthropic) — processes your business data to generate the analysis" },
          { label: "Payment gateway", text: "— processes your payment transactions securely" },
          { label: "Hosting & database provider", text: "— stores your data in encrypted form" },
          { label: "Google Places API", text: "(where relevant to your business type) — used to look up public competitor data based on the location you provide, not your personal data" },
        ],
      },
      s4: {
        heading: "4. Data Security",
        text: "We apply encryption during data transmission (HTTPS), internal access restrictions, and system monitoring to prevent unauthorized access. However, no system is 100% risk-free — we will promptly inform you if a security incident affecting your data occurs, in line with our obligations under the UU PDP.",
      },
      s5: {
        heading: "5. How Long Data Is Kept",
        text: "Your business data and analysis results are stored for as long as your account/history remains active, so you can re-download your report anytime. Data will be deleted from our systems no later than 30 days after you submit a deletion request.",
      },
      s6: {
        heading: "6. Your Rights as a Data Subject",
        items: [
          "Request a copy of the data we hold about you",
          "Request correction of inaccurate or incomplete data",
          "Request deletion of your data (\"right to be forgotten\")",
          "Withdraw consent for data use at any time, without affecting the validity of processing carried out beforehand",
          "Object to decisions made solely based on automated processing",
        ],
      },
      s7: {
        heading: "7. Minors",
        text: "Our service is intended for business owners aged 18 and above. We do not knowingly collect data from minors.",
      },
      s8: {
        heading: "8. Policy Changes",
        text: "We may update this policy from time to time as our service or regulations evolve. Material changes will be communicated on this page with an updated revision date.",
      },
      s9: {
        heading: "9. Contact",
        text: "Questions, data requests, or privacy-related complaints can be submitted through THE HIVE's official email.",
      },
    },
    terms: {
      title: "Terms & Conditions",
      lastUpdated: "Last updated: July 2026",
      intro: "By accessing or using THE HIVE, you are deemed to have read, understood, and fully agreed to the following terms and conditions.",
      s1: {
        heading: "1. About the Service",
        before: "THE HIVE is an AI-based business analysis platform that generates analysis reports based on data you provide yourself. This report is an",
        bold: "initial recommendation to support decision-making",
        after: ", and is not professional legal, financial, accounting, or business advice that is binding in nature.",
      },
      s2: {
        heading: "2. User Eligibility",
        text: "This service is intended for individuals aged 18 and above who have the legal capacity to enter into this agreement, either as an individual or on behalf of a business entity.",
      },
      s3: {
        heading: "3. Data Accuracy & User Responsibility",
        text: "The quality and accuracy of the analysis results heavily depend on the completeness and honesty of the data you provide. You are fully responsible for the accuracy of the data given. THE HIVE is not liable for any losses arising from business decisions made based on inaccurate, incomplete, or misleading data.",
      },
      s4: {
        heading: "4. Payment & Pricing",
        text: "The full report becomes available once payment has been successfully confirmed through our official payment gateway partner. The price that applies is the price shown at the time the transaction is made, and may change at any time for subsequent transactions (including price adjustments after the beta period ends, as noted on the Plans page).",
      },
      s5: {
        heading: "5. Prohibited Use",
        items: [
          "Entering false, misleading data, or data belonging to another party without permission",
          "Attempting to hack, overload the system excessively (spam), or exploit technical vulnerabilities",
          "Using bots or automation to access the service without written permission",
          "Using the service for illegal purposes or in violation of third-party rights",
          "Reselling or redistributing our reports commercially without permission",
        ],
      },
      s6: {
        heading: "6. Intellectual Property Rights",
        text: "The analysis report you receive is yours to use for your own business purposes. THE HIVE's systems, code, design, analysis methodology, and brand remain our exclusive property and are protected under applicable intellectual property law.",
      },
      s7: {
        heading: "7. Limitation of Liability",
        text: "To the extent permitted by applicable law, THE HIVE is not liable for indirect losses, lost profits, or other consequential losses arising from the use of this service. Our liability, if any, is limited to the maximum amount you paid for the related service.",
      },
      s8: {
        heading: "8. Governing Law",
        text: "These terms and conditions are governed by and interpreted in accordance with the laws of the Republic of Indonesia. Any dispute will first be pursued through amicable discussion before resorting to legal action.",
      },
      s9: {
        heading: "9. Changes to Service & Terms",
        text: "We may update features, pricing, or these terms from time to time as the product evolves. Material changes will be communicated on this page.",
      },
    },
    refund: {
      title: "Refund Policy",
      lastUpdated: "Last updated: July 2026",
      intro: "Because business analysis reports are generated specifically (personalized) based on the data you provide and are digital products by nature, we apply the following clear refund policy.",
      tableHeaders: { situation: "Situation", eligible: "Eligible for Refund?" },
      rows: [
        { situation: "Payment succeeded, but the report failed to generate due to an error on our end", eligible: "Yes, full refund", highlighted: true },
        { situation: "Report was generated, but the content is empty/erroneous/doesn't match the data provided", eligible: "Yes, full refund", highlighted: true },
        { situation: "Report was generated correctly, but you changed your mind", eligible: "No", highlighted: false },
        { situation: "The data you entered turned out to be incorrect/incomplete on your part", eligible: "No", highlighted: false },
        { situation: "Double charge due to a system failure", eligible: "Yes, excess amount refunded", highlighted: true },
      ],
      howToTitle: "How to Request a Refund",
      steps: [
        "Contact us via our official email within a maximum of 3 days from the transaction",
        "Include proof of payment (reference/invoice number) and a description of the issue you encountered",
        "Our team will review your request within a maximum of 3 business days",
        "If approved, funds will be returned to the original payment method within 7-14 business days (subject to the payment gateway's policy)",
      ],
    },
  },

  referral: {
    eyebrow: "Share THE HIVE",
    title: "Introduce THE HIVE to Your Friends",
    subtitle: "Know someone who's about to start or grow their business? Share THE HIVE so they can try the free analysis.",
    shareText: "Before starting or growing your business, check the opportunity first at THE HIVE — AI-based business analysis, free to start.",
    copyLabel: "Copy",
    copiedLabel: "Copied!",
    whatsappLabel: "📲 Share via WhatsApp",
  },
};

export const translations = { id, en };
export type Lang = keyof typeof translations;
