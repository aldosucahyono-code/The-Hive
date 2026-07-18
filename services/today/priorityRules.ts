// services/today/priorityRules.ts
//
// Rule Engine murni untuk Mission Today (diekstrak dari
// services/today/computeSnapshot.ts, audit Juli 2026 -- lihat diskusi
// Claude+GPT soal "Mission Today sebagai pusat pengalaman"). Sebelumnya
// logika if/else penentu Business Pulse + priorities/topRisk/opportunity
// hidup MENYATU di dalam buildSnapshot() yang juga melakukan query Supabase
// -- membuatnya tidak bisa dites otomatis tanpa mock database penuh.
//
// File ini SENGAJA tidak menyentuh Supabase/network sama sekali -- semua
// fungsi di sini menerima data biasa (angka, string, boolean) dan
// mengembalikan data biasa, jadi bisa dites langsung
// (services/today/priorityRules.test.ts) tanpa mock apapun. computeSnapshot.ts
// tetap satu-satunya tempat yang mengambil data dari Business Engine/Supabase,
// lalu memanggil fungsi-fungsi di sini untuk mengubahnya jadi Mission/Pulse --
// perilakunya TIDAK diubah sama sekali oleh ekstraksi ini.

export type PulseLevel = "preparation" | "stable" | "attention" | "action_required";
export type PulseReason = { key: string; params?: Record<string, string | number> };
export type RuleItem = { key: string; params?: Record<string, string | number> };
export type RuleItemWithWhy = RuleItem & { whyKey?: string };

