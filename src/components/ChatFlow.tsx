import { useEffect, useRef, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { hardNavigate } from "../utils/navigate";
import {
  isValidNameLike,
  isValidRoleOrCategory,
  isValidBrandName,
  isValidProfesi,
  isValidEmail,
  isValidPhone,
  isValidLocation,
  isValidOmset,
  isValidPastDate,
  isValidFutureDate,
  isValidFreeText,
  getTodayString,
} from "../utils/validation";

// Field yang jawabannya bebas (free text) dan rawan "tidak nyambung" dengan
// pertanyaan (directive PO: "jawaban harus sesuai dengan semua pertanyaan,
// jangan sampai jawaban user beda dari pertanyaan"). Field terstruktur
// (email, tanggal, nominal) sudah cukup aman lewat validate() biasa — tidak
// perlu cek semantik lagi. "nama"/"namaBisnis"/"jenisBisnis" sengaja
// DIKECUALIKAN: sulit didefinisikan "salah" secara semantik (nama orang/
// brand/bidang usaha memang bebas), jadi dibiarkan seperti sebelumnya.
const SEMANTIC_CHECK_FIELDS = new Set<keyof WizardData>([
  "profesi",
  "produkJasa",
  "lokasi",
  "targetPelanggan",
  "tantangan",
  "target",
  "ceritaVisi",
  "bucketAnswer1",
  "bucketAnswer2",
]);

/** Minta Beemo AI menilai apakah jawaban benar-benar relevan dengan
 * pertanyaan yang ditampilkan (bukan cek kualitas/kelengkapan — cuma
 * relevansi topik). Reuse endpoint generate-wizard-questions (mode baru)
 * supaya tidak nambah jumlah Vercel Serverless Function. Fail-open: kalau
 * API error/timeout/parsing gagal, anggap valid — jangan sampai gangguan
 * jaringan sesaat menghalangi pengunjung menyelesaikan wizard. */
async function checkSemanticMatch(
  questionText: string,
  answer: string,
  fieldKind: "lokasi" | "freeText",
  lang: "id" | "en"
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("/api/generate-wizard-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "validateAnswer", questionText, answer, fieldKind, lang }),
      signal: controller.signal,
    });
    if (!res.ok) return true;
    const json = await res.json();
    return json.valid !== false;
  } catch (err) {
    console.error("checkSemanticMatch error:", err);
    return true;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

type ChatFlowProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  startTime: number;
  onSuccess: () => void;
};

type InputKind = "text" | "email" | "textarea" | "date-past" | "date-future" | "currency";

type PhaseKey = "kenal" | "kondisi" | "target" | "strategi";

type Question = {
  field: keyof WizardData;
  prompt: (d: WizardData) => string;
  inputType: InputKind;
  placeholder?: string;
  validate: (value: string) => boolean;
  invalidNudge: string;
  phase: PhaseKey;
};

const todayString = getTodayString();

/** Ganti token {namaField} di template terjemahan dengan jawaban yang sudah
 * diberikan pengguna sejauh ini, supaya pertanyaan berikutnya terasa
 * menyambung/personal — bukan daftar pertanyaan lepas-lepas. */
function fill(template: string, data: WizardData): string {
  return template
    .replace(/\{nama\}/g, data.nama || "")
    .replace(/\{profesi\}/g, data.profesi || "")
    .replace(/\{namaBisnis\}/g, data.namaBisnis || "");
}

