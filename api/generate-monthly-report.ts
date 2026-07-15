// api/generate-monthly-report.ts
//
// Laporan Bulanan (directive: penyelarasan visi funnel lengkap — "PDF hanya
// satu pas diawal... kecuali users minta laporan pdf perkembangan setiap
// bulan... Hanya berlaku di fitur platinum"). BEDA dari api/generate-report.ts
// (baseline, sekali di awal, dari wizard data): endpoint ini merangkai
// PERKEMBANGAN dari data yang SUDAH dihitung platform (Business Memory +
// business_monthly_snapshot, lihat services/businessOS/monthlySnapshot.ts) —
// TIDAK pernah menghitung ulang skor/statistik, Claude hanya menulis narasi
// konsultan di atas angka yang sudah pasti benar.
//
// Dipicu ON-REQUEST oleh pelanggan (tombol di Workspace), BUKAN otomatis
// terjadwal — sesuai instruksi eksplisit PO. Gating tier PLATINUM aktif
// dicek di server (bukan cuma disembunyikan di UI), sama seperti pola gating
// Chat Beemo di services/beemo/chat.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveMembership } from "../services/membership/getActiveMembership.js";
import { getBusinessMemory } from "../services/memory/getBusinessMemory.js";
import { buildMonthlySystemPrompt, MONTHLY_SCHEMA_DESCRIPTION } from "../report-engine/monthlyReportPrompt.js";
import { renderReportPdf } from "../report-engine/renderPdf.js";
import type { ReportData } from "../report-engine/types.js";
import { logClaudeUsage, extractUsage } from "../services/costTracking/logUsage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function buildUserPrompt(
  memory: NonNullable<Awaited<ReturnType<typeof getBusinessMemory>>>,
  snapshot: {
    period_start: string;
    period_end: string;
    targets_completed: number;
    decisions_made: number;
    score_delta: number | null;
    new_opportunities: number;
    new_risks: number;
  } | null,
  lang: "id" | "en"
): string {
  const L = lang === "id";
  const lines: string[] = [];

  lines.push(`${L ? "Nama bisnis" : "Business name"}: ${memory.profile.businessName}`);
  if (memory.profile.industry) lines.push(`${L ? "Jenis bisnis" : "Industry"}: ${memory.profile.industry}`);
  lines.push(`${L ? "Jenis perjalanan" : "Journey type"}: ${memory.profile.businessType}`);
  lines.push(`${L ? "Tahap rinci saat ini" : "Current detailed stage"}: ${memory.stageDetail}`);

  if (memory.baseline?.businessHealthScore != null) {
    lines.push(`${L ? "Business Score baseline (awal)" : "Baseline Business Score"}: ${memory.baseline.businessHealthScore}/100`);
  }
  if (memory.latestAnalysis?.businessHealthScore != null) {
    lines.push(`${L ? "Business Score saat ini" : "Current Business Score"}: ${memory.latestAnalysis.businessHealthScore}/100`);
  }
  if (memory.journey) {
    lines.push(
      `${L ? "Journey (baseline -> sekarang)" : "Journey (baseline -> now)"}: ${memory.journey.baselineScore} -> ${memory.journey.currentScore} (${memory.journey.delta >= 0 ? "+" : ""}${memory.journey.delta})`
    );
  }

  if (snapshot) {
    lines.push(
      L
        ? `Periode laporan ini: ${snapshot.period_start} s/d ${snapshot.period_end} (data DEFINITIF, jangan dihitung ulang):`
        : `This report's period: ${snapshot.period_start} to ${snapshot.period_end} (DEFINITIVE data, do not recompute):`
    );
    lines.push(`- ${L ? "Perubahan skor bulan ini" : "Score change this month"}: ${snapshot.score_delta ?? (L ? "tidak ada data" : "no data")}`);
    lines.push(`- ${L ? "Target selesai" : "Targets completed"}: ${snapshot.targets_completed}`);
    lines.push(`- ${L ? "Keputusan besar diambil" : "Major decisions made"}: ${snapshot.decisions_made}`);
    lines.push(`- ${L ? "Peluang baru terdeteksi" : "New opportunities detected"}: ${snapshot.new_opportunities}`);
    lines.push(`- ${L ? "Risiko baru terdeteksi" : "New risks detected"}: ${snapshot.new_risks}`);
  } else {
    lines.push(
      L
        ? "Belum ada snapshot bulanan tersimpan untuk periode ini — akui jujur data perkembangan kuantitatif belum cukup, fokus ke konteks kualitatif di bawah."
        : "No monthly snapshot stored for this period yet — honestly acknowledge quantitative progress data isn't sufficient, focus on the qualitative context below."
    );
  }

  if (memory.goals) lines.push(`${L ? "Target/harapan pelanggan" : "Customer's goals"}: ${memory.goals}`);
  if (memory.mainChallenges) lines.push(`${L ? "Tantangan utama" : "Main challenges"}: ${memory.mainChallenges}`);
  if (memory.targetThisMonth) lines.push(`${L ? "Target bulan ini" : "This month's target"}: ${memory.targetThisMonth}`);

  if (memory.recentDecisions.length > 0) {
    lines.push(L ? "Keputusan besar terbaru:" : "Recent major decisions:");
    memory.recentDecisions.forEach((d) => {
      lines.push(`- [${d.status}] ${d.question}${d.conclusion ? ` -> ${d.conclusion}` : ""}`);
    });
  }

  if (memory.competitorSummary) {
    lines.push(
      `${L ? "Kompetitor" : "Competitors"}: ${memory.competitorSummary.totalCompetitorsFound} ditemukan, posisi "${memory.competitorSummary.marketPosition}" — ${memory.competitorSummary.marketPositionReason}`
    );
  }

  if (memory.recentUpdates.length > 0) {
    lines.push(L ? "Business Update terbaru:" : "Recent business updates:");
    memory.recentUpdates.slice(0, 3).forEach((u) => lines.push(`- ${u.createdAt.slice(0, 10)}: ${u.content.slice(0, 200)}`));
  }

  lines.push("");
  lines.push(MONTHLY_SCHEMA_DESCRIPTION);
  lines.push("");
  lines.push(L ? "Susun Laporan Perkembangan Bulanan berdasarkan data DEFINITIF di atas." : "Compose the Monthly Progress Report based on the DEFINITIVE data above.");

  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return res.status(401).json({ error: "Sesi login tidak valid. Silakan login ulang." });
  }
  const userId = userData.user.id;

  const { businessProfileId, lang } = req.body || {};
  const activeLang: "id" | "en" = lang === "en" ? "en" : "id";
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return res.status(400).json({ error: "businessProfileId wajib diisi" });
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();
  if (bpError || !business || business.user_id !== userId) {
    return res.status(403).json({ error: "Business profile tidak valid untuk akun ini." });
  }

  // Gating server-side WAJIB — Laporan Bulanan eksklusif PLATINUM aktif,
  // bukan sekadar disembunyikan di tombol UI (sama prinsipnya dengan Chat
  // Beemo di services/beemo/chat.ts).
  const membership = await getActiveMembership(businessProfileId);
  if (membership.tier !== "platinum" || membership.status !== "active") {
    return res.status(403).json({
      error:
        activeLang === "en"
          ? "The Monthly Progress Report is exclusive to active PLATINUM customers."
          : "Laporan Perkembangan Bulanan khusus pelanggan PLATINUM yang aktif.",
    });
  }

  const memory = await getBusinessMemory(businessProfileId);
  if (!memory) {
    return res.status(500).json({ error: activeLang === "en" ? "Failed to load business context." : "Gagal memuat konteks bisnis." });
  }

  const { data: snapshotRow } = await supabase
    .from("business_monthly_snapshot")
    .select("period_start, period_end, targets_completed, decisions_made, score_delta, new_opportunities, new_risks")
    .eq("business_profile_id", businessProfileId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY belum diset di Vercel." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      system: buildMonthlySystemPrompt(activeLang),
      messages: [{ role: "user", content: buildUserPrompt(memory, snapshotRow ?? null, activeLang) }],
      // Riset Sungguhan: rekomendasi bulanan boleh mencari data terkini
      // (tenggat pajak, perpanjangan izin, dll) sebelum ditulis.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, lihat catatan sama
      // di services/beemo/chat.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any,
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda respons ke pengguna kalau lambat/gagal.
    const usage = extractUsage(message);
    void logClaudeUsage({ businessProfileId, action: "monthly_report", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    let cleaned = raw.replace(/```json|```/g, "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sama
    // seperti generate-report.ts, dipertahankan any supaya properti
    // aiContent.* di bawah tetap bisa dipakai langsung.
    let aiContent: any;
    try {
      aiContent = JSON.parse(cleaned);
    } catch (parseErr) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw parseErr;
      cleaned = jsonMatch[0];
      aiContent = JSON.parse(cleaned);
    }

    const today = new Date();
    const periodLabel = snapshotRow
      ? `${snapshotRow.period_start.slice(0, 7)}`
      : today.toISOString().slice(0, 7);

    const reportData: ReportData = {
      tier: "platinum",
      price: "Termasuk paket PLATINUM",
      tagline: "Laporan Perkembangan Bulanan — AI Consultant Mendalam",
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
        reportNo: `THV-MTH-${periodLabel.replace(/-/g, "")}`,
        date: today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        version: "1.0",
        industry: memory.profile.industry || "-",
        preparedBy: "Beemo AI — THE HIVE",
        businessScore: aiContent.coverBusinessScore,
        confidencePct: aiContent.coverConfidencePct,
        executiveRecommendation: aiContent.coverExecutiveRecommendation,
        snapshot: aiContent.coverSnapshot,
      },
      executiveSummary: aiContent.executiveSummary ?? undefined,
      sections: aiContent.sections,
      ceoRecommendation: aiContent.ceoRecommendation ?? undefined,
      appendix: aiContent.appendix ?? undefined,
    };

    const pdfBuffer = await renderReportPdf(reportData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="THE-HIVE-LAPORAN-BULANAN-${memory.profile.businessName}-${periodLabel}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("generate-monthly-report error:", err);
    return res.status(500).json({ error: activeLang === "en" ? "Failed to generate the report. Try again." : "Gagal membuat laporan. Coba lagi." });
  }
}
