// services/memory/reviewMemoryFact.ts
//
// Business Memory (Master Product Directive — Phase 1): titik masuk untuk
// pemilik bisnis MENYETUJUI atau MENOLAK fakta yang diusulkan (lihat
// proposeMemoryFact.ts). Dipanggil dari action baru "reviewMemoryFact" di
// api/workspace.ts (lihat perubahan di file itu).
//
// Kalau fact_key yang sama sebelumnya sudah pernah approved, baris lama
// ditandai 'superseded' (bukan dihapus — jejak audit tetap ada) dan
// menunjuk ke baris baru lewat superseded_by, PERSIS pola versioning yang
// sudah dijelaskan di komentar migrations/2026-07-10_business_memory.sql.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function reviewMemoryFact(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const factId = payload.factId;
  const decision = payload.decision; // "approve" | "reject"

  if (!factId || typeof factId !== "string") {
    return { status: 400, body: { error: "factId wajib diisi" } };
  }
  if (decision !== "approve" && decision !== "reject") {
    return { status: 400, body: { error: "decision harus 'approve' atau 'reject'" } };
  }

  const { data: fact, error: factError } = await supabase
    .from("business_memory_facts")
    .select("id, business_profile_id, fact_key, status, business_profiles!inner(user_id)")
    .eq("id", factId)
    .single();

  if (factError || !fact) {
    return { status: 404, body: { error: "Fakta tidak ditemukan." } };
  }

  const owner = Array.isArray(fact.business_profiles) ? fact.business_profiles[0] : fact.business_profiles;
  if (!owner || owner.user_id !== userId) {
    return { status: 403, body: { error: "Fakta ini bukan milik akun ini." } };
  }

  if (fact.status !== "pending_approval") {
    return { status: 409, body: { error: "Fakta ini sudah diproses sebelumnya." } };
  }

  if (decision === "reject") {
    const { error } = await supabase
      .from("business_memory_facts")
      .update({ status: "rejected" })
      .eq("id", factId);

    if (error) {
      console.error("reviewMemoryFact: reject error:", error);
      return { status: 500, body: { error: "Gagal menolak fakta." } };
    }
    return { status: 200, body: { status: "rejected" } };
  }

  // approve: tandai fakta approved sebelumnya dengan fact_key sama sebagai
  // superseded, lalu setujui fakta baru ini.
  const { data: previousApproved } = await supabase
    .from("business_memory_facts")
    .select("id")
    .eq("business_profile_id", fact.business_profile_id)
    .eq("fact_key", fact.fact_key)
    .eq("status", "approved")
    .maybeSingle();

  const nowIso = new Date().toISOString();

  const { error: approveError } = await supabase
    .from("business_memory_facts")
    .update({ status: "approved", approved_at: nowIso, approved_by: userId })
    .eq("id", factId);

  if (approveError) {
    console.error("reviewMemoryFact: approve error:", approveError);
    return { status: 500, body: { error: "Gagal menyetujui fakta." } };
  }

  if (previousApproved) {
    const { error: supersedeError } = await supabase
      .from("business_memory_facts")
      .update({ status: "superseded", superseded_by: factId })
      .eq("id", previousApproved.id);

    if (supersedeError) {
      console.error("reviewMemoryFact: supersede error:", supersedeError);
      // Tidak menganggap ini gagal total — fakta baru sudah approved,
      // hanya jejak versioning fakta lama yang gagal ditandai. Dicatat
      // di log untuk ditindaklanjuti manual kalau perlu.
    }
  }

  return { status: 200, body: { status: "approved" } };
}
