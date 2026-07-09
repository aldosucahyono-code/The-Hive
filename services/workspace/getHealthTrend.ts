// services/workspace/getHealthTrend.ts
//
// BACAAN LANJUTAN dari Business Health Engine (Tahap 2.2) — TIDAK
// menghitung ulang apapun, murni membaca histori business_health yang
// SUDAH tersimpan. recalculateHealth.ts sengaja menyimpan baris BARU per
// dimensi setiap kali dihitung ulang (bukan menimpa baris lama), persis
// supaya bagian ini bisa membaca "perjalanan" skor per dimensi dari waktu
// ke waktu — lihat komentar di recalculateHealth.ts baris ~128.
//
// Dipakai oleh menu Growth (Tahap 2.3.1) untuk:
//   - Journey Progress per dimensi: skor pertama vs skor sekarang, plus
//     dimensi mana yang berubah paling besar ("biggest mover").
//   - Period Progress per dimensi: skor minggu lalu vs minggu ini.
//
// Catatan teknis: baris-baris yang di-insert dalam SATU pemanggilan
// recalculateBusinessHealth() (satu array insert = satu statement INSERT)
// berbagi nilai evaluated_at yang identik, karena now() di Postgres
// bersifat stabil per transaksi. Baris-baris itu dikelompokkan per
// evaluated_at untuk merekonstruksi "batch" tiap kali Business Update
// memicu penghitungan ulang — bukan logika baru, hanya cara membaca data
// yang sudah ada sesuai bentuk aslinya.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"] as const;
type Dimension = (typeof DIMENSIONS)[number];

type Batch = { evaluatedAt: string; scores: Partial<Record<Dimension, number>> };

export async function getHealthTrend(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: rows, error } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: true });

  if (error) {
    console.error("services/workspace/getHealthTrend error:", error);
    return { status: 500, body: { error: "Gagal memuat tren Business Health" } };
  }

  if (!rows || rows.length === 0) {
    return {
      status: 200,
      body: { journeyByDimension: null, periodByDimension: null, biggestMoverDimension: null },
    };
  }

  // Kelompokkan baris jadi batch per evaluated_at (1 batch = 1x
  // recalculateBusinessHealth = 1x Business Update dipicu).
  const batchesByTime = new Map<string, Batch>();
  for (const row of rows) {
    const key = row.evaluated_at as string;
    if (!batchesByTime.has(key)) batchesByTime.set(key, { evaluatedAt: key, scores: {} });
    batchesByTime.get(key)!.scores[row.dimension as Dimension] = row.score;
  }
  const batches = Array.from(batchesByTime.values()).sort((a, b) => a.evaluatedAt.localeCompare(b.evaluatedAt));

  const first = batches[0];
  const latest = batches[batches.length - 1];
  const previous = batches.length >= 2 ? batches[batches.length - 2] : null;

  const journeyByDimension: Record<string, { first: number; current: number; delta: number }> = {};
  let biggestMoverDimension: string | null = null;
  let biggestMoverAbs = -1;

  for (const dim of DIMENSIONS) {
    const firstScore = first.scores[dim];
    const currentScore = latest.scores[dim];
    if (typeof firstScore !== "number" || typeof currentScore !== "number") continue;
    const delta = currentScore - firstScore;
    journeyByDimension[dim] = { first: firstScore, current: currentScore, delta };
    if (Math.abs(delta) > biggestMoverAbs) {
      biggestMoverAbs = Math.abs(delta);
      biggestMoverDimension = dim;
    }
  }

  let periodByDimension: Record<string, { previous: number; current: number; delta: number }> | null = null;
  if (previous) {
    periodByDimension = {};
    for (const dim of DIMENSIONS) {
      const previousScore = previous.scores[dim];
      const currentScore = latest.scores[dim];
      if (typeof previousScore !== "number" || typeof currentScore !== "number") continue;
      periodByDimension[dim] = { previous: previousScore, current: currentScore, delta: currentScore - previousScore };
    }
  }

  return {
    status: 200,
    body: { journeyByDimension, periodByDimension, biggestMoverDimension },
  };
}
