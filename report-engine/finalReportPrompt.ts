// report-engine/finalReportPrompt.ts
//
// Task 13 ("riwayat diganti final reports"): prompt untuk DUA jenis PDF baru
// yang berbeda dari reportPrompt.ts (yang mengisi laporan dari data mentah
// wizard sebelum ada business_profile). File ini mengisi laporan dari
// Business Memory (services/memory/getBusinessMemory.ts) — sumber tunggal
// yang sama dipakai Chat Beemo/Decision Engine — supaya laporan "PDF awal"
// dan "PDF perbandingan periode" konsisten dengan apa yang pengguna lihat
// di Workspace, bukan menghitung ulang dari nol.
//
// Rombak produk Juli 2026 ("PDF eksklusif PLATINUM — isi rangkuman global
// SELURUH platform THE HIVE, >10 halaman, plus update yang sudah dilakukan
// pengguna di Workspace"): sebelumnya file ini hanya meminta 2-4 sections
// pendek TANPA executiveSummary/ceoRecommendation/appendix sama sekali —
// jauh lebih tipis dari yang seharusnya bisa didapat pelanggan PLATINUM
// (bandingkan dengan reportPrompt.ts tier platinum: 10-13 sections + ketiga
// blok itu). Sejak generateFinalReport.ts sekarang HANYA pernah dipanggil
// untuk tier platinum (PRO tidak lagi dapat PDF sama sekali), file ini tidak
// perlu lagi bercabang tier — SELALU disusun setara kedalaman laporan
// Platinum, mencakup semua pilar Workspace: Business Health, Market,
// Competition (data kompetitor asli), Social Media Intelligence (medsos
// kompetitor), Macro Economy Intelligence (kondisi ekonomi), Financial,
// Growth Strategy, Risk, Action Plan, Roadmap — plus, khusus laporan
// "expiry" (30 hari), satu section wajib berjudul "Aktivitas Workspace
// Periode Ini" yang merangkai Business Update/Decision Journal/Achievement
// yang benar-benar dilakukan pengguna sepanjang periode aksesnya.
//
// Skema JSON output SAMA PERSIS dengan report-engine/reportPrompt.ts dan
// monthlyReportPrompt.ts (sections: IntelligencePage[], executiveSummary,
// ceoRecommendation, appendix, dst) supaya bisa dirender ulang lewat
// renderReportPdf() yang sama — tidak ada template PDF kedua.

import type { BusinessMemoryContext } from "../services/memory/getBusinessMemory.js";
import type { MacroSnapshot } from "../services/macro/getMacroSnapshot.js";
import type { SocialMediaSnapshot } from "../services/socialMedia/types.js";

export type FinalReportType = "baseline" | "expiry";

