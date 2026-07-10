// services/businessOS/competitorSignal.ts
//
// Business OS Engine (directive "CONTINUE — BUSINESS OS ENGINE"): Business
// Daily Brief butuh "Peluang" yang bersumber dari Competitor Engine (contoh
// PO: "Kompetitor baru belum memiliki Google Business"), bukan cuma dari
// dimensi Business Health terlemah seperti sebelumnya.
//
// PRINSIP KETAT:
// - Murni BACA competitor_snapshots yang sudah ada (cache Competitor Engine,
//   TTL 7 hari) — TIDAK PERNAH memanggil provider/engine dari sini. Kalau
//   snapshot belum ada, jujur kembalikan null (bukan menebak).
// - Reuse Opportunity Engine (generateOpportunities) dan Insight Formatter
//   (opportunityHeadline via formatCompetitorInsights) yang SUDAH ADA — tidak
//   menulis ulang logic peluang kedua kalinya.
// - "Kompetitor baru muncul": competitor_snapshots adalah tabel INSERT-ONLY
//   (riwayat, bukan overwrite) — jadi mendeteksi kompetitor baru cukup
//   membandingkan nama di snapshot TERBARU vs snapshot SEBELUM itu, tanpa
//   tabel/kolom baru.

import { createClient } from "@supabase/supabase-js";
import type { CompetitorEngineResult } from "../competitor/types/index.js";
import { competitorResultToMarketSignals } from "../competitor/opportunity/marketSignals.js";
import { generateOpportunities } from "../competitor/opportunity/index.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type CompetitorOpportunitySignal = {
  title: string;
  reason: string;
  action: string;
  evidence: string;
} | null;

export type NewCompetitorSignal = { name: string } | null;

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function getCompetitorOpportunitySignal(businessProfileId: string): Promise<CompetitorOpportunitySignal> {
  const { data } = await supabase
    .from("competitor_snapshots")
    .select("result")
    .eq("business_profile_id", businessProfileId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const result = data.result as CompetitorEngineResult;
  const signals = competitorResultToMarketSignals(result);
  const opportunities = generateOpportunities(signals);
  if (opportunities.length === 0) return null;

  const sorted = [...opportunities].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );
  const top = sorted[0];

  return {
    title: top.title,
    reason: `${top.businessValue} ${top.reason}`.trim(),
    action: top.action,
    evidence: top.evidence,
  };
}

export async function getNewCompetitorSignal(businessProfileId: string): Promise<NewCompetitorSignal> {
  const { data: rows } = await supabase
    .from("competitor_snapshots")
    .select("result, fetched_at")
    .eq("business_profile_id", businessProfileId)
    .order("fetched_at", { ascending: false })
    .limit(2);

  if (!rows || rows.length < 2) return null; // belum ada snapshot pembanding -- jujur, tidak menebak

  const latest = rows[0].result as CompetitorEngineResult;
  const previous = rows[1].result as CompetitorEngineResult;

  const previousNames = new Set(previous.competitors.map((c) => c.name.trim().toLowerCase()));
  const newOne = latest.competitors.find((c) => !previousNames.has(c.name.trim().toLowerCase()));

  return newOne ? { name: newOne.name } : null;
}
