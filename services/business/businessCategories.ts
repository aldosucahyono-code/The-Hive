// services/business/businessCategories.ts
//
// Taksonomi kategori bisnis (The Hive Platinum Workspace — Fase 1, hasil
// diskusi desain Claude+GPT 18-19 Jul 2026). Dua level per usulan GPT:
// Level 1 (13 kategori luas) dipakai sekarang; Level 2 (subkategori, mis.
// Kuliner -> Cafe/Restoran/Bakery) SENGAJA belum dibangun ("baru berguna
// nanti, bukan sekarang" — jangan menambah kerumitan sebelum benar-benar
// dibutuhkan lapisan eksekusi mana pun).
//
// PENTING: daftar ini HARUS SAMA PERSIS dengan:
// - constraint check di migrations/2026-07-19b_business_category.sql
// - BUSINESS_CATEGORY_KEYS di src/lib/businessCategories.ts (frontend,
//   duplikat karena src/ dan services/ tidak saling импor lintas boundary
//   bundler/Vercel function) — kalau ubah salah satu, ubah semuanya.

export const BUSINESS_CATEGORY_KEYS = [
  "kuliner",
  "retail",
  "jasa",
  "logistik",
  "manufaktur",
  "pertanian_perikanan",
  "pertambangan_energi",
  "kesehatan",
  "pendidikan",
  "properti",
  "teknologi",
  "pariwisata",
  "lainnya",
] as const;

export type BusinessCategoryKey = (typeof BUSINESS_CATEGORY_KEYS)[number];

export function isValidBusinessCategory(value: unknown): value is BusinessCategoryKey {
  return typeof value === "string" && (BUSINESS_CATEGORY_KEYS as readonly string[]).includes(value);
}
