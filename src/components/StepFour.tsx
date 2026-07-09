import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidFreeText } from "../utils/validation";
import { useLanguage } from "../i18n/LanguageContext";

type StepFourProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  next: () => void;
  back: () => void;
};

const textareaBase = "w-full rounded-lg border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary resize-none";
const textareaOk = textareaBase + " border-white/10";
const textareaErr = textareaBase + " border-red-500";

// Ambang batas sengaja lebih tinggi dari field lain (bukan 7 karakter/2 kata)
// karena ini memang dimaksudkan sebagai cerita nyata, bukan jawaban singkat —
// supaya AI benar-benar punya bahan untuk memahami cara pandang pengguna.
const MIN_LENGTH = 40;
const MIN_WORDS = 10;

function StepFour({ data, updateField, next, back }: StepFourProps) {
  const { t } = useLanguage();
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(false);

  const ceritaValid = isValidFreeText(data.ceritaVisi, MIN_LENGTH, MIN_WORDS);

  function handleNext() {
    setTouched(true);
    if (!ceritaValid) {
      setError(true);
      return;
    }
    setError(false);
    next();
  }

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">{t.stepFour.stepLabel}</div>

      <div className="mb-2">
        <label className="mb-2 block text-sm">
          {t.stepFour.title} <span className="text-primary">*</span>
          {touched && !ceritaValid && (
            <span className="ml-2 text-amber-400" title={t.stepFour.warningTitle}>⚠</span>
          )}
        </label>
        <p className="mb-3 text-sm leading-relaxed text-neutral-300">{t.stepFour.intro}</p>
        <textarea
          rows={8}
          placeholder={t.stepFour.placeholder}
          value={data.ceritaVisi}
          onChange={(e) => updateField("ceritaVisi", e.target.value)}
          onBlur={() => setTouched(true)}
          className={touched && !ceritaValid ? textareaErr : textareaOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepFour.helper}</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{t.stepFour.formError}</p>
      )}

      <div className="flex justify-between">
        <button onClick={back} className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-neutral-200">
          {t.common.back}
        </button>
        <button onClick={handleNext} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black">
          {t.common.next}
        </button>
      </div>
    </>
  );
}

export default StepFour;
