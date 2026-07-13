// services/memory/getBusinessMemory.ts
//
// Business Memory (Master Product Directive — Phase 1): SATU-SATUNYA tempat
// yang merangkai seluruh konteks bisnis pelanggan jadi satu objek. Ini BUKAN
// sumber data baru — setiap field di sini dibaca dari tabel yang SUDAH ADA
// (business_profiles, analyses, business_updates, business_achievements,
// progress_snapshots, subscriptions lewat getActiveMembership) ditambah satu
// tabel baru business_memory_facts (fakta yang tidak punya rumah di field
// terstruktur manapun, lihat migrations/2026-07-10_business_memory.sql).
//
// Dipakai oleh:
// - services/beemo/chat.ts — supaya Chat Beemo menjawab berdasarkan konteks
//   penuh (Discovery/Update/Journey/Achievement/Target/Workspace), bukan
//   cuma nama+industri+skor terakhir seperti sebelumnya.
// - Engine berikutnya (Competitor/Opportunity/Recommendation, Tahap
//   berikutnya dari Master Product Directive) akan memanggil fungsi yang
//   sama ini, BUKAN menulis ulang query agregasinya sendiri — supaya tidak
//   ada dua definisi "apa yang diketahui platform soal bisnis ini" yang
//   berbeda.
//
// PENTING soal data honesty: fungsi ini TIDAK menghitung ulang skor/insight
// apapun (semua angka datang langsung dari tabel sumbernya), dan
// business_memory_facts yang diikutkan HANYA yang status='approved' —
// fakta yang masih 'pending_approval' tidak pernah dianggap benar sampai
// pemilik bisnis menyetujuinya (lihat approveMemoryFact.ts).
//
// BUSINESS CONTEXT (directive "Business Discovery & Dual Workspace"): objek
// yang dikembalikan fungsi ini ADALAH "Business Context" yang diminta — satu
// sumber yang dibaca SELURUH platform (Workspace, Chat Beemo, Engine, PDF)
// untuk mengambil keputusan. TIDAK dibuat objek/tabel terpisah bernama
// "Business Context" supaya tidak ada dua sumber kebenaran — field
// `businessType`/`goals`/`mainChallenges` di bawah ini HANYA menambah ke
// objek yang sudah ada, bukan membuat konsep baru yang bersaing.
//
// businessType ("start" | "grow") adalah SATU FIELD, SATU STATUS yang
// ditentukan sekali saat Business Discovery (lihat business_profiles.business_type,
// migrations/2026-07-10_business_type.sql) dan dibaca di sini sebagai
// SUMBER UTAMA. Baris lama yang belum punya nilai ini (pelanggan sebelum
// migrasi) di-derive dari business_stage sebagai fallback jujur — bukan
// ditebak sebagai fakta baru, hanya supaya pelanggan lama tidak mendapat
// Workspace yang rusak/kosong.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type BusinessMemoryContext = {
  businessProfileId: string;
  profile: {
    businessName: string;
    industry: string | null;
    businessStage: string;
    businessType: "start" | "grow";
    location: string | null;
    // Peran pengguna di bisnisnya sendiri (field "profesi" dari Chat Wizard,
    // mis. "Owner", "Manager Operasional", "Supervisor Toko") — diambil dari
    // analyses.raw_input persis seperti `location` di atas. Arahan pemilik
    // produk Juli 2026: field ini SEBELUMNYA dikumpulkan tapi tidak pernah
    // dipakai. Sekarang dibaca di sini (SATU sumber, dipakai bersama oleh
    // Chat Beemo/Decision Engine/Final Report) supaya saran yang diberikan
    // disesuaikan dengan wewenang sebenarnya dari orang yang chat — kalau
    // dia Manager/Supervisor (bukan pemilik), saran perlu dibingkai sebagai
    // "sampaikan ke Owner-mu begini..." bukan seolah dia sendiri yang
    // memutuskan. Lihat roleAwareAdviceLine() di services/beemo/chat.ts.
    userRole: string | null;
  };
  goals: string | null;
  mainChallenges: string | null;
  membership: {
    tier: "free" | "pro" | "platinum";
    status: "active" | "expired" | "free";
  };
  baseline: {
    summary: string | null;
    businessHealthScore: number | null;
    strengths: string | null;
    improvements: string | null;
    opportunity: string | null;
    createdAt: string;
  } | null;
  latestAnalysis: {
    summary: string | null;
    businessHealthScore: number | null;
    createdAt: string;
  } | null;
  journey: {
    baselineScore: number;
    currentScore: number;
    delta: number;
  } | null;
  period: {
    previousScore: number;
    currentScore: number;
    delta: number;
  } | null;
  recentUpdates: Array<{
    content: string;
    kondisiPenjualan: string | null;
    createdAt: string;
    category: string | null;
    severity: string | null;
  }>;
  // Business Update Engine: ringkasan klasifikasi update TERAKHIR saja
  // (bukan menghitung ulang — murni membaca category/severity yang sudah
  // disimpan services/updateEngine/classify.ts saat submitUpdate). Dipakai
  // Chat Beemo supaya langsung tahu "ada apa" tanpa membaca seluruh
  // recentUpdates satu per satu.
  latestUpdateInsight: { category: string; severity: string } | null;
  achievementsUnlockedCount: number;
  latestAchievementTitle: string | null;
  approvedFacts: Array<{
    factKey: string;
    factValue: unknown;
    approvedAt: string | null;
  }>;
  competitorSummary: {
    totalCompetitorsFound: number;
    marketPosition: string;
    marketPositionReason: string;
    dataSource: string;
    fetchedAt: string;
  } | null;
  // Living Business Loop (directive "CONTINUE — LIVING BUSINESS LOOP"):
  // stageDetail granular (11 langkah start / 6 langkah grow) dari Stage
  // Engine — dibaca di sini (bukan dihitung ulang) supaya Chat/Recommendation/
  // Mission semuanya melihat stage yang SAMA persis dengan yang tampil di
  // Workspace, bukan versi kedua yang bisa berbeda.
  stageDetail: string;
  // Decision Memory: keputusan besar yang pernah diajukan ke Decision Engine
  // (services/decision/proposeDecision.ts) masuk ke Business Context supaya
  // Recommendation/Mission/Chat tahu keputusan apa yang sedang/sudah diambil
  // pemilik bisnis — bukan cuma tersimpan sendirian di Decision History.
  recentDecisions: Array<{
    question: string;
    recommendation: string | null;
    conclusion: string | null;
    status: string;
    createdAt: string;
  }>;
  // Business OS (directive "CONTINUE — BUSINESS OS ENGINE"): sebelumnya
  // `goals` mencampur target minggu ini (dari Business Update terbaru) dan
  // aspirasi awal dari Business Discovery lewat satu rantai fallback —
  // cukup untuk Chat, tapi Business Daily Brief butuh keduanya terpisah
  // ("Target minggu ini" vs "Target bulan ini"), jadi ditambah di sini
  // sebagai field baru, BUKAN mengganti `goals` (masih dipakai Chat apa
  // adanya supaya tidak ada regresi).
  targetThisWeek: string | null;
  targetThisMonth: string | null;
};

