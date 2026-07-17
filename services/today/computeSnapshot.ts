// services/today/computeSnapshot.ts
//
// Today Engine (Fase 1 — lihat THE-HIVE-BUSINESS-COMMAND-CENTER-ARCHITECTURE.md
// §4). Layer BARU di atas Business Engine — menggabungkan Business Stage
// Engine + fakta Business Engine yang sudah ada jadi satu payload ringkas
// (TodaySnapshot), di-cache 1x per bisnis per hari di tabel today_snapshot.
//
// PRINSIP KETAT (tidak boleh dilanggar):
//   1. Tidak menghitung ulang apapun yang sudah dihitung Business Engine —
//      overall score, journey/period delta semua dibaca lewat service yang
//      SUDAH ADA (getBusinessHealth, getProgress, getHealthTrend), dipanggil
//      langsung sebagai fungsi (in-process), bukan lewat HTTP.
//   2. Payload yang disimpan HANYA data terstruktur (angka, enum, key) — TIDAK
//      ada teks/kalimat yang sudah dirangkai. Ini sengaja meniru pola yang
//      sudah dipakai BusinessScorePanel (statusLabel dihitung dari skor lewat
//      kunci i18n saat render, bukan disimpan sebagai teks beku) — supaya
//      ganti bahasa ID/EN tidak butuh recompute snapshot.
//   3. Fase 1 TIDAK memanggil Claude API sama sekali (sesuai roadmap §15
//      Fase 1: "tanpa AI insight, cuma Business Pulse ambang sederhana").
//      Beemo Insight generatif menyusul Fase 8, membaca payload yang sama.
//
// Cache: 1 baris per bisnis per snapshot_date (constraint unique di migrasi).
// Dihitung ulang kalau: belum ada snapshot hari ini, ATAU dipanggil dengan
// forceRecompute=true (dipakai submitUpdate.ts nanti untuk invalidasi
// event-driven — BELUM disambungkan di Fase 1, lihat catatan di bagian
// bawah file ini).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getBusinessHealth } from "../workspace/getBusinessHealth.js";
import { getProgress } from "../workspace/getProgress.js";
import { getAchievements } from "../workspace/getAchievements.js";
import { determineStageInternal } from "../stage/determineStage.js";
import { getCompetitorOpportunitySignal, getNewCompetitorSignal } from "../businessOS/competitorSignal.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type PulseLevel = "preparation" | "stable" | "attention" | "action_required";
type PulseReason = { key: string; params?: Record<string, string | number> };

type RuleItem = { key: string; params?: Record<string, string | number> };

// Rule Engine untuk "Peluang Terbaik" — TIDAK PAKAI AI. Ini murni lookup
// tetap: dimensi Business Health terlemah -> 1 saran tindakan yang relevan
// untuk dimensi itu. Sama semangatnya dengan UNIT_LABELS di
// evaluateAchievements.ts — tabel referensi statis, bukan opini yang
// dikarang saat runtime. Kalau saran ini dirasa kurang tepat, PERBAIKI
// isi tabelnya (§ dokumen arsitektur), bukan diganti jadi panggilan AI.
const DIMENSION_OPPORTUNITY_KEY: Record<string, string> = {
  marketing: "opportunityMarketing",
  sales: "opportunitySales",
  finance: "opportunityFinance",
  customer: "opportunityCustomer",
  operations: "opportunityOperations",
  brand: "opportunityBrand",
};

// Why Card (directive "CONTINUE — LIVING BUSINESS LOOP"): setiap RuleItem
// BOLEH punya whyKey — kunci i18n terpisah berisi penjelasan "mengapa ini
// penting" yang lebih panjang, dipakai params yang SAMA dengan item-nya.
// Template-based (bukan AI) supaya konsisten dengan seluruh Rule Engine di
// file ini — tapi tetap terasa personal karena memakai params nyata
// (dimensi, jumlah hari, dsb), bukan kalimat generik satu-untuk-semua.
type RuleItemWithWhy = RuleItem & { whyKey?: string };

