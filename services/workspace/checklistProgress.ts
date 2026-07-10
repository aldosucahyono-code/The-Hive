// services/workspace/checklistProgress.ts
//
// Living Business Loop (directive "CONTINUE — LIVING BUSINESS LOOP"): Mission
// Today checklist SEBELUMNYA hanya hidup sebagai React state di
// src/components/Workspace.tsx (Set<string> lokal, hilang setiap
// reload/logout — lihat migrations/2026-07-10_living_business_loop.sql §2).
// File ini menjadikannya EVENT nyata: checklist selesai tersimpan di
// business_checklist_progress, supaya Stage Engine (services/stage/
// determineStage.ts) punya sinyal objektif untuk business START — bukan
// menebak dari teks bebas.
//
// Setelah toggle, memicu getTodaySnapshot(..., forceRecompute:true) — sama
// pola dengan submitUpdate.ts — supaya Mission/Stage/Pulse berubah SAAT ITU
// JUGA, bukan menunggu snapshot besok (Event Pipeline, bukan refresh manual).

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

export async function getChecklistProgress(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: rows, error } = await supabase
    .from("business_checklist_progress")
    .select("item_key")
    .eq("business_profile_id", businessProfileId);

  if (error) {
    console.error("services/workspace/checklistProgress getChecklistProgress error:", error);
    return { status: 500, body: { error: "Gagal memuat progres checklist." } };
  }

  return { status: 200, body: { completedKeys: (rows || []).map((r) => r.item_key as string) } };
}

export async function toggleChecklistItem(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const itemKey = payload.itemKey;
  const completed = payload.completed;

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!itemKey || typeof itemKey !== "string") {
    return { status: 400, body: { error: "itemKey wajib diisi" } };
  }
  if (typeof completed !== "boolean") {
    return { status: 400, body: { error: "completed wajib diisi (boolean)" } };
  }
  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  if (completed) {
    const { error } = await supabase
      .from("business_checklist_progress")
      .upsert(
        { business_profile_id: businessProfileId, item_key: itemKey, completed_at: new Date().toISOString() },
        { onConflict: "business_profile_id,item_key" }
      );
    if (error) {
      console.error("services/workspace/checklistProgress toggle (complete) error:", error);
      return { status: 500, body: { error: "Gagal menyimpan progres checklist." } };
    }
  } else {
    const { error } = await supabase
      .from("business_checklist_progress")
      .delete()
      .eq("business_profile_id", businessProfileId)
      .eq("item_key", itemKey);
    if (error) {
      console.error("services/workspace/checklistProgress toggle (uncomplete) error:", error);
      return { status: 500, body: { error: "Gagal menyimpan progres checklist." } };
    }
  }

  // Event Pipeline: checklist selesai adalah event bisnis (sama seperti
  // Business Update) — picu Today Snapshot recompute supaya Stage/Mission
  // ikut berubah SAAT ITU JUGA. Kegagalan di sini tidak membatalkan toggle
  // yang sudah tersimpan, cukup dicatat.
  try {
    const { getTodaySnapshot } = await import("../today/computeSnapshot.js");
    await getTodaySnapshot(userId, { businessProfileId, forceRecompute: true });
  } catch (err) {
    console.error("services/workspace/checklistProgress: forceRecompute Today Snapshot gagal:", err);
  }

  return { status: 200, body: { itemKey, completed } };
}