// Sama persis dengan MONTHLY_SCHEMA_DESCRIPTION di monthlyReportPrompt.ts
// (satu skema ReportData dipakai di semua jalur PDF Platinum) — dituliskan
// ulang di sini alih-alih di-share supaya tiap prompt tetap bisa
// menyesuaikan catatan kontekstualnya sendiri tanpa saling mempengaruhi.
const SCHEMA_DESCRIPTION = `Skema JSON yang harus diisi (field wajib semua, kecuali ditandai opsional):
{
  "sections": [
    {
      "eyebrow": string,
      "title": string,
      "kpis": [{ "value": string, "label": string }, ...],  // 3-4 item
      "insight": string,
      "visual": null OR salah satu dari:
        { "type": "radar", "labels": string[], "values": number[] } |
        { "type": "bar", "labels": string[], "values": number[] } |
        { "type": "pie", "labels": string[], "values": number[] } |
        { "type": "matrix", "points": [{ "label": string, "x": number, "y": number }, ...], "xLabel": string, "yLabel": string, "variant": "risk" | "priority" } |
        { "type": "timeline", "milestones": [{ "period": string, "title": string }, ...] } |
        { "type": "swot", "data": { "kekuatan": string[], "kelemahan": string[], "peluang": string[], "ancaman": string[] } },
      "analysis": string[] (opsional, 1-3 paragraf pendek tambahan),
      "impact": string,
      "recommendation": string,
      "decision": "GO" | "WAIT" | "PIVOT" | "STOP",
      "confidencePct": number,
      "confidenceBasis": string,
      "extraHtml": string (opsional — tabel HTML kecil pakai class "hive-table" untuk data yang tidak muat di blok standar, mis. Financial Data Completeness)
    }
  ],
  "executiveSummary": {
    "businessScore": number, "overallDecision": "GO"|"WAIT"|"PIVOT"|"STOP", "confidencePct": number,
    "nextCheckpoint": string, "summary": string,
    "decisionMap": [{ "chapter": string, "decision": "GO"|"WAIT"|"PIVOT"|"STOP", "reason": string }, ...],
    "thisWeek": string
  },
  "ceoRecommendation": [{ "title": string, "text": string }, ...],  // 5 item, berurutan prioritas
  "appendix": {
    "references": [{ "topic": string, "source": string }, ...],
    "glossary": [{ "term": string, "meaning": string }, ...],
    "confidenceMatrix": [{ "section": string, "source": string, "confidencePct": number }, ...],
    "dataNeeded": string[],
    "aiNotes": string
  },
  "coverBusinessScore": number,
  "coverConfidencePct": number,
  "coverExecutiveRecommendation": string,
  "coverSnapshot": string
}`;

function languageRule(lang: "id" | "en"): string {
  return lang === "en"
    ? `Write the ENTIRE report (titles, insights, recommendations, executiveSummary, ceoRecommendation, appendix — everything) in ENGLISH. Professional McKinsey/BCG-style business-consultant voice — no AI-ish hedging phrases like "based on the data provided".`
    : `Tulis SELURUH laporan (judul, insight, rekomendasi, executiveSummary, ceoRecommendation, appendix — semuanya) dalam BAHASA INDONESIA. Gaya konsultan bisnis profesional setara McKinsey/BCG — jangan pakai frasa ala-AI seperti "berdasarkan data yang diberikan".`;
}

const DATA_HONESTY_RULE_ID = `ATURAN DATA HONESTY (WAJIB): HANYA gunakan data yang benar-benar ada di Ringkasan Bisnis di bawah. Kalau satu aspek belum punya data (mis. belum pernah kirim Business Update, belum pernah buka tab Medsos Kompetitor, data keuangan tidak tersedia), tulis jujur "belum ada data untuk ini" pada bagian itu — JANGAN mengarang angka, statistik, atau cerita. Ini berlaku juga untuk section yang WAJIB ada (mis. Social Media Intelligence) — kalau datanya kosong, section itu tetap dibuat tapi isinya mengakui keterbatasan data secara jujur, bukan dihilangkan begitu saja dari sections array.`;
const DATA_HONESTY_RULE_EN = `DATA HONESTY RULE (REQUIRED): ONLY use data that is actually present in the Business Summary below. If an aspect has no data yet (e.g. no Business Update submitted, Social Media Competitor tab never opened, financial data unavailable), honestly write "no data available yet" for that part — DO NOT invent numbers, statistics, or stories. This also applies to sections that are REQUIRED (e.g. Social Media Intelligence) — if the data is empty, still include the section but have it honestly acknowledge the data gap instead of silently dropping it from the sections array.`;

