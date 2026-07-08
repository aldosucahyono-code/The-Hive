// services/business/saveAnalysis.ts
//
// Business logic untuk action "saveAnalysis" — menyimpan hasil preview
// analisa awal (dari generate-preview) ke tabel analyses untuk sebuah
// business_profile yang sudah ada (bukan lewat wizard_drafts/promote-draft,
// karena user sudah login saat ini dipanggil dari Workspace).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./create";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function saveBusinessAnalysis(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !businessProfile || businessProfile.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .insert({
      business_profile_id: businessProfileId,
      raw_input: payload.wizardData || null,
      ai_output: payload.preview || null,
    })
    .select("id")
    .single();

  if (analysisError || !analysis) {
    console.error("services/business/saveAnalysis error:", analysisError);
    return { status: 500, body: { error: "Gagal menyimpan hasil analisa" } };
  }

  return { status: 200, body: { analysisId: analysis.id } };
}
