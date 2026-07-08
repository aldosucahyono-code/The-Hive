// services/workspace/getBusinessHealth.ts
//
// Membaca hasil perhitungan Business Health Engine (business_health) —
// murni baca data, tidak menghitung apapun di sini (perhitungan sudah
// dilakukan recalculateHealth.ts saat Business Update disimpan).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"] as const;

export async function getBusinessHealth(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
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

  const { data: rows, error } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });

  if (error) {
    console.error("services/workspace/getBusinessHealth error:", error);
    return { status: 500, body: { error: "Gagal memuat Business Health" } };
  }

  const latestByDimension: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows || []) {
    if (!seen.has(row.dimension)) {
      latestByDimension[row.dimension] = row.score;
      seen.add(row.dimension);
    }
  }

  if (seen.size === 0) {
    return { status: 200, body: { dimensions: null, overall: null } };
  }

  const scores = DIMENSIONS.map((d) => latestByDimension[d]).filter((s) => typeof s === "number");
  const overall = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  return {
    status: 200,
    body: {
      dimensions: latestByDimension,
      overall,
    },
  };
}
