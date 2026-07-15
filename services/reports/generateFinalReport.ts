// services/reports/generateFinalReport.ts
//
// Task 13 ("riwayat diganti final reports"): satu-satunya tempat yang
// membuat PDF Final Report (baseline ATAU expiry) dan menyimpannya
// SUNGGUHAN ke Supabase Storage (bucket "reports") + tabel business_reports
// — bukan generate-on-demand tiap kali dibuka (lihat migrations/2026-07-11_final_reports.sql).
//
// Dipanggil dari:
// - api/workspace.ts (action "generateBaselineReport") — on-demand, sekali
//   per bisnis, dipicu dari tombol di Final Reports panel.
// - api/cron/generate-expiry-reports.ts — otomatis di hari H expired.
//
// Sama seperti generate-report.ts, PDF dirender lewat renderReportPdf()
// (Playwright) — catatan infrastruktur yang sama berlaku (lihat header
// api/generate-report.ts): perlu playwright-core + @sparticuz/chromium atau
// render service terpisah sebelum production sungguhan.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { renderReportPdf } from "../../report-engine/renderPdf.js";
import { buildFinalReportPrompt, buildFinalReportUserPrompt, type FinalReportType } from "../../report-engine/finalReportPrompt.js";
import type { ReportData } from "../../report-engine/types.js";
import { getBusinessMemory, type BusinessMemoryContext } from "../memory/getBusinessMemory.js";
import type { ServiceResult } from "../business/create.js";
import { getMacroSnapshot, type MacroSnapshot } from "../macro/getMacroSnapshot.js";
import { getCachedSocialSnapshot } from "../socialMedia/cache.js";
import type { SocialMediaSnapshot } from "../socialMedia/types.js";
import { logClaudeUsage, extractUsage } from "../costTracking/logUsage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const REPORTS_BUCKET = "reports";

