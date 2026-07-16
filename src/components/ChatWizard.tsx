import { useEffect, useState } from "react";

import ChooseAnalysisType from "./ChooseAnalysisType";
import ChatFlow from "./ChatFlow";
import LoadingAI from "./LoadingAI";
import PreviewReport, { type PreviewData } from "./PreviewReport";
import WizardCapBlocked from "./WizardCapBlocked";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";

export type WizardData = {
  jenisAnalisis: "" | "baru" | "berjalan";
  nama: string;
  email: string;
  // Nomor HP — dikumpulkan untuk push notifikasi WhatsApp ke pelanggan
  // nanti setelah fitur itu diaktifkan (belum aktif sekarang, cuma
  // disimpan). Lihat business_profiles.phone_number (migrations/2026-07-12_business_phone_number.sql).
  noHp: string;
  profesi: string;
  namaBisnis: string;
  jenisBisnis: string;
  // Produk/Jasa Utama (revisi Juli 2026) — lebih spesifik dari jenisBisnis
  // (mis. jenisBisnis="Kuliner", produkJasa="Nasi goreng gerobak keliling").
  // Dipakai Medsos Kompetitor (Apify) untuk menyusun kata kunci pencarian
  // yang lebih akurat saat mencari akun Instagram kompetitor — lihat
  // services/socialMedia/instagramProvider.ts.
  produkJasa: string;
  // Bugfix Juli 2026 (QA audit: pertanyaan/reaksi produkJasa yang SUDAH
  // dijawab masih bisa "berubah sendiri" di riwayat chat begitu
  // dynamicProdukJasaExamples/dynamicIndustryReaction selesai di-fetch
  // TERLAMBAT, mis. lewat dari timeout 8 detik -- pola sama persis dengan
  // bucketQuestion1/2 di bawah, cuma belum pernah diterapkan ke produkJasa.
  // Membekukan teks pertanyaan & reaksi industri yang BENAR-BENAR
  // ditampilkan saat dijawab (lihat handleSubmitAnswer di ChatFlow.tsx),
  // dipakai frozenPrompt() untuk riwayat.
  produkJasaQuestion: string;
  produkJasaReaction: string;
  lokasi: string;
  sejakKapan: string;
  rencanaLaunching: string;
  omsetBulanan: string;
  targetPelanggan: string;
  // 2 pertanyaan "bucket info" wajib — isinya DINAMIS, dihasilkan Beemo AI
  // sesuai nama & jenis bisnis pengguna (lihat api/generate-wizard-questions.ts),
  // bukan teks statis. bucketQuestionN menyimpan teks pertanyaan yang benar-benar
  // ditampilkan (AI-generated atau fallback), supaya konteksnya utuh saat
  // dikirim ke generate-preview/generate-report.
  bucketQuestion1: string;
  bucketAnswer1: string;
  bucketQuestion2: string;
  bucketAnswer2: string;
  tantangan: string;
  target: string;
  ceritaVisi: string;
  honeypot: string;
};

// Revisi UX Juli 2026 (review PO: "jangan ada jawaban user yang hilang"
// saat back/refresh) — draft percakapan yang BELUM selesai disimpan ke
// localStorage BROWSER (murni sisi klien, sama sekali TIDAK menyentuh
// wizard_drafts di database maupun endpoint manapun). Kalau localStorage
// tidak bisa dipakai (mode privat/kuota penuh), degradasi jujur: progres
// tetap ada selama tab tidak ditutup (React state biasa), pengguna diberi
// peringatan lewat draftSaveWarning supaya tahu untuk tidak me-refresh.
const WIZARD_DRAFT_STORAGE_KEY = "hive_wizard_draft_inprogress";
const WIZARD_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 jam -- draft lebih lama dianggap basi, mulai dari nol lagi

type SavedWizardDraft = { data: WizardData; step: number; startTime: number; savedAt: number };

