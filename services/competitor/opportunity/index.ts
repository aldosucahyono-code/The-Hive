// services/competitor/opportunity/index.ts
//
// Opportunity Engine. HANYA membaca MarketSignal[] (lihat marketSignals.ts)
// — tidak pernah CompetitorEngineResult atau provider Google langsung
// ("Jangan coupling", arahan directive). Ini yang membuat Opportunity Engine
// tetap valid walau nanti sumber datanya bertambah (Google Business Profile,
// media sosial, marketplace) — signal baru cukup masuk lewat adapter baru,
// fungsi di file ini tidak berubah.

import type { MarketSignal, Opportunity, OpportunityPriority } from "../types/index.js";

function priorityForSignal(signal: MarketSignal): OpportunityPriority {
  if (signal.category === "market_gap") return "high"; // ruang pasar kosong = peluang besar, cepat diambil
  if (signal.category === "competitor_weakness") return "medium";
  if (signal.category === "competitor_strength") return "low"; // ini ancaman/pembanding, bukan peluang langsung — tetap dicatat sebagai low agar tidak diabaikan
  return "low";
}

function opportunityFromSignal(signal: MarketSignal, index: number): Opportunity {
  const priority = priorityForSignal(signal);

  if (signal.category === "market_gap") {
    return {
      id: `opp-market-gap-${index}`,
      title: "Ruang pasar yang belum ramai kompetitor",
      businessValue: "Peluang menjadi pilihan utama sebelum banyak pesaing masuk ke area yang sama.",
      difficulty: "medium",
      impact: "large",
      priority,
      reason: signal.evidence,
      action: "Perkuat promosi lokal (Google Maps, media sosial) sekarang selagi kompetisi masih rendah.",
      source: signal.sourceType,
      evidence: signal.evidence,
    };
  }

  if (signal.category === "competitor_weakness") {
    return {
      id: `opp-competitor-weakness-${index}`,
      title: "Celah dari kelemahan kompetitor di sekitar",
      businessValue: "Pelanggan yang kecewa dengan kompetitor bisa direbut dengan pengalaman yang lebih baik.",
      difficulty: "easy",
      impact: "medium",
      priority,
      reason: (signal.data.text as string) || signal.evidence,
      action: "Soroti kelebihan Anda (pelayanan, kecepatan, kualitas) di titik yang jadi keluhan kompetitor.",
      source: signal.sourceType,
      evidence: signal.evidence,
    };
  }

  // competitor_strength -> dicatat sebagai "opportunity" untuk belajar/menutup gap, bukan diabaikan
  return {
    id: `opp-competitor-strength-${index}`,
    title: "Standar yang perlu dikejar dari kompetitor kuat",
    businessValue: "Menyamai standar kompetitor yang sudah kuat membantu Anda tetap kompetitif.",
    difficulty: "hard",
    impact: "medium",
    priority,
    reason: (signal.data.text as string) || signal.evidence,
    action: "Pelajari apa yang membuat kompetitor ini unggul, lalu adaptasi sesuai kapasitas bisnis Anda.",
    source: signal.sourceType,
    evidence: signal.evidence,
  };
}

export function generateOpportunities(signals: MarketSignal[]): Opportunity[] {
  return signals.map((s, i) => opportunityFromSignal(s, i));
}