const WHY_KEY: Record<string, string> = {
  startFirstUpdate: "whyStartFirstUpdate",
  fillBusinessUpdate: "whyFillBusinessUpdate",
  inactivityWarning: "whyInactivityWarning",
  neverUpdatedYet: "whyNeverUpdatedYet",
  focusWeakDimension: "whyFocusWeakDimension",
  achievementNudge: "whyAchievementNudge",
  keepGoing: "whyKeepGoing",
  decisionFollowUp: "whyDecisionFollowUp",
  celebrateAchievement: "whyCelebrateAchievement",
  riskUpdateOverdue: "whyRiskUpdateOverdue",
  riskScoreDown: "whyRiskScoreDown",
  riskWeakDimension: "whyRiskWeakDimension",
  opportunityMarketing: "whyOpportunityMarketing",
  opportunitySales: "whyOpportunitySales",
  opportunityFinance: "whyOpportunityFinance",
  opportunityCustomer: "whyOpportunityCustomer",
  opportunityOperations: "whyOpportunityOperations",
  opportunityBrand: "whyOpportunityBrand",
  opportunityGeneric: "whyOpportunityGeneric",
  targetStalled: "whyTargetStalled",
  newCompetitorDetected: "whyNewCompetitorDetected",
};

function withWhy(item: RuleItem): RuleItemWithWhy {
  const whyKey = WHY_KEY[item.key];
  return whyKey ? { ...item, whyKey } : item;
}

export type TodaySnapshotPayload = {
  stageGroup: "preparation" | "running";
  stageDetail: string;
  stageSource: "auto" | "manual_override";
  pulseLevel: PulseLevel;
  pulseReasons: PulseReason[];
  score: number | null;
  journeyDelta: number | null;
  periodDelta: number | null;
  daysSinceUpdate: number | null;
  lastUpdateAt: string | null;
  // Business Memory Narrative — lihat catatan lengkap di buildSnapshot()
  // (query businessUpdatesCount/daysSinceFirstUse). Murni angka, kalimatnya
  // dirangkai di frontend.
  businessUpdatesCount: number;
  daysSinceFirstUse: number | null;
  // Mission Engine (Living Business Loop): maksimal 5 item, diurutkan
  // berdasarkan urgensi — semua rule-based dari Business Engine + Decision
  // Memory + Business Update terbaru (data freshness, dimensi terlemah,
  // kedekatan achievement, follow-up keputusan, apresiasi pencapaian).
  priorities: RuleItemWithWhy[];
  topRisk: RuleItemWithWhy | null;
  opportunity: RuleItemWithWhy | null;
  whatChanged: Array<{ dimension: string; delta: number }> | null;
  nextMilestone: {
    titleId: string;
    titleEn: string;
    remaining: number;
    unitId: string;
    unitEn: string;
  } | null;
  // Business OS Engine (directive "CONTINUE — BUSINESS OS ENGINE"): peluang
  // yang bersumber dari Competitor Engine (bukan dimensi Business Health
  // terlemah seperti `opportunity` di atas). SENGAJA teks jadi (bukan
  // key+params) — pengecualian yang sama seperti Insight Formatter
  // Competitor: teksnya inherently variabel (tergantung kompetitor mana),
  // reuse opportunity.title/reason/action/evidence yang sudah dihasilkan
  // Opportunity Engine, tidak dikarang di sini.
  competitorOpportunity: { title: string; reason: string; action: string; evidence: string } | null;
  targetThisWeek: string | null;
  targetThisMonth: string | null;
};

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  return Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24));
}

