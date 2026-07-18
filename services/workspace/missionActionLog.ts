// services/workspace/missionActionLog.ts
//
// Mission Action Log (lanjutan audit Claude + GPT, "Mission Today sebagai
// pusat pengalaman"): mencatat setiap kali user menandai prioritas #1 di
// Mission Today sebagai "Selesai" atau "Nanti" -- lihat catatan lengkap di
// migrations/2026-07-18_mission_action_log.sql.
//
// SENGAJA tidak mempengaruhi Rule Engine (services/today/computeSnapshot.ts)
// sama sekali -- ini murni pencatatan untuk analisis pola pemakaian di masa
// depan (roadmap GPT Fase 3), bukan input baru untuk ranking prioritas
// sekarang. Tidak ada endpoint "getX" untuk baca balik log ini dari client
// karena belum ada UI yang membutuhkannya -- kalau nanti Fase 3 benar-benar
// dikerjakan, baca langsung dari tabel ini via query analitik terpisah.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkOwnership(businessProfileId: string, userId: string): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();
  return !error && !!business && business.user_id === userId;
}

export async function logMissionAction(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const snapshotDate = payload.snapshotDate;
  const priorityKey = payload.priorityKey;
  const status = payload.status;

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!snapshotDate || typeof snapshotDate !== "string") {
    return { status: 400, body: { error: "snapshotDate wajib diisi" } };
  }
  if (!priorityKey || typeof priorityKey !== "string") {
    return { status: 400, body: { error: "priorityKey wajib diisi" } };
  }
  if (status !== "done" && status !== "later") {
    return { status: 400, body: { error: "status harus 'done' atau 'later'" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { error } = await supabase.from("mission_action_log").insert({
    business_profile_id: businessProfileId,
    snapshot_date: snapshotDate,
    priority_key: priorityKey,
    status,
  });

  if (error) {
    console.error("services/workspace/missionActionLog logMissionAction error:", error);
    // Kegagalan di sini TIDAK membatalkan aksi user di UI (localStorage
    // sudah menyimpan status-nya secara real-time terlepas dari ini) --
    // cukup dicatat, tidak dikembalikan sebagai error keras ke frontend
    // supaya tombol Selesai/Nanti tidak terasa "gagal" dari sisi user.
    return { status: 200, body: { logged: false } };
  }

  return { status: 200, body: { logged: true } };
}
