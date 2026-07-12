// services/notifications/markNotificationsSeen.ts
//
// Dipanggil setiap kali pengguna membuka dropdown lonceng (Workspace.tsx).
// Upsert satu baris di notification_reads (lihat
// migrations/2026-07-13_notification_reads.sql) -- SATU timestamp per
// business_profile, bukan per notifikasi, karena notifikasi di sini tidak
// pernah disimpan sebagai baris sendiri (lihat getNotifications.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function markNotificationsSeen(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notification_reads")
    .upsert({ business_profile_id: businessProfileId, last_seen_at: now, updated_at: now }, { onConflict: "business_profile_id" });

  if (error) {
    console.error("markNotificationsSeen: gagal menyimpan last_seen_at:", error);
    return { status: 500, body: { error: "Gagal menandai notifikasi sudah dibaca." } };
  }

  return { status: 200, body: { lastSeenAt: now } };
}
