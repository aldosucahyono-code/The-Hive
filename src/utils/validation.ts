// Kumpulan aturan validasi form wizard.
// Dipakai bersama oleh StepOne, StepTwo, StepThree supaya aturannya konsisten.

export function hasExcessiveRepetition(value: string): boolean {
  // Menangkap input seperti "aaa", "aaaaaaa", atau "!!!!!!"
  return /(.)\1{2,}/i.test(value.trim());
}

export function hasLowVariety(value: string): boolean {
  // Menangkap input seperti "wkwkwkwk" atau "abababab" yang lolos dari cek
  // repetisi berurutan. Sengaja HANYA diterapkan ke teks pendek (6-24 karakter):
  // kalimat asli yang lebih panjang wajar punya rasio huruf unik lebih rendah
  // (bahasa Indonesia banyak mengulang huruf umum seperti a, n, t, r, s, u),
  // jadi menerapkan ambang batas ini ke teks panjang akan menolak jawaban
  // yang sah — persis bug yang pernah terjadi di lapangan.
  const trimmed = value.trim().replace(/\s/g, "");
  if (trimmed.length < 6 || trimmed.length > 24) return false;
  const uniqueChars = new Set(trimmed.toLowerCase()).size;
  return uniqueChars / trimmed.length < 0.3;
}

export function isSpammy(value: string): boolean {
  return hasExcessiveRepetition(value) || hasLowVariety(value);
}

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const lettersOnlyPattern = /^[A-Za-zÀ-ÿ\s]+$/;

export function isValidNameLike(value: string, minLength = 3): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (!lettersOnlyPattern.test(trimmed)) return false;
  if (isSpammy(trimmed)) return false;
  return true;
}

const locationPattern = /^[A-Za-zÀ-ÿ0-9\s,.\-/]+$/;

export function isValidLocation(value: string, minLength = 10): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (!locationPattern.test(trimmed)) return false;
  if (countWords(trimmed) < 2) return false;
  if (isSpammy(trimmed)) return false;
  return true;
}

const freeTextPattern = /^[A-Za-zÀ-ÿ0-9\s,.\-!?()%'"/]+$/;

export function isValidFreeText(value: string, minLength = 7, minWords = 2): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (!freeTextPattern.test(trimmed)) return false;
  if (countWords(trimmed) < minWords) return false;
  if (isSpammy(trimmed)) return false;
  return true;
}

export function isValidBrandName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (isSpammy(trimmed)) return false;
  return true;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value.trim());
}

const prohibitedProfessionWords = [
  "pencuri",
  "maling",
  "hacker",
  "peretas",
  "penipu",
  "koruptor",
  "teroris",
  "pembunuh",
  "perampok",
  "bandit",
  "penjahat",
  "mafia",
  "preman",
  "pembajak",
  "penadah",
  "penyelundup",
  "pemerkosa",
  "pengedar",
  "pelacur",
  "germo",
  "calo",
  "penjudi",
  "rentenir",
  "penculik",
  "pemeras",
  "thief",
  "murderer",
  "terrorist",
  "scammer",
  "assassin",
  "kidnapper",
  "smuggler",
];

export function isProhibitedProfession(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return prohibitedProfessionWords.some((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(normalized);
  });
}

export function isValidProfesi(value: string, minLength = 3): boolean {
  if (!isValidNameLike(value, minLength)) return false;
  if (isProhibitedProfession(value)) return false;
  return true;
}

export function isValidOmset(value: string): boolean {
  return /[0-9]/.test(value);
}

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidPastDate(value: string): boolean {
  if (!value.trim()) return false;
  return value <= getTodayString();
}