// Role-Aware Advice (arahan pemilik produk, Juli 2026 — sama seperti
// roleAwareAdviceLine() di services/beemo/chat.ts, dipakai bersama supaya
// Final Report tidak punya sudut pandang berbeda dari Chat Beemo untuk
// pelanggan yang sama). Kalau "Peran pengguna" di Ringkasan Bisnis BUKAN
// pemilik, field "recommendation" tiap section harus jelas membedakan mana
// yang bisa dieksekusi sendiri vs mana yang perlu diusulkan ke Owner.
const ROLE_AWARE_RULE_ID = `ATURAN SUDUT PANDANG PERAN (WAJIB kalau "Peran pengguna" ada di Ringkasan Bisnis): JANGAN berasumsi pembaca laporan ini otomatis pemilik usaha. Kalau perannya BUKAN pemilik/pengambil keputusan utama (mis. Manager, Supervisor, staf, admin — bukan Owner/Founder/CEO/Direktur Utama), tulis field "recommendation" tiap bagian dengan membedakan mana yang bisa langsung dia lakukan dalam wewenangnya sendiri, dan mana yang perlu dia usulkan/sampaikan ke Owner-nya (beserta data pendukung yang perlu dibawa).`;
const ROLE_AWARE_RULE_EN = `ROLE PERSPECTIVE RULE (REQUIRED if "User's role" is present in the Business Summary): Do NOT assume the reader of this report is automatically the business owner. If their role is NOT the owner/main decision-maker (e.g. Manager, Supervisor, staff, admin — not Owner/Founder/CEO/Managing Director), write each section's "recommendation" field distinguishing what they can act on within their own authority versus what they need to escalate/propose to their Owner (including what supporting data to bring).`;

const RESEARCH_RULE_ID = `PERAN GANDA & RISET SUNGGUHAN (WAJIB): susun laporan ini dengan mengambil peran SEMUA fungsi bisnis yang relevan — Akuntan, HRD, Legal, Marketing/Sales, Operasional — sesuai isi tiap bagian. Kalau satu bagian menyentuh hal yang butuh data terkini/spesifik (syarat izin usaha, aturan pajak UMKM terbaru, tren adopsi AI/medsos, ketentuan pemerintah daerah, dll), CARI DULU lewat web search sebelum menulis bagian itu — jangan menulis dari ingatan lama kalau bisa diverifikasi. Jangan pernah menutup rekomendasi hanya dengan "konsultasikan dengan ahli/profesional" — beri langkah konkret dulu (ke mana harus pergi, hubungi siapa/instansi apa, dokumen apa yang perlu disiapkan).`;
const RESEARCH_RULE_EN = `MULTI-ROLE & ACTUAL RESEARCH (REQUIRED): write this report taking on ALL relevant business functions — Accountant, HR, Legal, Marketing/Sales, Operations — as fits each section. Where a section touches something that needs current/specific data (permit requirements, latest tax rules, AI/social-media adoption trends, local government regulations, etc.), SEARCH FIRST via web search before writing that section — don't rely on old memory when it can be verified. Never close a recommendation with only "consult a professional" — give a concrete next step first (where to go, who/which agency to contact, what documents are needed).`;

