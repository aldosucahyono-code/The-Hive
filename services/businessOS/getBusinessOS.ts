// services/businessOS/getBusinessOS.ts
//
// Business OS Engine (directive "CONTINUE — BUSINESS OS ENGINE"): satu
// service yang menggabungkan Today Snapshot + Weekly Review + Decision
// belum-selesai + Target minggu/bulan ini menjadi SATU object — "Business
// Daily Brief". Today Page (frontend) HANYA memanggil action ini dan HANYA
// merender — semua logic penggabungan ada di sini, bukan di React.
//
// PRINSIP:
// - TIDAK ADA logic evaluasi baru di file ini — murni membaca/menggabungkan
//   engine yang SUDAH ADA (Today Snapshot, Weekly Review, Decision Engine),
//   sama seperti Insight Formatter menggabungkan tanpa menghitung ulang.
// - Teks Mission/Prioritas/Why Card TETAP dikirim sebagai {key, params}
//   (i18n), BUKAN kalimat jadi dari backend — konsisten dengan pola seluruh
//   Workspace. Pengecualian HANYA untuk field bersumber Competitor Engine
//   (competitorOpportunity: title/reason/action/evidence) yang memang teks
//   bebas per-kompetitor (exception yang sudah dipakai sejak Living Business
//   Loop).
// - "Kalau tidak ada data, jangan membuat briefing": setiap field Daily
//   Brief JUJUR null kalau tidak ada sinyal nyata — tidak ada fallback teks
//   generik yang mengarang.

import { createClient } from "@supabase/supabase-js";
import { getTodaySnapshot } from "../today/computeSnapshot.js";
import { getWeeklyReviewInternal } from "./weeklyReview.js";
import { ensureMonthlySnapshot } from "./monthlySnapshot.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type ServiceResult = { status: number; body: Record<string, unknown> };
type RuleItem = { key: string; params?: Record<string, unknown>; whyKey?: string } | null;

export type BusinessDailyBrief = {
  stageGroup: string;
  stageDetail: string;
  focus: RuleItem; // "Fokus hari ini" + "Mengapa" (whyKey) — dari priorities[0]
  whatChanged: Array<{ dimension: string; delta: number }>; // "Yang berubah sejak kemarin"
  needsAttention: RuleItem; // topRisk — "Perlu perhatian"
  opportunity: {
    source: "competitor" | "internal";
    // competitor: title/reason/action/evidence teks bebas (exception).
    // internal: {key, params} i18n seperti biasa.
    competitor: { title: string; reason: string; action: string; evidence: string } | null;
    internal: RuleItem;
  };
  pendingDecision: { id: string; question: string; createdAt: string } | null; // "Keputusan belum selesai"
  targetThisWeek: string | null;
  targetThisMonth: string | null;
};

async function checkOwnership(businessProfileId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();
  return !!data && data.user_id === userId;
}

export async function getBusinessOS(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const todayResult = await getTodaySnapshot(userId, {
    businessProfileId,
    forceRecompute: payload.forceRecompute === true,
  });
  if (todayResult.status !== 200) {
    return todayResult;
  }
  const snapshot = todayResult.body.snapshot as Record<string, unknown>;

  // Persist-only Monthly Snapshot — jalan di background setiap kali Business
  // OS dibaca, non-fatal (§ directive: "snapshot bulanan harus sudah
  // disimpan" walau belum ada UI-nya).
  ensureMonthlySnapshot(businessProfileId).catch((err) => {
    console.error("getBusinessOS: ensureMonthlySnapshot gagal:", err);
  });

  const [weeklyReview, pendingDecisionRows] = await Promise.all([
    getWeeklyReviewInternal(businessProfileId, payload.forceRecompute === true).catch((err) => {
      console.error("getBusinessOS: getWeeklyReviewInternal gagal:", err);
      return null;
    }),
    supabase
      .from("business_decisions")
      .select("id, question, created_at")
      .eq("business_profile_id", businessProfileId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const pendingDecisionRow = pendingDecisionRows.data?.[0] || null;

  const priorities = (snapshot.priorities as RuleItem[]) || [];
  const focus = priorities[0] || null;
  const competitorOpportunity =
    (snapshot.competitorOpportunity as BusinessDailyBrief["opportunity"]["competitor"]) || null;
  const internalOpportunity = (snapshot.opportunity as RuleItem) || null;

  const dailyBrief: BusinessDailyBrief = {
    stageGroup: snapshot.stageGroup as string,
    stageDetail: snapshot.stageDetail as string,
    focus,
    whatChanged: (snapshot.whatChanged as Array<{ dimension: string; delta: number }>) || [],
    needsAttention: (snapshot.topRisk as RuleItem) || null,
    opportunity: {
      // Business OS mengutamakan peluang bersumber Competitor Engine (sesuai
      // contoh PO: "Kompetitor baru belum memiliki Google Business") — jatuh
      // ke peluang internal (dimensi Business Health terlemah) kalau belum
      // ada snapshot kompetitor.
      source: competitorOpportunity ? "competitor" : "internal",
      competitor: competitorOpportunity,
      internal: competitorOpportunity ? null : internalOpportunity,
    },
    pendingDecision: pendingDecisionRow
      ? { id: pendingDecisionRow.id as string, question: pendingDecisionRow.question as string, createdAt: pendingDecisionRow.created_at as string }
      : null,
    targetThisWeek: (snapshot.targetThisWeek as string) || null,
    targetThisMonth: (snapshot.targetThisMonth as string) || null,
  };

  return {
    status: 200,
    body: {
      snapshot,
      dailyBrief,
      weeklyReview,
    },
  };
}