function loadSavedWizardDraft(): { data: WizardData; step: number; startTime: number } | null {
  try {
    const raw = window.localStorage.getItem(WIZARD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedWizardDraft> | null;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > WIZARD_DRAFT_MAX_AGE_MS) return null;
    // Hanya step 1 (percakapan) yang aman dipulihkan -- step 0 (belum pilih
    // jenis analisa) tidak ada progres untuk disimpan, dan step 6/7
    // bergantung pada hasil API sebelumnya yang sudah tidak relevan lagi.
    const restoredStep = parsed.step === 1 && parsed.data.jenisAnalisis ? 1 : 0;
    // startTime ASLI (bukan waktu mount ulang ini) dipulihkan juga --
    // dipakai ChatFlow.tsx untuk deteksi bot ("submit < 5 detik sejak
    // wizard dimulai"). Kalau tidak dipulihkan, submit tepat setelah resume
    // draft bisa salah dianggap bot padahal wizard sudah dimulai sejak lama.
    const restoredStartTime = typeof parsed.startTime === "number" ? parsed.startTime : Date.now();
    return { data: { ...initialData, ...parsed.data }, step: restoredStep, startTime: restoredStartTime };
  } catch {
    return null;
  }
}

function clearSavedWizardDraft() {
  try {
    window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
  } catch {
    // no-op -- localStorage memang tidak tersedia, tidak ada yang perlu dibersihkan
  }
}

// Audit Juli 2026 (masukan ChatGPT + QA: hasil preview hilang kalau tab
// ditutup sebelum login) — BEDA dari WIZARD_DRAFT_STORAGE_KEY di atas (itu
// untuk jawaban yang BELUM selesai, step 1). Key ini menyimpan id hasil
// preview yang SUDAH SELESAI (step 7), disimpan ke wizard_drafts server
// lewat /api/save-submission segera setelah preview jadi -- lihat
// runPreviewAnalysis(). Kalau tab ditutup dan dibuka lagi, id ini dipakai
// untuk memuat ulang hasil yang SAMA dari server (api/get-preview-draft),
// bukan mengulang wizard atau memanggil Claude lagi.
const PREVIEW_RESULT_STORAGE_KEY = "hive_preview_draft_id";
const PREVIEW_RESULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari -- lebih lama dari draft jawaban (24 jam) karena stakes-nya beda: ini hasil JADI yang sudah dibayar dengan waktu tunggu, sayang dibuang cepat

function savePreviewResultId(id: string) {
  try {
    window.localStorage.setItem(PREVIEW_RESULT_STORAGE_KEY, JSON.stringify({ id, savedAt: Date.now() }));
  } catch {
    // no-op -- localStorage tidak tersedia, degradasi jujur (tidak ada pemulihan kalau tab ditutup, tapi tidak menggagalkan apa pun yang terlihat pengguna)
  }
}

function loadPreviewResultId(): string | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; savedAt?: number } | null;
    if (!parsed?.id || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > PREVIEW_RESULT_MAX_AGE_MS) return null;
    return parsed.id;
  } catch {
    return null;
  }
}

function clearPreviewResultId() {
  try {
    window.localStorage.removeItem(PREVIEW_RESULT_STORAGE_KEY);
  } catch {
    // no-op
  }
}

const initialData: WizardData = {
  jenisAnalisis: "",
  nama: "",
  email: "",
  noHp: "",
  profesi: "",
  namaBisnis: "",
  jenisBisnis: "",
  produkJasa: "",
  produkJasaQuestion: "",
  produkJasaReaction: "",
  lokasi: "",
  sejakKapan: "",
  rencanaLaunching: "",
  omsetBulanan: "",
  targetPelanggan: "",
  bucketQuestion1: "",
  bucketAnswer1: "",
  bucketQuestion2: "",
  bucketAnswer2: "",
  tantangan: "",
  target: "",
  ceritaVisi: "",
  honeypot: "",
};