const SECTION_COVERAGE_ID = `CAKUPAN BAGIAN (WAJIB, 11-14 sections, boleh disesuaikan urutan/judul sesuai relevansi data pengguna — TAPI SEMUA TOPIK di bawah ini harus tercakup salah satu section, karena laporan ini adalah RANGKUMAN GLOBAL seluruh platform THE HIVE, bukan cuma satu-dua aspek):
1. Business Health — skor multi-dimensi (visual "radar", pakai data dimensi kalau tersedia, kalau tidak pakai skor keseluruhan dari baseline/journey)
2. Market Intelligence — ukuran & karakter pasar yang relevan buat bisnis ini
3. Competition Intelligence — pakai data Ringkasan Kompetitor SUNGGUHAN yang diberikan (jumlah kompetitor ditemukan, posisi pasar) — JANGAN mengarang nama kompetitor baru
4. Social Media Intelligence — pakai data Medsos Kompetitor yang diberikan (follower, engagement, platform) kalau ada; kalau kosong, akui jujur dan sarankan buka tab Medsos Kompetitor di Workspace
5. Macro Economy Intelligence — pakai indikator ekonomi (kurs, inflasi, suku bunga BI) yang diberikan, kaitkan konkret ke bisnis ini (biaya bahan baku impor, suku bunga pinjaman, dst)
6. Financial Intelligence (WAJIB pakai extraHtml tabel "Data Completeness" kalau data keuangan tidak tersedia — JANGAN mengarang angka omzet/laba/ROI)
7. Growth Strategy (visual "swot")
8. Target & Progres — pakai target minggu ini/bulan ini dan journey skor yang diberikan
9. Risk Intelligence (visual "matrix" variant "risk")
10. Action Plan (visual "matrix" variant "priority")
11. Roadmap (visual "timeline")

Section tambahan boleh disisipkan (mis. "Regulasi & Perjanjian Kemitraan/Franchise" kalau relevan) TANPA mengurangi 11 topik wajib di atas.`;
const SECTION_COVERAGE_EN = `SECTION COVERAGE (REQUIRED, 11-14 sections, order/titles may be adjusted to fit the user's data — BUT ALL TOPICS below must be covered by some section, because this report is a GLOBAL SUMMARY of the entire THE HIVE platform, not just one or two aspects):
1. Business Health — multi-dimensional score (visual "radar", use dimension data if available, otherwise the overall score from baseline/journey)
2. Market Intelligence — market size & character relevant to this business
3. Competition Intelligence — use the REAL Competitor Summary data given (competitors found, market position) — DO NOT invent new competitor names
4. Social Media Intelligence — use the Social Media Competitor data given (followers, engagement, platforms) if present; if empty, honestly acknowledge it and suggest opening the Social Media Competitor tab in Workspace
5. Macro Economy Intelligence — use the given economic indicators (exchange rate, inflation, BI rate), tie them concretely to this business (imported raw material costs, loan interest rates, etc.)
6. Financial Intelligence (MUST use extraHtml "Data Completeness" table if financial data isn't available — DO NOT invent revenue/profit/ROI numbers)
7. Growth Strategy (visual "swot")
8. Target & Progress — use the given this-week/this-month targets and score journey
9. Risk Intelligence (visual "matrix" variant "risk")
10. Action Plan (visual "matrix" variant "priority")
11. Roadmap (visual "timeline")

Additional sections may be inserted (e.g. "Franchise/Partnership Regulations" if relevant) WITHOUT reducing the 11 required topics above.`;

/** PDF awal — dibuat sekali (idempotent) saat pertama kali business_profile
 * punya baseline analysis DAN begitu pelanggan settlement PLATINUM (dipicu
 * otomatis dari notification-handler.ts). Isinya rangkuman GLOBAL seluruh
 * platform THE HIVE untuk bisnis ini sejauh yang sudah tercatat — titik
 * acuan ("baseline") yang akan jadi pembanding semua progres selanjutnya. */