// Rule Engine untuk "Peluang Terbaik" — TIDAK PAKAI AI. Ini murni lookup
// tetap: dimensi Business Health terlemah -> 1 saran tindakan yang relevan
// untuk dimensi itu. Sama semangatnya dengan UNIT_LABELS di
// evaluateAchievements.ts — tabel referensi statis, bukan opini yang
// dikarang saat runtime. Kalau saran ini dirasa kurang tepat, PERBAIKI
// isi tabelnya (§ dokumen arsitektur), bukan diganti jadi panggilan AI.
export const DIMENSION_OPPORTUNITY_KEY: Record<string, string> = {
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
export const WHY_KEY: Record<string, string> = {
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

export function withWhy(item: RuleItem): RuleItemWithWhy {
  const whyKey = WHY_KEY[item.key];
  return whyKey ? { ...item, whyKey } : item;
}

export type PulseInput = {
  stageGroup: "preparation" | "running";
  daysSinceUpdate: number | null;
  periodDelta: number | null;
};

/** Business Pulse: ambang sederhana, bukan skor baru (§4.2 dokumen
 * arsitektur). Sama persis dengan logika lama di buildSnapshot(). */
export function computeBusinessPulse(input: PulseInput): { pulseLevel: PulseLevel; pulseReasons: PulseReason[] } {
  const { stageGroup, daysSinceUpdate, periodDelta } = input;
  let pulseLevel: PulseLevel;
  const reasons: PulseReason[] = [];

  if (stageGroup === "preparation") {
    pulseLevel = "preparation";
  } else if (daysSinceUpdate === null) {
    pulseLevel = "action_required";
    reasons.push({ key: "neverUpdated" });
  } else if (daysSinceUpdate > 14) {
    pulseLevel = "action_required";
    reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
  } else if (daysSinceUpdate > 7 || (periodDelta !== null && periodDelta < 0)) {
    pulseLevel = "attention";
    if (daysSinceUpdate > 7) reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
    if (periodDelta !== null && periodDelta < 0) {
      reasons.push({ key: "scoreDown", params: { points: Math.abs(periodDelta) } });
    }
  } else {
    pulseLevel = "stable";
    if (periodDelta !== null && periodDelta > 0) {
      reasons.push({ key: "scoreUp", params: { points: periodDelta } });
    }
  }

  return { pulseLevel, pulseReasons: reasons };
}

export type PriorityRulesInput = {
  stageGroup: "preparation" | "running";
  daysSinceUpdate: number | null;
  /** Isi field pencapaian di Business Update TERBARU, kalau ada. */
  latestUpdatePencapaian: string | null;
  /** Pertanyaan keputusan yang butuh follow-up, kalau ada satu yang eligible. */
  pendingFollowUpQuestion: string | null;
  targetStalled: boolean;
  /** Nama kompetitor baru yang terdeteksi, kalau ada. */
  newCompetitorName: string | null;
  healthDimensions: Record<string, number> | null;
  nextMilestone: { remaining: number; titleId: string; titleEn: string; remainingRatio: number } | null;
  periodDelta: number | null;
};

export type PriorityRulesOutput = {
  priorities: RuleItemWithWhy[];
  topRisk: RuleItemWithWhy | null;
  opportunity: RuleItemWithWhy | null;
};

/** Prioritas / Risiko / Peluang: Rule Engine, TANPA AI. Semua di bawah ini
 * diturunkan dari angka yang sudah dihitung Business Engine (health,
 * progress, achievement) lewat aturan tetap (if/else), BUKAN dari Claude
 * API. Ini menjawab arahan Product Owner: "Opportunity tidak harus AI.
 * Opportunity bisa dibuat dari Business Engine." Sama persis dengan logika
 * lama di buildSnapshot() -- ekstraksi ini TIDAK mengubah urutan/hasil. */
export function computePriorities(input: PriorityRulesInput): PriorityRulesOutput {
  const {
    stageGroup,
    daysSinceUpdate,
    latestUpdatePencapaian,
    pendingFollowUpQuestion,
    targetStalled,
    newCompetitorName,
    healthDimensions,
    nextMilestone,
    periodDelta,
  } = input;

  const weakestEntry = healthDimensions
    ? Object.entries(healthDimensions).reduce((a, b) => (b[1] < a[1] ? b : a), Object.entries(healthDimensions)[0])
    : null;

  const priorities: RuleItem[] = [];
  let topRisk: RuleItem | null = null;
  let opportunity: RuleItem | null = null;

  if (stageGroup === "preparation") {
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
      latestUpdatePencapaian &&
      latestUpdatePencapaian.trim().split(/\s+/).length >= 2 &&
      latestUpdatePencapaian.trim().length >= 10
    ) {
      priorities.push({ key: "celebrateAchievement" });
    }

    // Decision Follow Up: keputusan besar yang sudah >=7 hari tanpa
    // follow-up, ditandai di query sebelumnya — masuk sebagai prioritas
    // supaya benar-benar terlihat, bukan cuma tersimpan diam di riwayat.
    if (pendingFollowUpQuestion) {
      priorities.push({ key: "decisionFollowUp", params: { question: pendingFollowUpQuestion.slice(0, 120) } });
    }

    // Business OS Engine — Smart Reminder: target belum bergerak 2 minggu.
    if (targetStalled) {
      priorities.push({ key: "targetStalled" });
    }

    // Business OS Engine — Smart Reminder: kompetitor baru muncul di
    // sekitar lokasi (dibandingkan snapshot sebelumnya).
    if (newCompetitorName) {
      priorities.push({ key: "newCompetitorDetected", params: { name: newCompetitorName } });
    }

    if (weakestEntry) {
      priorities.push({ key: "focusWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } });
    }
    if (nextMilestone && nextMilestone.remainingRatio < 0.3) {
      priorities.push({
        key: "achievementNudge",
        params: {
          remaining: nextMilestone.remaining,
          titleId: nextMilestone.titleId,
          titleEn: nextMilestone.titleEn,
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
    } else if (periodDelta !== null && periodDelta < 0) {
      topRisk = { key: "riskScoreDown", params: { points: Math.abs(periodDelta) } };
    } else if (weakestEntry && weakestEntry[1] < 45) {
      topRisk = { key: "riskWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } };
    }

    // Peluang terbaik — lookup tetap dari dimensi terlemah (lihat
    // DIMENSION_OPPORTUNITY_KEY di atas), bukan opini AI.
    if (weakestEntry) {
      opportunity = { key: DIMENSION_OPPORTUNITY_KEY[weakestEntry[0]] || "opportunityGeneric" };
    }
  }

  return {
    priorities: priorities.slice(0, 5).map(withWhy),
    topRisk: topRisk ? withWhy(topRisk) : null,
    opportunity: opportunity ? withWhy(opportunity) : null,
  };
}
