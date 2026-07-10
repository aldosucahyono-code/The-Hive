// services/decision/listDecisions.ts
//
// Decision History — daftar keputusan yang pernah diajukan pemilik usaha ke
// Beemo (services/decision/proposeDecision.ts), dipakai Workspace untuk
// menampilkan riwayat, dan nanti PDF Baseline/Monthly Progress Report
// (belum dikerjakan) untuk merangkai tanpa menghitung ulang.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function listDecisions(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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
    .from("business_decisions")
    .select("id, question, goal, risk, opportunity, supporting_data, recommendation, conclusion, status, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("services/decision/listDecisions error:", error);
    return { status: 500, body: { error: "Gagal memuat riwayat keputusan." } };
  }

  return {
    status: 200,
    body: {
      decisions: (rows || []).map((r) => ({
        id: r.id,
        question: r.question,
        goal: r.goal,
        risk: r.risk,
        opportunity: r.opportunity,
        supportingData: r.supporting_data || [],
        recommendation: r.recommendation,
        conclusion: r.conclusion,
        status: r.status,
        createdAt: r.created_at,
      })),
    },
  };
}
