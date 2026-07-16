// services/workspace/actionPlan/actionPlan.ts
//
// Baca & centang Rencana Aksi Beemo (lihat generateActionPlan.ts untuk cara
// pembuatannya via AI). Dipisah dari generateActionPlan.ts karena kedua
// fungsi di sini murni baca/tulis (tidak memanggil Claude) -- pola sama
// dengan generateLeadReferrals.ts (generate) vs listLeadReferrals.ts (baca).
//
// Hanya batch TERBARU (generated_at maksimum) yang ditampilkan -- batch
// lama SENGAJA tidak dihapus di generateActionPlan.ts (tidak pernah
// menghapus data pelanggan begitu saja), tapi rencana yang relevan untuk
// pengguna hanya rencana yang paling baru disusun.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkOwnership(businessProfileId: string, userId: string): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .maybeSingle();
  return !error && !!business && business.user_id === userId;
}

export async function listActionPlan(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: rows, error } = await supabase
    .from("business_action_plan_items")
    .select("id, batch_id, day_offset, title, description, completed, completed_at, generated_at")
    .eq("business_profile_id", businessProfileId)
    .order("generated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("listActionPlan error:", error);
    return { status: 500, body: { error: "Gagal memuat rencana aksi." } };
  }

  const allRows = rows || [];
  // Hanya batch dengan generated_at TERBARU yang relevan -- baris pertama
  // (setelah order desc) menentukan batch_id yang dipakai.
  const latestBatchId = allRows[0]?.batch_id ?? null;
  const items = latestBatchId ? allRows.filter((r) => r.batch_id === latestBatchId) : [];
  items.sort((a, b) => a.day_offset - b.day_offset);

  return { status: 200, body: { items, hasPlan: items.length > 0 } };
}

export async function toggleActionPlanItem(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const itemId = payload.itemId;
  const completed = payload.completed;

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!itemId || typeof itemId !== "string") {
    return { status: 400, body: { error: "itemId wajib diisi" } };
  }
  if (typeof completed !== "boolean") {
    return { status: 400, body: { error: "completed wajib diisi (boolean)" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: updated, error } = await supabase
    .from("business_action_plan_items")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("business_profile_id", businessProfileId)
    .select("id, completed, completed_at")
    .maybeSingle();

  if (error || !updated) {
    console.error("toggleActionPlanItem error:", error);
    return { status: 500, body: { error: "Gagal menyimpan status rencana aksi." } };
  }

  return { status: 200, body: { itemId, completed: updated.completed, completedAt: updated.completed_at } };
}
