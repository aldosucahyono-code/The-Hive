// services/costTracking/logUsage.ts
//
// Pencatatan biaya AI SUNGGUHAN per panggilan -- dipanggil dari SEMUA titik
// panggilan Claude/Apify di codebase ini (lihat daftar lengkap di
// services/costTracking/pricing.ts dan setiap file pemanggil). SELALU
// best-effort: gagal mencatat biaya TIDAK BOLEH menggagalkan fitur yang
// sebenarnya (chat/laporan/dst) -- caller tidak perlu await hasilnya kalau
// tidak mau menunda respons ke pengguna (fire-and-forget aman, kegagalan
// cuma masuk console.error).
//
// businessProfileId nullable: sejumlah panggilan terjadi SEBELUM akun ada
// (preview gratis, validasi wizard) -- tetap dicatat (biaya nyata
// dikeluarkan) dengan email kalau ada, atau benar-benar anonim kalau tidak.

import { createClient } from "@supabase/supabase-js";
import { calcClaudeCostUsd, calcApifyCostUsd } from "./pricing.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type ClaudeUsageParams = {
  businessProfileId?: string | null;
  email?: string | null;
  action: string; // label singkat: "chat", "final_report", "lead_referrals", dst
  model: string;
  inputTokens: number;
  outputTokens: number;
  webSearches?: number;
};

export async function logClaudeUsage(params: ClaudeUsageParams): Promise<void> {
  try {
    const costUsd = calcClaudeCostUsd(params.model, params.inputTokens, params.outputTokens, params.webSearches || 0);
    if (costUsd == null) {
      console.error(`logClaudeUsage: model tidak dikenal di pricing table: ${params.model}`);
      return;
    }
    const { error } = await supabase.from("ai_usage_log").insert({
      business_profile_id: params.businessProfileId || null,
      email: params.email || null,
      service: "claude",
      action: params.action,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      web_searches: params.webSearches || 0,
      cost_usd: costUsd,
    });
    if (error) console.error("logClaudeUsage insert error:", error);
  } catch (err) {
    console.error("logClaudeUsage exception:", err);
  }
}

/** Ekstrak input/output tokens + jumlah web search dari response Anthropic
 * SDK apa adanya -- dibungkus di sini supaya seluruh 10 titik panggilan
 * TIDAK PERLU masing-masing menulis `as any` sendiri (versi SDK terpasang,
 * 0.32.1, belum punya tipe untuk server_tool_use di response.usage walau
 * API sungguhan sudah mengembalikan field itu). Mengembalikan 0 web search
 * kalau field tidak ada (aman, model tanpa tools memang selalu 0). */
export function extractUsage(response: unknown): { inputTokens: number; outputTokens: number; webSearches: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lihat catatan di atas
  const usage = (response as any)?.usage;
  return {
    inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
    outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
    webSearches: typeof usage?.server_tool_use?.web_search_requests === "number" ? usage.server_tool_use.web_search_requests : 0,
  };
}

export type ApifyUsageParams = {
  businessProfileId?: string | null;
  action: string; // "competitor_social_search" dst
  events: number;
};

export async function logApifyUsage(params: ApifyUsageParams): Promise<void> {
  try {
    const costUsd = calcApifyCostUsd(params.events);
    const { error } = await supabase.from("ai_usage_log").insert({
      business_profile_id: params.businessProfileId || null,
      service: "apify",
      action: params.action,
      apify_events: params.events,
      cost_usd: costUsd,
    });
    if (error) console.error("logApifyUsage insert error:", error);
  } catch (err) {
    console.error("logApifyUsage exception:", err);
  }
}
