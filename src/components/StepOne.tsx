import { useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidNameLike, isValidBrandName, isValidProfesi, isValidEmail } from "../utils/validation";

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
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">STEP 1 OF 4</div>

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
          Nama Anda <span className="text-primary">*</span>
          {touched.nama && !namaValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh huruf berulang/asal">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder="Contoh : Michael Aldo"
          value={data.nama}
          onChange={(e) => updateField("nama", e.target.value)}
          onBlur={() => markTouched("nama")}
          className={touched.nama && !namaValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Hanya huruf, minimal 3 karakter, tanpa angka/simbol/huruf berulang.</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          Email Anda <span className="text-primary">*</span>
          {touched.email && !emailValid && (
            <span className="ml-2 text-amber-400" title="Masukkan format email yang benar">⚠</span>
          )}
        </label>
        <input
          type="email"
          placeholder="Contoh : nama@email.com"
          value={data.email}
          onChange={(e) => updateField("email", e.target.value)}
          onBlur={() => markTouched("email")}
          className={touched.email && !emailValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Bukti pembayaran Anda akan dikirim ke email ini.</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          Profesi Anda <span className="text-primary">*</span>
          {touched.profesi && !profesiValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh mengandung profesi ilegal/negatif">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder="Founder, Owner, Manager..."
          value={data.profesi}
          onChange={(e) => updateField("profesi", e.target.value)}
          onBlur={() => markTouched("profesi")}
          className={touched.profesi && !profesiValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Hanya huruf, minimal 3 karakter, tidak boleh profesi ilegal/negatif (mis. pencuri, hacker).</p>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          Nama Bisnis/Brand Anda <span className="text-primary">*</span>
          {touched.namaBisnis && !namaBisnisValid && (
            <span className="ml-2 text-amber-400" title="Wajib diisi dengan nama yang wajar">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder="Contoh : King Rawon & King Juice Premium"
          value={data.namaBisnis}
          onChange={(e) => updateField("namaBisnis", e.target.value)}
          onBlur={() => markTouched("namaBisnis")}
          className={touched.namaBisnis && !namaBisnisValid ? inputErr : inputOk}
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          Jenis Bisnis Anda <span className="text-primary">*</span>
          {touched.jenisBisnis && !jenisBisnisValid && (
            <span className="ml-2 text-amber-400" title="Hanya huruf, minimal 3 karakter, tidak boleh huruf berulang/asal">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder="Coffee Shop, Kontraktor, Retail..."
          value={data.jenisBisnis}
          onChange={(e) => updateField("jenisBisnis", e.target.value)}
          onBlur={() => markTouched("jenisBisnis")}
          className={touched.jenisBisnis && !jenisBisnisValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Hanya huruf, minimal 3 karakter, tanpa angka/simbol/huruf berulang.</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">Periksa kembali kolom yang ditandai ⚠ sebelum lanjut.</p>
      )}

      <div className="flex justify-end">
        <button onClick={handleNext} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black">
          Lanjut →
        </button>
      </div>
    </>
  );
}

export default StepOne;
