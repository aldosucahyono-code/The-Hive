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
};

export const translations = { id, en };
export type Lang = keyof typeof translations;
