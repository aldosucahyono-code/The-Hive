import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { isValidFreeText } from "../utils/validation";

type BusinessUpdateModalProps = {
  businessProfileId: string;
  onClose: () => void;
  onSaved: (newlyUnlocked?: Array<Record<string, unknown>>) => void;
};

type Kondisi = "naik" | "tetap" | "turun";

function BusinessUpdateModal({ businessProfileId, onClose, onSaved }: BusinessUpdateModalProps) {
  const { t } = useLanguage();
  const { session } = useAuth();

  const [perkembangan, setPerkembangan] = useState("");
  const [pencapaian, setPencapaian] = useState("");
  const [tantangan, setTantangan] = useState("");
  const [kondisiPenjualan, setKondisiPenjualan] = useState<Kondisi | null>(null);
  const [omsetValue, setOmsetValue] = useState("");
  const [pelangganBaru, setPelangganBaru] = useState("");
  const [targetDepan, setTargetDepan] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const omsetInputRef = useRef<HTMLInputElement>(null);

  function handleOmsetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const oldValue = omsetValue;
    const rawValue = e.target.value;
    const newCursorPos = e.target.selectionStart ?? rawValue.length;
    const isSingleBackspace = rawValue.length === oldValue.length - 1;

    let workingDigits: string;
    let digitsBeforeCursor: number;

    const deletedChar = isSingleBackspace ? oldValue[newCursorPos] : undefined;

    if (isSingleBackspace && deletedChar && !/[0-9]/.test(deletedChar)) {
      const digitsBeforeOldCursor = oldValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
      const allDigits = oldValue.replace(/[^0-9]/g, "");
      workingDigits =
        allDigits.slice(0, digitsBeforeOldCursor - 1) + allDigits.slice(digitsBeforeOldCursor);
      digitsBeforeCursor = digitsBeforeOldCursor - 1;
    } else {
      workingDigits = rawValue.replace(/[^0-9]/g, "");
      digitsBeforeCursor = rawValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
    }

    const formatted = workingDigits ? "Rp" + Number(workingDigits).toLocaleString("id-ID") + ",-" : "";
    setOmsetValue(formatted);

    requestAnimationFrame(() => {
      const el = omsetInputRef.current;
      if (!el) return;
      let seen = 0;
      let newPos = el.value.length;
      if (digitsBeforeCursor <= 0) {
        newPos = 0;
      } else {
        for (let i = 0; i < el.value.length; i++) {
          if (/[0-9]/.test(el.value[i])) {
            seen++;
            if (seen === digitsBeforeCursor) {
              newPos = i + 1;
              break;
            }
          }
        }
      }
      el.setSelectionRange(newPos, newPos);
    });
  }

  const perkembanganValid = isValidFreeText(perkembangan, 10, 3);
  const pencapaianValid = isValidFreeText(pencapaian, 5, 2);
  const tantanganValid = isValidFreeText(tantangan, 5, 2);
  const targetDepanValid = isValidFreeText(targetDepan, 5, 2);

  const inputBase = "w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-primary";
  const inputOk = inputBase + " border-white/15";
  const inputErr = inputBase + " border-red-500";
  const textareaOk = inputOk + " resize-none";
  const textareaErr = inputErr + " resize-none";

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function isAllValid(): boolean {
    return perkembanganValid && pencapaianValid && tantanganValid && !!kondisiPenjualan && targetDepanValid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ perkembangan: true, pencapaian: true, tantangan: true, targetDepan: true });

    if (!isAllValid() || !session?.access_token) {
      setFormError(true);
      return;
    }
    setFormError(false);
    setServerError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "submitUpdate",
          businessProfileId,
          perkembangan,
          pencapaian,
          tantangan,
          kondisiPenjualan,
          omsetValue: omsetValue || null,
          pelangganBaru: pelangganBaru || null,
          targetDepan,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setServerError(json.error || t.businessUpdateModal.genericError);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setSubmitting(false);
      setTimeout(() => {
        onSaved(json.newlyUnlocked);
      }, 1200);
    } catch (err) {
      console.error("submitUpdate error:", err);
      setServerError(t.businessUpdateModal.networkError);
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !submitting) onClose();
  }

  return (
    <div onClick={handleOverlayClick} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-6 backdrop-blur-md sm:p-8">
        {!submitting && (
          <button onClick={onClose} aria-label={t.businessUpdateModal.closeLabel} className="absolute right-4 top-4 text-neutral-400 hover:text-white">
            ✕
          </button>
        )}

        <h2 className="mb-1 text-xl font-extrabold text-white">{t.businessUpdateModal.title}</h2>
        <p className="mb-6 text-sm text-neutral-400">{t.businessUpdateModal.subtitle}</p>

        {success ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
            <p className="text-sm text-neutral-100">{t.businessUpdateModal.successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.businessUpdateModal.perkembanganLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={3}
                value={perkembangan}
                onChange={(e) => setPerkembangan(e.target.value)}
                onBlur={() => markTouched("perkembangan")}
                placeholder={t.businessUpdateModal.perkembanganPlaceholder}
                className={touched.perkembangan && !perkembanganValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.businessUpdateModal.pencapaianLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={pencapaian}
                onChange={(e) => setPencapaian(e.target.value)}
                onBlur={() => markTouched("pencapaian")}
                placeholder={t.businessUpdateModal.pencapaianPlaceholder}
                className={touched.pencapaian && !pencapaianValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.businessUpdateModal.tantanganLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={tantangan}
                onChange={(e) => setTantangan(e.target.value)}
                onBlur={() => markTouched("tantangan")}
                placeholder={t.businessUpdateModal.tantanganPlaceholder}
                className={touched.tantangan && !tantanganValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-300">
                {t.businessUpdateModal.kondisiPenjualanLabel} <span className="text-primary">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["naik", "tetap", "turun"] as Kondisi[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKondisiPenjualan(k)}
                    className={
                      "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors " +
                      (kondisiPenjualan === k
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/15 bg-white/5 text-neutral-300 hover:border-primary/40")
                    }
                  >
                    {k === "naik" ? t.businessUpdateModal.kondisiNaik : k === "tetap" ? t.businessUpdateModal.kondisiTetap : t.businessUpdateModal.kondisiTurun}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300">{t.businessUpdateModal.omsetLabel}</label>
                <input
                  ref={omsetInputRef}
                  type="text"
                  inputMode="numeric"
                  value={omsetValue}
                  onChange={handleOmsetChange}
                  placeholder={t.businessUpdateModal.omsetPlaceholder}
                  className={inputOk}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300">{t.businessUpdateModal.pelangganBaruLabel}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pelangganBaru}
                  onChange={(e) => setPelangganBaru(e.target.value)}
                  placeholder={t.businessUpdateModal.pelangganBaruPlaceholder}
                  className={inputOk}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.businessUpdateModal.targetDepanLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={targetDepan}
                onChange={(e) => setTargetDepan(e.target.value)}
                onBlur={() => markTouched("targetDepan")}
                placeholder={t.businessUpdateModal.targetDepanPlaceholder}
                className={touched.targetDepan && !targetDepanValid ? textareaErr : textareaOk}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{t.businessUpdateModal.formError}</p>}
            {serverError && <p className="text-sm text-red-400">{serverError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t.businessUpdateModal.submitLoading : t.businessUpdateModal.submitButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default BusinessUpdateModal;
