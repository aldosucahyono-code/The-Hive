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
      "Analisis praktis & mudah dipahami",
      "SWOT, kompetitor, strategi marketing",
      "Peluang pasar & rekomendasi operasional",
      "Rencana aksi 30-60-90 hari",
      "Langsung bisa diterapkan",
    ],
    proButton: "🔓 Unlock PRO",
    platinumAudience: "Untuk Perusahaan & Keputusan Strategis",
    platinumChecklist: [
      "Semua fitur PRO",
      "Executive & Competitive Intelligence",
      "AI Consultant & Dashboard Profesional",
      "Scenario Planning & Decision Matrix",
      "Insight mendalam untuk pertumbuhan jangka panjang",
    ],
    platinumButton: "🔓 Unlock PLATINUM",
    footerNote: "🔒 Hasil analisis akan tersedia langsung dalam format PDF yang siap diunduh.",
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
    title: "Dapatkan Laporan Analisis Bisnis Profesional dalam Hitungan Menit",
    subtitle:
      "Masukkan informasi bisnis Anda. Beemo akan menganalisis kondisi bisnis, membandingkan kompetitor, menemukan peluang pasar, lalu menyusun laporan profesional yang siap digunakan dalam beberapa menit.",
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
      "Analisis kondisi bisnis & skor kesehatan bisnis",
      "SWOT lengkap, analisis kompetitor & peluang pasar",
      "Strategi marketing & rekomendasi operasional",
      "Prioritas aksi 30-60-90 hari & roadmap bisnis",
      "Ringkas, mudah dipahami, langsung bisa diterapkan",
    ],
    platinumTitle: "Analisis Mendalam untuk Keputusan Strategis",
    platinumDesc: "Cocok untuk perusahaan, startup, investor, pemilik bisnis besar, dan pengambil keputusan.",
    platinumIncludesNote: "Semua di PRO, ditambah:",
    platinumChecklist: [
      "Executive, Consumer, Competitive & Industry Intelligence",
      "Scenario Planning, Decision Matrix & Growth Strategy",
      "AI Executive Consultant & Business Dashboard Profesional",
      "Research Appendix & data pendukung terpercaya",
      "Insight lebih dalam untuk strategi jangka panjang",
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
    askEmail: "Senang kenalan denganmu, {nama}! 😊 Boleh minta emailmu? Bukti pembayaran nanti dikirim ke sini.",
    askProfesi: "Mantap! Sekarang cerita dong, kamu berperan sebagai apa di bisnis ini? (misalnya Founder, Owner, Manager)",
    askNamaBisnis: "Oke, {profesi} — apa nama bisnis atau brand kamu?",
    askJenisBisnis: "{namaBisnis}, nama yang bagus! 👍 Bisnis ini bergerak di bidang apa? (misalnya Coffee Shop, Retail, Jasa Konsultasi)",
    askLokasiNew: "Sip. Sekarang soal lokasi — di mana rencana lokasi bisnis kamu?",
    askLokasiRunning: "Sip. Sekarang soal lokasi — di mana lokasi bisnis kamu sekarang?",
    askTargetPelanggan: "Siapa target pelanggan utama yang kamu bidik?",
    askRencanaLaunching: "Kira-kira kapan rencana launching-nya? Perkiraan saja tidak apa-apa.",
    askSejakKapan: "Sejak kapan bisnis ini mulai berjalan?",
    askModalAwal: "Berapa estimasi modal awal yang kamu siapkan?",
    askOmset: "Berapa rata-rata omset bulanan bisnis kamu saat ini?",
    askTantanganNew: "Sekarang bagian penting nih — apa tantangan terbesar yang kamu hadapi dalam merintis {namaBisnis}?",
    askTantanganRunning: "Sekarang bagian penting nih — apa tantangan terbesar {namaBisnis} saat ini?",
    askTarget: "Oke, dicatat. Apa target atau harapan besar kamu untuk bisnis ini dalam 6-12 bulan ke depan?",
    askCeritaVisi:
      "Terakhir nih, {nama} — boleh cerita lebih personal? Ceritakan kondisi kamu saat ini, impian terbesar yang ingin dicapai, dan bagaimana kamu memandang bisnis ini. Dari cerita kamu, saya akan bantu susun strategi yang paling sesuai.",
    summaryIntro: "Terima kasih banyak, {nama}! 🙌 Ceritamu sangat membantu. Ini ringkasan yang saya tangkap — cek dulu sebelum saya mulai analisis:",
    progressLabel: "Pertanyaan {current} dari {total}",
    editLabel: "Edit",
    sendPlaceholder: "Ketik jawabanmu di sini...",
    sendHint: "Tekan Enter untuk mengirim",
    invalidNudge: "Hmm, sepertinya belum lengkap — coba ceritakan sedikit lebih detail ya.",
    invalidEmailNudge: "Sepertinya format emailnya belum pas, coba cek lagi ya.",
    invalidDateFutureNudge: "Tanggalnya sudah lewat nih, coba pilih tanggal ke depan ya.",
    invalidDatePastNudge: "Tanggalnya kok di masa depan? Pilih tanggal yang sudah terjadi ya.",
    invalidGenericNudge: "Sepertinya masih ada yang perlu diperbaiki, coba cek lagi ya.",
    botError: "Sepertinya ada yang tidak biasa saat mengisi form ini. Mohon isi ulang secara manual ya.",
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
      "Practical, easy-to-understand analysis",
      "SWOT, competitors, marketing strategy",
      "Market opportunities & operational recommendations",
      "30-60-90 day action plan",
      "Ready to implement immediately",
    ],
    proButton: "🔓 Unlock PRO",
    platinumAudience: "For Companies & Strategic Decisions",
    platinumChecklist: [
      "Everything in PRO",
      "Executive & Competitive Intelligence",
      "AI Consultant & Professional Dashboard",
      "Scenario Planning & Decision Matrix",
      "Deep insight for long-term growth",
    ],
    platinumButton: "🔓 Unlock PLATINUM",
    footerNote: "🔒 Your analysis result will be available directly as a ready-to-download PDF.",
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
    title: "Get a Professional Business Analysis Report in Minutes",
    subtitle:
      "Enter your business information. Beemo will analyze your business condition, compare competitors, find market opportunities, then put together a professional, ready-to-use report in minutes.",
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
      "Business condition analysis & business health score",
      "Full SWOT, competitor analysis & market opportunities",
      "Marketing strategy & operational recommendations",
      "30-60-90 day action priorities & business roadmap",
      "Concise, easy to understand, ready to implement",
    ],
    platinumTitle: "Deep Analysis for Strategic Decisions",
    platinumDesc: "Great for companies, startups, investors, business owners, and decision makers.",
    platinumIncludesNote: "Everything in PRO, plus:",
    platinumChecklist: [
      "Executive, Consumer, Competitive & Industry Intelligence",
      "Scenario Planning, Decision Matrix & Growth Strategy",
      "AI Executive Consultant & Professional Business Dashboard",
      "Research Appendix & trusted supporting data",
      "Deeper insight for long-term strategy",
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
    askEmail: "Nice to meet you, {nama}! 😊 Could I get your email? Your payment receipt will be sent there.",
    askProfesi: "Awesome! Tell me, what's your role in this business? (e.g. Founder, Owner, Manager)",
    askNamaBisnis: "Got it, {profesi} — what's the name of your business or brand?",
    askJenisBisnis: "{namaBisnis}, nice name! 👍 What industry is this business in? (e.g. Coffee Shop, Retail, Consulting)",
    askLokasiNew: "Got it. Now about location — where's your business planned to be located?",
    askLokasiRunning: "Got it. Now about location — where is your business located right now?",
    askTargetPelanggan: "Who's your main target customer?",
    askRencanaLaunching: "When are you planning to launch? An estimate is fine.",
    askSejakKapan: "Since when has this business been running?",
    askModalAwal: "What's your estimated starting capital?",
    askOmset: "What's your average monthly revenue right now?",
    askTantanganNew: "Now for the important part — what's the biggest challenge you're facing in starting {namaBisnis}?",
    askTantanganRunning: "Now for the important part — what's the biggest challenge {namaBisnis} is facing right now?",
    askTarget: "Got it, noted. What's your biggest target or hope for this business in the next 6-12 months?",
    askCeritaVisi:
      "Last one, {nama} — mind sharing something more personal? Tell me about your current situation, the biggest dream you want to achieve, and how you see business. From your story, I'll help craft the strategy that fits you best.",
    summaryIntro: "Thank you so much, {nama}! 🙌 Your story really helps. Here's what I've gathered — check it over before I start the analysis:",
    progressLabel: "Question {current} of {total}",
    editLabel: "Edit",
    sendPlaceholder: "Type your answer here...",
    sendHint: "Press Enter to send",
    invalidNudge: "Hmm, that seems a bit short — could you share a bit more detail?",
    invalidEmailNudge: "That email format doesn't look quite right, could you double check?",
    invalidDateFutureNudge: "That date's already passed — could you pick a date in the future?",
    invalidDatePastNudge: "That date's in the future — could you pick a date that's already happened?",
    invalidGenericNudge: "Something still needs fixing there, could you check again?",
    botError: "Something unusual happened while filling this form. Please fill it in manually and try again.",
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
};

export const translations = { id, en };
export type Lang = keyof typeof translations;
