// services/memory/getPendingMemoryFacts.ts
//
// Business Memory (Master Product Directive — Phase 1): dipakai Workspace
// untuk menampilkan kartu "Beemo mengusulkan pembaruan..." — daftar fakta
// yang masih menunggu persetujuan pemilik bisnis (lihat proposeMemoryFact.ts
// dan reviewMemoryFact.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getPendingMemoryFacts(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: pending, error } = await supabase
    .from("business_memory_facts")
    .select("id, fact_key, fact_value, source, proposed_at, raw_context")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "pending_approval")
    .order("proposed_at", { ascending: false });

  if (error) {
    console.error("services/memory/getPendingMemoryFacts error:", error);
    return { status: 500, body: { error: "Gagal memuat fakta yang diusulkan Beemo." } };
  }

  return {
    status: 200,
    body: {
      pending: (pending || []).map((p) => ({
        id: p.id,
        factKey: p.fact_key,
        factValue: p.fact_value,
        source: p.source,
        proposedAt: p.proposed_at,
        rawContext: p.raw_context,
      })),
    },
  };
}
