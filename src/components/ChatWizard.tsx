import { useEffect, useState } from "react";

import ChooseAnalysisType from "./ChooseAnalysisType";
import StepOne from "./StepOne";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepReview from "./StepReview";
import LoadingAI from "./LoadingAI";
import PreviewReport, { type PreviewData } from "./PreviewReport";

export type WizardData = {
  jenisAnalisis: "" | "baru" | "berjalan";
  nama: string;
  email: string;
  profesi: string;
  namaBisnis: string;
  jenisBisnis: string;
  lokasi: string;
  sejakKapan: string;
  omsetBulanan: string;
  targetPelanggan: string;
  tantangan: string;
  target: string;
  honeypot: string;
};

const initialData: WizardData = {
  jenisAnalisis: "",
  nama: "",
  email: "",
  profesi: "",
  namaBisnis: "",
  jenisBisnis: "",
  lokasi: "",
  sejakKapan: "",
  omsetBulanan: "",
  targetPelanggan: "",
  tantangan: "",
  target: "",
  honeypot: "",
};

function ChatWizard() {
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

  /** Panggil Claude API untuk preview gratis. ready=true dilaporkan ke
   * LoadingAI baik sukses maupun gagal, supaya animasi tidak menggantung
   * selamanya kalau API error. */
  async function runPreviewAnalysis() {
    setPreviewReady(false);
    setPreviewError(null);
    try {
      const response = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardData: data }),
      });
      const json = await response.json();
      if (!response.ok) {
        setPreviewError(json.error || "Gagal membuat preview.");
        setPreviewData(null);
      } else {
        setPreviewData(json.preview as PreviewData);
      }
    } catch (err) {
      console.error("runPreviewAnalysis error:", err);
      setPreviewError("Terjadi kesalahan jaringan. Coba lagi.");
      setPreviewData(null);
    } finally {
      setPreviewReady(true);
    }
  }

  // Memicu pemanggilan API tepat sekali saat wizard masuk step loading (5).
  useEffect(() => {
    if (step === 5) {
      runPreviewAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function retryPreview() {
    setStep(5);
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

  if (step === 5) {
    return <LoadingAI ready={previewReady} onDone={() => setStep(6)} />;
  }

  if (step === 6) {
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

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-surface text-2xl">
          🤖
        </div>
        <h2 className="text-xl font-bold">Halo, saya Beemo.</h2>
        <p className="mt-1 text-neutral-400">
          {data.jenisAnalisis === "baru"
            ? "Menganalisis rencana bisnis baru Anda."
            : "Menganalisis bisnis Anda yang sudah berjalan."}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-8">

        {step === 1 && (
          <StepOne data={data} updateField={updateField} next={() => setStep(2)} />
        )}

        {step === 2 && (
          <StepTwo data={data} updateField={updateField} next={() => setStep(3)} back={() => setStep(1)} />
        )}

        {step === 3 && (
          <StepThree data={data} updateField={updateField} next={() => setStep(4)} back={() => setStep(2)} />
        )}

        {step === 4 && (
          <StepReview
            data={data}
            onEdit={(target) => setStep(target)}
            back={() => setStep(3)}
            startTime={startTime}
            onSuccess={() => setStep(5)}
          />
        )}

      </div>

    </section>
  );
}

export default ChatWizard;
