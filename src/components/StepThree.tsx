import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidFreeText } from "../utils/validation";
import { useLanguage } from "../i18n/LanguageContext";

type StepThreeProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  next: () => void;
  back: () => void;
};

type TouchedState = {
  tantangan: boolean;
  target: boolean;
};

const textareaBase = "w-full rounded-lg border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary resize-none";
const textareaOk = textareaBase + " border-white/10";
const textareaErr = textareaBase + " border-red-500";

function StepThree({ data, updateField, next, back }: StepThreeProps) {
  const { t } = useLanguage();
  const [touched, setTouched] = useState<TouchedState>({
    tantangan: false,
    target: false,
  });
  const [error, setError] = useState(false);

  const tantanganValid = isValidFreeText(data.tantangan);
  const targetValid = isValidFreeText(data.target);

  function markTouched(field: keyof TouchedState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleNext() {
    setTouched({ tantangan: true, target: true });

    if (!tantanganValid || !targetValid) {
      setError(true);
      return;
    }

    setError(false);
    next();
  }

  const isBaru = data.jenisAnalisis === "baru";

  const tantanganLabel = isBaru ? t.stepThree.tantanganLabelNew : t.stepThree.tantanganLabelRunning;
  const tantanganPlaceholder = isBaru ? t.stepThree.tantanganPlaceholderNew : t.stepThree.tantanganPlaceholderRunning;
  const targetPlaceholder = isBaru ? t.stepThree.targetPlaceholderNew : t.stepThree.targetPlaceholderRunning;

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">{t.stepThree.stepLabel}</div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {tantanganLabel} <span className="text-primary">*</span>
          {touched.tantangan && !tantanganValid && (
            <span className="ml-2 text-amber-400" title={t.stepThree.warningTitle}>⚠</span>
          )}
        </label>
        <textarea
          rows={5}
          placeholder={tantanganPlaceholder}
          value={data.tantangan}
          onChange={(e) => updateField("tantangan", e.target.value)}
          onBlur={() => markTouched("tantangan")}
          className={touched.tantangan && !tantanganValid ? textareaErr : textareaOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepThree.helper}</p>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          {t.stepThree.targetLabel} <span className="text-primary">*</span>
          {touched.target && !targetValid && (
            <span className="ml-2 text-amber-400" title={t.stepThree.warningTitle}>⚠</span>
          )}
        </label>
        <textarea
          rows={5}
          placeholder={targetPlaceholder}
          value={data.target}
          onChange={(e) => updateField("target", e.target.value)}
          onBlur={() => markTouched("target")}
          className={touched.target && !targetValid ? textareaErr : textareaOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepThree.helper}</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{t.stepThree.formError}</p>
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

export default StepThree;
