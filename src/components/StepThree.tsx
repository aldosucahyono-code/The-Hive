import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidFreeText } from "../utils/validation";

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

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">STEP 3 OF 4</div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          Tantangan Terbesar Bisnis Anda <span className="text-primary">*</span>
          {touched.tantangan && !tantanganValid && (
            <span className="ml-2 text-amber-400" title="Minimal 7 karakter, 2 kata, tidak boleh asal/berulang">⚠</span>
          )}
        </label>
        <textarea
          rows={5}
          placeholder="Contoh : Penjualan menurun karena kualitas produk tidak konsisten sejak bulan kedua buka..."
          value={data.tantangan}
          onChange={(e) => updateField("tantangan", e.target.value)}
          onBlur={() => markTouched("tantangan")}
          className={touched.tantangan && !tantanganValid ? textareaErr : textareaOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Ceritakan sedetail mungkin (minimal 2 kata), jangan asal ketik.</p>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          Target / Harapan Bisnis Anda <span className="text-primary">*</span>
          {touched.target && !targetValid && (
            <span className="ml-2 text-amber-400" title="Minimal 7 karakter, 2 kata, tidak boleh asal/berulang">⚠</span>
          )}
        </label>
        <textarea
          rows={5}
          placeholder="Contoh : Ingin omset naik 2x lipat dalam 6 bulan dengan menjangkau pelanggan mahasiswa..."
          value={data.target}
          onChange={(e) => updateField("target", e.target.value)}
          onBlur={() => markTouched("target")}
          className={touched.target && !targetValid ? textareaErr : textareaOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Ceritakan sedetail mungkin (minimal 2 kata), jangan asal ketik.</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">Periksa kembali kolom yang ditandai ⚠ sebelum lanjut.</p>
      )}

      <div className="flex justify-between">
        <button onClick={back} className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-neutral-200">
          ← Kembali
        </button>
        <button onClick={handleNext} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black">
          Lanjut →
        </button>
      </div>
    </>
  );
}

export default StepThree;
