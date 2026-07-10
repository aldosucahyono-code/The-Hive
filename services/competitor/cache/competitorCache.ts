// services/competitor/cache/competitorCache.ts
//
// TTL cache di atas tabel competitor_snapshots (lihat
// migrations/2026-07-10_competitor_engine.sql). Memanggil Google
// Places/Overpass setiap kali Workspace/Chat/PDF butuh data kompetitor
// itu boros dan tidak perlu — lanskap kompetitor tidak berubah dalam
// hitungan jam. Engine (engine/index.ts) memanggil getCachedSnapshot()
// dulu; hanya menjalankan pipeline penuh (provider->normalizer->engine)
// kalau cache kosong/kadaluarsa.

import { createClient } from "@supabase/supabase-js";
import type { CompetitorEngineResult } from "../types/index.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TTL_HOURS = 24 * 7; // seminggu — lanskap kompetitor UMKM lokal tidak berubah harian

export async function getCachedSnapshot(businessProfileId: string): Promise<CompetitorEngineResult | null> {
  const { data, error } = await supabase
    .from("competitor_snapshots")
    .select("result, expires_at")
    .eq("business_profile_id", businessProfileId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null; // kadaluarsa — caller akan menjalankan ulang pipeline

  return data.result as CompetitorEngineResult;
}

export async function saveSnapshot(
  businessProfileId: string,
  provider: CompetitorEngineResult["dataSource"],
  queryIndustry: string,
  queryLocation: string,
  result: CompetitorEngineResult
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("competitor_snapshots").insert({
    business_profile_id: businessProfileId,
    provider,
    query_industry: queryIndustry,
    query_location: queryLocation,
    result,
    expires_at: expiresAt,
  });

  if (error) {
    // Cache gagal ditulis bukan alasan menggagalkan seluruh request —
    // pengguna tetap dapat hasil engine, hanya saja permintaan berikutnya
    // akan menjalankan ulang pipeline (tidak fatal, hanya kurang efisien).
    console.error("[competitor] gagal menyimpan snapshot cache:", error);
  }
}
