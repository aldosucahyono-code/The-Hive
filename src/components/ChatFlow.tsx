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
  // Revisi UX Juli 2026 (arahan PO "Evaluasi Flow & UX THE HIVE" — Phase 1):
  // pesan singkat Beemo yang tampil sebagai bubble TERPISAH tepat sebelum
  // pertanyaan ini, khusus untuk pertanyaan PERTAMA di tiap tahap baru
  // (string statis) ATAU pertanyaan yang bereaksi ke jawaban SEBELUMNYA
  // (fungsi, mis. reaksi berdasar jenisBisnis — lihat industryReaction()).
  // Sengaja dipisah dari `prompt` (bukan digabung jadi satu string) supaya
  // questionText yang dikirim ke checkSemanticMatch() tetap murni teks
  // pertanyaan aslinya, tidak ikut tercampur narasi transisi/reaksi ini.
  transitionBefore?: string | ((d: WizardData) => string);
};

/** Ambil teks transitionBefore final — mendukung bentuk string statis
 * (pesan transisi antar-tahap) maupun fungsi (reaksi dinamis berdasarkan
 * jawaban sebelumnya, mis. jenis bisnis). */
function resolveTransitionBefore(tb: Question["transitionBefore"], d: WizardData): string | undefined {
  if (!tb) return undefined;
  return typeof tb === "function" ? tb(d) : tb;
}

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

/** Bugfix Juli 2026 (QA: "pertanyaan template dulu, terus reload/berubah
 * sendiri"): dipakai untuk menampilkan pertanyaan yang isinya dinamis
 * (bucketAnswer1/2, produkJasa) di riwayat percakapan yang SUDAH dijawab.
 * SEBELUM ini, riwayat selalu memanggil q.prompt(data) langsung -- yang
 * dievaluasi ULANG di setiap render, jadi kalau dynamicQuestions/
 * dynamicProdukJasaExamples baru selesai di-fetch SETELAH pengguna sudah
 * menjawab (mis. pengguna mengetik sangat cepat), teks pertanyaan yang
 * SUDAH ditampilkan & dijawab bisa "berubah sendiri" di riwayat -- padahal
 * jawaban pengguna sebenarnya menjawab teks yang LAMA. Field
 * bucketQuestion1/bucketQuestion2 sudah lama membekukan teks yang
 * benar-benar ditampilkan (lihat handleSubmitAnswer) -- fungsi ini
 * memakainya kalau tersedia, baru fallback ke q.prompt(data) kalau belum
 * (mis. saat masih dalam mode edit sebelum submit pertama kali). */