/** Merangkai Business Memory untuk satu business_profile. Tidak melakukan
 * pengecekan kepemilikan (ownership check) sendiri — caller (service lain
 * yang sudah memverifikasi userId/businessProfileId) bertanggung jawab atas
 * itu, supaya fungsi ini tetap murni "baca & rangkai", tidak menduplikasi
 * logic otorisasi yang sudah ada di setiap service pemanggil. */
export async function getBusinessMemory(businessProfileId: string): Promise<BusinessMemoryContext | null> {
  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, business_name, industry, business_stage, business_type")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business) {
    console.error("getBusinessMemory: business_profiles error:", bpError);
    return null;
  }

  // Fallback jujur untuk baris lama tanpa business_type (lihat catatan di
  // header file) — TIDAK menulis balik ke database di sini, hanya dipakai
  // saat membaca supaya pelanggan lama tidak mendapat Workspace kosong.
  const businessType: "start" | "grow" =
    business.business_type === "start" || business.business_type === "grow"
      ? business.business_type
      : business.business_stage === "idea" || business.business_stage === "starting"
        ? "start"
        : "grow";

  const { getActiveMembership } = await import("../membership/getActiveMembership.js");
  const membership = await getActiveMembership(businessProfileId);

  const { data: analyses } = await supabase
    .from("analyses")
    .select("ai_output, raw_input, is_baseline, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(20);

  const analysisRows = analyses || [];
  const rowWithLocation = analysisRows.find((a) => (a.raw_input as Record<string, unknown> | null)?.lokasi);
  const location = ((rowWithLocation?.raw_input as Record<string, unknown> | undefined)?.lokasi as string) || null;
  // userRole ("profesi" di Chat Wizard) — pola pengambilan sama seperti
  // location tepat di atas. Lihat komentar lengkap di BusinessMemoryContext.
  const rowWithProfesi = analysisRows.find((a) => (a.raw_input as Record<string, unknown> | null)?.profesi);
  const userRole = ((rowWithProfesi?.raw_input as Record<string, unknown> | undefined)?.profesi as string) || null;
  // Harapan/kekhawatiran dari Business Discovery (raw_input.target/tantangan)
  // — dipakai sebagai FALLBACK. Sumber utama tetap Business Update terbaru
  // (lihat blok business_updates di bawah), karena harapan/kekhawatiran bisa
  // berubah seiring bisnis berjalan — bukan cuma sekali di awal.
  const rowWithGoals = analysisRows.find((a) => (a.raw_input as Record<string, unknown> | null)?.target);
  const discoveryGoals = ((rowWithGoals?.raw_input as Record<string, unknown> | undefined)?.target as string) || null;
  const rowWithChallenges = analysisRows.find((a) => (a.raw_input as Record<string, unknown> | null)?.tantangan);
  const discoveryChallenges =
    ((rowWithChallenges?.raw_input as Record<string, unknown> | undefined)?.tantangan as string) || null;
  const baselineRow = analysisRows.find((a) => a.is_baseline) || analysisRows[analysisRows.length - 1] || null;
  const latestRow = analysisRows[0] || null;

  const baseline = baselineRow
    ? {
        summary: (baselineRow.ai_output?.summary as string) || null,
        businessHealthScore: (baselineRow.ai_output?.businessHealthScore as number) || null,
        strengths: (baselineRow.ai_output?.strengths as string) || null,
        improvements: (baselineRow.ai_output?.improvements as string) || null,
        opportunity: (baselineRow.ai_output?.opportunity as string) || null,
        createdAt: baselineRow.created_at,
      }
    : null;

  const latestAnalysis = latestRow
    ? {
        summary: (latestRow.ai_output?.summary as string) || null,
        businessHealthScore: (latestRow.ai_output?.businessHealthScore as number) || null,
        createdAt: latestRow.created_at,
      }
    : null;

  const { data: snapshots } = await supabase
    .from("progress_snapshots")
    .select("period_start, business_score")
    .eq("business_profile_id", businessProfileId)
    .order("period_start", { ascending: true });

  let journey: BusinessMemoryContext["journey"] = null;
  let period: BusinessMemoryContext["period"] = null;
  if (snapshots && snapshots.length > 0) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
    journey = { baselineScore: first.business_score, currentScore: last.business_score, delta: last.business_score - first.business_score };
    period = prev
      ? { previousScore: prev.business_score, currentScore: last.business_score, delta: last.business_score - prev.business_score }
      : null;
  }

  const { data: updateRows } = await supabase
    .from("business_updates")
    .select("content, kondisi_penjualan, tantangan, target_depan, category, severity, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentUpdates = (updateRows || []).map((u) => ({
    content: u.content,
    kondisiPenjualan: u.kondisi_penjualan,
    createdAt: u.created_at,
    category: u.category ?? null,
    severity: u.severity ?? null,
  }));

  const latestUpdateInsight =
    updateRows && updateRows[0] && updateRows[0].category && updateRows[0].severity
      ? { category: updateRows[0].category as string, severity: updateRows[0].severity as string }
      : null;

  // Goals/mainChallenges (Business Context): utamakan Business Update
  // TERBARU (harapan/kekhawatiran memang bisa berubah seiring bisnis
  // berjalan) — baru jatuh ke jawaban Business Discovery awal kalau belum
  // pernah ada Business Update sama sekali.
  const latestUpdateWithChallenge = (updateRows || []).find((u) => u.tantangan);
  const latestUpdateWithGoal = (updateRows || []).find((u) => u.target_depan);
  const mainChallenges = latestUpdateWithChallenge?.tantangan || discoveryChallenges;
  const goals = latestUpdateWithGoal?.target_depan || discoveryGoals;

  const { data: achievementRows } = await supabase
    .from("business_achievements")
    .select("unlocked_at, achievement_definitions(title_id)")
    .eq("business_profile_id", businessProfileId)
    .order("unlocked_at", { ascending: false });

  const achievementsUnlockedCount = achievementRows?.length || 0;
  const latestAchievementDef = achievementRows?.[0]?.achievement_definitions;
  const latestAchievementTitle = Array.isArray(latestAchievementDef)
    ? latestAchievementDef[0]?.title_id || null
    : (latestAchievementDef as unknown as { title_id?: string } | null | undefined)?.title_id || null;

  const { data: factRows } = await supabase
    .from("business_memory_facts")
    .select("fact_key, fact_value, approved_at")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  const approvedFacts = (factRows || []).map((f) => ({
    factKey: f.fact_key,
    factValue: f.fact_value,
    approvedAt: f.approved_at,
  }));

  // Ringkasan kompetitor: baca LANGSUNG snapshot terakhir yang sudah dihitung
  // Competitor Engine (services/competitor/engine + cache) — tidak pernah
  // memanggil provider/engine dari sini. Ini murni pembacaan hasil yang
  // sudah ada, sesuai prinsip "jangan membuat memory kedua, jangan
  // menduplikasi data": Business Memory hanya merangkai apa yang sudah
  // dihitung engine lain, tidak menghitung ulang.
  const { data: competitorSnapshotRow } = await supabase
    .from("competitor_snapshots")
    .select("result, fetched_at")
    .eq("business_profile_id", businessProfileId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const competitorSummary = competitorSnapshotRow
    ? (() => {
        const r = competitorSnapshotRow.result as {
          marketSummary?: { totalCompetitorsFound?: number };
          marketPosition?: string;
          marketPositionReason?: string;
          dataSource?: string;
        };
        return {
          totalCompetitorsFound: r.marketSummary?.totalCompetitorsFound ?? 0,
          marketPosition: r.marketPosition ?? "unknown",
          marketPositionReason: r.marketPositionReason ?? "",
          dataSource: r.dataSource ?? "unknown",
          fetchedAt: competitorSnapshotRow.fetched_at,
        };
      })()
    : null;

  // Living Business Loop: stageDetail dibaca lewat Stage Engine yang sama
  // dipakai Today (services/stage/determineStage.ts) — signal overallScore
  // diambil langsung dari business_health (query ringkas, sama seperti
  // getBusinessHealth.ts) karena getBusinessMemory tidak punya userId untuk
  // memanggil service itu lewat ownership check-nya sendiri. Ini konsisten
  // dengan pola yang SUDAH ADA di fungsi ini (journey/period juga dihitung
  // dengan query langsung ke progress_snapshots, bukan memanggil getProgress).
  const HEALTH_DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"];
  const { data: healthRows } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });

  let overallScore: number | null = null;
  if (healthRows && healthRows.length > 0) {
    const latestByDimension: Record<string, number> = {};
    const seen = new Set<string>();
    for (const row of healthRows) {
      if (!seen.has(row.dimension)) {
        latestByDimension[row.dimension] = row.score;
        seen.add(row.dimension);
      }
    }
    const scores = HEALTH_DIMENSIONS.map((d) => latestByDimension[d]).filter((s) => typeof s === "number");
    if (scores.length > 0) overallScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }

  const { determineStageInternal } = await import("../stage/determineStage.js");
  const stage = await determineStageInternal(businessProfileId, {
    overallScore,
    journeyDelta: journey?.delta ?? null,
    achievementsUnlockedCount,
  });

  const { data: decisionRows } = await supabase
    .from("business_decisions")
    .select("question, recommendation, conclusion, status, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentDecisions = (decisionRows || []).map((d) => ({
    question: d.question as string,
    recommendation: (d.recommendation as string) || null,
    conclusion: (d.conclusion as string) || null,
    status: d.status as string,
    createdAt: d.created_at as string,
  }));

  return {
    businessProfileId,
    profile: {
      businessName: business.business_name,
      industry: business.industry,
      businessStage: business.business_stage,
      businessType,
      location,
      userRole,
    },
    goals,
    mainChallenges,
    membership: { tier: membership.tier, status: membership.status },
    baseline,
    latestAnalysis,
    journey,
    period,
    recentUpdates,
    latestUpdateInsight,
    achievementsUnlockedCount,
    latestAchievementTitle,
    approvedFacts,
    competitorSummary,
    stageDetail: stage.stageDetail,
    recentDecisions,
    targetThisWeek: latestUpdateWithGoal?.target_depan || null,
    targetThisMonth: discoveryGoals,
  };
}
