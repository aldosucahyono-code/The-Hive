// src/lib/businessCategories.ts
//
// Taksonomi kategori bisnis (The Hive Platinum Workspace — Fase 1). HARUS
// SAMA PERSIS dengan services/business/businessCategories.ts (backend) dan
// constraint di migrations/2026-07-19b_business_category.sql — duplikat
// karena src/ (bundle frontend) dan services/ (Vercel function) tidak
// saling impor lintas boundary. Kalau ubah salah satu, ubah semuanya.

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

export const BUSINESS_CATEGORY_ICON: Record<BusinessCategoryKey, string> = {
  kuliner: "🍜",
  retail: "🛍️",
  jasa: "🧰",
  logistik: "🚚",
  manufaktur: "🏭",
  pertanian_perikanan: "🌾",
  pertambangan_energi: "⛏️",
  kesehatan: "🩺",
  pendidikan: "📚",
  properti: "🏠",
  teknologi: "💻",
  pariwisata: "🧳",
  lainnya: "🐝",
};
