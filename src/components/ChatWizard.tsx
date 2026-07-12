import { useEffect, useState } from "react";

import ChooseAnalysisType from "./ChooseAnalysisType";
import ChatFlow from "./ChatFlow";
import LoadingAI from "./LoadingAI";
import PreviewReport, { type PreviewData } from "./PreviewReport";
import { useLanguage } from "../i18n/LanguageContext";

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

const initialData: WizardData = {
  jenisAnalisis: "",
  nama: "",
  email: "",
  noHp: "",
  profesi: "",
  namaBisnis: "",
  jenisBisnis: "",
  produkJasa: "",
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
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [startTime] = useState(() => Date.now());
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  function updateField(field: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function restart() {
    setData(initialData);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewReady(false);
    setStep(0);
  }

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
      const json = await response.json();
      if (!response.ok) {
        setPreviewError(json.error || t.chatWizard.previewErrorGeneric);
        setPreviewData(null);
      } else {
        setPreviewData(json.preview as PreviewData);
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
      />
    );
  }

  // step === 1: seluruh percakapan
  return (
    <section className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      <div className="rounded-3xl border border-white/10 bg-surface p-4 sm:p-6">
        <ChatFlow
          data={data}
          updateField={updateField}
          startTime={startTime}
          onSuccess={() => setStep(6)}
        />
      </div>
    </section>
  );
}

export default ChatWizard;
