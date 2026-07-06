import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidNameLike, isValidBrandName, isValidProfesi, isValidEmail } from "../utils/validation";
import { useLanguage } from "../i18n/LanguageContext";

type StepOneProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  next: () => void;
};

type TouchedState = {
  nama: boolean;
  email: boolean;
  profesi: boolean;
  namaBisnis: boolean;
  jenisBisnis: boolean;
};

const inputBase = "w-full rounded-lg border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary";
const inputOk = inputBase + " border-white/10";
const inputErr = inputBase + " border-red-500";

function StepOne({ data, updateField, next }: StepOneProps) {
  const { t } = useLanguage();
  const [touched, setTouched] = useState<TouchedState>({
    nama: false,
    email: false,
    profesi: false,
    namaBisnis: false,
    jenisBisnis: false,
  });
  const [error, setError] = useState(false);

  const namaValid = isValidNameLike(data.nama);
  const emailValid = isValidEmail(data.email);
  const profesiValid = isValidProfesi(data.profesi);
  const namaBisnisValid = isValidBrandName(data.namaBisnis);
  const jenisBisnisValid = isValidNameLike(data.jenisBisnis);

  function markTouched(field: keyof TouchedState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleNext() {
    setTouched({ nama: true, email: true, profesi: true, namaBisnis: true, jenisBisnis: true });

    if (!namaValid || !emailValid || !profesiValid || !namaBisnisValid || !jenisBisnisValid) {
      setError(true);
      return;
    }

    setError(false);
    next();
  }

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">{t.stepOne.stepLabel}</div>

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

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {t.stepOne.namaLabel} <span className="text-primary">*</span>
          {touched.nama && !namaValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh huruf berulang/asal">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder={t.stepOne.namaPlaceholder}
          value={data.nama}
          onChange={(e) => updateField("nama", e.target.value)}
          onBlur={() => markTouched("nama")}
          className={touched.nama && !namaValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepOne.namaHelper}</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {t.stepOne.emailLabel} <span className="text-primary">*</span>
          {touched.email && !emailValid && (
            <span className="ml-2 text-amber-400" title="Masukkan format email yang benar">⚠</span>
          )}
        </label>
        <input
          type="email"
          placeholder={t.stepOne.emailPlaceholder}
          value={data.email}
          onChange={(e) => updateField("email", e.target.value)}
          onBlur={() => markTouched("email")}
          className={touched.email && !emailValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepOne.emailHelper}</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {t.stepOne.profesiLabel} <span className="text-primary">*</span>
          {touched.profesi && !profesiValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh mengandung profesi ilegal/negatif">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder={t.stepOne.profesiPlaceholder}
          value={data.profesi}
          onChange={(e) => updateField("profesi", e.target.value)}
          onBlur={() => markTouched("profesi")}
          className={touched.profesi && !profesiValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepOne.profesiHelper}</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {t.stepOne.namaBisnisLabel} <span className="text-primary">*</span>
          {touched.namaBisnis && !namaBisnisValid && (
            <span className="ml-2 text-amber-400" title="Wajib diisi dengan nama yang wajar">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder={t.stepOne.namaBisnisPlaceholder}
          value={data.namaBisnis}
          onChange={(e) => updateField("namaBisnis", e.target.value)}
          onBlur={() => markTouched("namaBisnis")}
          className={touched.namaBisnis && !namaBisnisValid ? inputErr : inputOk}
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          {t.stepOne.jenisBisnisLabel} <span className="text-primary">*</span>
          {touched.jenisBisnis && !jenisBisnisValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh huruf berulang/asal">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder={t.stepOne.jenisBisnisPlaceholder}
          value={data.jenisBisnis}
          onChange={(e) => updateField("jenisBisnis", e.target.value)}
          onBlur={() => markTouched("jenisBisnis")}
          className={touched.jenisBisnis && !jenisBisnisValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepOne.jenisBisnisHelper}</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{t.stepOne.formError}</p>
      )}

      <div className="flex justify-end">
        <button onClick={handleNext} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black">
          {t.common.next}
        </button>
      </div>
    </>
  );
}

export default StepOne;
