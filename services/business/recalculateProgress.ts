// services/business/recalculateProgress.ts
//
// BUSINESS ENGINE (Tahap 2.3) — Progress Engine.
//
// Sama seperti Business Health Engine: murni perhitungan, TIDAK ADA AI,
// TIDAK ADA prompt, tidak memanggil Claude. Dipanggil otomatis setelah
// Business Health selesai dihitung ulang (lihat submitUpdate.ts).
//
// Journey Progress   = titik saat ini dibanding progress_snapshot PALING
//                       AWAL (baseline) — titik awal ini TIDAK PERNAH berubah.
// Period Progress    = titik saat ini dibanding progress_snapshot
//                       SEBELUMNYA (minggu lalu vs minggu ini).
//
// Satu progress_snapshot dibuat/diperbarui per minggu kalender (Senin-Minggu)
// per business_profile — kalau dalam minggu yang sama ada beberapa Business
// Update, snapshot minggu itu di-UPDATE (bukan bikin baris baru), supaya
// tetap 1 snapshot = 1 periode.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Minggu, 1 = Senin, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export async function recalculateProgress(businessProfileId: string, currentBusinessScore: number): Promise<void> {
  const today = new Date();
  const periodStart = getWeekStart(today);
  const periodEnd = getWeekEnd(periodStart);

  // Cek apakah snapshot minggu ini sudah ada.
  const { data: existingSnapshot } = await supabase
    .from("progress_snapshots")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("period_type", "week")
    .eq("period_start", periodStart)
    .maybeSingle();

  let snapshotId: string;

  if (existingSnapshot) {
    await supabase
      .from("progress_snapshots")
      .update({ business_score: currentBusinessScore })
      .eq("id", existingSnapshot.id);
    snapshotId = existingSnapshot.id;
  } else {
    const { data: newSnapshot, error } = await supabase
      .from("progress_snapshots")
      .insert({
        business_profile_id: businessProfileId,
        period_type: "week",
        period_start: periodStart,
        period_end: periodEnd,
        business_score: currentBusinessScore,
      })
      .select("id")
      .single();

    if (error || !newSnapshot) {
      console.error("recalculateProgress: gagal membuat snapshot:", error);
      return;
    }
    snapshotId = newSnapshot.id;
  }

  // Ambil Business Update minggu ini untuk simpan business_metrics
  // (dinormalisasi, bukan JSON — sesuai prinsip skema sejak Tahap 1).
  const { data: weekUpdates } = await supabase
    .from("business_updates")
    .select("omset_value, pelanggan_baru")
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", `${periodStart}T00:00:00`)
    .lte("created_at", `${periodEnd}T23:59:59`);

  const totalOmset = (weekUpdates || []).reduce((sum, u) => sum + (u.omset_value || 0), 0);
  const totalPelangganBaru = (weekUpdates || []).reduce((sum, u) => sum + (u.pelanggan_baru || 0), 0);

  // Hapus dulu metrics lama snapshot ini, insert ulang yang baru — supaya
  // tetap akurat kalau ada beberapa update dalam minggu yang sama.
  await supabase.from("business_metrics").delete().eq("snapshot_id", snapshotId);
  await supabase.from("business_metrics").insert([
    { snapshot_id: snapshotId, metric_name: "omset", metric_value: totalOmset, metric_unit: "IDR" },
    { snapshot_id: snapshotId, metric_name: "pelanggan_baru", metric_value: totalPelangganBaru, metric_unit: "orang" },
  ]);
}
