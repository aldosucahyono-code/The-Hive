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
import type { ReportData, Tier } from "../../report-engine/types.js";
import { getBusinessMemory, type BusinessMemoryContext } from "../memory/getBusinessMemory.js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const REPORTS_BUCKET = "reports";

export type GenerateFinalReportResult =
  | { ok: true; reportId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

/** Bikin ReportData minimal (skema sama dengan generate-report.ts) dari
 * hasil Claude + Business Memory — cover-nya pakai skor Business Memory
 * langsung (bukan angka karangan Claude) supaya konsisten dengan yang
 * pengguna lihat di Workspace. */
function buildReportData(
  memory: BusinessMemoryContext,
  reportType: FinalReportType,
  tier: Tier,
  lang: "id" | "en",
  aiContent: {
    sections: ReportData["sections"];
    coverBusinessScore: number;
    coverConfidencePct: number;
    coverExecutiveRecommendation: string;
    coverSnapshot: string;
  }
): ReportData {
  const today = new Date();
  const coverScore =
    reportType === "expiry" && memory.journey ? memory.journey.currentScore : (memory.baseline?.businessHealthScore ?? aiContent.coverBusinessScore);
  return {
    tier,
    price: tier === "pro" ? "Rp99.000" : "Rp349.000",
    tagline:
      reportType === "baseline"
        ? lang === "en"
          ? "Initial Report — your business analysis baseline"
          : "Laporan Awal — titik acuan analisa bisnismu"
        : lang === "en"
          ? "Period Comparison Report — what changed, and what's next"
          : "Laporan Perbandingan Periode — apa yang berubah, dan langkah berikutnya",
    profile: {
      ownerName: "-",
      businessName: memory.profile.businessName,
      businessType: memory.profile.industry || "-",
      profession: "-",
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
    sections: aiContent.sections,
  };
}

type FinalReportAiContent = {
  sections: ReportData["sections"];
  coverBusinessScore: number;
  coverConfidencePct: number;
  coverExecutiveRecommendation: string;
  coverSnapshot: string;
};

async function callClaudeForFinalReport(
  memory: BusinessMemoryContext,
  reportType: FinalReportType,
  tier: Tier,
  lang: "id" | "en"
): Promise<FinalReportAiContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY belum diset di Vercel.");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: tier === "platinum" ? 4000 : 2500,
    system: buildFinalReportPrompt(reportType, tier, lang),
    messages: [{ role: "user", content: buildFinalReportUserPrompt(memory, reportType) }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");
  let cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw parseErr;
    cleaned = jsonMatch[0];
    return JSON.parse(cleaned);
  }
}

/** Generate + simpan satu Final Report. Idempotent untuk "baseline" — kalau
 * sudah pernah dibuat sebelumnya, kembalikan yang lama (tidak memanggil
 * Claude/Playwright dua kali untuk hal yang sama). "expiry" TIDAK idempotent
 * per-panggilan (satu PDF baru per periode yang berakhir), tapi caller
 * (cron) bertanggung jawab tidak memanggil dua kali untuk periode yang sama. */
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
  if (memory.membership.tier === "free") {
    return { ok: false, error: "Final Reports tersedia untuk pelanggan PRO/PLATINUM." };
  }
  const tier: Tier = memory.membership.tier === "platinum" ? "platinum" : "pro";

  try {
    const aiContent = await callClaudeForFinalReport(memory, reportType, tier, lang);
    const reportData = buildReportData(memory, reportType, tier, lang, aiContent);
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
