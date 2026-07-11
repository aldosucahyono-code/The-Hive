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
  // (audit Task 14a) textEn/evidenceEn ditambahkan di marketSignals.ts —
  // kalau entah bagaimana tidak ada (data lama di cache sebelum fix ini),
  // jatuh ke reason id supaya tidak pernah kosong/undefined di UI.
  const reasonEn = ((signal.data.textEn as string) || (signal.data.evidenceEn as string) || (signal.data.text as string) || signal.evidence) as string;

  if (signal.category === "market_gap") {
    return {
      id: `opp-market-gap-${index}`,
      title: "Ruang pasar yang belum ramai kompetitor",
      titleEn: "Untapped market space with few competitors",
      businessValue: "Peluang menjadi pilihan utama sebelum banyak pesaing masuk ke area yang sama.",
      businessValueEn: "An opportunity to become the go-to choice before more competitors enter the same area.",
      difficulty: "medium",
      impact: "large",
      priority,
      reason: signal.evidence,
      reasonEn: (signal.data.evidenceEn as string) || signal.evidence,
      action: "Perkuat promosi lokal (Google Maps, media sosial) sekarang selagi kompetisi masih rendah.",
      actionEn: "Strengthen local promotion (Google Maps, social media) now while competition is still low.",
      source: signal.sourceType,
      evidence: signal.evidence,
    };
  }

  if (signal.category === "competitor_weakness") {
    return {
      id: `opp-competitor-weakness-${index}`,
      title: "Celah dari kelemahan kompetitor di sekitar",
      titleEn: "A gap from nearby competitors' weaknesses",
      businessValue: "Pelanggan yang kecewa dengan kompetitor bisa direbut dengan pengalaman yang lebih baik.",
      businessValueEn: "Customers unhappy with competitors can be won over with a better experience.",
      difficulty: "easy",
      impact: "medium",
      priority,
      reason: (signal.data.text as string) || signal.evidence,
      reasonEn,
      action: "Soroti kelebihan Anda (pelayanan, kecepatan, kualitas) di titik yang jadi keluhan kompetitor.",
      actionEn: "Highlight your strengths (service, speed, quality) exactly where competitors are falling short.",
      source: signal.sourceType,
      evidence: signal.evidence,
    };
  }

  // competitor_strength -> dicatat sebagai "opportunity" untuk belajar/menutup gap, bukan diabaikan
  return {
    id: `opp-competitor-strength-${index}`,
    title: "Standar yang perlu dikejar dari kompetitor kuat",
    titleEn: "A standard worth catching up to from a strong competitor",
    businessValue: "Menyamai standar kompetitor yang sudah kuat membantu Anda tetap kompetitif.",
    businessValueEn: "Matching a strong competitor's standard helps you stay competitive.",
    difficulty: "hard",
    impact: "medium",
    priority,
    reason: (signal.data.text as string) || signal.evidence,
    reasonEn,
    action: "Pelajari apa yang membuat kompetitor ini unggul, lalu adaptasi sesuai kapasitas bisnis Anda.",
    actionEn: "Study what makes this competitor strong, then adapt it to fit your business's capacity.",
    source: signal.sourceType,
    evidence: signal.evidence,
  };
}

export function generateOpportunities(signals: MarketSignal[]): Opportunity[] {
  return signals.map((s, i) => opportunityFromSignal(s, i));
}