export type GenerateFinalReportResult =
  | { ok: true; reportId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

/** Bikin ReportData minimal (skema sama dengan generate-report.ts) dari
 * hasil Claude + Business Memory — cover-nya pakai skor Business Memory
 * langsung (bukan angka karangan Claude) supaya konsisten dengan yang
 * pengguna lihat di Workspace.
 *
 * Rombak produk Juli 2026 ("PDF eksklusif PLATINUM, isi rangkuman lengkap
 * platform >10 halaman"): sejak PDF Final Reports hanya untuk PLATINUM (lihat
 * guard di generateFinalReport() di bawah), fungsi ini TIDAK PERNAH lagi
 * dipanggil dengan tier "pro" — parameter tier dihapus, harga & executive
 * summary/CEO recommendation/appendix SELALU diisi (sebelumnya field-field
 * itu tidak pernah diisi sama sekali di sini, walau types.ts sudah
 * menyediakannya untuk Platinum — laporan Final Reports jadi jauh lebih
 * tipis dari yang seharusnya bisa didapat pelanggan Platinum). */
function buildReportData(
  memory: BusinessMemoryContext,
  reportType: FinalReportType,
  lang: "id" | "en",
  aiContent: FinalReportAiContent
): ReportData {
  const today = new Date();
  const coverScore =
    reportType === "expiry" && memory.journey ? memory.journey.currentScore : (memory.baseline?.businessHealthScore ?? aiContent.coverBusinessScore);
  return {
    tier: "platinum",
    price: "Rp349.000",
    tagline:
      reportType === "baseline"
        ? lang === "en"
          ? "Initial Report — your complete THE HIVE platform baseline"
          : "Laporan Awal — rangkuman lengkap titik acuan bisnismu di THE HIVE"
        : lang === "en"
          ? "Period Comparison Report — everything that happened this cycle, and what's next"
          : "Laporan Perbandingan Periode — semua yang terjadi sepanjang periode ini, dan langkah berikutnya",
    profile: {
      ownerName: memory.profile.userRole || "-",
      businessName: memory.profile.businessName,
      businessType: memory.profile.industry || "-",
      profession: memory.profile.userRole || "-",
      location: memory.profile.location || "-",
      status: memory.profile.businessType === "start" ? "Bisnis Baru" : "Bisnis Berjalan",
      initialCapital: "-",
    },
    cover: {
      reportNo: `THV-${reportType === "baseline" ? "BASE" : "EXP"}-${today.toISOString().slice(0, 10).replace(/-/g, "")}`,
      date: today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      version: "1.0",
      industry: memory.profile.industry || "-",
      preparedBy: "Beemo AI — THE HIVE",
      businessScore: coverScore,
      confidencePct: aiContent.coverConfidencePct,
      executiveRecommendation: aiContent.coverExecutiveRecommendation,
      snapshot: aiContent.coverSnapshot,
    },
    executiveSummary: aiContent.executiveSummary,
    sections: aiContent.sections,
    ceoRecommendation: aiContent.ceoRecommendation,
    appendix: aiContent.appendix,
  };
}

type FinalReportAiContent = {
  sections: ReportData["sections"];
  executiveSummary: ReportData["executiveSummary"];
  ceoRecommendation: ReportData["ceoRecommendation"];
  appendix: ReportData["appendix"];
  coverBusinessScore: number;
  coverConfidencePct: number;
  coverExecutiveRecommendation: string;
  coverSnapshot: string;
};

// Fix bug (Jul 2026): generateBaselineReport gagal (400) dengan
// "SyntaxError: Expected ',' or ']' after array element in JSON at
// position ..." — Claude kadang menghasilkan JSON dengan karakter kontrol
// mentah (newline/tab literal) di DALAM string value (mis. paragraf
// executiveSummary yang panjang), yang secara teknis ilegal di JSON ketat
// dan bikin JSON.parse tersandung di titik itu. sanitizeJsonControlChars()
// hanya meng-escape newline/tab/CR yang BENAR-BENAR berada di dalam string
// literal (dilacak lewat quote-state + escape-state per karakter, bukan
// regex membabi buta) — tidak menyentuh apapun di luar string, jadi aman
// dari sisi makna konten.
//
// Ini menutup kelas bug paling umum (raw newline di dalam string), tapi
// TIDAK menjamin 100% (kelas lain: tanda kutip ganda yang tidak di-escape
// di tengah kalimat, jauh lebih sulit dideteksi tanpa ambiguitas). Karena
// itu tetap dipasangkan FINAL_REPORT_MAX_ATTEMPTS panggilan ulang ke Claude
// kalau parsing masih gagal setelah sanitasi — output LLM tidak
// deterministik, jadi percobaan kedua/ketiga punya peluang bagus
// menghasilkan JSON yang valid tanpa perlu menebak-nebak heuristik
// perbaikan kutip yang berisiko.
function sanitizeJsonControlChars(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        result += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
      result += ch;
    } else {
      if (ch === '"') inString = true;
      result += ch;
    }
  }
  return result;
}

function parseFinalReportJson(raw: string): FinalReportAiContent {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // lanjut ke percobaan berikutnya di bawah
  }
  try {
    return JSON.parse(sanitizeJsonControlChars(cleaned));
  } catch {
    // lanjut ke percobaan berikutnya di bawah
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respons Claude tidak mengandung objek JSON.");
  return JSON.parse(sanitizeJsonControlChars(jsonMatch[0]));
}

const FINAL_REPORT_MAX_ATTEMPTS = 3;