function frozenPrompt(q: Question, data: WizardData): string {
  if (q.field === "bucketAnswer1" && data.bucketQuestion1) return data.bucketQuestion1;
  if (q.field === "bucketAnswer2" && data.bucketQuestion2) return data.bucketQuestion2;
  return q.prompt(data);
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
const PRODUK_JASA_EXAMPLE_MAP: Array<{ keywords: string[]; id: [string, string]; en: [string, string]; reactionId: string; reactionEn: string }> = [
  {
    keywords: ["makan", "kuliner", "resto", "warung", "catering", "bakso", "sate", "nasi", "ayam", "seafood", "food"],
    id: ["Bakso urat komplit", "Ayam geprek sambal matah"],
    en: ["Full bakso meatball bowl", "Spicy sambal fried chicken"],
    reactionId: "Biasanya bisnis kuliner sangat dipengaruhi lokasi dan pelanggan yang datang kembali.",
    reactionEn: "Food businesses are usually heavily influenced by location and repeat customers.",
  },
  {
    keywords: ["kopi", "kedai", "cafe", "kafe", "coffee"],
    id: ["Kopi susu gula aren", "Es kopi kenangan"],
    en: ["Palm sugar milk coffee", "Iced signature coffee"],
    reactionId: "Bisnis kopi biasanya soal repeat order dan suasana tempatnya.",
    reactionEn: "Coffee businesses usually run on repeat orders and the vibe of the place.",
  },
  {
    keywords: ["fashion", "pakaian", "baju", "distro", "hijab", "konveksi", "clothing"],
    id: ["Kaos distro custom", "Hijab instan motif bunga"],
    en: ["Custom graphic t-shirts", "Ready-to-wear floral hijab"],
    reactionId: "Fashion biasanya soal tren yang bergerak cepat.",
    reactionEn: "Fashion is usually about trends that move fast.",
  },
  {
    keywords: ["jasa", "servis", "service", "konsultasi", "reparasi", "cuci"],
    id: ["Jasa reparasi AC rumah", "Konsultasi pajak UMKM"],
    en: ["Home AC repair service", "SME tax consulting"],
    reactionId: "Bisnis jasa biasanya soal kepercayaan pelanggan.",
    reactionEn: "Service businesses usually run on customer trust.",
  },
  {
    keywords: ["salon", "spa", "kecantikan", "beauty", "skincare"],
    id: ["Perawatan facial wajah", "Creambath rambut rileksasi"],
    en: ["Facial skin treatment", "Relaxing hair creambath"],
    reactionId: "Bisnis kecantikan biasanya soal kepercayaan dan pengalaman pelanggan.",
    reactionEn: "Beauty businesses are usually about trust and the customer experience.",
  },
  {
    // Toko HP/gadget/elektronik — kategori baru (QA Juli 2026: sebelumnya
    // jatuh ke contoh default nasi goreng/kopi walau jenisBisnis-nya sudah
    // jelas "Toko HP", karena belum ada kategori yang cocok).
    keywords: ["hp", "handphone", "ponsel", "gadget", "elektronik", "aksesoris", "laptop", "komputer", "gawai", "phone", "electronic"],
    id: ["Case & pelindung layar HP", "Charger dan aksesoris original"],
    en: ["Phone case & screen protector", "Original chargers & accessories"],
    reactionId: "Toko gadget/elektronik biasanya soal harga bersaing dan kelengkapan barang.",
    reactionEn: "Gadget/electronics stores usually compete on price and product range.",
  },
  {
    keywords: ["motor", "mobil", "otomotif", "bengkel", "onderdil", "spare part", "ban", "automotive"],
    id: ["Servis rutin motor matic", "Spare part & oli mesin mobil"],
    en: ["Routine scooter servicing", "Car spare parts & engine oil"],
    reactionId: "Bisnis otomotif biasanya soal kepercayaan teknis pelanggan.",
    reactionEn: "Automotive businesses usually run on customers' technical trust.",
  },
  {
    keywords: ["pendidikan", "les", "kursus", "bimbel", "sekolah", "pelatihan", "education", "tutoring"],
    id: ["Kelas les privat matematika", "Modul & materi kursus online"],
    en: ["Private math tutoring class", "Online course materials"],
    reactionId: "Bisnis pendidikan biasanya soal reputasi dan hasil nyata buat muridnya.",
    reactionEn: "Education businesses usually run on reputation and real results for students.",
  },
];
const DEFAULT_PRODUK_JASA_EXAMPLE: { id: [string, string]; en: [string, string] } = {
  id: ["Nasi goreng gerobak keliling", "Kopi susu gula aren"],
  en: ["Mobile cart fried rice", "Palm sugar milk coffee"],
};
const DEFAULT_INDUSTRY_REACTION = {
  id: "Aku mulai kebayang gambaran bisnismu.",
  en: "I'm starting to get a picture of your business.",
};

function produkJasaExamples(jenisBisnis: string, lang: "id" | "en"): [string, string] {
  const lower = (jenisBisnis || "").toLowerCase();
  const match = PRODUK_JASA_EXAMPLE_MAP.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  return match ? match[lang] : DEFAULT_PRODUK_JASA_EXAMPLE[lang];
}

// Revisi UX Juli 2026 (review PO Phase 1, poin 1-2: "Beemo harus terlihat
// sedang berpikir", "respons jangan statis, cukup if-else berdasar jenis
// bisnis, tidak perlu AI"): reaksi singkat berdasarkan kategori jenisBisnis
// yang BARU SAJA dijawab, ditampilkan sebagai transitionBefore pada
// pertanyaan produkJasa (pertanyaan berikutnya) — reuse kategori yang sama
// dengan PRODUK_JASA_EXAMPLE_MAP supaya kata kunci tidak dobel-didefinisikan
// di dua tempat yang bisa saling berbeda seiring waktu.
function industryReaction(jenisBisnis: string, lang: "id" | "en", isBaru: boolean): string {
  const raw = (jenisBisnis || "").trim();
  const lower = raw.toLowerCase();
  const match = PRODUK_JASA_EXAMPLE_MAP.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  const insight = match ? (lang === "id" ? match.reactionId : match.reactionEn) : DEFAULT_INDUSTRY_REACTION[lang];
  // Polishing pass (review ketiga, poin 2): echo balik teks jenisBisnis
  // PERSIS seperti yang diketik pengguna (bukan cuma "Menarik." generik),
  // supaya terasa didengar. Lalu penutup dibedakan bisnis baru vs eksisting
  // sesuai reminder PO ("tetap bedakan mana bisnis baru mana eksisting").
  const echo = raw
    ? lang === "id"
      ? `${raw} ya, menarik 😊`
      : `${raw}, interesting 😊`
    : lang === "id"
    ? "Menarik 😊"
    : "Interesting 😊";
  const closing = isBaru
    ? lang === "id"
      ? "Nanti aku perhatikan ini pas nyusun rencana buat kamu."
      : "I'll keep this in mind when I put your plan together."
    : lang === "id"
    ? "Ini yang bakal aku bandingkan dengan kondisi kamu sekarang."
    : "I'll compare this with your current situation.";
  return `${echo} ${insight} ${closing}`;
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
  // Bugfix Juli 2026 ("Dunia Pasir/Penyedia Pasir Besi Lumajang" masih
  // disodori contoh nasi goreng/kopi di pertanyaan produkJasa): sebelumnya
  // contoh itu dipetakan dari daftar keyword statis (PRODUK_JASA_EXAMPLE_MAP
  // di bawah) yang tidak mengenali jenis bisnis di luar daftarnya. Sekarang
  // Beemo AI ikut memikirkan 2 contoh produk/jasa yang benar-benar sesuai
  // nama & jenis bisnis ini, di-fetch BERSAMAAN dengan dynamicQuestions di
  // atas (endpoint yang sama, tidak ada panggilan/latency tambahan). Kalau
  // API gagal/belum siap saat pengguna sampai ke pertanyaan produkJasa,
  // produkJasaExamples() di bawah tetap fallback ke peta keyword statis.
  const [dynamicProdukJasaExamples, setDynamicProdukJasaExamples] = useState<[string, string] | null>(null);
  // Fitur baru Juli 2026 (directive PO: "kita akan menghadapi ratusan, ribuan,
  // jutaan kategori usaha... Claude adalah Beemo, bukan semuanya template") —
  // reaksi industri (dulu murni cocokkan kata kunci ke PRODUK_JASA_EXAMPLE_MAP
  // lewat industryReaction(), yang selalu jatuh ke fallback generik untuk
  // kategori di luar 8 daftar tetap, mis. "parfum") sekarang DIPIKIRKAN Beemo
  // AI sungguhan lewat endpoint yang SAMA (tidak ada panggilan/latency
  // tambahan) — lihat industryReaction di api/generate-wizard-questions.ts.
  const [dynamicIndustryReaction, setDynamicIndustryReaction] = useState<string | null>(null);
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
        if (
          res.ok &&
          Array.isArray(json.produkJasaExamples) &&
          json.produkJasaExamples.length === 2 &&
          json.produkJasaExamples.every((ex: unknown) => typeof ex === "string" && ex.trim().length > 0)
        ) {
          setDynamicProdukJasaExamples(json.produkJasaExamples as [string, string]);
        }
        if (res.ok && typeof json.industryReaction === "string" && json.industryReaction.trim().length > 0) {
          setDynamicIndustryReaction(json.industryReaction.trim());
        }
      } catch (err) {
        console.error("generate-wizard-questions error:", err);
        // Diamkan — pertanyaan fallback di bawah tetap membuat alur jalan.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.namaBisnis, data.jenisBisnis, data.jenisAnalisis, dynamicFetchStarted]);

  // Bugfix Juli 2026 (QA: "kalau perlu loading 5-8 detik gapapa, daripada
  // kasih pertanyaan template dulu terus reload/berubah sendiri" -- laporan
  // users menunjukkan pertanyaan produkJasa sempat tampil pakai contoh
  // fallback yang tidak nyambung ke bisnisnya, lalu TERLIHAT BERUBAH sendiri
  // begitu dynamicProdukJasaExamples selesai di-fetch, karena prompt()/
  // placeholder dievaluasi ulang tiap render, bukan dibekukan begitu
  // ditampilkan). Fix: JANGAN tampilkan pertanyaan produkJasa sama sekali
  // sampai dynamicProdukJasaExamples siap (maksimal 8 detik, lalu fallback
  // ke peta keyword supaya tidak macet selamanya kalau API benar-benar
  // gagal) -- pengguna cukup melihat indikator "mengetik" sebentar, BUKAN
  // pertanyaan yang nanti berubah sendiri di depan matanya.
  const [produkJasaExamplesTimedOut, setProdukJasaExamplesTimedOut] = useState(false);
  useEffect(() => {
    if (!dynamicFetchStarted || dynamicProdukJasaExamples || produkJasaExamplesTimedOut) return;
    const timeoutId = window.setTimeout(() => setProdukJasaExamplesTimedOut(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [dynamicFetchStarted, dynamicProdukJasaExamples, produkJasaExamplesTimedOut]);
  const produkJasaExamplesReady = !!dynamicProdukJasaExamples || produkJasaExamplesTimedOut;

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
        const [ex1, ex2] = dynamicProdukJasaExamples || produkJasaExamples(d.jenisBisnis, lang);
        return fill(t.chatFlow.askProdukJasa, d).replace("{contoh1}", ex1).replace("{contoh2}", ex2);
      },
      inputType: "text",
      placeholder: (dynamicProdukJasaExamples || produkJasaExamples(data.jenisBisnis, lang)).join(", ") + "...",
      validate: (v: string) => isValidFreeText(v, 3, 1),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
      // Revisi UX Juli 2026 (review PO): reaksi ke jenisBisnis yang BARU SAJA
      // dijawab, sebelum bertanya produkJasa — supaya Beemo terasa "berpikir"
      // soal bisnisnya, bukan cuma lanjut ke pertanyaan berikutnya begitu
      // saja. Sejak fitur "Beemo AI, bukan template" (Juli 2026): pakai
      // reaksi yang benar-benar DIPIKIRKAN AI (dynamicIndustryReaction, dari
      // panggilan yang sama dengan dynamicProdukJasaExamples, jadi sudah
      // siap di waktu yang sama -- lihat produkJasaExamplesReady di bawah)
      // kalau tersedia; fallback ke fungsi keyword statis kalau API gagal/
      // timeout, supaya alur tidak pernah macet.
      transitionBefore: (d) => dynamicIndustryReaction || industryReaction(d.jenisBisnis, lang, isBaru),
    },
    {
      field: "lokasi",
      prompt: (d) => fill(isBaru ? t.chatFlow.askLokasiNew : t.chatFlow.askLokasiRunning, d),
      inputType: "text",
      placeholder: t.stepTwo.lokasiPlaceholder,
      validate: isValidLocation,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kondisi",
      transitionBefore: t.chatFlow.transitionToKondisi,
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
      transitionBefore: t.chatFlow.transitionToTarget,
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
      transitionBefore: (d) => fill(t.chatFlow.transitionToStrategi, d),
    },
  ];

  // Revisi UX Juli 2026 (review PO: "jangan ada jawaban user yang hilang"
  // saat back/refresh) — kalau `data` datang sudah terisi sebagian (dipulihkan
  // dari localStorage oleh ChatWizard.tsx), lanjutkan dari pertanyaan pertama
  // yang BELUM terjawab, bukan mulai dari 0 lagi. Dihitung SEKALI saat mount
  // (lazy initializer) — perubahan `data` sesudahnya (lewat jawaban baru)
  // tetap lewat setAnsweredCount biasa, bukan dihitung ulang di sini.
  const [answeredCount, setAnsweredCount] = useState<number>(() => {
    let count = 0;
    for (const q of questions) {
      const val = data[q.field];
      if (typeof val === "string" && val.trim().length > 0) {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  });
  const [inputValue, setInputValue] = useState("");
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [botError, setBotError] = useState(false);
  // Revisi UX Juli 2026 (review PO: "Reflection" — sebelum Loading, Beemo
  // merangkum poin kunci yang sudah diceritakan pengguna). Murni baca ulang
  // `data` yang sudah ada, TIDAK ada panggilan AI baru. Ditampilkan sebentar
  // (REFLECTION_DISPLAY_MS) sebelum benar-benar pindah ke layar Loading.
  const [showingReflection, setShowingReflection] = useState(false);
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
  // Revisi UX Juli 2026 (review PO Phase 1, poin 4: "jangan hardcode estimasi
  // waktu, kalau bisa hitung dari average answer time") — lacak durasi nyata
  // antar-jawaban pengguna SENDIRI di sesi ini (bukan angka tetap), lalu
  // pakai rata-ratanya untuk memperkirakan sisa waktu. Murni state
  // presentasi di browser, tidak dikirim/disimpan ke manapun.
  const lastAnswerTimestampRef = useRef<number>(startTime);
  const answerDurationsMsRef = useRef<number[]>([]);

  const allAnswered = answeredCount >= questions.length;
  const activeQuestion = editingField
    ? questions.find((q) => q.field === editingField)!
    : questions[answeredCount];

  // Teks pesan bot yang "sedang" ditampilkan saat ini — baik itu pertanyaan
  // aktif, pertanyaan yang sedang diedit, maupun ringkasan penutup.
  function getCurrentBotText(): string | null {
    if (editingField) {
      const q = questions.find((qq) => qq.field === editingField);
      return q ? frozenPrompt(q, data) : null;
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
    // Bugfix Juli 2026 (lihat produkJasaExamplesReady di atas): jangan
    // kembalikan teks pertanyaan produkJasa sama sekali kalau contoh AI-nya
    // belum siap -- null di sini ditangani sebagai "masih menunggu" oleh
    // waitingForProdukJasa di bawah (tetap tampilkan indikator mengetik,
    // BUKAN pertanyaan yang nanti berubah sendiri).
    if (activeQuestion?.field === "produkJasa" && !produkJasaExamplesReady) return null;
    return activeQuestion ? activeQuestion.prompt(data) : null;
  }

  // Bugfix Juli 2026: true selama pertanyaan produkJasa BELUM siap
  // ditampilkan (menunggu dynamicProdukJasaExamples) -- dipakai untuk
  // memaksa indikator "mengetik" tetap tampil (bukan cuma sekali 450ms
  // seperti animasi biasa) dan menyembunyikan composer/input sampai
  // pertanyaannya benar-benar final, supaya tidak pernah ada teks yang
  // tampil dulu baru berubah di depan pengguna.
  const waitingForProdukJasa = !editingField && activeQuestion?.field === "produkJasa" && !produkJasaExamplesReady;

  const [revealedLength, setRevealedLength] = useState(0);
  const [showTypingDots, setShowTypingDots] = useState(false);
  const typingIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  // Bugfix Juli 2026 (directive PO: "saya tidak mau ada bug dalam chat
  // wizard" -- lihat catatan panjang di useEffect di bawah): dua ref
  // tambahan untuk safety-net supaya animasi reveal TIDAK PERNAH bisa
  // permanen macet dan menyembunyikan input jawaban dari pengguna.
  const typingHardTimeoutRef = useRef<number | null>(null);
  const typingVisibilityHandlerRef = useRef<(() => void) | null>(null);

  // Kunci unik per "pesan bot yang sedang tampil" — dipakai supaya animasi
  // mengetik cuma jalan sekali per pesan baru, bukan tiap kali komponen
  // render ulang (misalnya saat mengetik jawaban). Selama
  // waitingForProdukJasa, key-nya konstan ("produkJasa-waiting") supaya
  // efek reveal tidak berulang kali di-reset saat menunggu -- begitu siap
  // (produkJasaExamplesReady jadi true), key berubah ke `q-${answeredCount}`
  // yang baru, memicu animasi reveal berjalan SEKALI dengan teks final.
  const typingKey = editingField
    ? `edit-${editingField}`
    : emailStatus === "recognized"
      ? "email-recognized"
      : allAnswered
        ? "summary"
        : activeQuestion && semanticRetryField === activeQuestion.field
          ? `semantic-retry-${semanticRetryField}`
          : waitingForProdukJasa
            ? "produkJasa-waiting"
            : `q-${answeredCount}`;

  // Bugfix Juli 2026 (bug produksi nyata, ditemukan lewat uji coba end-to-end
  // wizard di production: pertanyaan "produk/jasa" macet PERMANEN di tengah
  // animasi mengetik -- teks berhenti beberapa karakter sebelum selesai dan
  // TIDAK PERNAH lanjut, input jawaban tidak pernah muncul karena render-nya
  // digerbang oleh `typingDone`, pengguna benar-benar terjebak tanpa cara
  // keluar selain reload dan kehilangan progres). Root cause: reveal lama
  // pakai setInterval yang nambah +3 karakter per tick 16ms -- kalau browser
  // men-throttle timer tab ini (umum terjadi untuk tab yang di-background,
  // atau di lingkungan otomatis/headless), interval bisa berhenti dipanggil
  // SAMA SEKALI di tengah jalan, dan karena progress-nya cuma "nambah dari
  // titik terakhir", dia tidak pernah "mengejar" ke posisi seharusnya.
  //
  // Fix (directive PO: "saya tidak mau ada bug dalam chat wizard" -- jadi
  // bukan cuma tambal, tapi bikin animasi ini TIDAK BISA macet permanen
  // dalam kondisi apa pun):
  // 1. Reveal sekarang berbasis WAKTU (elapsed ms sejak reveal mulai), bukan
  //    counter tetap -- begitu ada SATU tick saja yang sempat jalan (walau
  //    telat/jarang karena throttling), progress langsung dihitung ulang ke
  //    posisi yang SEHARUSNYA saat itu, bukan nambah dikit dari titik
  //    terakhir. Throttling jadi bikin animasi terlihat "lompat-lompat",
  //    bukan berhenti total.
  // 2. Listener visibilitychange: begitu tab kembali terlihat (mis. user
  //    balik dari app lain), reveal langsung dihitung ulang saat itu juga --
  //    tidak menunggu interval berikutnya yang mungkin juga di-throttle.
  // 3. Hard safety timeout: independen dari interval manapun, dijadwalkan
  //    sekali di awal untuk durasi teks + margin aman -- kalau karena alasan
  //    apa pun revealedLength belum juga mencapai akhir saat itu, dipaksa
  //    selesai. Ini jaring pengaman terakhir: apa pun yang terjadi ke
  //    interval/timer lain, input jawaban DIJAMIN muncul paling lama
  //    beberapa detik setelah pesan mulai tampil.
  useEffect(() => {
    if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    if (typingHardTimeoutRef.current) window.clearTimeout(typingHardTimeoutRef.current);
    if (typingVisibilityHandlerRef.current) {
      document.removeEventListener("visibilitychange", typingVisibilityHandlerRef.current);
      typingVisibilityHandlerRef.current = null;
    }

    const fullText = getCurrentBotText();
    setRevealedLength(0);

    if (fullText === null) {
      setShowTypingDots(false);
      return;
    }
    // Bugfix (Vercel build gagal, TS18047 — pola sama persis dengan bugfix
    // TS18048 di PreviewReport.tsx Juli 2026): narrowing "fullText !== null"
    // di atas TIDAK ikut terbawa ke dalam function declaration/closure
    // bersarang (arrow function setTimeout, apalagi function applyElapsedProgress
    // yang bersarang DUA level) -- TypeScript menganalisa isinya terpisah
    // dari titik deklarasi. Re-bind ke const baru dengan tipe eksplisit
    // supaya tidak ambigu string|null lagi di closure manapun.
    const fullTextValue: string = fullText;

    setShowTypingDots(true);
    typingTimeoutRef.current = window.setTimeout(() => {
      setShowTypingDots(false);

      const revealStartedAt = Date.now();
      const CHARS_PER_MS = 3 / 16; // kecepatan sama seperti sebelumnya (~187 char/detik)
      const totalRevealMs = fullTextValue.length / CHARS_PER_MS;

      function applyElapsedProgress() {
        const elapsed = Date.now() - revealStartedAt;
        const next = Math.min(fullTextValue.length, Math.ceil(elapsed * CHARS_PER_MS));
        setRevealedLength(next);
        return next;
      }

      typingIntervalRef.current = window.setInterval(() => {
        const next = applyElapsedProgress();
        if (next >= fullTextValue.length && typingIntervalRef.current) {
          window.clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 16);

      const handleVisibility = () => {
        if (document.visibilityState === "visible") applyElapsedProgress();
      };
      document.addEventListener("visibilitychange", handleVisibility);
      typingVisibilityHandlerRef.current = handleVisibility;

      typingHardTimeoutRef.current = window.setTimeout(() => {
        setRevealedLength(fullTextValue.length);
        if (typingIntervalRef.current) {
          window.clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, totalRevealMs + 1000);
    }, 450);

    return () => {
      if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (typingHardTimeoutRef.current) window.clearTimeout(typingHardTimeoutRef.current);
      if (typingVisibilityHandlerRef.current) {
        document.removeEventListener("visibilitychange", typingVisibilityHandlerRef.current);
        typingVisibilityHandlerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingKey]);

  const currentBotFullText = getCurrentBotText() || "";
  const typingDone = !showTypingDots && !waitingForProdukJasa && revealedLength >= currentBotFullText.length;

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

    // Catat durasi jawab pertanyaan ini (dipakai untuk estimasi waktu
    // tersisa yang benar-benar dihitung dari kecepatan pengguna sendiri —
    // lihat lastAnswerTimestampRef/answerDurationsMsRef di atas). Dibatasi
    // 2 detik–2 menit supaya jeda tidak wajar (mis. pengguna pindah tab lama)
    // tidak merusak estimasi, tapi tidak perlu presisi sempurna.
    const now = Date.now();
    const durationMs = Math.min(Math.max(now - lastAnswerTimestampRef.current, 2000), 120000);
    answerDurationsMsRef.current = [...answerDurationsMsRef.current, durationMs].slice(-6);
    lastAnswerTimestampRef.current = now;

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

  const REFLECTION_DISPLAY_MS = 2400;

  function handleProses() {
    const elapsed = Date.now() - startTime;
    const looksLikeBot = data.honeypot.trim().length > 0 || elapsed < 5000;
    if (looksLikeBot) {
      setBotError(true);
      return;
    }
    setBotError(false);
    // Tampilkan Reflection dulu sebentar, baru benar-benar pindah ke Loading
    // (onSuccess) — supaya terasa Beemo "berhenti sejenak merangkum",
    // bukan langsung lompat ke layar loading generik.
    setShowingReflection(true);
    window.setTimeout(() => {
      setLoading(true);
      onSuccess();
    }, REFLECTION_DISPLAY_MS);
  }

  /** Ringkasan hangat ("Reflection") berisi highlight jawaban yang sudah
   * diberikan — MURNI membaca field yang sudah ada di `data`, tidak ada
   * pemanggilan AI/API baru. Maksimal 5 baris supaya tetap ringkas dibaca
   * dalam beberapa detik sebelum pindah ke Loading. Teks bebas (tantangan/
   * target) dipotong kalau terlalu panjang — pure string slicing, bukan
   * diringkas AI. */
  function buildReflectionHighlights(): { label: string; value: string }[] {
    const items: { label: string; value: string }[] = [];
    const truncate = (s: string, max = 60) => (s.length > max ? s.slice(0, max).trim() + "…" : s);

    // Polishing pass (review ketiga, poin 7): format "label: value" persis
    // seperti dicontohkan PO ("✅ Nama usaha: Kopi Susu Cak Do"), reuse label
    // yang sama dengan tabel ringkasan edit (t.chatFlow.xLabel) supaya tidak
    // ada dua sumber teks label yang bisa berbeda seiring waktu. Hanya field
    // yang SUDAH terisi yang muncul -- tidak ada placeholder kosong.
    if (data.namaBisnis) items.push({ label: t.chatFlow.namaBisnisLabel, value: data.namaBisnis });
    if (data.jenisBisnis) items.push({ label: t.chatFlow.jenisBisnisLabel, value: data.jenisBisnis });
    if (data.produkJasa) items.push({ label: t.chatFlow.produkJasaLabel, value: truncate(data.produkJasa) });
    if (data.lokasi) items.push({ label: t.chatFlow.lokasiLabel, value: data.lokasi });
    if (isBaru && data.targetPelanggan) {
      items.push({ label: t.chatFlow.targetPelangganLabel, value: truncate(data.targetPelanggan) });
    } else if (!isBaru && data.sejakKapan) {
      items.push({ label: t.chatFlow.sejakKapanLabel, value: data.sejakKapan });
    }
    if (data.tantangan) items.push({ label: t.chatFlow.tantanganLabel, value: truncate(data.tantangan) });
    if (data.target) items.push({ label: t.chatFlow.targetLabel, value: truncate(data.target) });

    return items.slice(0, 6);
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
  // Revisi UX Juli 2026 (review PO Phase 1, poin 3: progress bar tampilkan
  // "Tahap X dari Y" juga, bukan cuma persen+nama tahap).
  const PHASE_ORDER: PhaseKey[] = ["kenal", "kondisi", "target", "strategi"];
  const currentStageNumber = allAnswered
    ? PHASE_ORDER.length
    : activeQuestion
      ? PHASE_ORDER.indexOf(activeQuestion.phase) + 1
      : 1;
  const stageLabelText = t.chatFlow.stageLabel
    .replace("{current}", String(currentStageNumber))
    .replace("{total}", String(PHASE_ORDER.length));
  const progressPercent = Math.round((answeredCount / questions.length) * 100);
  // Revisi UX Juli 2026 (review PO Phase 1, poin 4: "jangan hardcode, kalau
  // bisa hitung dari average answer time") — rata-rata durasi jawaban NYATA
  // pengguna ini sejauh ini (lihat answerDurationsMsRef), bukan angka tetap.
  // Sebelum ada data (pertanyaan pertama), pakai asumsi awal 20 detik yang
  // segera digantikan begitu ada jawaban pertama.
  const DEFAULT_AVG_SECONDS = 20;
  const recordedDurations = answerDurationsMsRef.current;
  const averageAnswerSeconds =
    recordedDurations.length > 0
      ? recordedDurations.reduce((sum, ms) => sum + ms, 0) / recordedDurations.length / 1000
      : DEFAULT_AVG_SECONDS;
  const remainingQuestionsCount = Math.max(0, questions.length - answeredCount);
  const estimatedMinutesLeft = Math.max(1, Math.ceil((remainingQuestionsCount * averageAnswerSeconds) / 60));
  const showEstimatedTime = !allAnswered && remainingQuestionsCount > 0;
  // Revisi UX Juli 2026 (review PO Phase 1, poin terakhir: checklist "Data
  // yang sudah kukenal") — subset field yang SELALU ada baik untuk usaha
  // baru maupun berjalan (targetPelanggan/sejakKapan berbeda tergantung
  // isBaru, jadi sengaja tidak diikutkan supaya daftar ini konsisten untuk
  // kedua jalur). Baca-saja dari `data` yang sudah ada, tidak ada field baru.
  const knownDataChecklist: { field: keyof WizardData; label: string }[] = [
    { field: "namaBisnis", label: t.chatFlow.namaBisnisLabel },
    { field: "jenisBisnis", label: t.chatFlow.jenisBisnisLabel },
    { field: "produkJasa", label: t.chatFlow.produkJasaLabel },
    { field: "lokasi", label: t.chatFlow.lokasiLabel },
    { field: "tantangan", label: t.chatFlow.tantanganLabel },
    { field: "target", label: t.chatFlow.targetLabel },
  ];
  // Polishing pass (review ketiga, poin 3): tampilkan VALUE-nya ("Nama usaha
  // 'Kopi Susu Cak Do'"), bukan sekadar label kosong -- dan hanya field yang
  // SUDAH terisi yang muncul (tidak ada lagi placeholder "○ belum diisi").
  const knownDataEntries = knownDataChecklist
    .map((c) => ({ label: c.label, value: ((data[c.field] as string) || "").trim() }))
    .filter((c) => c.value.length > 0)
    .map((c) => ({ ...c, value: c.value.length > 28 ? c.value.slice(0, 28).trim() + "…" : c.value }));

  return (
    <div className="flex h-[75dvh] max-h-[720px] min-h-[420px] flex-col">
      {/* Progress bar persisten — menggantikan teks "Step X dari Y" supaya
          terasa seperti aplikasi AI modern, bukan formulir/wizard. Revisi
          Juli 2026 (review PO Phase 1): tambah label "Tahap X dari Y" dan
          checklist ringkas data yang sudah dikenal. */}
      <div className="mb-2 flex-none">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          <span>{allAnswered ? "✅" : "🟡"}</span>
          <span>{stageLabelText}</span>
        </div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-600">
          <span>
            {currentPhaseLabel}
            {showEstimatedTime && (
              <span className="ml-2 font-normal text-neutral-400">
                · {t.chatFlow.estimatedTimeRemaining.replace("{menit}", String(estimatedMinutesLeft)).replace("{minutes}", String(estimatedMinutesLeft))}
              </span>
            )}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        {!allAnswered && knownDataEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
            <span className="font-medium text-neutral-400">{t.chatFlow.knownDataLabel}</span>
            {knownDataEntries.map((c) => (
              <span key={c.label} className="text-emerald-600">
                ✓ {c.label}: <span className="font-medium text-neutral-600">{c.value}</span>
              </span>
            ))}
          </div>
        )}
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
        {questions.slice(0, answeredCount).map((q) => {
          const transitionText = resolveTransitionBefore(q.transitionBefore, data);
          return (
            <div key={q.field as string} className="space-y-2">
              {transitionText && <ChatBubble role="bot" text={transitionText} />}
              <ChatBubble role="bot" text={frozenPrompt(q, data)} />
              <ChatBubble role="user" text={(data[q.field] as string) || ""} />
            </div>
          );
        })}

        {allAnswered && !editingField && (
          <div className="space-y-2">
            {showTypingDots ? (
              <TypingDots />
            ) : (
              <ChatBubble role="bot" text={currentBotFullText.slice(0, revealedLength)} />
            )}
            {typingDone && !showingReflection && (
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
            {/* Reflection (revisi UX Juli 2026, review PO) — muncul begitu
                pengguna klik Proses, menggantikan tabel edit di atas untuk
                sesaat sebelum benar-benar pindah ke layar Loading. Murni
                baca ulang `data` (lihat buildReflectionHighlights), tidak
                ada AI/panggilan baru. */}
            {typingDone && showingReflection && (
              <div className="space-y-2">
                <ChatBubble role="bot" text={t.chatFlow.reflectionIntro} />
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                  <ul className="space-y-1.5 text-sm text-neutral-800">
                    {buildReflectionHighlights().map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex-none text-emerald-600">✅</span>
                        <span>
                          <strong className="font-semibold">{item.label}:</strong> {item.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ChatBubble role="bot" text={t.chatFlow.reflectionClosing} />
              </div>
            )}
          </div>
        )}

        {activeQuestion && (!allAnswered || editingField) && (
          <div className="space-y-1.5">
            {/* Bubble transisi tahap (statis, tidak ikut animasi mengetik) —
                hanya tampil untuk pertanyaan pertama di tahap baru, dan tidak
                di mode edit (mengedit jawaban lama bukan "memasuki tahap
                baru"). Lihat transitionBefore di deklarasi questions[].
                Bugfix Juli 2026 (pola sama dengan waitingForProdukJasa di
                atas): SENGAJA disembunyikan selama waitingForProdukJasa,
                supaya reaksi industri yang AI-generated (dynamicIndustryReaction)
                tidak sempat tampil dulu pakai fallback keyword lalu "berubah
                sendiri" begitu API-nya selesai -- pengguna cukup lihat
                indikator mengetik sampai teksnya benar-benar final. */}
            {!editingField && !semanticChecking && !waitingForProdukJasa && semanticRetryField !== activeQuestion.field && resolveTransitionBefore(activeQuestion.transitionBefore, data) && (
              <ChatBubble role="bot" text={resolveTransitionBefore(activeQuestion.transitionBefore, data)!} />
            )}
            {showTypingDots || waitingForProdukJasa ? (
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

        {allAnswered && !editingField && typingDone && !showingReflection && (
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