async function buildSnapshot(userId: string, businessProfileId: string): Promise<TodaySnapshotPayload> {
  // Reuse service Business Engine yang SUDAH ADA — tidak menghitung ulang.
  // getAchievements ikut dipanggil di sini (bukan cuma dari tab Growth) —
  // ini AMAN karena evaluateAchievements() di baliknya sudah idempotent &
  // di-cache per pemanggilan (lihat ACHIEVEMENT-ENGINE-FINAL.md §3), jadi
  // tidak menduplikasi logic, hanya menambah satu titik pemanggilan baru.
  const [healthRes, progressRes, achievementsRes] = await Promise.all([
    getBusinessHealth(userId, { businessProfileId }),
    getProgress(userId, { businessProfileId }),
    getAchievements(userId, { businessProfileId }),
  ]);

  const health = healthRes.body as { dimensions: Record<string, number> | null; overall: number | null };
  const progress = progressRes.body as {
    journey: { delta: number; baselineDate: string } | null;
    period: { delta: number } | null;
  };
  const achievementsBody = achievementsRes.body as {
    nextMilestone: {
      titleId: string;
      titleEn: string;
      remaining: number;
      unitId: string;
      unitEn: string;
      remainingRatio: number;
    } | null;
  };

  // Stage Engine dipanggil SETELAH Business Health/Progress/Achievement
  // selesai dihitung, supaya sinyal businessType='grow' (overallScore,
  // journeyDelta, achievementsUnlockedCount) dikirim apa adanya — bukan
  // dihitung ulang kedua kalinya di dalam Stage Engine.
  const stage = await determineStageInternal(businessProfileId, {
    overallScore: health.overall,
    journeyDelta: progress.journey?.delta ?? null,
    achievementsUnlockedCount: (achievementsRes.body as { unlocked: unknown[] }).unlocked?.length || 0,
  });

  const { data: latestUpdate } = await supabase
    .from("business_updates")
    .select("created_at, pencapaian")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const daysSinceUpdate = latestUpdate ? daysBetween(latestUpdate.created_at as string, now) : null;

  // Business Memory Narrative (roadmap GPT, "Apa yang berubah dibanding
  // dulu?") — HANYA angka mentah di sini (count() + tanggal baseline yang
  // SUDAH dihitung getProgress di atas, tidak query ulang) sesuai prinsip
  // #2 file ini: payload snapshot cuma boleh berisi data terstruktur, bukan
  // kalimat jadi. Kalimatnya baru dirangkai di frontend lewat template i18n
  // (persis pola pulseReasons/whatChanged), supaya ganti bahasa ID/EN tidak
  // butuh recompute. Query count() di bawah murah (index business_profile_id
  // yang sudah ada dari query business_updates lain di file ini) dan TIDAK
  // memanggil AI sama sekali.
  const { count: businessUpdatesCount } = await supabase
    .from("business_updates")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);
  const daysSinceFirstUse = progress.journey?.baselineDate ? daysBetween(progress.journey.baselineDate, now) : null;

  // Decision Follow Up (Living Business Loop): keputusan besar yang masih
  // "open" dan sudah >=7 hari sejak diajukan, yang BELUM pernah ditanyakan
  // follow-up-nya — ditandai follow_up_prompted_at supaya tidak muncul
  // berulang setiap hari untuk keputusan yang sama.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingFollowUp } = await supabase
    .from("business_decisions")
    .select("id, question")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "open")
    .is("follow_up_prompted_at", null)
    .lte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pendingFollowUp) {
    await supabase
      .from("business_decisions")
      .update({ follow_up_prompted_at: new Date().toISOString() })
      .eq("id", pendingFollowUp.id);
  }

  // Business OS Engine — Smart Reminder "target belum bergerak 2 minggu":
  // bandingkan target_depan pada 3 Business Update terakhir. Kalau semuanya
  // sama persis (setelah trim+lowercase) DAN update PALING AWAL dari 3 itu
  // sudah >=14 hari lalu, berarti pengguna belum mengganti targetnya sejak
  // dua minggu — sinyal nyata dari data, bukan tebakan.
  const { data: recentTargetRows } = await supabase
    .from("business_updates")
    .select("target_depan, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(3);

  let targetStalled = false;
  if (recentTargetRows && recentTargetRows.length === 3) {
    const normalized = recentTargetRows.map((r) => (r.target_depan as string || "").trim().toLowerCase());
    const allSame = normalized.every((t) => t && t === normalized[0]);
    const oldestOfThree = recentTargetRows[recentTargetRows.length - 1].created_at as string;
    if (allSame && daysBetween(oldestOfThree, now) >= 14) targetStalled = true;
  }

  // Business OS Engine — peluang bersumber Competitor Engine + deteksi
  // kompetitor baru (murni baca cache, tidak memanggil provider/engine).
  const [competitorOpportunity, newCompetitor] = await Promise.all([
    getCompetitorOpportunitySignal(businessProfileId),
    getNewCompetitorSignal(businessProfileId),
  ]);

  // Business OS Engine — "Target minggu ini" (target_depan Business Update
  // terbaru, sudah ada di recentTargetRows) vs "Target bulan ini" (aspirasi
  // awal dari Business Discovery, raw_input.target) — DUA hal yang berbeda,
  // sama seperti pemisahan di getBusinessMemory.ts.
  const targetThisWeek = (recentTargetRows?.[0]?.target_depan as string) || null;
  const { data: discoveryRows } = await supabase
    .from("analyses")
    .select("raw_input, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(20);
  const discoveryRowWithTarget = (discoveryRows || []).find(
    (a) => (a.raw_input as Record<string, unknown> | null)?.target
  );
  const targetThisMonth =
    ((discoveryRowWithTarget?.raw_input as Record<string, unknown> | undefined)?.target as string) || null;

  // --- Business Pulse: ambang sederhana, bukan skor baru (§4.2) ---
  let pulseLevel: PulseLevel;
  const reasons: PulseReason[] = [];

  if (stage.stageGroup === "preparation") {
    pulseLevel = "preparation";
  } else if (daysSinceUpdate === null) {
    pulseLevel = "action_required";
    reasons.push({ key: "neverUpdated" });
  } else if (daysSinceUpdate > 14) {
    pulseLevel = "action_required";
    reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
  } else if (daysSinceUpdate > 7 || (progress.period && progress.period.delta < 0)) {
    pulseLevel = "attention";
    if (daysSinceUpdate > 7) reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
    if (progress.period && progress.period.delta < 0) {
      reasons.push({ key: "scoreDown", params: { points: Math.abs(progress.period.delta) } });
    }
  } else {
    pulseLevel = "stable";
    if (progress.period && progress.period.delta > 0) {
      reasons.push({ key: "scoreUp", params: { points: progress.period.delta } });
    }
  }

  // --- Prioritas / Risiko / Peluang: Rule Engine, TANPA AI ---
  // Semua di bawah ini diturunkan dari angka yang sudah dihitung Business
  // Engine (health, progress, achievement) lewat aturan tetap (if/else),
  // BUKAN dari Claude API. Ini menjawab arahan Product Owner: "Opportunity
  // tidak harus AI. Opportunity bisa dibuat dari Business Engine."
  const weakestEntry = health.dimensions
    ? Object.entries(health.dimensions).reduce((a, b) => (b[1] < a[1] ? b : a), Object.entries(health.dimensions)[0])
    : null;

  const priorities: RuleItem[] = [];
  let topRisk: RuleItem | null = null;
  let opportunity: RuleItem | null = null;

  if (stage.stageGroup === "preparation") {
    // Fase persiapan: satu-satunya prioritas nyata adalah mulai mengisi
    // Business Update pertama — checklist detail persiapan dirender
    // terpisah di UI dari template statis (bukan dari Today Engine).
    priorities.push({ key: "startFirstUpdate" });
  } else {
    // Proactive Mentor: peringatan tidak aktif — kata-kata persis sesuai
    // contoh PO ("Sudah 10 hari tidak ada Business Update...") dipakai di
    // >=10 hari (bukan cuma pengingat umum). 7-9 hari tetap dapat pengingat
    // yang lebih lembut.
    //
    // Bugfix Juli 2026 (QA users, screenshot: headline Mission Today
    // berbunyi "Kami belum menerima perkembangan bisnismu selama 0 hari" —
    // untuk bisnis yang BELUM PERNAH update sama sekali, daysSinceUpdate
    // null "??  0" tadinya dianggap sama dengan "sudah 0 hari tidak update",
    // padahal artinya beda total (belum pernah punya data vs data basi).
    // SEBELUM ini keduanya salah dipetakan ke template "inactivityWarning"
    // yang sama (X hari). Sekarang dipisah: never-updated dapat template
    // AJAKAN pertama kali (bukan X hari), directive PO: "dari pada
    // memberikan informasi [...] lebih baik dirubah menjadi ajakan untuk
    // segera update".
    if (daysSinceUpdate === null) {
      priorities.push({ key: "neverUpdatedYet" });
    } else if (daysSinceUpdate >= 10) {
      priorities.push({ key: "inactivityWarning", params: { days: daysSinceUpdate } });
    } else if (daysSinceUpdate > 7) {
      priorities.push({ key: "fillBusinessUpdate", params: { days: daysSinceUpdate } });
    }

    // Proactive Mentor: apresiasi pencapaian — kalau Business Update
    // TERBARU (dalam 2 hari terakhir) menyertakan pencapaian nyata (bukan
    // "belum ada"/kosong), Workspace merayakannya dulu sebelum lanjut ke
    // saran berikutnya. Ambang sama dengan validasi form (>=10 karakter,
    // >=2 kata) — bukan menebak makna teksnya, cuma memastikan isinya
    // substantif.
    if (
      daysSinceUpdate !== null &&
      daysSinceUpdate <= 2 &&
      latestUpdate?.pencapaian &&
      typeof latestUpdate.pencapaian === "string" &&
      latestUpdate.pencapaian.trim().split(/\s+/).length >= 2 &&
      latestUpdate.pencapaian.trim().length >= 10
    ) {
      priorities.push({ key: "celebrateAchievement" });
    }

    // Decision Follow Up: keputusan besar yang sudah >=7 hari tanpa
    // follow-up, ditandai di query sebelumnya — masuk sebagai prioritas
    // supaya benar-benar terlihat, bukan cuma tersimpan diam di riwayat.
    if (pendingFollowUp) {
      priorities.push({ key: "decisionFollowUp", params: { question: (pendingFollowUp.question as string).slice(0, 120) } });
    }

    // Business OS Engine — Smart Reminder: target belum bergerak 2 minggu.
    if (targetStalled) {
      priorities.push({ key: "targetStalled" });
    }

    // Business OS Engine — Smart Reminder: kompetitor baru muncul di
    // sekitar lokasi (dibandingkan snapshot sebelumnya).
    if (newCompetitor) {
      priorities.push({ key: "newCompetitorDetected", params: { name: newCompetitor.name } });
    }

    if (weakestEntry) {
      priorities.push({ key: "focusWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } });
    }
    if (achievementsBody.nextMilestone && achievementsBody.nextMilestone.remainingRatio < 0.3) {
      priorities.push({
        key: "achievementNudge",
        params: {
          remaining: achievementsBody.nextMilestone.remaining,
          titleId: achievementsBody.nextMilestone.titleId,
          titleEn: achievementsBody.nextMilestone.titleEn,
        },
      });
    }
    if (priorities.length === 0) priorities.push({ key: "keepGoing" });

    // Mission Engine: maksimal 5 item (sesuai directive), urutan di atas
    // SUDAH diprioritaskan dari yang paling mendesak (inactivity/apresiasi
    // dulu, baru dimensi/achievement) — cukup potong, tidak perlu sort ulang.

    // Risiko terbesar — SATU sinyal negatif paling mendesak, urutan tetap:
    // data basi > skor turun > dimensi sangat rendah. Kalau tidak ada yang
    // cocok, jujur tidak ada risiko besar terdeteksi (tidak dipaksakan).
    if (daysSinceUpdate !== null && daysSinceUpdate > 14) {
      topRisk = { key: "riskUpdateOverdue", params: { days: daysSinceUpdate } };
    } else if (progress.period && progress.period.delta < 0) {
      topRisk = { key: "riskScoreDown", params: { points: Math.abs(progress.period.delta) } };
    } else if (weakestEntry && weakestEntry[1] < 45) {
      topRisk = { key: "riskWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } };
    }

    // Peluang terbaik — lookup tetap dari dimensi terlemah (lihat
    // DIMENSION_OPPORTUNITY_KEY di atas), bukan opini AI.
    if (weakestEntry) {
      opportunity = { key: DIMENSION_OPPORTUNITY_KEY[weakestEntry[0]] || "opportunityGeneric" };
    }
  }

  const cappedPriorities = priorities.slice(0, 5).map(withWhy);
  const finalTopRisk = topRisk ? withWhy(topRisk) : null;
  const finalOpportunity = opportunity ? withWhy(opportunity) : null;

  // --- Yang berubah sejak periode lalu: presentasi ulang getHealthTrend ---
  let whatChanged: Array<{ dimension: string; delta: number }> | null = null;
  const { data: trendRows } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false })
    .limit(12); // cukup untuk 2 batch terakhir (maks 6 dimensi x 2)

  if (trendRows && trendRows.length > 0) {
    const batches = new Map<string, Record<string, number>>();
    for (const row of trendRows) {
      const key = row.evaluated_at as string;
      if (!batches.has(key)) batches.set(key, {});
      batches.get(key)![row.dimension as string] = row.score as number;
    }
    const sortedKeys = Array.from(batches.keys()).sort((a, b) => b.localeCompare(a));
    if (sortedKeys.length >= 2) {
      const latest = batches.get(sortedKeys[0])!;
      const previous = batches.get(sortedKeys[1])!;
      whatChanged = Object.entries(latest)
        .filter(([dim]) => typeof previous[dim] === "number")
        .map(([dim, score]) => ({ dimension: dim, delta: score - previous[dim] }));
    }
  }

  const nextMilestone = achievementsBody.nextMilestone
    ? {
        titleId: achievementsBody.nextMilestone.titleId,
        titleEn: achievementsBody.nextMilestone.titleEn,
        remaining: achievementsBody.nextMilestone.remaining,
        unitId: achievementsBody.nextMilestone.unitId,
        unitEn: achievementsBody.nextMilestone.unitEn,
      }
    : null;

  return {
    stageGroup: stage.stageGroup,
    stageDetail: stage.stageDetail,
    stageSource: stage.source,
    pulseLevel,
    pulseReasons: reasons,
    score: health.overall,
    journeyDelta: progress.journey?.delta ?? null,
    periodDelta: progress.period?.delta ?? null,
    daysSinceUpdate,
    lastUpdateAt: (latestUpdate?.created_at as string) || null,
    businessUpdatesCount: businessUpdatesCount ?? 0,
    daysSinceFirstUse,
    priorities: cappedPriorities,
    topRisk: finalTopRisk,
    opportunity: finalOpportunity,
    whatChanged,
    nextMilestone,
    competitorOpportunity,
    targetThisWeek,
    targetThisMonth,
  };
}

export async function getTodaySnapshot(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("today_snapshot")
    .select("payload, computed_at")
    .eq("business_profile_id", businessProfileId)
    .eq("snapshot_date", today)
    .maybeSingle();

  // Grafik Performa (revisi Juli 2026, ganti dummy chart yang sebelumnya
  // sengaja fiktif): today_snapshot SUDAH menyimpan 1 baris per hari per
  // bisnis (constraint unique business_profile_id+snapshot_date) — jadi
  // riwayat skor harian sebenarnya SUDAH ADA, tidak perlu tabel baru.
  // Diambil di sini (bukan disimpan di payload snapshot itu sendiri) supaya
  // tidak ikut kena logic cache 1x/hari — selalu baca baris terakhir yang
  // benar-benar ada, jujur kalau baru sedikit hari (bisnis baru) alih-alih
  // dikarang jadi 7 titik penuh.
  const scoreHistory = await getScoreHistory(businessProfileId, today);

  if (existing && !payload.forceRecompute) {
    return { status: 200, body: { snapshot: existing.payload, computedAt: existing.computed_at, scoreHistory } };
  }

  const snapshot = await buildSnapshot(userId, businessProfileId);

  const { data: saved, error: upsertError } = await supabase
    .from("today_snapshot")
    .upsert(
      { business_profile_id: businessProfileId, snapshot_date: today, payload: snapshot, computed_at: new Date().toISOString() },
      { onConflict: "business_profile_id,snapshot_date" }
    )
    .select("payload, computed_at")
    .single();

  if (upsertError) {
    console.error("services/today/computeSnapshot upsert error:", upsertError);
    // Tetap kembalikan hasil hitungan meski gagal cache, supaya UI tidak
    // gagal total hanya karena snapshot tidak tersimpan.
    return { status: 200, body: { snapshot, computedAt: new Date().toISOString(), scoreHistory } };
  }

  // Baris hari ini baru saja ditulis (upsert di atas) tapi belum tentu ikut
  // dalam scoreHistory yang diambil SEBELUM upsert — tambahkan manual
  // supaya grafik hari ini langsung update tanpa perlu reload kedua.
  const todayScore = (saved.payload as TodaySnapshotPayload)?.score ?? null;
  const historyWithToday = scoreHistory.some((h) => h.date === today)
    ? scoreHistory.map((h) => (h.date === today ? { date: today, score: todayScore } : h))
    : [...scoreHistory, { date: today, score: todayScore }].slice(-7);

  return { status: 200, body: { snapshot: saved.payload, computedAt: saved.computed_at, scoreHistory: historyWithToday } };
}

export type ScoreHistoryPoint = { date: string; score: number | null };

/** Baca sampai 7 hari terakhir today_snapshot.payload->score untuk satu
 * bisnis, diurutkan lama->baru (siap dipakai chart kiri-ke-kanan). TIDAK
 * mengarang titik untuk hari yang tidak ada datanya — kalau bisnis baru
 * berumur 2 hari, array-nya cuma berisi 2 titik, apa adanya. */
async function getScoreHistory(businessProfileId: string, uptoDate: string): Promise<ScoreHistoryPoint[]> {
  const { data: rows, error } = await supabase
    .from("today_snapshot")
    .select("snapshot_date, payload")
    .eq("business_profile_id", businessProfileId)
    .lte("snapshot_date", uptoDate)
    .order("snapshot_date", { ascending: false })
    .limit(7);

  if (error) {
    console.error("services/today/computeSnapshot getScoreHistory error:", error);
    return [];
  }

  return (rows || [])
    .map((r) => ({
      date: r.snapshot_date as string,
      score: (r.payload as TodaySnapshotPayload)?.score ?? null,
    }))
    .reverse();
}

// Living Business Loop: submitUpdate.ts dan
// services/workspace/checklistProgress.ts SEKARANG memanggil
// getTodaySnapshot(..., { forceRecompute: true }) setelah Business Engine
// selesai recalculate — Event Pipeline ini yang membuat Mission/Stage/Pulse
// berubah SAAT ITU JUGA, bukan menunggu snapshot besok atau refresh manual.