async function callClaudeForFinalReport(
  businessProfileId: string,
  memory: BusinessMemoryContext,
  reportType: FinalReportType,
  lang: "id" | "en",
  macro: MacroSnapshot | null,
  social: SocialMediaSnapshot | null
): Promise<FinalReportAiContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY belum diset di Vercel.");

  const client = new Anthropic({ apiKey });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= FINAL_REPORT_MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      // Dinaikkan dari 4000 -> 10000 (Rombak Juli 2026): skema sekarang WAJIB
      // mengisi executiveSummary + 10-14 sections + ceoRecommendation +
      // appendix supaya PDF konsisten tembus >10 halaman (lihat
      // finalReportPrompt.ts) — 4000 token sebelumnya nyaris pasti memotong
      // output JSON di tengah jalan begitu jumlah section bertambah banyak,
      // yang berisiko menghasilkan JSON tidak valid atau bagian akhir laporan
      // terpotong. Nilainya disamakan dengan generate-monthly-report.ts (8000)
      // plus sedikit ruang ekstra karena skema di sini juga memuat appendix.
      max_tokens: 10000,
      system: buildFinalReportPrompt(reportType, lang),
      messages: [{ role: "user", content: buildFinalReportUserPrompt(memory, reportType, macro, social) }],
      // Riset Sungguhan (pola sama dengan reportPrompt.ts/monthlyReportPrompt.ts):
      // bagian yang menyentuh legalitas/pajak/regulasi terkini boleh mencari
      // dulu sebelum ditulis, alih-alih mengandalkan ingatan lama model.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, sama seperti catatan di
      // services/beemo/chat.ts dan generate-monthly-report.ts.
      //
      // Diturunkan dari 5 -> 3 (audit Juli 2026, root-cause 504 "Task timed
      // out after 300 seconds" di /api/workspace): tiap web_search menambah
      // giliran bolak-balik (model mencari -> tunggu hasil -> lanjut
      // menulis) sebelum respons akhir kembali, dan FINAL_REPORT_MAX_ATTEMPTS
      // di bawah bisa mengulang SELURUH panggilan ini (termasuk semua
      // pencarian) sampai 3x kalau JSON-nya gagal di-parse -- worst-case
      // 5 pencarian x 3 percobaan gampang menembus 300 detik. 3 pencarian
      // per percobaan tetap cukup untuk riset legalitas/pajak terkini tapi
      // memangkas waktu terburuk secara signifikan.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] as any,
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda respons ke pengguna kalau lambat/gagal.
    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId, action: "final_report", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");

    try {
      return parseFinalReportJson(raw);
    } catch (parseErr) {
      lastErr = parseErr;
      console.error(`callClaudeForFinalReport: JSON tidak valid di percobaan ${attempt}/${FINAL_REPORT_MAX_ATTEMPTS}:`, parseErr);
    }
  }
  throw lastErr;
}

/** Generate + simpan satu Final Report. Idempotent untuk "baseline" DAN
 * "expiry" (per business+period_end) — dijamin di DUA lapis: cek cepat di
 * awal (fast path, hindari panggil Claude/Playwright kalau jelas-jelas
 * sudah ada), DAN unique index di database
 * (migrations/2026-07-11b_final_reports_race_guard.sql) sebagai jaminan
 * sebenarnya kalau dua request lolos cek awal hampir bersamaan (audit Juli
 * 2026 — cek awal saja TIDAK atomic, race dua request nyaris bersamaan bisa
 * lolos keduanya). Kalau INSERT gagal karena unique_violation (kode 23505),
 * itu tandanya request lain menang duluan — baca balik baris yang sudah
 * tersimpan alih-alih menganggapnya error. */