// Step 0: pilih jenis analisis
// Step 1: percakapan (ChatFlow menangani seluruh alur tanya-jawab + ringkasan)
// Step 6: loading AI
// Step 7: hasil preview
function ChatWizard() {
  const { lang, t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  // Revisi UX Juli 2026 (review PO: jangan hilangkan jawaban user saat
  // back/refresh) — dicoba dipulihkan SEKALI saat mount (lazy initializer),
  // dari localStorage browser. Kalau tidak ada draft valid, mulai dari nol
  // seperti biasa.
  const [restoredDraft] = useState(() => loadSavedWizardDraft());
  const [step, setStep] = useState(() => restoredDraft?.step ?? 0);
  const [data, setData] = useState<WizardData>(() => restoredDraft?.data ?? initialData);
  const [startTime] = useState(() => restoredDraft?.startTime ?? Date.now());
  const [draftWasRestored] = useState(() => !!restoredDraft);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  // wizard_drafts.id begitu save-submission berhasil (lihat
  // runPreviewAnalysis) — diteruskan ke PreviewReport supaya autoPromote di
  // sana bisa langsung promoteDraft dengan id ini, TANPA memanggil
  // save-submission kedua kalinya (dulu dua-duanya insert baris sendiri).
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  // Audit Juli 2026 (masukan ChatGPT + QA: "user isi 15 pertanyaan, tunggu
  // hampir 1 menit, lalu tab tertutup -- semua hilang") — kalau TIDAK ada
  // draft jawaban yang sedang berjalan (restoredDraft null, berarti bukan
  // kasus "lagi ngobrol lalu refresh"), tapi ADA id hasil preview yang
  // sudah selesai tersimpan, coba muat ulang hasil itu dari server SEBELUM
  // render apa pun -- supaya pengunjung yang balik lagi langsung melihat
  // hasil yang sama, bukan diminta mengulang wizard dari nol.
  const [checkingPreviewRestore, setCheckingPreviewRestore] = useState(() => !restoredDraft && !!loadPreviewResultId());
  useEffect(() => {
    if (!checkingPreviewRestore) return;
    const savedId = loadPreviewResultId();
    if (!savedId) {
      setCheckingPreviewRestore(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/get-preview-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: savedId }),
        });
        const json = await response.json();
        if (!cancelled && response.ok && json.preview && json.wizardData) {
          setData({ ...initialData, ...json.wizardData });
          setPreviewData(json.preview as PreviewData);
          setPreviewReady(true);
          setPreviewDraftId(savedId);
          setStep(7);
        } else if (!cancelled) {
          // Draft tidak ditemukan/kadaluwarsa di server -- bersihkan id
          // lokal supaya tidak dicoba lagi tiap mount, mulai dari nol.
          clearPreviewResultId();
        }
      } catch (err) {
        console.error("restore preview draft error:", err);
      } finally {
        if (!cancelled) setCheckingPreviewRestore(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingPreviewRestore]);
  // Audit Juli 2026 (directive PO: "satu-satunya pintu... hanya lewat chat
  // wizzard") — kalau pengunjung SUDAH LOGIN (mis. lewat tombol "Tambah
  // Bisnis" di Workspace, atau Workspace yang masih kosong), cek batas
  // jumlah bisnis paket (free 2/pro 3/platinum 5) SEBELUM pertanyaan
  // apapun ditampilkan — supaya tidak isi form penuh dulu baru ditolak di
  // akhir. Pengunjung anonim (belum login) TIDAK kena gate ini sama sekali,
  // sama seperti alur "coba gratis" biasa.
  const [capCleared, setCapCleared] = useState(false);

  function updateField(field: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function restart() {
    clearSavedWizardDraft();
    clearPreviewResultId();
    setData(initialData);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewReady(false);
    setPreviewDraftId(null);
    setStep(0);
  }

  // Revisi UX Juli 2026 (review PO: jangan hilangkan jawaban user) — simpan
  // draft ke localStorage tiap kali `data` berubah, TAPI hanya selama masih
  // di percakapan (step 1). Step 0 belum ada apapun untuk disimpan; step 6/7
  // sudah diproses lewat generate-preview (server), draft klien tidak
  // relevan lagi di titik itu.
  useEffect(() => {
    if (step !== 1) return;
    try {
      window.localStorage.setItem(
        WIZARD_DRAFT_STORAGE_KEY,
        JSON.stringify({ data, step, startTime, savedAt: Date.now() })
      );
      if (draftSaveFailed) setDraftSaveFailed(false);
    } catch {
      setDraftSaveFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, step]);

  async function runPreviewAnalysis() {
    setPreviewReady(false);
    setPreviewError(null);

    // Batas waktu di sisi browser — kalau server tidak merespons dalam waktu
    // wajar (55 detik, sedikit di bawah batas 60 detik function di Vercel),
    // gagalkan secara terkendali dan tampilkan pesan error + tombol coba
    // lagi, daripada layar loading menggantung tanpa kepastian.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardData: data, lang }),
        signal: controller.signal,
      });

      // Bugfix Juli 2026 (laporan PO: submit gagal, muncul "Terjadi
      // kesalahan jaringan" padahal request sebenarnya sampai ke server) —
      // sebelumnya response.json() dipanggil langsung di try yang sama
      // dengan fetch(), jadi kalau server membalas body yang BUKAN JSON
      // valid (mis. halaman error generik dari platform saat function
      // crash sebelum sempat balas JSON), error parse itu jatuh ke catch
      // paling luar dan SALAH dilabeli sebagai error jaringan (padahal
      // request-nya sukses terkirim). Sekarang parse JSON dipisah supaya
      // bisa dibedakan dengan jelas dari kegagalan fetch/koneksi asli.
      let json: { preview?: PreviewData; error?: string } | null = null;
      try {
        json = await response.json();
      } catch (parseErr) {
        console.error("runPreviewAnalysis: respons server bukan JSON valid:", parseErr, "status:", response.status);
        setPreviewError(t.chatWizard.previewErrorGeneric);
        setPreviewData(null);
        return;
      }

      if (!response.ok) {
        setPreviewError(json?.error || t.chatWizard.previewErrorGeneric);
        setPreviewData(null);
      } else {
        const preview = (json?.preview as PreviewData) ?? null;
        setPreviewData(preview);

        // Audit Juli 2026 (masukan ChatGPT + QA: "hasil preview hilang
        // kalau tab ditutup") — simpan SEGERA ke wizard_drafts server (fire
        // and forget, tidak menunda tampilan hasil ke pengguna) supaya ada
        // sesuatu untuk dipulihkan kalau tab ini ditutup sebelum login.
        // Sebelumnya save-submission cuma dipanggil saat auto-promote di
        // PreviewReport.tsx (yang mengharuskan user SUDAH login) -- jadi
        // pengunjung anonim yang menutup tab kehilangan hasilnya permanen.
        if (preview) {
          fetch("/api/save-submission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wizardData: data, preview, lang }),
          })
            .then((r) => r.json())
            .then((saveJson) => {
              if (saveJson?.id) {
                savePreviewResultId(saveJson.id);
                setPreviewDraftId(saveJson.id);
              }
            })
            .catch((err) => console.error("runPreviewAnalysis: save-submission gagal:", err));
        }
      }
    } catch (err) {
      console.error("runPreviewAnalysis error:", err);
      if (err instanceof Error && err.name === "AbortError") {
        setPreviewError(t.chatWizard.previewErrorTimeout);
      } else {
        setPreviewError(t.chatWizard.previewErrorNetwork);
      }
      setPreviewData(null);
    } finally {
      clearTimeout(timeoutId);
      setPreviewReady(true);
    }
  }

  useEffect(() => {
    if (step === 6) {
      runPreviewAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function retryPreview() {
    setStep(6);
  }

  if (authLoading || checkingPreviewRestore) {
    return (
      <section className="mx-auto flex min-h-[40vh] max-w-lg items-center justify-center px-6 py-20 text-center">
        <p className="text-neutral-600">{t.wizardCapBlocked.checkingLabel}</p>
      </section>
    );
  }

  if (user && !capCleared) {
    return <WizardCapBlocked onUnblocked={() => setCapCleared(true)} colorScheme="light" />;
  }

  if (step === 0) {
    return (
      <ChooseAnalysisType
        onChoose={(type) => {
          updateField("jenisAnalisis", type);
          setStep(1);
        }}
      />
    );
  }

  if (step === 6) {
    return <LoadingAI ready={previewReady} onDone={() => setStep(7)} />;
  }

  if (step === 7) {
    return (
      <PreviewReport
        data={data}
        preview={previewData}
        error={previewError}
        onRetry={retryPreview}
        onRestart={restart}
        draftId={previewDraftId}
      />
    );
  }

  // step === 1: seluruh percakapan
  return (
    <section className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      {draftWasRestored && (
        <p className="mb-3 text-center text-xs font-medium text-neutral-500">{t.chatWizard.draftRestoredNotice}</p>
      )}
      {draftSaveFailed && (
        <p className="mb-3 text-center text-xs font-medium text-amber-600">{t.chatWizard.draftSaveWarning}</p>
      )}
      <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6">
        <ChatFlow
          data={data}
          updateField={updateField}
          startTime={startTime}
          onSuccess={() => {
            // Wizard selesai -- draft klien tidak relevan lagi (jawaban
            // sudah dikirim ke generate-preview/wizard_drafts server-side).
            clearSavedWizardDraft();
            setStep(6);
          }}
        />
      </div>
    </section>
  );
}

export default ChatWizard;
