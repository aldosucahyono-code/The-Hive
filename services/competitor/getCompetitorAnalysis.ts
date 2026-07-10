// services/competitor/getCompetitorAnalysis.ts
//
// API-facing entrypoint untuk seluruh pipeline Competitor Engine (dipanggil
// dari api/workspace.ts action "getCompetitorAnalysis"). Ini satu-satunya
// file di folder services/competitor/ yang melakukan ownership check +
// format ServiceResult — sub-modul lain (engine/, opportunity/,
// recommendation/, provider/, normalizer/, cache/, types/) tetap murni
// logic, tidak tahu soal HTTP/auth, supaya bisa dipakai ulang oleh PDF
// Baseline nanti tanpa duplikasi.
//
// Pipeline lengkap:
//   runCompetitorEngine (provider -> normalizer -> engine, dengan cache)
//   -> competitorResultToMarketSignals (decoupling adapter)
//   -> generateOpportunities
//   -> getBusinessMemory (SATU-SATUNYA sumber context, tidak query ulang)
//   -> generateRecommendations
//
// Tier-aware (siap untuk gating nanti, belum diaktifkan): Competitor Engine
// penuh untuk Pro/Platinum; Free tetap diblok di lapisan Workspace (UpgradeLockCard),
// sama seperti pola tier gating yang sudah ada di semua panel lain.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { runCompetitorEngine } from "./engine/index.js";
import { competitorResultToMarketSignals } from "./opportunity/marketSignals.js";
import { generateOpportunities } from "./opportunity/index.js";
import { generateRecommendations } from "./recommendation/index.js";
import { getBusinessMemory } from "../memory/getBusinessMemory.js";
import { formatCompetitorInsights } from "./insightFormatter/index.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getCompetitorAnalysis(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  const forceRefresh = payload.forceRefresh === true;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const engineResult = await runCompetitorEngine(businessProfileId, { forceRefresh });
  if ("error" in engineResult) {
    return { status: 422, body: { error: engineResult.error } };
  }

  const signals = competitorResultToMarketSignals(engineResult);
  const opportunities = generateOpportunities(signals);

  const memory = await getBusinessMemory(businessProfileId);
  const recommendations = memory ? generateRecommendations(memory, opportunities) : [];

  // Insight Formatter (Master Product Completion Directive, Launch Sprint):
  // Workspace TIDAK LAGI menampilkan object teknis mentah sebagai bahasa
  // utama — insights[] di bawah ini adalah kalimat siap-tampil untuk pemilik
  // usaha. competitor/opportunities/recommendations tetap dikirim (dipakai
  // sebagai "Lihat Data Pendukung"/evidence detail di Workspace, dan tetap
  // jadi sumber untuk Chat Beemo/PDF Baseline nanti) — tidak dihapus, hanya
  // tidak lagi jadi tampilan utama.
  const insights = formatCompetitorInsights(engineResult, opportunities, recommendations, lang);

  return {
    status: 200,
    body: {
      competitor: engineResult,
      opportunities,
      recommendations,
      insights,
    },
  };
}