function buildBaselinePrompt(lang: "id" | "en"): string {
  const shared =
    lang === "en"
      ? `You are Beemo, THE HIVE's AI Business Consultant. Write the "Initial Report" (PDF Awal) for a PLATINUM customer — a comprehensive, McKinsey/BCG-caliber summary of this business's very first analysis AND everything THE HIVE platform currently knows about it, the reference point ("baseline") all future progress will be measured against. This is NOT a short teaser — it's the customer's official strategic document, must read as a complete consulting report.`
      : `Anda adalah Beemo, AI Business Consultant THE HIVE. Susun "Laporan Awal" (PDF Awal) untuk pelanggan PLATINUM — rangkuman komprehensif setara konsultan McKinsey/BCG dari analisa pertama bisnis pelanggan ini DAN semua yang saat ini diketahui platform THE HIVE tentang bisnis ini, titik acuan ("baseline") yang akan jadi pembanding semua progres selanjutnya. Ini BUKAN teaser singkat — ini dokumen strategis resmi pelanggan, harus terasa seperti laporan konsultan yang utuh.`;
  return `${shared}

${languageRule(lang)}

${lang === "en" ? DATA_HONESTY_RULE_EN : DATA_HONESTY_RULE_ID}

${lang === "en" ? ROLE_AWARE_RULE_EN : ROLE_AWARE_RULE_ID}

${lang === "en" ? RESEARCH_RULE_EN : RESEARCH_RULE_ID}

Susun laporan berdasarkan Ringkasan Bisnis yang diberikan (dikirim di pesan berikutnya, termasuk skema JSON yang harus diisi).

${lang === "en" ? SECTION_COVERAGE_EN : SECTION_COVERAGE_ID}

WAJIB ADA: executiveSummary (ringkasan 1 halaman di depan semua bagian), ceoRecommendation (5 keputusan konkret berurutan prioritas — "Lima Keputusan Pertama Jika Saya CEO..."), appendix (referensi, glossary, data confidence matrix per bagian, data yang dibutuhkan supaya laporan berikutnya lebih akurat, catatan AI soal metodologi).

Kamu boleh mencari (web search) dulu untuk bagian yang butuh data terkini, TAPI balasan akhir kamu HARUS HANYA JSON valid sesuai skema di atas — TANPA kalimat narasi proses pencarian, TANPA markdown, TANPA teks lain sama sekali.${
    lang === "en" ? " Remember: ALL text content inside the JSON must be in ENGLISH." : ""
  }`;
}

/** PDF perbandingan periode — dibuat otomatis di hari H expired
 * (api/cron/generate-expiry-reports.ts, sekarang hanya untuk tier
 * platinum), isinya perbandingan SEMUA yang telah dilakukan sepanjang
 * periode akses (dari baseline sampai sekarang) + rangkuman global platform
 * yang sama seperti baseline + kesimpulan. PDF ini jadi acuan baseline
 * periode berikutnya kalau pelanggan berlangganan lagi. */
function buildExpiryPrompt(lang: "id" | "en"): string {
  const shared =
    lang === "en"
      ? `You are Beemo, THE HIVE's AI Business Consultant. Write the "Period Comparison Report" for a PLATINUM customer — this customer's access period is ending today. Compare everything that happened during this period against where they started (baseline), summarize the full current state of the platform for this business (same comprehensive scope as the Initial Report), and give an honest conclusion + recommendation for what's next. Comprehensive McKinsey/BCG-caliber document, not a short recap.`
      : `Anda adalah Beemo, AI Business Consultant THE HIVE. Susun "Laporan Perbandingan Periode" untuk pelanggan PLATINUM — periode akses pelanggan ini berakhir hari ini. Bandingkan semua yang sudah dilakukan sepanjang periode ini dengan kondisi awal (baseline), rangkum kondisi platform TERKINI untuk bisnis ini secara menyeluruh (cakupan sama komprehensifnya dengan Laporan Awal), lalu beri kesimpulan jujur + rekomendasi langkah berikutnya. Dokumen komprehensif setara konsultan McKinsey/BCG, bukan rekap singkat.`;
  return `${shared}

${languageRule(lang)}

${lang === "en" ? DATA_HONESTY_RULE_EN : DATA_HONESTY_RULE_ID}

${lang === "en" ? ROLE_AWARE_RULE_EN : ROLE_AWARE_RULE_ID}

${lang === "en" ? RESEARCH_RULE_EN : RESEARCH_RULE_ID}

Susun laporan berdasarkan Ringkasan Bisnis yang diberikan (dikirim di pesan berikutnya, termasuk skema JSON yang harus diisi).

${lang === "en" ? SECTION_COVERAGE_EN : SECTION_COVERAGE_ID}

SATU SECTION TAMBAHAN WAJIB KHUSUS LAPORAN INI (di luar 11 topik di atas, tempatkan setelah Business Health): ${
    lang === "en"
      ? `"Workspace Activity This Period" — a dedicated section built ONLY from the "Business Update submitted this period", "Decisions logged in Decision Journal", and "Achievements unlocked" data given below. This is the concrete record of what the customer actually DID inside Workspace, not a generic recap. If nothing was logged, say so honestly (this itself is a useful finding — an inactive customer needs to hear that plainly) instead of inventing activity.`
      : `"Aktivitas Workspace Periode Ini" — section khusus yang disusun HANYA dari data "Business Update yang tercatat", "Keputusan besar di Decision Journal", dan "Pencapaian (achievement) yang terbuka" yang diberikan di bawah. Ini catatan konkret apa yang BENAR-BENAR dilakukan pelanggan di Workspace, bukan rekap generik. Kalau tidak ada aktivitas tercatat, katakan jujur (ini sendiri temuan yang berguna — pelanggan yang pasif perlu tahu itu apa adanya) daripada mengarang aktivitas.`
  }

WAJIB ADA: executiveSummary (ringkasan 1 halaman di depan semua bagian), ceoRecommendation (5 keputusan konkret berurutan prioritas untuk periode berikutnya), appendix (referensi, glossary, data confidence matrix per bagian, data yang dibutuhkan supaya laporan berikutnya lebih akurat, catatan AI soal metodologi). Section terakhir sebelum appendix WAJIB berjudul kesimpulan (eyebrow "KESIMPULAN & LANGKAH BERIKUTNYA" atau terjemahannya) dan field "recommendation"-nya jadi acuan target periode berikutnya.

Kamu boleh mencari (web search) dulu untuk bagian yang butuh data terkini, TAPI balasan akhir kamu HARUS HANYA JSON valid sesuai skema di atas — TANPA kalimat narasi proses pencarian, TANPA markdown, TANPA teks lain sama sekali.${
    lang === "en" ? " Remember: ALL text content inside the JSON must be in ENGLISH." : ""
  }`;
}

