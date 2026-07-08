import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Lang } from "./translations";

/** Kode locale untuk Intl/toLocaleDateString per bahasa. Menambah bahasa
 * baru (Jepang, Mandarin, Arab, dst.) cukup tambah satu baris di sini —
 * jangan ada lagi `lang === "id" ? "id-ID" : "en-US"` tersebar di komponen. */
export const LOCALE_MAP: Record<Lang, string> = {
  id: "id-ID",
  en: "en-US",
};

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (typeof translations)["id"];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "hive_lang";

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "id" || stored === "en") return stored;
  } catch {
    // localStorage tidak tersedia — pakai default.
  }
  return "id";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage tidak tersedia — pilihan bahasa tidak akan diingat, tidak fatal.
    }
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);
  }

  function toggleLang() {
    setLangState((prev) => (prev === "id" ? "en" : "id"));
  }

  const value: LanguageContextValue = {
    lang,
    setLang,
    toggleLang,
    t: translations[lang],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage() dipanggil di luar <LanguageProvider>.");
  }
  return ctx;
}

/** Satu-satunya tempat untuk mengisi placeholder "{nama}" di dalam string
 * kamus translations.ts. Semua komponen yang butuh interpolasi teks
 * bilingual WAJIB pakai ini — jangan bikin salinan sendiri per komponen
 * (dulu ada duplikat di Workspace.tsx sebelum dipusatkan ke sini). */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}