// Contoh produk/jasa untuk pertanyaan produkJasa (audit Juli 2026): SEBELUM
// ini, contohnya SELALU "Nasi goreng gerobak keliling"/"Kopi susu gula
// aren" tidak peduli jenisBisnis-nya apa — jadi pengguna yang jenis
// bisnisnya sudah jelas "Rumah Makan"/bakso tetap disodori contoh kopi.
// Dipetakan dari kata kunci di jenisBisnis (yang sudah dijawab SEBELUM
// pertanyaan ini muncul, lihat urutan questions di bawah) — bukan
// panggilan AI baru, supaya tidak ada jeda loading tepat sebelum
// pertanyaan ini tampil (beda dengan dynamicQuestions yang punya banyak
// waktu di background sebelum dipakai).
const PRODUK_JASA_EXAMPLE_MAP: Array<{ keywords: string[]; id: [string, string]; en: [string, string] }> = [
  {
    keywords: ["makan", "kuliner", "resto", "warung", "catering", "bakso", "sate", "nasi", "ayam", "seafood", "food"],
    id: ["Bakso urat komplit", "Ayam geprek sambal matah"],
    en: ["Full bakso meatball bowl", "Spicy sambal fried chicken"],
  },
  {
    keywords: ["kopi", "kedai", "cafe", "kafe", "coffee"],
    id: ["Kopi susu gula aren", "Es kopi kenangan"],
    en: ["Palm sugar milk coffee", "Iced signature coffee"],
  },
  {
    keywords: ["fashion", "pakaian", "baju", "distro", "hijab", "konveksi", "clothing"],
    id: ["Kaos distro custom", "Hijab instan motif bunga"],
    en: ["Custom graphic t-shirts", "Ready-to-wear floral hijab"],
  },
  {
    keywords: ["jasa", "servis", "service", "konsultasi", "reparasi", "cuci"],
    id: ["Jasa reparasi AC rumah", "Konsultasi pajak UMKM"],
    en: ["Home AC repair service", "SME tax consulting"],
  },
  {
    keywords: ["salon", "spa", "kecantikan", "beauty", "skincare"],
    id: ["Perawatan facial wajah", "Creambath rambut rileksasi"],
    en: ["Facial skin treatment", "Relaxing hair creambath"],
  },
  {
    // Toko HP/gadget/elektronik — kategori baru (QA Juli 2026: sebelumnya
    // jatuh ke contoh default nasi goreng/kopi walau jenisBisnis-nya sudah
    // jelas "Toko HP", karena belum ada kategori yang cocok).
    keywords: ["hp", "handphone", "ponsel", "gadget", "elektronik", "aksesoris", "laptop", "komputer", "gawai", "phone", "electronic"],
    id: ["Case & pelindung layar HP", "Charger dan aksesoris original"],
    en: ["Phone case & screen protector", "Original chargers & accessories"],
  },
  {
    keywords: ["motor", "mobil", "otomotif", "bengkel", "onderdil", "spare part", "ban", "automotive"],
    id: ["Servis rutin motor matic", "Spare part & oli mesin mobil"],
    en: ["Routine scooter servicing", "Car spare parts & engine oil"],
  },
  {
    keywords: ["pendidikan", "les", "kursus", "bimbel", "sekolah", "pelatihan", "education", "tutoring"],
    id: ["Kelas les privat matematika", "Modul & materi kursus online"],
    en: ["Private math tutoring class", "Online course materials"],
  },
];
const DEFAULT_PRODUK_JASA_EXAMPLE: { id: [string, string]; en: [string, string] } = {
  id: ["Nasi goreng gerobak keliling", "Kopi susu gula aren"],
  en: ["Mobile cart fried rice", "Palm sugar milk coffee"],
};

function produkJasaExamples(jenisBisnis: string, lang: "id" | "en"): [string, string] {
  const lower = (jenisBisnis || "").toLowerCase();
  const match = PRODUK_JASA_EXAMPLE_MAP.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  return match ? match[lang] : DEFAULT_PRODUK_JASA_EXAMPLE[lang];
}

