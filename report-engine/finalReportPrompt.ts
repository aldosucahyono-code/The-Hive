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
// Skema JSON output SAMA PERSIS dengan report-engine/reportPrompt.ts
// (sections: IntelligencePage[], dst) supaya bisa dirender ulang lewat
// renderReportPdf() yang sama — tidak ada template PDF kedua.

import type { Tier } from "./types.js";
import type { BusinessMemoryContext } from "../services/memory/getBusinessMemory.js";

export type FinalReportType = "baseline" | "expiry";

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
        { "type": "timeline", "milestones": [{ "period": string, "title": string }, ...] },
      "impact": string,
      "recommendation": string,
      "decision": "GO" | "WAIT" | "PIVOT" | "STOP",
      "confidencePct": number,
      "confidenceBasis": string
    }
  ],
  "coverBusinessScore": number,
  "coverConfidencePct": number,
  "coverExecutiveRecommendation": string,
  "coverSnapshot": string
}`;

function languageRule(lang: "id" | "en"): string {
  return lang === "en"
    ? `Write the ENTIRE report (titles, insights, recommendations, everything) in ENGLISH. Professional business-consultant voice — no AI-ish hedging phrases like "based on the data provided".`
    : `Tulis SELURUH laporan (judul, insight, rekomendasi, semuanya) dalam BAHASA INDONESIA. Gaya konsultan bisnis profesional — jangan pakai frasa ala-AI seperti "berdasarkan data yang diberikan".`;
}

const DATA_HONESTY_RULE_ID = `ATURAN DATA HONESTY (WAJIB): HANYA gunakan data yang benar-benar ada di Ringkasan Bisnis di bawah. Kalau satu aspek belum punya data (mis. belum pernah kirim Business Update), tulis jujur "belum ada data untuk ini" pada bagian itu — JANGAN mengarang angka atau cerita.`;
const DATA_HONESTY_RULE_EN = `DATA HONESTY RULE (REQUIRED): ONLY use data that is actually present in the Business Summary below. If an aspect has no data yet (e.g. no Business Update submitted), honestly write "no data available yet" for that part — DO NOT invent numbers or stories.`;

// Role-Aware Advice (arahan pemilik produk, Juli 2026 — sama seperti
// roleAwareAdviceLine() di services/beemo/chat.ts, dipakai bersama supaya
// Final Report tidak punya sudut pandang berbeda dari Chat Beemo untuk
// pelanggan yang sama). Kalau "Peran pengguna" di Ringkasan Bisnis BUKAN
// pemilik, field "recommendation" tiap section harus jelas membedakan mana
// yang bisa dieksekusi sendiri vs mana yang perlu diusulkan ke Owner.
const ROLE_AWARE_RULE_ID = `ATURAN SUDUT PANDANG PERAN (WAJIB kalau "Peran pengguna" ada di Ringkasan Bisnis): JANGAN berasumsi pembaca laporan ini otomatis pemilik usaha. Kalau perannya BUKAN pemilik/pengambil keputusan utama (mis. Manager, Supervisor, staf, admin — bukan Owner/Founder/CEO/Direktur Utama), tulis field "recommendation" tiap bagian dengan membedakan mana yang bisa langsung dia lakukan dalam wewenangnya sendiri, dan mana yang perlu dia usulkan/sampaikan ke Owner-nya (beserta data pendukung yang perlu dibawa).`;
const ROLE_AWARE_RULE_EN = `ROLE PERSPECTIVE RULE (REQUIRED if "User's role" is present in the Business Summary): Do NOT assume the reader of this report is automatically the business owner. If their role is NOT the owner/main decision-maker (e.g. Manager, Supervisor, staff, admin — not Owner/Founder/CEO/Managing Director), write each section's "recommendation" field distinguishing what they can act on within their own authority versus what they need to escalate/propose to their Owner (including what supporting data to bring).`;

/** PDF awal — dibuat sekali (idempotent) saat pertama kali business_profile
 * punya baseline analysis, isinya rangkuman total semua analisa sejauh ini
 * (baseline + progres yang sudah tercatat sampai saat PDF ini dibuat). */
function buildBaselinePrompt(tier: Tier, lang: "id" | "en"): string {
  const shared =
    lang === "en"
      ? `You are Beemo, THE HIVE's AI Business Consultant. Write the "Initial Report" (PDF Awal) — a full summary of the very first business analysis for this customer, the reference point ("baseline") all future progress will be measured against.`
      : `Anda adalah Beemo, AI Business Consultant THE HIVE. Susun "Laporan Awal" (PDF Awal) — rangkuman lengkap analisa pertama bisnis pelanggan ini, titik acuan ("baseline") yang akan jadi pembanding semua progres selanjutnya.`;
  return `${shared}

${languageRule(lang)}

${lang === "en" ? DATA_HONESTY_RULE_EN : DATA_HONESTY_RULE_ID}

${lang === "en" ? ROLE_AWARE_RULE_EN : ROLE_AWARE_RULE_ID}

Susun laporan paket ${tier.toUpperCase()} berdasarkan Ringkasan Bisnis yang diberikan (dikirim di pesan berikutnya, termasuk skema JSON yang harus diisi). 2-4 bagian (sections) cukup: kondisi awal bisnis (skor kesehatan, kekuatan, area perbaikan), peluang yang teridentifikasi, dan rekomendasi langkah awal.`;
}

