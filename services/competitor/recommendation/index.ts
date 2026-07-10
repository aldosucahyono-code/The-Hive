// services/competitor/recommendation/index.ts
//
// Recommendation Engine. Membaca Business Score + Journey (dari Business
// Memory, yang sudah merangkai progress_snapshots), Target (baseline
// improvements/opportunity — Business Discovery TIDAK punya tabel target
// terpisah, "target" selama ini memang berasal dari analisis AI awal,
// sesuai pola yang sudah dipakai TargetPanel di Workspace.tsx), Business
// Update terbaru, dan Opportunity dari Competitor Engine — lalu menyusun
// rekomendasi ke 4 ember waktu (Hari Ini / Minggu Ini / Bulan Ini / 90 Hari).
//
// Data honesty: sebuah ember boleh KOSONG kalau memang tidak ada data yang
// cukup untuk merekomendasikan sesuatu secara jujur — tidak diisi dengan
// rekomendasi generik supaya "terlihat penuh".

import type { BusinessMemoryContext } from "../../memory/getBusinessMemory.js";
import type { Opportunity, Recommendation, RecommendationBucketKey } from "../types/index.js";

function pushRec(
  list: Recommendation[],
  bucket: RecommendationBucketKey,
  title: string,
  reason: string,
  action: string,
  source: string
) {
  list.push({ id: `rec-${bucket}-${list.length}`, bucket, title, reason, action, source });
}

export function generateRecommendations(
  memory: BusinessMemoryContext,
  opportunities: Opportunity[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  // --- Hari Ini: prioritas kritis/tinggi dari Opportunity Engine, atau
  // penurunan skor periode terakhir yang butuh perhatian segera.
  const criticalOrHigh = opportunities.filter((o) => o.priority === "critical" || o.priority === "high");
  if (criticalOrHigh.length > 0) {
    const top = criticalOrHigh[0];
    pushRec(recs, "today", top.title, top.reason, top.action, "competitor");
  } else if (memory.period && memory.period.delta < 0) {
    pushRec(
      recs,
      "today",
      "Skor bisnis turun dibanding periode sebelumnya",
      `Skor bisnis Anda turun ${Math.abs(memory.period.delta)} poin dibanding update sebelumnya (${memory.period.previousScore} → ${memory.period.currentScore}).`,
      "Cek Business Update terakhir untuk tahu penyebabnya, lalu catat rencana perbaikan hari ini.",
      "journey"
    );
  }

  // --- Minggu Ini: opportunity prioritas medium, atau tindak lanjut target
  // dari update terakhir (target_depan/pencapaian yang sudah dicatat sendiri
  // oleh pemilik bisnis).
  const mediumOpportunities = opportunities.filter((o) => o.priority === "medium");
  if (mediumOpportunities.length > 0) {
    const top = mediumOpportunities[0];
    pushRec(recs, "this_week", top.title, top.reason, top.action, "competitor");
  }
  if (memory.recentUpdates.length > 0) {
    const latestUpdate = memory.recentUpdates[0];
    if (latestUpdate.content) {
      pushRec(
        recs,
        "this_week",
        "Tindak lanjuti Business Update terakhir",
        `Update terakhir Anda: "${latestUpdate.content.slice(0, 120)}${latestUpdate.content.length > 120 ? "..." : ""}"`,
        "Tinjau apakah rencana yang Anda catat sudah dijalankan minggu ini.",
        "business_update"
      );
    }
  }

  // --- Bulan Ini: dari improvements di baseline analysis (area perbaikan
  // yang sudah diidentifikasi AI saat baseline, belum tentu sudah dikerjakan).
  if (memory.baseline?.improvements) {
    pushRec(
      recs,
      "this_month",
      "Kerjakan area perbaikan dari analisis awal",
      memory.baseline.improvements,
      "Pilih satu area perbaikan yang paling relevan bulan ini dan buat langkah konkret.",
      "business_memory"
    );
  }
  const lowOpportunities = opportunities.filter((o) => o.priority === "low" && o.impact !== "small");
  if (lowOpportunities.length > 0) {
    const top = lowOpportunities[0];
    pushRec(recs, "this_month", top.title, top.reason, top.action, "competitor");
  }

  // --- 90 Hari: dari opportunity di baseline analysis (arah jangka panjang
  // yang sudah diidentifikasi AI), plus opportunity besar dari Competitor
  // Engine (market gap berdampak besar).
  if (memory.baseline?.opportunity) {
    pushRec(
      recs,
      "next_90_days",
      "Kejar peluang jangka panjang dari analisis awal",
      memory.baseline.opportunity,
      "Susun rencana bertahap 90 hari untuk mengejar peluang ini.",
      "business_memory"
    );
  }
  const largeImpactOpportunities = opportunities.filter((o) => o.impact === "large");
  if (largeImpactOpportunities.length > 0) {
    const top = largeImpactOpportunities[0];
    pushRec(recs, "next_90_days", top.title, top.reason, top.action, "competitor");
  }

  return recs;
}