export async function generateFinalReport(
  businessProfileId: string,
  reportType: FinalReportType,
  lang: "id" | "en" = "id",
  periodStart?: string | null,
  periodEnd?: string | null
): Promise<GenerateFinalReportResult> {
  if (reportType === "baseline") {
    const { data: existing } = await supabase
      .from("business_reports")
      .select("id")
      .eq("business_profile_id", businessProfileId)
      .eq("report_type", "baseline")
      .maybeSingle();
    if (existing) {
      return { ok: true, reportId: existing.id, alreadyExisted: true };
    }
  }

  const memory = await getBusinessMemory(businessProfileId);
  if (!memory) return { ok: false, error: "Gagal memuat konteks bisnis." };
  // Bugfix produk Juli 2026 ("PDF eksklusif PLATINUM, kurangi biaya generate
  // untuk PRO"): sebelumnya PRO ikut lolos di sini (hanya "free" yang
  // diblokir) — PRO bisa generate/lihat/download PDF Final Reports persis
  // seperti PLATINUM. Sekarang PDF generate/view/download HANYA untuk
  // PLATINUM; diblokir juga di sini (bukan cuma di UI Workspace.tsx) supaya
  // endpoint ini tidak bisa dipanggil langsung untuk PRO/Gratis dan tetap
  // konsisten kalau ada jalur pemanggilan lain di masa depan (defense in
  // depth — pola yang sama dipakai guard tier lain di codebase ini).
  if (memory.membership.tier !== "platinum") {
    return { ok: false, error: "Final Reports (PDF) tersedia khusus untuk pelanggan PLATINUM." };
  }

  // Rombak Juli 2026 ("rangkuman global isi platform THE HIVE secara
  // lengkap"): Business Memory sudah punya ringkasan kompetitor, tapi TIDAK
  // punya Kondisi Ekonomi (Makro) atau Medsos Kompetitor — dua pilar
  // Workspace yang sebelumnya tidak pernah masuk PDF sama sekali. Diambil di
  // sini secara terpisah, BUKAN lewat live trigger yang mahal:
  // - getMacroSnapshot: data umum (bukan per-bisnis), murah — kurs live +
  //   inflasi/BI rate statis terkurasi, sama seperti yang dibaca Workspace.
  // - getCachedSocialSnapshot: HANYA baca cache yang sudah ada (kalau
  //   pengguna belum pernah membuka tab Medsos Kompetitor, cache-nya kosong
  //   dan itu jujur ditulis "belum ada data" di laporan — TIDAK memicu
  //   pipeline Apify baru di sini, supaya generate PDF tetap cepat/murah).
  const [macro, social] = await Promise.all([
    getMacroSnapshot("", { lang }).then((r) => (r.status === 200 ? ((r.body as { macro: MacroSnapshot }).macro ?? null) : null)),
    getCachedSocialSnapshot(businessProfileId),
  ]);

  try {
    const aiContent = await callClaudeForFinalReport(businessProfileId, memory, reportType, lang, macro, social);
    const reportData = buildReportData(memory, reportType, lang, aiContent);
    const pdfBuffer = await renderReportPdf(reportData);

    const timestamp = Date.now();
    const storagePath = `${businessProfileId}/${reportType}-${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage.from(REPORTS_BUCKET).upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) {
      console.error("generateFinalReport: gagal upload ke Storage:", uploadError);
      return { ok: false, error: "Gagal menyimpan PDF." };
    }

    const { data: saved, error: insertError } = await supabase
      .from("business_reports")
      .insert({
        business_profile_id: businessProfileId,
        report_type: reportType,
        storage_path: storagePath,
        period_start: periodStart ?? null,
        period_end: periodEnd ?? null,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") {
      // Kalah balapan dari request lain yang sudah menang duluan (lihat
      // catatan di atas fungsi ini) — PDF yang baru saja kita render/upload
      // jadi mubazir (tersimpan di Storage tapi tidak dicatat, aman
      // diabaikan), baca balik baris yang SUDAH tersimpan punya request lain.
      const existingSelect =
        reportType === "baseline"
          ? supabase.from("business_reports").select("id").eq("business_profile_id", businessProfileId).eq("report_type", "baseline")
          : supabase
              .from("business_reports")
              .select("id")
              .eq("business_profile_id", businessProfileId)
              .eq("report_type", "expiry")
              .eq("period_end", periodEnd ?? "");
      const { data: winner } = await existingSelect.maybeSingle();
      if (winner) {
        return { ok: true, reportId: winner.id, alreadyExisted: true };
      }
      console.error("generateFinalReport: unique_violation tapi baris pemenang tidak ditemukan:", insertError);
      return { ok: false, error: "Gagal mencatat laporan." };
    }

    if (insertError || !saved) {
      console.error("generateFinalReport: gagal simpan baris business_reports:", insertError);
      return { ok: false, error: "Gagal mencatat laporan." };
    }

    return { ok: true, reportId: saved.id, alreadyExisted: false };
  } catch (err) {
    console.error("services/reports/generateFinalReport error:", err);
    return { ok: false, error: "Beemo gagal menyusun laporan ini. Coba lagi." };
  }
}

/** Wrapper action untuk api/workspace.ts (action "generateBaselineReport")
 * — cek kepemilikan business_profile dulu (pola sama dengan service
 * lain di services/workspace/*.ts), baru panggil generateFinalReport. Hanya
 * untuk reportType "baseline" — laporan "expiry" HANYA dibuat otomatis
 * lewat api/cron/generate-expiry-reports.ts, tidak ada tombol manual untuk
 * itu (supaya tidak bisa dipanggil berkali-kali oleh pengguna). */
export async function generateBaselineReportAction(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const result = await generateFinalReport(businessProfileId, "baseline", lang);
  if (!result.ok) {
    return { status: 400, body: { error: result.error } };
  }
  return { status: 200, body: { reportId: result.reportId, alreadyExisted: result.alreadyExisted } };
}
