// services/business/checklistDimensionMap.ts
//
// Audit Juli 2026: sebelumnya dimensi marketing/operations/brand di Business
// Health BEKU SELAMANYA di angka tebakan AI hari pertama, karena tidak ada
// satu pun sinyal data yang menggerakkannya (hanya sales/finance/customer
// yang bergerak, dari Business Update). Ini menjadikan checklist harian
// ("Mission Today", lihat RUNNING_CHECKLIST_KEYS di Workspace.tsx) sebagai
// sinyal NYATA untuk 3 dimensi yang beku itu — jujur (berbasis aksi yang
// benar-benar dilakukan user, bukan dikarang), bukan AI menebak ulang.
//
// Peta ini SATU-SATUNYA sumber (dipakai checklistProgress.ts saat toggle,
// dan getBusinessHealth.ts untuk menyusun alasan per dimensi) — jangan
// hardcode ulang di tempat lain. Hanya checklist "bisnis berjalan" (run*)
// yang dipetakan; checklist "bisnis baru" (prep*) mendorong Stage Engine
// (kesiapan buka usaha), bukan skor kesehatan bisnis berjalan.
export const DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const CHECKLIST_DIMENSION_MAP: Record<string, Dimension> = {
  run1: "customer", // Follow up pelanggan lama
  run2: "finance", // Review margin keuntungan
  run3: "operations", // Audit stok barang
  // run4 "Isi Business Update minggu ini" sengaja TIDAK dipetakan — itu
  // proses pengisian data, bukan sinyal satu dimensi tunggal (mengisinya
  // sudah menggerakkan sales/finance/customer lewat recalculateBusinessHealth).
  run5: "operations", // Upload dokumentasi terbaru
  run6: "marketing", // Posting promosi/konten media sosial minggu ini
  run7: "brand", // Minta ulasan/testimoni dari pelanggan
};

// Kenaikan skor per checklist yang diselesaikan — kecil & deterministik
// (bukan AI), supaya tidak bisa "digembungkan" dan tetap konsisten dengan
// prinsip recalculateHealth.ts (input sama -> output sama).
export const CHECKLIST_DIMENSION_BOOST = 4;