function ChatFlow({ data, updateField, startTime, onSuccess }: ChatFlowProps) {
  const { t, lang } = useLanguage();
  const { sendLoginOtp, verifyOtpCode, user } = useAuth();
  const isBaru = data.jenisAnalisis === "baru";
  // Audit Juli 2026 (directive PO: gateway satu-satunya lewat Chat Wizard,
  // termasuk untuk user yang MEMANG sudah login mau tambah bisnis lain) —
  // kalau sesi login browser ini sudah ada, kita SUDAH TAHU emailnya, jadi
  // pertanyaan "siapa emailmu?" + pengecekan /api/check-email jadi
  // percuma/membingungkan (bisa saja malah menyapa "email ini sudah
  // terdaftar" ke pemilik email itu sendiri). Isi otomatis dari sesi &
  // lewati pertanyaannya sama sekali — lihat pemakaian isLoggedIn di bawah.
  const isLoggedIn = !!user;

  useEffect(() => {
    if (isLoggedIn && user?.email && !data.email) {
      updateField("email", user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.email]);

  // 2 pertanyaan "bucket info" dinamis — dihasilkan Beemo AI sesuai nama &
  // jenis bisnis pengguna (directive PO: "jangan mutlak dan mengacu saja
  // pada code... beemo benar2 memikirkan pertanyaan apa secara otomatis
  // sesuai dengan brand dan jenis bisnis"). Fetch dimulai sedini mungkin
  // (begitu jenisBisnis terisi) supaya sudah siap jauh sebelum pengguna
  // sampai ke pertanyaan ini beberapa langkah kemudian. Kalau gagal/belum
  // siap saat pengguna sampai di situ, jatuh ke pertanyaan fallback supaya
  // alur tidak pernah macet.
  const [dynamicQuestions, setDynamicQuestions] = useState<
    { question: string; placeholder: string }[] | null
  >(null);
  const [dynamicFetchStarted, setDynamicFetchStarted] = useState(false);

  useEffect(() => {
    if (dynamicFetchStarted) return;
    if (!data.namaBisnis || !data.jenisBisnis || !data.jenisAnalisis) return;
    setDynamicFetchStarted(true);

    (async () => {
      try {
        const res = await fetch("/api/generate-wizard-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jenisAnalisis: data.jenisAnalisis,
            namaBisnis: data.namaBisnis,
            jenisBisnis: data.jenisBisnis,
            lang,
          }),
        });
        const json = await res.json();
        if (res.ok && Array.isArray(json.questions) && json.questions.length === 2) {
          setDynamicQuestions(json.questions);
        }
      } catch (err) {
        console.error("generate-wizard-questions error:", err);
        // Diamkan — pertanyaan fallback di bawah tetap membuat alur jalan.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.namaBisnis, data.jenisBisnis, data.jenisAnalisis, dynamicFetchStarted]);

  const fallbackBucketQuestion1 = isBaru
    ? t.chatFlow.dynamicFallbackFranchiseQuestion
    : t.chatFlow.dynamicFallbackLegalQuestion;
  const fallbackBucketPlaceholder1 = isBaru
    ? t.stepTwo.dynamicFallbackFranchisePlaceholder
    : t.stepTwo.dynamicFallbackLegalPlaceholder;

  const questions: Question[] = [
    {
      field: "nama",
      prompt: () => t.chatFlow.greeting,
      inputType: "text",
      placeholder: t.stepOne.namaPlaceholder,
      validate: isValidNameLike,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    // Dilewati kalau sudah login (lihat isLoggedIn di atas) — email diisi
    // otomatis dari sesi, tidak perlu ditanya ulang atau dicek ke
    // /api/check-email (yang justru bisa menyapa pemiliknya sendiri dengan
    // "email ini sudah terdaftar").
    ...(isLoggedIn
      ? []
      : ([
          {
            field: "email",
            prompt: (d) => fill(t.chatFlow.askEmail, d),
            inputType: "email",
            placeholder: t.stepOne.emailPlaceholder,
            validate: isValidEmail,
            invalidNudge: t.chatFlow.invalidEmailNudge,
            phase: "kenal",
          },
        ] as Question[])),
    {
      field: "noHp",
      prompt: (d) => fill(t.chatFlow.askNoHp, d),
      inputType: "text",
      placeholder: t.stepOne.noHpPlaceholder,
      validate: isValidPhone,
      invalidNudge: t.chatFlow.invalidPhoneNudge,
      phase: "kenal",
    },
    {
      field: "profesi",
      prompt: () => t.chatFlow.askProfesi,
      inputType: "text",
      placeholder: t.stepOne.profesiPlaceholder,
      validate: isValidProfesi,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "namaBisnis",
      prompt: (d) => fill(t.chatFlow.askNamaBisnis, d),
      inputType: "text",
      placeholder: t.stepOne.namaBisnisPlaceholder,
      validate: isValidBrandName,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      // BUGFIX Juli 2026: dulu pakai isValidNameLike (huruf & spasi saja),
      // jadi kategori usaha wajar yang ada tanda baca (mis. "Konsultan
      // IT/AI", "F&B", "Jasa Outsourcing, IT, dan Pertambangan") selalu
      // ditolak. Lihat komentar isValidRoleOrCategory di utils/validation.ts.
      field: "jenisBisnis",
      prompt: (d) => fill(t.chatFlow.askJenisBisnis, d),
      inputType: "text",
      placeholder: t.stepOne.jenisBisnisPlaceholder,
      validate: isValidRoleOrCategory,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      // Produk/Jasa Utama (revisi Juli 2026) — lebih spesifik dari
      // jenisBisnis, dipakai buat mencari akun Instagram kompetitor yang
      // benar-benar relevan (lihat services/socialMedia/instagramProvider.ts),
      // bukan cuma nama bidang usaha yang terlalu umum. Contoh di pertanyaan
      // & placeholder-nya dinamis sesuai jenisBisnis (lihat
      // produkJasaExamples() di atas) — sebelumnya selalu contoh nasi
      // goreng/kopi walau jenisBisnis-nya sudah jelas beda (mis. bakso).
      field: "produkJasa",
      prompt: (d) => {
        const [ex1, ex2] = produkJasaExamples(d.jenisBisnis, lang);
        return fill(t.chatFlow.askProdukJasa, d).replace("{contoh1}", ex1).replace("{contoh2}", ex2);
      },
      inputType: "text",
      placeholder: produkJasaExamples(data.jenisBisnis, lang).join(", ") + "...",
      validate: (v: string) => isValidFreeText(v, 3, 1),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "lokasi",
      prompt: () => (isBaru ? t.chatFlow.askLokasiNew : t.chatFlow.askLokasiRunning),
      inputType: "text",
      placeholder: t.stepTwo.lokasiPlaceholder,
      validate: isValidLocation,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kondisi",
    },
    ...(isBaru
      ? ([
          {
            field: "targetPelanggan",
            prompt: () => t.chatFlow.askTargetPelanggan,
            inputType: "textarea",
            placeholder: t.stepTwo.targetPelangganPlaceholder,
            validate: (v: string) => isValidFreeText(v, 7, 2),
            invalidNudge: t.chatFlow.invalidNudge,
            phase: "kondisi",
          },
          {
            field: "rencanaLaunching",
            prompt: () => t.chatFlow.askRencanaLaunching,
            inputType: "date-future",
            validate: isValidFutureDate,
            invalidNudge: t.chatFlow.invalidDateFutureNudge,
            phase: "kondisi",
          },
        ] as Question[])
      : ([
          {
            field: "sejakKapan",
            prompt: () => t.chatFlow.askSejakKapan,
            inputType: "date-past",
            validate: isValidPastDate,
            invalidNudge: t.chatFlow.invalidDatePastNudge,
            phase: "kondisi",
          },
        ] as Question[])),
    {
      field: "omsetBulanan",
      prompt: () => (isBaru ? t.chatFlow.askModalAwal : t.chatFlow.askOmset),
      inputType: "currency",
      placeholder: isBaru ? t.stepTwo.omsetPlaceholderNew : t.stepTwo.omsetPlaceholderRunning,
      validate: isValidOmset,
      invalidNudge: t.chatFlow.invalidGenericNudge,
      phase: "kondisi",
    },
    // Dua pertanyaan "bucket info" wajib (directive PO: "maksimal dua
    // pertanyaan... sebagai analisa pull bucket info untuk mendukung
    // keputusanmu" — wajib, berlaku bisnis baru maupun berjalan). Isinya
    // DINAMIS dari Beemo AI (lihat dynamicQuestions di atas), bukan teks
    // statis — beda tiap nama/jenis bisnis. Kalau AI belum siap saat
    // pengguna sampai di sini, pakai fallback supaya alur tetap jalan.
    // Validasi longgar (isValidFreeText 3 karakter/1 kata) supaya jawaban
    // singkat seperti "belum ada" tetap lolos — ini fakta objektif bisnis,
    // bukan cerita panjang seperti tantangan/target.
    {
      field: "bucketAnswer1",
      prompt: () => dynamicQuestions?.[0]?.question || fallbackBucketQuestion1,
      inputType: "textarea",
      placeholder: dynamicQuestions?.[0]?.placeholder || fallbackBucketPlaceholder1,
      validate: (v: string) => isValidFreeText(v, 3, 1),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kondisi",
    },
    {
      field: "bucketAnswer2",
      prompt: () => dynamicQuestions?.[1]?.question || t.chatFlow.dynamicFallbackGenericQuestion2,
      inputType: "textarea",
      placeholder: dynamicQuestions?.[1]?.placeholder || t.stepTwo.dynamicFallbackGenericPlaceholder2,
      validate: (v: string) => isValidFreeText(v, 3, 1),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kondisi",
    },
    {
      field: "tantangan",
      prompt: (d) => fill(isBaru ? t.chatFlow.askTantanganNew : t.chatFlow.askTantanganRunning, d),
      inputType: "textarea",
      placeholder: isBaru ? t.stepThree.tantanganPlaceholderNew : t.stepThree.tantanganPlaceholderRunning,
      validate: (v: string) => isValidFreeText(v),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "target",
    },
    {
      field: "target",
      prompt: () => t.chatFlow.askTarget,
      inputType: "textarea",
      placeholder: isBaru ? t.stepThree.targetPlaceholderNew : t.stepThree.targetPlaceholderRunning,
      validate: (v: string) => isValidFreeText(v),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "target",
    },
    {
      field: "ceritaVisi",
      prompt: (d) => fill(t.chatFlow.askCeritaVisi, d),
      inputType: "textarea",
      placeholder: t.stepFour.placeholder,
      validate: (v: string) => isValidFreeText(v, 40, 10),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "strategi",
    },
  ];

  const [answeredCount, setAnsweredCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [botError, setBotError] = useState(false);
  const [editingField, setEditingField] = useState<keyof WizardData | null>(null);
  // "Kenali email yang sudah pernah gabung" — murni fitur UX, bukan gerbang
  // akses. Kalau email dikenali, tawarkan kirim kode masuk 6 digit
  // (verifikasi kepemilikan tetap wajib) alih-alih memaksa isi wizard dari
  // nol. Audit Juli 2026: dulu kirim magic link, sekarang kode 6 digit --
  // lihat catatan lengkap di AuthModal.tsx (link tetap gagal otp_expired
  // walau email paling baru diklik, gejala industri umum aplikasi email
  // memindai link duluan).
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "recognized">("idle");
  const [magicLinkState, setMagicLinkState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpCodeState, setOtpCodeState] = useState<"idle" | "verifying" | "error">("idle");
  // Validasi semantik (directive PO: "jawaban harus sesuai dengan
  // pertanyaan"): semanticChecking = sedang menunggu Beemo AI menilai
  // relevansi jawaban. semanticRetryField = field yang sedang diminta
  // dijawab ULANG karena percobaan SEBELUMNYA dinilai tidak nyambung.
  //
  // AUDIT Juli 2026: sebelumnya dibatasi HANYA 1x cek per field (percobaan
  // kedua langsung diterima apa adanya, tanpa dicek ulang sama sekali) —
  // celah ini yang menyebabkan lokasi mustahil seperti "Papua, Jawa Timur"
  // bisa lolos begitu percobaan pertama gagal lalu diisi ulang. Sekarang
  // divalidasi hingga MAX_SEMANTIC_ATTEMPTS kali per field; baru diterima
  // apa adanya SETELAH itu, supaya tetap ada jalan keluar kalau penilaian
  // AI memang meleset berulang, tapi tidak langsung membuka celah di
  // percobaan kedua.
  const [semanticChecking, setSemanticChecking] = useState(false);
  const [semanticRetryField, setSemanticRetryField] = useState<keyof WizardData | null>(null);
  const semanticAttemptCountsRef = useRef<Partial<Record<keyof WizardData, number>>>({});
  const MAX_SEMANTIC_ATTEMPTS = 2;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currencyInputRef = useRef<HTMLInputElement>(null);

  const allAnswered = answeredCount >= questions.length;
  const activeQuestion = editingField
    ? questions.find((q) => q.field === editingField)!
    : questions[answeredCount];

  // Teks pesan bot yang "sedang" ditampilkan saat ini — baik itu pertanyaan
  // aktif, pertanyaan yang sedang diedit, maupun ringkasan penutup.
  function getCurrentBotText(): string | null {
    if (editingField) {
      const q = questions.find((qq) => qq.field === editingField);
      return q ? q.prompt(data) : null;
    }
    if (emailStatus === "recognized") return t.chatFlow.emailRecognizedMessage;
    // BUGFIX Juli 2026: sebelumnya baris ini mengembalikan summaryIntro
    // mentah tanpa lewat fill(), jadi placeholder "{nama}" di template
    // ("Terima kasih banyak, {nama}...") tampil literal ke pengguna alih-alih
    // nama asli mereka. Ditemukan saat uji coba end-to-end wizard.
    if (allAnswered) return fill(t.chatFlow.summaryIntro, data);
    if (activeQuestion && semanticRetryField === activeQuestion.field) {
      return activeQuestion.field === "lokasi"
        ? t.chatFlow.semanticNudgeLocation
        : t.chatFlow.semanticNudgeGeneric;
    }
    return activeQuestion ? activeQuestion.prompt(data) : null;
  }

  const [revealedLength, setRevealedLength] = useState(0);
  const [showTypingDots, setShowTypingDots] = useState(false);
  const typingIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Kunci unik per "pesan bot yang sedang tampil" — dipakai supaya animasi
  // mengetik cuma jalan sekali per pesan baru, bukan tiap kali komponen
  // render ulang (misalnya saat mengetik jawaban).
  const typingKey = editingField
    ? `edit-${editingField}`
    : emailStatus === "recognized"
      ? "email-recognized"
      : allAnswered
        ? "summary"
        : activeQuestion && semanticRetryField === activeQuestion.field
          ? `semantic-retry-${semanticRetryField}`
          : `q-${answeredCount}`;

  useEffect(() => {
    if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);

    const fullText = getCurrentBotText();
    setRevealedLength(0);

    if (fullText === null) {
      setShowTypingDots(false);
      return;
    }

    setShowTypingDots(true);
    typingTimeoutRef.current = window.setTimeout(() => {
      setShowTypingDots(false);
      // Ringan: cuma setInterval biasa yang menambah panjang teks yang
      // ditampilkan sedikit demi sedikit — bukan library animasi.
      typingIntervalRef.current = window.setInterval(() => {
        setRevealedLength((prev) => {
          const next = prev + 3;
          if (next >= fullText.length) {
            if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
            return fullText.length;
          }
          return next;
        });
      }, 16);
    }, 450);

    return () => {
      if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingKey]);

  const currentBotFullText = getCurrentBotText() || "";
  const typingDone = !showTypingDots && revealedLength >= currentBotFullText.length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [answeredCount, editingField, revealedLength, showTypingDots]);

  function handleCurrencyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const oldValue = (data.omsetBulanan as string) || "";
    const rawValue = e.target.value;
    const newCursorPos = e.target.selectionStart ?? rawValue.length;
    const isSingleBackspace = rawValue.length === oldValue.length - 1;

    let workingDigits: string;
    let digitsBeforeCursor: number;
    const deletedChar = isSingleBackspace ? oldValue[newCursorPos] : undefined;

    if (isSingleBackspace && deletedChar && !/[0-9]/.test(deletedChar)) {
      const digitsBeforeOldCursor = oldValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
      const allDigits = oldValue.replace(/[^0-9]/g, "");
      workingDigits = allDigits.slice(0, digitsBeforeOldCursor - 1) + allDigits.slice(digitsBeforeOldCursor);
      digitsBeforeCursor = digitsBeforeOldCursor - 1;
    } else {
      workingDigits = rawValue.replace(/[^0-9]/g, "");
      digitsBeforeCursor = rawValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
    }

    const formatted = workingDigits ? "Rp" + Number(workingDigits).toLocaleString("id-ID") + ",-" : "";
    updateField("omsetBulanan", formatted);

    requestAnimationFrame(() => {
      const el = currencyInputRef.current;
      if (!el) return;
      let seen = 0;
      let newPos = el.value.length;
      if (digitsBeforeCursor <= 0) {
        newPos = 0;
      } else {
        for (let i = 0; i < el.value.length; i++) {
          if (/[0-9]/.test(el.value[i])) {
            seen++;
            if (seen === digitsBeforeCursor) {
              newPos = i + 1;
              break;
            }
          }
        }
      }
      el.setSelectionRange(newPos, newPos);
    });
  }

  async function handleSubmitAnswer() {
    if (!activeQuestion) return;
    const value = activeQuestion.inputType === "currency" ? (data.omsetBulanan as string) || "" : inputValue;

    if (!activeQuestion.validate(value)) {
      setShowError(true);
      return;
    }

    setShowError(false);

    // Cek relevansi semantik (bukan lagi editing dari ringkasan — di mode
    // edit dilewati, lihat catatan di bawah) — SEBELUM jawaban dianggap
    // final, supaya jawaban yang "tidak nyambung" dengan pertanyaan (mis.
    // alamat dijawab untuk pertanyaan posisi/peran) diminta ditulis ulang,
    // bukan langsung lolos ke pertanyaan berikutnya. Divalidasi hingga
    // MAX_SEMANTIC_ATTEMPTS kali per field (lihat catatan audit di
    // deklarasi state di atas) — bukan cuma sekali.
    const attemptsSoFar = semanticAttemptCountsRef.current[activeQuestion.field] || 0;
    if (!editingField && SEMANTIC_CHECK_FIELDS.has(activeQuestion.field) && attemptsSoFar < MAX_SEMANTIC_ATTEMPTS) {
      setSemanticChecking(true);
      const questionText = activeQuestion.prompt(data);
      const fieldKind = activeQuestion.field === "lokasi" ? "lokasi" : "freeText";
      const isMatch = await checkSemanticMatch(questionText, value, fieldKind, lang);
      setSemanticChecking(false);
      if (!isMatch) {
        // Percobaan gagal — minta ditulis ulang, JANGAN advance ke
        // pertanyaan berikutnya. Jawaban lama tidak disimpan.
        semanticAttemptCountsRef.current[activeQuestion.field] = attemptsSoFar + 1;
        setSemanticRetryField(activeQuestion.field);
        setInputValue("");
        return;
      }
    }
    if (semanticRetryField === activeQuestion.field) setSemanticRetryField(null);

    updateField(activeQuestion.field, value);
    // Simpan teks pertanyaan yang benar-benar ditampilkan (AI-generated atau
    // fallback) supaya konteksnya utuh saat dikirim ke generate-preview/
    // generate-report — activeQuestion.prompt(data) dievaluasi sekarang,
    // sebelum data berubah.
    if (activeQuestion.field === "bucketAnswer1") {
      updateField("bucketQuestion1", activeQuestion.prompt(data));
    } else if (activeQuestion.field === "bucketAnswer2") {
      updateField("bucketQuestion2", activeQuestion.prompt(data));
    }

    if (editingField) {
      setEditingField(null);
      setInputValue("");
      return;
    }

    const isEmailField = activeQuestion.field === "email";
    setAnsweredCount((prev) => prev + 1);
    setInputValue("");

    if (isEmailField) {
      setEmailStatus("checking");
      try {
        const response = await fetch("/api/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
        const json = await response.json();
        setEmailStatus(response.ok && json.exists ? "recognized" : "idle");
      } catch (err) {
        console.error("check-email error:", err);
        // Gagal cek -> tetap lanjutkan wizard seperti biasa, jangan
        // menghalangi orang baru gara-gara masalah jaringan sesaat.
        setEmailStatus("idle");
      }
    }
  }

  async function handleSendMagicLink() {
    setMagicLinkState("sending");
    setOtpCode("");
    setOtpCodeState("idle");
    const { error } = await sendLoginOtp(data.email);
    setMagicLinkState(error ? "error" : "sent");
  }

  async function handleVerifyRecognizedEmailCode(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || otpCodeState === "verifying") return;
    setOtpCodeState("verifying");
    const { error } = await verifyOtpCode(data.email, otpCode);
    if (error) {
      setOtpCodeState("error");
      return;
    }
    // Sukses -- session sudah aktif lewat onAuthStateChange (lihat
    // AuthContext.tsx). hardNavigate reload penuh ke #workspace, sama
    // seperti jalur login normal lainnya.
    hardNavigate("workspace");
  }

  function handleContinueAsNewAnalysis() {
    setEmailStatus("idle");
    setMagicLinkState("idle");
    setOtpCode("");
    setOtpCodeState("idle");
  }

  // Enter mengirim jawaban; di textarea, Shift+Enter tetap bikin baris baru
  // (pola chat yang sudah familiar bagi kebanyakan orang).
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const isTextarea = (e.target as HTMLElement).tagName === "TEXTAREA";
    if (isTextarea && e.shiftKey) return;
    e.preventDefault();
    handleSubmitAnswer();
  }

  function startEdit(field: keyof WizardData) {
    setEditingField(field);
    setInputValue((data[field] as string) || "");
    setShowError(false);
  }

  function handleProses() {
    const elapsed = Date.now() - startTime;
    const looksLikeBot = data.honeypot.trim().length > 0 || elapsed < 5000;
    if (looksLikeBot) {
      setBotError(true);
      return;
    }
    setBotError(false);
    setLoading(true);
    onSuccess();
  }

  function renderInput(question: Question) {
    const commonClass =
      "w-full rounded-2xl border bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary " +
      (showError ? "border-red-500" : "border-neutral-200");

    if (question.inputType === "textarea") {
      return (
        <textarea
          autoFocus
          rows={3}
          placeholder={question.placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={commonClass + " resize-none"}
        />
      );
    }
    if (question.inputType === "date-past" || question.inputType === "date-future") {
      return (
        <input
          autoFocus
          type="date"
          min={question.inputType === "date-future" ? todayString : undefined}
          max={question.inputType === "date-past" ? todayString : undefined}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={commonClass + " [color-scheme:light]"}
        />
      );
    }
    if (question.inputType === "currency") {
      return (
        <input
          ref={currencyInputRef}
          autoFocus
          type="text"
          inputMode="numeric"
          placeholder={question.placeholder}
          value={data.omsetBulanan}
          onChange={handleCurrencyChange}
          onKeyDown={handleKeyDown}
          className={commonClass}
        />
      );
    }
    return (
      <input
        autoFocus
        type={question.inputType === "email" ? "email" : "text"}
        placeholder={question.placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={commonClass}
      />
    );
  }

  const summaryRows: { label: string; field: keyof WizardData; group: string }[] = [
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.namaLabel, field: "nama" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.noHpLabel, field: "noHp" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.profesiLabel, field: "profesi" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.namaBisnisLabel, field: "namaBisnis" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.jenisBisnisLabel, field: "jenisBisnis" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.produkJasaLabel, field: "produkJasa" },
    { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.lokasiLabel, field: "lokasi" },
    ...(isBaru
      ? [
          { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.targetPelangganLabel, field: "targetPelanggan" as const },
          { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.rencanaLaunchingLabel, field: "rencanaLaunching" as const },
        ]
      : [{ group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.sejakKapanLabel, field: "sejakKapan" as const }]),
    {
      group: t.chatFlow.lokasiKondisiTitle,
      label: isBaru ? t.chatFlow.modalAwalLabel : t.chatFlow.omsetLabel,
      field: "omsetBulanan",
    },
    { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.bucketLabel1, field: "bucketAnswer1" },
    { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.bucketLabel2, field: "bucketAnswer2" },
    { group: t.chatFlow.tantanganTargetTitle, label: t.chatFlow.tantanganLabel, field: "tantangan" },
    { group: t.chatFlow.tantanganTargetTitle, label: t.chatFlow.targetLabel, field: "target" },
    { group: t.chatFlow.ceritaVisiTitle, label: t.chatFlow.ceritaVisiTitle, field: "ceritaVisi" },
  ];

  const groupedSummary: { group: string; rows: typeof summaryRows }[] = [];
  for (const row of summaryRows) {
    let bucket = groupedSummary.find((g) => g.group === row.group);
    if (!bucket) {
      bucket = { group: row.group, rows: [] };
      groupedSummary.push(bucket);
    }
    bucket.rows.push(row);
  }

  const showComposer =
    !!activeQuestion &&
    (!allAnswered || !!editingField) &&
    typingDone &&
    emailStatus !== "checking" &&
    emailStatus !== "recognized" &&
    !semanticChecking;

  const phaseLabels: Record<PhaseKey, string> = {
    kenal: t.chatFlow.phaseKenal,
    kondisi: t.chatFlow.phaseKondisi,
    target: t.chatFlow.phaseTarget,
    strategi: t.chatFlow.phaseStrategi,
  };
  const currentPhaseLabel = allAnswered
    ? t.chatFlow.phaseSelesai
    : activeQuestion
      ? phaseLabels[activeQuestion.phase]
      : "";
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="flex h-[75dvh] max-h-[720px] min-h-[420px] flex-col">
      {/* Progress bar persisten — menggantikan teks "Step X dari Y" supaya
          terasa seperti aplikasi AI modern, bukan formulir/wizard. */}
      <div className="mb-3 flex-none">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-600">
          <span>{currentPhaseLabel}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={data.honeypot}
          onChange={(e) => updateField("honeypot", e.target.value)}
        />
      </div>

      {/* Area pesan — bisa di-scroll, composer di bawah selalu terlihat */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-2 pr-2">
        {questions.slice(0, answeredCount).map((q) => (
          <div key={q.field as string} className="space-y-2">
            <ChatBubble role="bot" text={q.prompt(data)} />
            <ChatBubble role="user" text={(data[q.field] as string) || ""} />
          </div>
        ))}

        {allAnswered && !editingField && (
          <div className="space-y-2">
            {showTypingDots ? (
              <TypingDots />
            ) : (
              <ChatBubble role="bot" text={currentBotFullText.slice(0, revealedLength)} />
            )}
            {typingDone && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
                {groupedSummary.map((g) => (
                  <div key={g.group} className="mb-4 last:mb-0">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">{g.group}</h4>
                    {g.rows.map((row) => (
                      <div
                        key={row.field as string}
                        className="flex items-start justify-between gap-3 border-b border-neutral-100 py-1.5 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <span className="block text-neutral-600">{row.label}</span>
                          <strong className="break-words">{(data[row.field] as string) || "—"}</strong>
                        </div>
                        <button
                          onClick={() => startEdit(row.field)}
                          className="flex-none rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:border-primary/40 hover:text-neutral-900"
                        >
                          {t.chatFlow.editLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeQuestion && (!allAnswered || editingField) && (
          <div className="space-y-1.5">
            {showTypingDots ? (
              <TypingDots />
            ) : (
              <ChatBubble role="bot" text={currentBotFullText.slice(0, revealedLength)} />
            )}
          </div>
        )}

        {semanticChecking && (
          <div className="space-y-1.5">
            <TypingDots />
          </div>
        )}

        {emailStatus === "recognized" && typingDone && (
          <div className="space-y-3 pt-1">
            {magicLinkState === "sent" ? (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm text-neutral-800">{t.chatFlow.emailRecognizedSent}</p>
                <p className="text-xs leading-relaxed text-amber-800">{t.authModal.secrecyWarning}</p>
                <form onSubmit={handleVerifyRecognizedEmailCode} className="flex flex-col items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/[^0-9]/g, ""));
                      if (otpCodeState === "error") setOtpCodeState("idle");
                    }}
                    placeholder={t.chatFlow.emailRecognizedCodePlaceholder}
                    disabled={otpCodeState === "verifying"}
                    className="w-40 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-center text-lg tracking-[0.3em] text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-primary/50 focus:outline-none"
                  />
                  {otpCodeState === "error" && (
                    <p className="text-center text-xs text-red-600">{t.chatFlow.emailRecognizedCodeInvalidError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={!otpCode.trim() || otpCodeState === "verifying"}
                    className="w-40 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {otpCodeState === "verifying"
                      ? t.chatFlow.emailRecognizedCodeVerifyingButton
                      : t.chatFlow.emailRecognizedCodeSubmitButton}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMagicLink}
                    className="text-xs font-semibold text-primary underline hover:opacity-80"
                  >
                    {t.chatFlow.emailRecognizedResendButton}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <button
                  onClick={handleSendMagicLink}
                  disabled={magicLinkState === "sending"}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {magicLinkState === "sending"
                    ? t.chatFlow.emailRecognizedSending
                    : t.chatFlow.emailRecognizedSendButton}
                </button>
                {magicLinkState === "error" && (
                  <p className="text-sm text-red-600">{t.chatFlow.emailRecognizedError}</p>
                )}
                <button
                  onClick={handleContinueAsNewAnalysis}
                  className="w-full rounded-xl border border-neutral-300 py-3 text-sm text-neutral-700 hover:border-primary/40 hover:text-neutral-900"
                >
                  {t.chatFlow.emailRecognizedContinueButton}
                </button>
              </>
            )}
          </div>
        )}

        {allAnswered && !editingField && typingDone && (
          <div className="pt-1">
            {botError && <p className="mb-3 text-sm text-red-600">{t.chatFlow.botError}</p>}
            <button
              onClick={handleProses}
              disabled={loading}
              className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-4 text-black disabled:opacity-60"
            >
              <span className="text-base font-bold">
                {loading ? t.chatFlow.submitLoading : t.chatFlow.submitLabel}
              </span>
              <span className="text-xs font-medium opacity-80">{t.chatFlow.submitHelper}</span>
            </button>
          </div>
        )}
      </div>

      {/* Composer — selalu menempel di bawah, mirip aplikasi chat pada umumnya */}
      {showComposer && (
        <div className="mt-3 flex-none border-t border-neutral-200 pt-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">{renderInput(activeQuestion)}</div>
            <button
              onClick={handleSubmitAnswer}
              aria-label="send"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-black transition-transform hover:scale-105 active:scale-95"
            >
              ➤
            </button>
          </div>
          {showError && (
            <p className="mt-2 text-sm text-amber-600">⚠ {activeQuestion.invalidNudge}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-primary/30 bg-neutral-100 text-sm">
        🤖
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]"></span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]"></span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]"></span>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "bot" | "user"; text: string }) {
  const isBot = role === "bot";
  return (
    <div className={"flex items-end gap-2 " + (isBot ? "justify-start" : "justify-end")}>
      {isBot && (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-primary/30 bg-neutral-100 text-sm">
          🤖
        </div>
      )}
      <div
        className={
          "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed " +
          (isBot ? "rounded-bl-sm bg-neutral-100 text-neutral-800" : "rounded-br-sm bg-primary text-black")
        }
      >
        {text}
      </div>
    </div>
  );
}

export default ChatFlow;