/** PDF perbandingan periode — dibuat otomatis di hari H expired
 * (api/cron/generate-expiry-reports.ts), isinya perbandingan SEMUA yang
 * telah dilakukan sepanjang periode akses (dari baseline sampai sekarang)
 * + kesimpulan. PDF ini jadi acuan baseline periode berikutnya kalau
 * pelanggan berlangganan lagi. */
function buildExpiryPrompt(tier: Tier, lang: "id" | "en"): string {
  const shared =
    lang === "en"
      ? `You are Beemo, THE HIVE's AI Business Consultant. Write the "Period Comparison Report" — this customer's access period is ending today. Compare everything they did during this period against where they started (baseline), and give an honest conclusion + recommendation for what's next.`
      : `Anda adalah Beemo, AI Business Consultant THE HIVE. Susun "Laporan Perbandingan Periode" — periode akses pelanggan ini berakhir hari ini. Bandingkan semua yang sudah dilakukan sepanjang periode ini dengan kondisi awal (baseline), lalu beri kesimpulan jujur + rekomendasi langkah berikutnya.`;
  return `${shared}

${languageRule(lang)}

${lang === "en" ? DATA_HONESTY_RULE_EN : DATA_HONESTY_RULE_ID}

${lang === "en" ? ROLE_AWARE_RULE_EN : ROLE_AWARE_RULE_ID}

Susun laporan paket ${tier.toUpperCase()} berdasarkan Ringkasan Bisnis yang diberikan (dikirim di pesan berikutnya, termasuk skema JSON yang harus diisi). 2-4 bagian (sections) cukup: perbandingan skor awal vs sekarang (journey/period di Ringkasan Bisnis), progres nyata yang tercatat (Business Update/Achievement/Decision), dan kesimpulan + rekomendasi untuk periode berikutnya. Section terakhir WAJIB berjudul kesimpulan (eyebrow "KESIMPULAN & LANGKAH BERIKUTNYA" atau terjemahannya) dan field "recommendation"-nya jadi acuan target periode berikutnya.`;
}

export function buildFinalReportPrompt(reportType: FinalReportType, tier: Tier, lang: "id" | "en"): string {
  return reportType === "baseline" ? buildBaselinePrompt(tier, lang) : buildExpiryPrompt(tier, lang);
}

/** Merangkai Business Memory jadi teks konteks untuk prompt — dipakai
 * SEBAGAI GANTI buildUserPrompt(wizardData) di generate-report.ts, karena
 * di sini sumbernya Business Memory (data yang sudah tercatat), bukan
 * jawaban wizard mentah. */
export function buildFinalReportUserPrompt(memory: BusinessMemoryContext, reportType: FinalReportType): string {
  const lines: string[] = [];
  lines.push(`Ringkasan Bisnis:`);
  lines.push(`- Nama bisnis: ${memory.profile.businessName}`);
  if (memory.profile.industry) lines.push(`- Industri: ${memory.profile.industry}`);
  lines.push(`- Jenis: ${memory.profile.businessType === "start" ? "Bisnis baru (belum/baru buka)" : "Bisnis sudah berjalan"}`);
  if (memory.profile.location) lines.push(`- Lokasi: ${memory.profile.location}`);
  if (memory.profile.userRole) lines.push(`- Peran pengguna di bisnis ini: ${memory.profile.userRole}`);
  if (memory.goals) lines.push(`- Target: ${memory.goals}`);
  if (memory.mainChallenges) lines.push(`- Tantangan utama: ${memory.mainChallenges}`);

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

  if (reportType === "expiry") {
    if (memory.journey) {
      lines.push(`\nPerjalanan Skor (dari awal sampai sekarang):`);
      lines.push(`- Skor awal: ${memory.journey.baselineScore}, skor sekarang: ${memory.journey.currentScore}, perubahan: ${memory.journey.delta >= 0 ? "+" : ""}${memory.journey.delta}`);
    }
    if (memory.period) {
      lines.push(`- Perubahan periode terakhir: ${memory.period.previousScore} -> ${memory.period.currentScore} (${memory.period.delta >= 0 ? "+" : ""}${memory.period.delta})`);
    }
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
    }
    if (memory.recentDecisions.length > 0) {
      lines.push(`\nKeputusan besar yang diajukan ke Decision Journal sepanjang periode ini:`);
      for (const d of memory.recentDecisions) {
        lines.push(`- ${d.question}${d.conclusion ? ` -> Kesimpulan: ${d.conclusion}` : ""}`);
      }
    }
  }

  lines.push(`\n${SCHEMA_DESCRIPTION}`);
  return lines.join("\n");
}
