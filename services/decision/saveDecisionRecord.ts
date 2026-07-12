// services/decision/saveDecisionRecord.ts
//
// Satu tempat untuk menyimpan hasil Decision Engine ke business_decisions +
// menaikkan kuota (decision_count) — dipakai DUA jalur yang sekarang
// keduanya berujung ke Decision Journal (revisi Juli 2026, "chat mendeteksi
// otomatis + jalankan analisis mendalam"):
// 1. Auto-detect dari Chat Beemo (services/beemo/chat.ts) — Beemo sendiri
//    yang mendeteksi pertanyaan sebagai keputusan besar di TENGAH percakapan
//    biasa (lihat parseDecisionBlock di chat.ts), tidak ada form terpisah.
// 2. services/decision/proposeDecision.ts — jalur Claude terpisah dengan
//    output JSON penuh, dipertahankan sebagai kemampuan backend meski form
//    manualnya sudah dihapus dari UI (lihat DecisionJournalList di
//    Workspace.tsx, sekarang murni riwayat).
//
// SATU logika insert+kuota di sini supaya kedua jalur tidak pernah berbeda
// (mis. lupa naikkan counter di salah satu jalur).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Tier Usage Quota — jumlah keputusan tersimpan per periode akses. Decision
// Journal eksklusif PLATINUM (audit Juli 2026), tapi tipe tetap mencakup
// "pro" supaya konsisten dipakai di tempat yang butuh Record lengkap per
// tier tanpa cabang khusus.
export const DECISION_QUOTA: Record<"pro" | "platinum", number> = { pro: 3, platinum: 15 };

export type DecisionRecord = {
  id: string | null;
  question: string;
  goal: string;
  risk: string;
  opportunity: string;
  supportingData: string[];
  recommendation: string;
  conclusion: string;
  status: string;
  createdAt: string;
};

export async function saveDecisionRecord(params: {
  businessProfileId: string;
  question: string;
  goal: string;
  risk: string;
  opportunity: string;
  supportingData: string[];
  recommendation: string;
  conclusion: string;
  subscriptionId: string | null;
  currentDecisionCount: number;
}): Promise<{ decision: DecisionRecord; newCount: number }> {
  const {
    businessProfileId,
    question,
    goal,
    risk,
    opportunity,
    supportingData,
    recommendation,
    conclusion,
    subscriptionId,
    currentDecisionCount,
  } = params;

  const { data: saved, error: insertError } = await supabase
    .from("business_decisions")
    .insert({
      business_profile_id: businessProfileId,
      question,
      goal: goal || null,
      risk: risk || null,
      opportunity: opportunity || null,
      supporting_data: supportingData || [],
      recommendation: recommendation || null,
      conclusion: conclusion || null,
    })
    .select("id, question, goal, risk, opportunity, supporting_data, recommendation, conclusion, status, created_at")
    .single();

  // Naikkan kuota SETELAH analisa berhasil dibuat (baik tersimpan ke
  // Decision History atau tidak) — gagal increment tidak menggagalkan hasil
  // yang sudah diberikan ke pengguna, sama prinsipnya dengan
  // chat_message_count di services/beemo/chat.ts.
  let newCount = currentDecisionCount;
  if (subscriptionId) {
    newCount = currentDecisionCount + 1;
    const { error: quotaError } = await supabase
      .from("subscriptions")
      .update({ decision_count: newCount })
      .eq("id", subscriptionId);
    if (quotaError) {
      console.error("saveDecisionRecord: gagal update decision_count:", quotaError);
    }
  }

  if (insertError || !saved) {
    console.error("saveDecisionRecord: gagal menyimpan Decision Journal:", insertError);
    return {
      decision: {
        id: null,
        question,
        goal,
        risk,
        opportunity,
        supportingData,
        recommendation,
        conclusion,
        status: "open",
        createdAt: new Date().toISOString(),
      },
      newCount,
    };
  }

  return {
    decision: {
      id: saved.id,
      question: saved.question,
      goal: saved.goal,
      risk: saved.risk,
      opportunity: saved.opportunity,
      supportingData: saved.supporting_data || [],
      recommendation: saved.recommendation,
      conclusion: saved.conclusion,
      status: saved.status,
      createdAt: saved.created_at,
    },
    newCount,
  };
}