export function buildFinalReportPrompt(reportType: FinalReportType, lang: "id" | "en"): string {
  return reportType === "baseline" ? buildBaselinePrompt(lang) : buildExpiryPrompt(lang);
}

/** Format indikator makro jadi baris teks siap pakai di prompt — dipisah
 * dari buildFinalReportUserPrompt supaya mudah dibaca. */
function formatMacroLines(macro: MacroSnapshot | null, lang: "id" | "en"): string[] {
  const L = lang === "id";
  if (!macro || macro.indicators.length === 0) {
    return [L ? "\nKondisi Ekonomi Makro: tidak tersedia saat laporan ini dibuat." : "\nMacro Economic Conditions: not available at the time this report was generated."];
  }
  const lines = [L ? "\nKondisi Ekonomi Makro Indonesia saat ini (data resmi/live, JANGAN diganti angka lain):" : "\nCurrent Indonesian Macro Economic Conditions (official/live data, DO NOT substitute other numbers):"];
  for (const ind of macro.indicators) {
    const label = L ? ind.labelId : ind.labelEn;
    lines.push(`- ${label}: ${ind.valueDisplay} (${L ? "per" : "as of"} ${ind.asOf}, sumber: ${ind.source === "live_api" ? (L ? "API live" : "live API") : (L ? "data resmi terkurasi" : "curated official data")})`);
  }
  return lines;
}

/** Format ringkasan Medsos Kompetitor jadi baris teks siap pakai —
 * dataSource dibedakan jujur (mock vs live_api), sama prinsip data honesty
 * yang dipakai UI Workspace (badge "Data Contoh/Simulasi" vs data asli). */
