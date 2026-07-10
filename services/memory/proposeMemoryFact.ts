// services/memory/proposeMemoryFact.ts
//
// Business Memory (Master Product Directive — Phase 1): titik masuk untuk
// mengusulkan fakta baru ke Business Memory. Dipanggil dari services/beemo/
// chat.ts ketika Beemo mendeteksi informasi penting yang layak diingat
// (mis. target market berubah, status legalitas berubah) — TAPI fakta itu
// TIDAK langsung dianggap benar (status default 'pending_approval'). Baru
// masuk ke getBusinessMemory() (dan dianggap "diketahui platform") setelah
// pemilik bisnis menyetujuinya lewat approveMemoryFact().
//
// Ini sengaja dipisah dari getBusinessMemory.ts (baca) supaya alur tulis
// fakta baru punya satu pintu masuk yang jelas, bukan ditulis manual dari
// banyak tempat dengan aturan berbeda-beda.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type ProposeMemoryFactInput = {
  businessProfileId: string;
  factKey: string;
  factValue: unknown;
  source: "chat" | "business_update" | "discovery" | "manual";
  rawContext?: string;
};

export async function proposeMemoryFact(input: ProposeMemoryFactInput): Promise<{ id: string } | null> {
  // Kalau ada fakta dengan key yang sama yang masih pending_approval untuk
  // business_profile ini, jangan bikin duplikat — cukup timpa value/context-
  // nya (masih baris yang sama, belum disetujui siapapun jadi aman diubah).
  const { data: existingPending } = await supabase
    .from("business_memory_facts")
    .select("id")
    .eq("business_profile_id", input.businessProfileId)
    .eq("fact_key", input.factKey)
    .eq("status", "pending_approval")
    .maybeSingle();

  if (existingPending) {
    const { error: updateError } = await supabase
      .from("business_memory_facts")
      .update({ fact_value: input.factValue, raw_context: input.rawContext || null, proposed_at: new Date().toISOString() })
      .eq("id", existingPending.id);

    if (updateError) {
      console.error("proposeMemoryFact: update existing pending error:", updateError);
      return null;
    }
    return { id: existingPending.id };
  }

  const { data, error } = await supabase
    .from("business_memory_facts")
    .insert({
      business_profile_id: input.businessProfileId,
      fact_key: input.factKey,
      fact_value: input.factValue,
      source: input.source,
      status: "pending_approval",
      raw_context: input.rawContext || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("proposeMemoryFact: insert error:", error);
    return null;
  }

  return { id: data.id };
}
