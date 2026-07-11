// services/competitor/opportunity/marketSignals.ts
//
// Adapter — SATU-SATUNYA tempat yang tahu cara mengubah CompetitorEngineResult
// menjadi MarketSignal[]. Ini lapisan decoupling yang diminta Product Owner:
// Opportunity Engine (index.ts di folder ini) TIDAK PERNAH mengimpor
// CompetitorEngineResult secara langsung, hanya MarketSignal. Kalau nanti ada
// sumber data baru (Google Business Profile, media sosial, marketplace),
// cukup tambah adapter serupa di sini (mis. googleBusinessProfileSignals.ts)
// yang juga menghasilkan MarketSignal[] — Opportunity Engine tidak perlu
// diubah sama sekali.

import type { CompetitorEngineResult, MarketSignal } from "../types/index.js";

export function competitorResultToMarketSignals(result: CompetitorEngineResult): MarketSignal[] {
  const signals: MarketSignal[] = [];

  for (const w of result.competitorWeaknesses) {
    signals.push({
      sourceType: "competitor",
      sourceId: result.businessProfileId,
      category: "competitor_weakness",
      evidence: w.evidence,
      // textEn ditambahkan (audit Task 14a) supaya Opportunity Engine bisa
      // membangun reason dalam bahasa yang benar — lihat opportunity/index.ts.
      data: { text: w.text, textEn: w.textEn },
    });
  }

  for (const s of result.competitorStrengths) {
    signals.push({
      sourceType: "competitor",
      sourceId: result.businessProfileId,
      category: "competitor_strength",
      evidence: s.evidence,
      data: { text: s.text, textEn: s.textEn },
    });
  }

  // Market gap: kalau jumlah kompetitor yang ditemukan sangat sedikit,
  // ini sinyal ruang pasar yang belum ramai — evidence-nya adalah angka
  // nyata dari marketSummary, bukan asumsi.
  if (result.marketSummary.totalCompetitorsFound <= 2) {
    signals.push({
      sourceType: "competitor",
      sourceId: result.businessProfileId,
      category: "market_gap",
      evidence: `Hanya ${result.marketSummary.totalCompetitorsFound} kompetitor ditemukan di sekitar lokasi (${result.query.location}) untuk industri ${result.query.industry}.`,
      data: {
        totalCompetitorsFound: result.marketSummary.totalCompetitorsFound,
        evidenceEn: `Only ${result.marketSummary.totalCompetitorsFound} competitor(s) found near location (${result.query.location}) for the ${result.query.industry} industry.`,
      },
    });
  }

  return signals;
}
