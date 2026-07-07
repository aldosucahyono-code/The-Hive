import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { isValidBrandName, isValidNameLike } from "../utils/validation";

type AddBusinessModalProps = {
  onClose: () => void;
  onCreated: (businessProfileId: string) => void;
};

type JenisAnalisis = "baru" | "berjalan";

function AddBusinessModal({ onClose, onCreated }: AddBusinessModalProps) {
  const { t } = useLanguage();
  const { session } = useAuth();

  const [jenisAnalisis, setJenisAnalisis] = useState<JenisAnalisis | null>(null);
  const [namaBisnis, setNamaBisnis] = useState("");
  const [jenisBisnis, setJenisBisnis] = useState("");
  const [touchedNama, setTouchedNama] = useState(false);
  const [touchedJenis, setTouchedJenis] = useState(false);
  const [formError, setFormError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const namaBisnisValid = isValidBrandName(namaBisnis);
  const jenisBisnisValid = isValidNameLike(jenisBisnis);

  const inputBase = "w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-primary";
  const inputOk = inputBase + " border-white/15";
  const inputErr = inputBase + " border-red-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouchedNama(true);
    setTouchedJenis(true);

    if (!namaBisnisValid || !jenisBisnisValid || !session?.access_token) {
      setFormError(true);
      return;
    }
    setFormError(false);
    setServerError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/create-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessName: namaBisnis,
          industry: jenisBisnis,
          businessStage: jenisAnalisis === "baru" ? "idea" : "running",
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setServerError(json.error || t.addBusinessModal.genericError);
        setSubmitting(false);
        return;
      }

      onCreated(json.businessProfileId);
    } catch (err) {
      console.error("create-business error:", err);
      setServerError(t.addBusinessModal.networkError);
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 p-6 backdrop-blur-md sm:p-8">
        <button
          onClick={onClose}
          aria-label={t.addBusinessModal.closeLabel}
          className="absolute right-4 top-4 text-neutral-400 hover:text-white"
        >
          ✕
        </button>

        <h2 className="mb-1 text-xl font-extrabold text-white">{t.addBusinessModal.title}</h2>
        <p className="mb-6 text-sm text-neutral-400">{t.addBusinessModal.subtitle}</p>

        {jenisAnalisis === null ? (
          // Langkah 1: pilih baru atau sudah berjalan (menentukan business_stage)
          <div>
            <p className="mb-4 text-sm font-semibold text-neutral-300">{t.addBusinessModal.chooseTitle}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => setJenisAnalisis("baru")}
                className="rounded-xl border border-white/10 bg-surface p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="mb-2 text-xl">🌱</div>
                <h3 className="mb-1 text-sm font-bold text-white">{t.addBusinessModal.chooseNewTitle}</h3>
                <p className="text-xs leading-relaxed text-neutral-400">{t.addBusinessModal.chooseNewDesc}</p>
              </button>
              <button
                onClick={() => setJenisAnalisis("berjalan")}
                className="rounded-xl border border-white/10 bg-surface p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="mb-2 text-xl">📈</div>
                <h3 className="mb-1 text-sm font-bold text-white">{t.addBusinessModal.chooseRunningTitle}</h3>
                <p className="text-xs leading-relaxed text-neutral-400">{t.addBusinessModal.chooseRunningDesc}</p>
              </button>
            </div>
          </div>
        ) : (
          // Langkah 2: isi nama & jenis bisnis (validasi setara StepOne.tsx)
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setJenisAnalisis(null)}
              className="text-xs text-neutral-400 hover:text-white"
            >
              {t.addBusinessModal.backButton}
            </button>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.addBusinessModal.namaBisnisLabel} <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={namaBisnis}
                onChange={(e) => setNamaBisnis(e.target.value)}
                onBlur={() => setTouchedNama(true)}
                placeholder={t.addBusinessModal.namaBisnisPlaceholder}
                disabled={submitting}
                className={touchedNama && !namaBisnisValid ? inputErr : inputOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.addBusinessModal.jenisBisnisLabel} <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={jenisBisnis}
                onChange={(e) => setJenisBisnis(e.target.value)}
                onBlur={() => setTouchedJenis(true)}
                placeholder={t.addBusinessModal.jenisBisnisPlaceholder}
                disabled={submitting}
                className={touchedJenis && !jenisBisnisValid ? inputErr : inputOk}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{t.addBusinessModal.formError}</p>}
            {serverError && <p className="text-sm text-red-400">{serverError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t.addBusinessModal.submitLoading : t.addBusinessModal.submitButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddBusinessModal;
