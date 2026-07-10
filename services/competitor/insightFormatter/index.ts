// services/competitor/insightFormatter/index.ts
//
// Insight Formatter — layer BARU yang diminta Master Product Completion
// Directive (V1.0 Launch Ready Sprint), diletakkan persis di antara Business
// Engine dan Workspace:
//
//   Competitor/Opportunity/Recommendation Engine (object teknis, evidence)
//     -> Insight Formatter [file ini]
//     -> Workspace (kalimat manusia + tombol "Lihat Data Pendukung")
//
// Tugasnya SATU: mengubah object teknis (priority/impact/rating/marketPosition,
// dst) menjadi kalimat yang bisa dipahami pemilik usaha yang bukan analis
// bisnis — tanpa mengarang apapun. Setiap FormattedInsight tetap membawa
// evidence asli (evidenceDetail) supaya Workspace bisa menampilkan tombol
// "Lihat Data Pendukung" tanpa Insight Formatter perlu tahu soal UI.
//
// Bahasa sederhana (istilah pengguna, BUKAN istilah analis — lihat directive
// bagian BAHASA):
//   Market Position   -> Posisi Bisnismu di Area Ini
//   Strength          -> Yang Sudah Menjadi Kelebihan Bisnismu
//   Weakness          -> Yang Masih Bisa Ditingkatkan
//   Recommendation    -> Yang Sebaiknya Kamu Lakukan
//   Opportunity       -> Peluang yang Bisa Kamu Manfaatkan
//
// Prinsip data honesty tetap berlaku di sini: Insight Formatter TIDAK
// menghitung apapun, TIDAK menambah klaim baru — hanya menyusun ulang teks
// dari data yang sudah dihasilkan Engine (marketPositionReason, evidence,
// text kompetitor, action, reason) menjadi kalimat utuh.

import type { CompetitorEngineResult, Opportunity, Recommendation } from "../types/index.js";

export type FormattedInsightCategory =
  | "market_position"
  | "strength"
  | "weakness"
  | "opportunity"
  | "recommendation";

export type FormattedInsight = {
  id: string;
  category: FormattedInsightCategory;
  categoryLabelId: string;
  categoryLabelEn: string;
  headline: string; // kalimat utama, bahasa sederhana, siap ditampilkan
  evidenceSummary: string; // ringkasan singkat data pendukung (selalu tampil kecil di bawah headline)
  evidenceDetail: string; // detail penuh, HANYA tampil setelah pengguna klik "Lihat Data Pendukung"
  priority?: Opportunity["priority"];
  bucket?: Recommendation["bucket"];
};

const CATEGORY_LABELS: Record<FormattedInsightCategory, { id: string; en: string }> = {
  market_position: { id: "Posisi Bisnismu di Area Ini", en: "Your Position in This Area" },
  strength: { id: "Yang Sudah Menjadi Kelebihan Bisnismu", en: "What's Already Your Strength" },
  weakness: { id: "Yang Masih Bisa Ditingkatkan", en: "What Can Still Be Improved" },
  opportunity: { id: "Peluang yang Bisa Kamu Manfaatkan", en: "Opportunities You Can Use" },
  recommendation: { id: "Yang Sebaiknya Kamu Lakukan", en: "What You Should Do" },
};

function opportunityHeadline(o: Opportunity, lang: "id" | "en"): string {
  // Menyusun kalimat "apa - kenapa penting - apa yang sebaiknya dilakukan"
  // dari field yang SUDAH ADA di Opportunity (businessValue, reason, action)
  // — bukan klaim baru.
  if (lang === "en") {
    return `${o.businessValue} ${o.reason} Suggested step: ${o.action}`;
  }
  return `${o.businessValue} ${o.reason} Langkah yang bisa kamu ambil: ${o.action}`;
}

function recommendationHeadline(r: Recommendation, lang: "id" | "en"): string {
  if (lang === "en") {
    return `${r.title}. ${r.reason} Suggested step: ${r.action}`;
  }
  return `${r.title}. ${r.reason} Langkah yang bisa kamu ambil: ${r.action}`;
}

/** Mengubah seluruh output Competitor/Opportunity/Recommendation Engine
 * menjadi daftar FormattedInsight siap tampil. Urutan: posisi pasar dulu
 * (konteks), lalu kelebihan, lalu yang bisa ditingkatkan, lalu peluang, lalu
 * rekomendasi — supaya pemilik usaha membaca dari "di mana saya sekarang"
 * ke "apa yang harus saya lakukan", bukan daftar acak. */
export function formatCompetitorInsights(
  competitor: CompetitorEngineResult,
  opportunities: Opportunity[],
  recommendations: Recommendation[],
  lang: "id" | "en"
): FormattedInsight[] {
  const insights: FormattedInsight[] = [];

  insights.push({
    id: "insight-market-position",
    category: "market_position",
    categoryLabelId: CATEGORY_LABELS.market_position.id,
    categoryLabelEn: CATEGORY_LABELS.market_position.en,
    headline: competitor.marketPositionReason,
    evidenceSummary:
      lang === "en"
        ? `Based on ${competitor.marketSummary.totalCompetitorsFound} competitors found nearby.`
        : `Berdasarkan ${competitor.marketSummary.totalCompetitorsFound} kompetitor yang ditemukan di sekitar lokasimu.`,
    evidenceDetail: competitor.marketPositionReason,
  });

  competitor.userStrengths.forEach((s, i) => {
    insights.push({
      id: `insight-strength-${i}`,
      category: "strength",
      categoryLabelId: CATEGORY_LABELS.strength.id,
      categoryLabelEn: CATEGORY_LABELS.strength.en,
      headline: s.text,
      evidenceSummary: lang === "en" ? "See supporting data" : "Lihat data pendukung",
      evidenceDetail: s.evidence,
    });
  });

  competitor.competitorWeaknesses.forEach((w, i) => {
    insights.push({
      id: `insight-weakness-${i}`,
      category: "weakness",
      categoryLabelId: CATEGORY_LABELS.weakness.id,
      categoryLabelEn: CATEGORY_LABELS.weakness.en,
      headline: w.text,
      evidenceSummary: lang === "en" ? "See supporting data" : "Lihat data pendukung",
      evidenceDetail: w.evidence,
    });
  });

  opportunities.forEach((o) => {
    insights.push({
      id: `insight-${o.id}`,
      category: "opportunity",
      categoryLabelId: CATEGORY_LABELS.opportunity.id,
      categoryLabelEn: CATEGORY_LABELS.opportunity.en,
      headline: opportunityHeadline(o, lang),
      evidenceSummary: lang === "en" ? "See supporting data" : "Lihat data pendukung",
      evidenceDetail: o.evidence,
      priority: o.priority,
    });
  });

  recommendations.forEach((r) => {
    insights.push({
      id: `insight-${r.id}`,
      category: "recommendation",
      categoryLabelId: CATEGORY_LABELS.recommendation.id,
      categoryLabelEn: CATEGORY_LABELS.recommendation.en,
      headline: recommendationHeadline(r, lang),
      evidenceSummary: lang === "en" ? `Source: ${r.source}` : `Sumber: ${r.source}`,
      evidenceDetail: r.reason,
      bucket: r.bucket,
    });
  });

  return insights;
}
