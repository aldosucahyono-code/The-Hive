import { useState } from "react";

import ChooseAnalysisType from "./ChooseAnalysisType";
import StepOne from "./StepOne";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepReview from "./StepReview";
import LoadingAI from "./LoadingAI";
import PreviewReport from "./PreviewReport";

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

  function updateField(field: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function restart() {
    setData(initialData);
    setStep(0);
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
    return <LoadingAI onDone={() => setStep(6)} />;
  }

  if (step === 6) {
    return <PreviewReport data={data} onRestart={restart} />;
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