function formatSocialLines(social: SocialMediaSnapshot | null, lang: "id" | "en"): string[] {
  const L = lang === "id";
  if (!social || social.summary.totalProfilesFound === 0) {
    return [
      L
        ? "\nMedsos Kompetitor: belum ada data tersimpan (pelanggan belum pernah membuka tab Medsos Kompetitor di Workspace, atau belum ditemukan akun kompetitor)."
        : "\nSocial Media Competitors: no data stored yet (customer has not opened the Social Media Competitor tab in Workspace, or no competitor accounts were found).",
    ];
  }
  const lines = [
    L
      ? `\nMedsos Kompetitor (sumber data: ${social.dataSource === "live_api" ? "ASLI (Apify)" : "CONTOH/simulasi — belum data pasar sungguhan"}):`
      : `\nSocial Media Competitors (data source: ${social.dataSource === "live_api" ? "REAL (Apify)" : "SAMPLE/simulated — not real market data yet"}):`,
  ];
  lines.push(
    `- ${L ? "Total profil ditemukan" : "Total profiles found"}: ${social.summary.totalProfilesFound}, ${L ? "rata-rata follower" : "average followers"}: ${social.summary.averageFollowers ?? "-"}${
      social.summary.averageEngagementRatePct != null ? `, ${L ? "rata-rata engagement" : "average engagement"}: ${social.summary.averageEngagementRatePct}%` : ""
    }`
  );
  if (social.dataSource === "mock" && social.records.length > 0) {
    for (const r of social.records) lines.push(`  - ${r.competitorName} (${r.platform}): ${r.followers} follower, ${r.engagementRatePct}% engagement`);
  }
  if (social.dataSource === "live_api" && social.liveRecords.length > 0) {
    for (const r of social.liveRecords) lines.push(`  - ${r.competitorName} (@${r.username}, ${r.platform}): ${r.followers} follower`);
  }
  if (social.aiSummary) lines.push(`- ${L ? "Ringkasan" : "Summary"}: ${social.aiSummary}`);
  return lines;
}

/** Merangkai Business Memory + Kondisi Ekonomi Makro + Medsos Kompetitor
 * jadi teks konteks untuk prompt — dipakai SEBAGAI GANTI
 * buildUserPrompt(wizardData) di generate-report.ts, karena di sini
 * sumbernya Business Memory (data yang sudah tercatat), bukan jawaban
 * wizard mentah. Parameter macro/social ditambahkan Juli 2026 supaya
 * laporan ini betul-betul jadi "rangkuman global platform", bukan cuma
 * baseline+journey seperti sebelumnya. */
