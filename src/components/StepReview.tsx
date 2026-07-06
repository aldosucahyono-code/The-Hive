import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { useLanguage } from "../i18n/LanguageContext";

type StepReviewProps = {
  data: WizardData;
  onEdit: (step: number) => void;
  back: () => void;
  startTime: number;
  onSuccess: () => void;
};

const MIN_FILL_TIME_MS = 5000;

function StepReview({ data, onEdit, back, startTime, onSuccess }: StepReviewProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [botError, setBotError] = useState(false);
  const isBaru = data.jenisAnalisis === "baru";

  function handleProses() {
    const elapsed = Date.now() - startTime;
    const looksLikeBot = data.honeypot.trim().length > 0 || elapsed < MIN_FILL_TIME_MS;

    if (looksLikeBot) {
      setBotError(true);
      return;
    }

    setBotError(false);
    setLoading(true);
    onSuccess();
  }

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">{t.stepReview.stepLabel}</div>

      <p className="mb-6 text-sm text-neutral-300">{t.stepReview.intro}</p>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{t.stepReview.identitasTitle}</h4>
          <button onClick={() => onEdit(1)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">{t.common.edit}</button>
        </div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.namaLabel}</span><strong>{data.nama}</strong></div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.profesiLabel}</span><strong>{data.profesi}</strong></div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.namaBisnisLabel}</span><strong>{data.namaBisnis}</strong></div>
        <div className="flex justify-between py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.jenisBisnisLabel}</span><strong>{data.jenisBisnis}</strong></div>
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{t.stepReview.lokasiKondisiTitle}</h4>
          <button onClick={() => onEdit(2)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">{t.common.edit}</button>
        </div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.lokasiLabel}</span><strong>{data.lokasi}</strong></div>
        {isBaru ? (
          <>
            <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.targetPelangganLabel}</span><strong>{data.targetPelanggan}</strong></div>
            <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.rencanaLaunchingLabel}</span><strong>{data.rencanaLaunching}</strong></div>
          </>
        ) : (
          <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">{t.stepReview.sejakKapanLabel}</span><strong>{data.sejakKapan}</strong></div>
        )}
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-neutral-400">{isBaru ? t.stepReview.modalAwalLabel : t.stepReview.omsetLabel}</span>
          <strong>{data.omsetBulanan}</strong>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{t.stepReview.tantanganTargetTitle}</h4>
          <button onClick={() => onEdit(3)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">{t.common.edit}</button>
        </div>
        <div className="border-b border-white/5 py-2 text-sm">
          <span className="block text-neutral-400">{t.stepReview.tantanganLabel}</span>
          <strong>{data.tantangan}</strong>
        </div>
        <div className="py-2 text-sm">
          <span className="block text-neutral-400">{t.stepReview.targetLabel}</span>
          <strong>{data.target}</strong>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">{t.stepReview.ceritaVisiTitle}</h4>
          <button onClick={() => onEdit(4)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">{t.common.edit}</button>
        </div>
        <p className="py-2 text-sm text-neutral-200">{data.ceritaVisi}</p>
      </div>

      {botError && (
        <p className="mb-4 text-sm text-red-400">{t.stepReview.botError}</p>
      )}

      <div className="mb-3 flex justify-start">
        <button onClick={back} className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-neutral-200">
          {t.common.back}
        </button>
      </div>

      <button
        onClick={handleProses}
        disabled={loading}
        className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-4 text-black disabled:opacity-60"
      >
        <span className="text-base font-bold">
          {loading ? t.stepReview.submitLoading : t.stepReview.submitLabel}
        </span>
        <span className="text-xs font-medium opacity-80">
          {t.stepReview.submitHelper}
        </span>
      </button>
    </>
  );
}

export default StepReview;