export function buildFinalReportUserPrompt(
  memory: BusinessMemoryContext,
  reportType: FinalReportType,
  macro: MacroSnapshot | null = null,
  social: SocialMediaSnapshot | null = null
): string {
  const lines: string[] = [];
  lines.push(`Ringkasan Bisnis:`);
  lines.push(`- Nama bisnis: ${memory.profile.businessName}`);
  if (memory.profile.industry) lines.push(`- Industri: ${memory.profile.industry}`);
  lines.push(`- Jenis: ${memory.profile.businessType === "start" ? "Bisnis baru (belum/baru buka)" : "Bisnis sudah berjalan"}`);
  if (memory.profile.location) lines.push(`- Lokasi: ${memory.profile.location}`);
  if (memory.profile.userRole) lines.push(`- Peran pengguna di bisnis ini: ${memory.profile.userRole}`);
  if (memory.goals) lines.push(`- Target: ${memory.goals}`);
  if (memory.mainChallenges) lines.push(`- Tantangan utama: ${memory.mainChallenges}`);
  if (memory.targetThisWeek) lines.push(`- Target minggu ini: ${memory.targetThisWeek}`);
  if (memory.targetThisMonth) lines.push(`- Target bulan ini: ${memory.targetThisMonth}`);

  if (memory.baseline) {
    lines.push(`\nAnalisa Awal (Baseline, ${memory.baseline.createdAt}):`);
    if (memory.baseline.businessHealthScore != null) lines.push(`- Skor kesehatan bisnis awal: ${memory.baseline.businessHealthScore}`);
    if (memory.baseline.summary) lines.push(`- Ringkasan: ${memory.baseline.summary}`);
    if (memory.baseline.strengths) lines.push(`- Kekuatan: ${memory.baseline.strengths}`);
    if (memory.baseline.improvements) lines.push(`- Area perbaikan: ${memory.baseline.improvements}`);
    if (memory.baseline.opportunity) lines.push(`- Peluang: ${memory.baseline.opportunity}`);
  } else {
    lines.push(`\nBelum ada analisa awal (baseline) tercatat.`);
  }

  if (memory.journey) {
    lines.push(`\nPerjalanan Skor (dari awal sampai sekarang):`);
    lines.push(`- Skor awal: ${memory.journey.baselineScore}, skor sekarang: ${memory.journey.currentScore}, perubahan: ${memory.journey.delta >= 0 ? "+" : ""}${memory.journey.delta}`);
  }
  if (memory.period) {
    lines.push(`- Perubahan periode terakhir: ${memory.period.previousScore} -> ${memory.period.currentScore} (${memory.period.delta >= 0 ? "+" : ""}${memory.period.delta})`);
  }

  if (memory.competitorSummary) {
    lines.push(`\nRingkasan Kompetitor (data SUNGGUHAN, jangan mengarang nama kompetitor lain):`);
    lines.push(
      `- ${memory.competitorSummary.totalCompetitorsFound} kompetitor ditemukan, posisi pasar: "${memory.competitorSummary.marketPosition}" — ${memory.competitorSummary.marketPositionReason} (sumber: ${memory.competitorSummary.dataSource}, per ${memory.competitorSummary.fetchedAt})`
    );
  } else {
    lines.push(`\nRingkasan Kompetitor: belum ada data tersimpan.`);
  }

  lines.push(...formatSocialLines(social, "id"));
  lines.push(...formatMacroLines(macro, "id"));

  if (reportType === "expiry") {
    if (memory.recentUpdates.length > 0) {
      lines.push(`\nBusiness Update yang tercatat sepanjang periode ini (terbaru dulu):`);
      for (const u of memory.recentUpdates) {
        lines.push(`- (${u.createdAt}) ${u.content}${u.kondisiPenjualan ? ` — kondisi penjualan: ${u.kondisiPenjualan}` : ""}`);
      }
    } else {
      lines.push(`\nTidak ada Business Update tercatat sepanjang periode ini.`);
    }
    if (memory.achievementsUnlockedCount > 0) {
      lines.push(`\nPencapaian (achievement) yang terbuka sepanjang periode: ${memory.achievementsUnlockedCount}${memory.latestAchievementTitle ? `, terbaru: "${memory.latestAchievementTitle}"` : ""}`);
    } else {
      lines.push(`\nTidak ada pencapaian (achievement) baru yang terbuka sepanjang periode ini.`);
    }
    if (memory.recentDecisions.length > 0) {
      lines.push(`\nKeputusan besar yang diajukan ke Decision Journal sepanjang periode ini:`);
      for (const d of memory.recentDecisions) {
        lines.push(`- ${d.question}${d.conclusion ? ` -> Kesimpulan: ${d.conclusion}` : ""}`);
      }
    } else {
      lines.push(`\nTidak ada keputusan besar yang diajukan ke Decision Journal sepanjang periode ini.`);
    }
  } else if (memory.recentUpdates.length > 0) {
    // Baseline TETAP dikasih tahu kalau kebetulan sudah ada aktivitas
    // Workspace sebelum PDF pertama ini dibuat (mis. pelanggan sempat
    // memakai Workspace di tier lama sebelum upgrade Platinum) — bukan
    // section wajib tersendiri (itu khusus expiry), tapi konteks yang jujur
    // untuk dipakai kalau relevan di section lain.
    lines.push(`\nAktivitas Workspace sebelum laporan ini dibuat (konteks tambahan, bukan section wajib tersendiri):`);
    for (const u of memory.recentUpdates.slice(0, 3)) lines.push(`- (${u.createdAt}) ${u.content}`);
  }

  lines.push(`\n${SCHEMA_DESCRIPTION}`);
  return lines.join("\n");
}
