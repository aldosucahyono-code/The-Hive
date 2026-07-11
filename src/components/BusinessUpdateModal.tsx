import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, fillTemplate } from "../i18n/LanguageContext";
import type { Translations } from "../i18n/translations";
import { isValidFreeText } from "../utils/validation";

type BusinessUpdateModalProps = {
  businessProfileId: string;
  businessType: "start" | "grow";
  onClose: () => void;
  onSaved: (newlyUnlocked?: Array<Record<string, unknown>>) => void;
};

type Kondisi = "naik" | "tetap" | "turun";

// Business Update Engine: hasil klasifikasi dari services/updateEngine/classify.ts
// (dikirim balik oleh api/workspace action "submitUpdate"). Kunci i18n +
// params, bukan kalimat jadi, supaya bilingual tetap ikut kalau bahasa
// ditoggle.
type UpdateInsight = {
  category: "sales" | "marketing" | "finance" | "customer" | "operations" | "brand";
  severity: "low" | "medium" | "high";
  headlineKey: string;
  headlineParams: Record<string, string | number>;
  actionKey: string;
};

const ACTION_KEY_MAP: Record<UpdateInsight["actionKey"], keyof Translations["workspace"]> = {
  updateActionSales: "updateActionSales",
  updateActionMarketing: "updateActionMarketing",
  updateActionFinance: "updateActionFinance",
  updateActionCustomer: "updateActionCustomer",
  updateActionOperations: "updateActionOperations",
  updateActionBrand: "updateActionBrand",
};

const SEVERITY_LABEL_MAP: Record<UpdateInsight["severity"], keyof Translations["workspace"]> = {
  low: "updateSeverityLow",
  medium: "updateSeverityMedium",
  high: "updateSeverityHigh",
};

const SEVERITY_STYLE: Record<UpdateInsight["severity"], string> = {
  low: "bg-white/10 text-neutral-400",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-red-500/15 text-red-300",
};

function resolveHeadline(t: Translations, insight: UpdateInsight): string {
  const template = (t.workspace as unknown as Record<string, string>)[insight.headlineKey];
  if (!template) return "";
  return fillTemplate(template, insight.headlineParams);
}

function BusinessUpdateModal({ businessProfileId, businessType, onClose, onSaved }: BusinessUpdateModalProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  // Task 11 (audit Juli 2026): bisnis yang "belum buka" (start) belum punya
  // penjualan/omset/pelanggan sungguhan — form Business Update sebelumnya
  // menanyakan pertanyaan yang sama persis ("kondisi penjualan?", "omset
  // minggu ini?") ke bisnis yang belum berjalan sama sekali, terasa aneh
  // dan tidak relevan. Sekarang label/placeholder berbeda untuk businessType
  // "start" (fokus ke progres persiapan), field & backend TIDAK berubah.
  const bu = t.businessUpdateModal;
  const isStart = businessType === "start";
  const copy = {
    title: isStart ? bu.titleStart : bu.title,
    subtitle: isStart ? bu.subtitleStart : bu.subtitle,
    perkembanganLabel: isStart ? bu.perkembanganLabelStart : bu.perkembanganLabel,
    perkembanganPlaceholder: isStart ? bu.perkembanganPlaceholderStart : bu.perkembanganPlaceholder,
    pencapaianLabel: isStart ? bu.pencapaianLabelStart : bu.pencapaianLabel,
    pencapaianPlaceholder: isStart ? bu.pencapaianPlaceholderStart : bu.pencapaianPlaceholder,
    tantanganLabel: isStart ? bu.tantanganLabelStart : bu.tantanganLabel,
    tantanganPlaceholder: isStart ? bu.tantanganPlaceholderStart : bu.tantanganPlaceholder,
    kondisiPenjualanLabel: isStart ? bu.kondisiPenjualanLabelStart : bu.kondisiPenjualanLabel,
    kondisiNaik: isStart ? bu.kondisiNaikStart : bu.kondisiNaik,
    kondisiTetap: isStart ? bu.kondisiTetapStart : bu.kondisiTetap,
    kondisiTurun: isStart ? bu.kondisiTurunStart : bu.kondisiTurun,
    omsetLabel: isStart ? bu.omsetLabelStart : bu.omsetLabel,
    omsetPlaceholder: isStart ? bu.omsetPlaceholderStart : bu.omsetPlaceholder,
    pelangganBaruLabel: isStart ? bu.pelangganBaruLabelStart : bu.pelangganBaruLabel,
    pelangganBaruPlaceholder: isStart ? bu.pelangganBaruPlaceholderStart : bu.pelangganBaruPlaceholder,
    targetDepanLabel: isStart ? bu.targetDepanLabelStart : bu.targetDepanLabel,
    targetDepanPlaceholder: isStart ? bu.targetDepanPlaceholderStart : bu.targetDepanPlaceholder,
  };

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
  const [insightResult, setInsightResult] = useState<UpdateInsight | null>(null);
  const [newlyUnlockedResult, setNewlyUnlockedResult] = useState<Array<Record<string, unknown>> | undefined>(undefined);
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

      // Business Update Engine: Beemo langsung "berpikir" begitu update
      // tersimpan — tampilkan reaksinya dulu (bukan auto-close 1.2 detik
      // seperti sebelumnya), baru refresh data lain saat pengguna klik
      // Lanjutkan. Ini yang membuat update terasa hidup, bukan cuma
      // form yang menghilang.
      setInsightResult(json.insight || null);
      setNewlyUnlockedResult(json.newlyUnlocked);
      setSuccess(true);
      setSubmitting(false);
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

        <h2 className="mb-1 text-xl font-extrabold text-white">{copy.title}</h2>
        <p className="mb-6 text-sm text-neutral-400">{copy.subtitle}</p>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
              <p className="text-sm text-neutral-100">{t.businessUpdateModal.successMessage}</p>
            </div>

            {insightResult && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.updateInsightCardTitle}</p>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + SEVERITY_STYLE[insightResult.severity]}>
                    {t.workspace[SEVERITY_LABEL_MAP[insightResult.severity]]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-200">{resolveHeadline(t, insightResult)}</p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  {t.workspace[ACTION_KEY_MAP[insightResult.actionKey as UpdateInsight["actionKey"]]] || ""}
                </p>
              </div>
            )}

            <button
              onClick={() => onSaved(newlyUnlockedResult)}
              className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-black transition-opacity hover:opacity-90"
            >
              {t.businessUpdateModal.continueButton}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {copy.perkembanganLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={3}
                value={perkembangan}
                onChange={(e) => setPerkembangan(e.target.value)}
                onBlur={() => markTouched("perkembangan")}
                placeholder={copy.perkembanganPlaceholder}
                className={touched.perkembangan && !perkembanganValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {copy.pencapaianLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={pencapaian}
                onChange={(e) => setPencapaian(e.target.value)}
                onBlur={() => markTouched("pencapaian")}
                placeholder={copy.pencapaianPlaceholder}
                className={touched.pencapaian && !pencapaianValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {copy.tantanganLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={tantangan}
                onChange={(e) => setTantangan(e.target.value)}
                onBlur={() => markTouched("tantangan")}
                placeholder={copy.tantanganPlaceholder}
                className={touched.tantangan && !tantanganValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-neutral-300">
                {copy.kondisiPenjualanLabel} <span className="text-primary">*</span>
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
                    {k === "naik" ? copy.kondisiNaik : k === "tetap" ? copy.kondisiTetap : copy.kondisiTurun}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300">{copy.omsetLabel}</label>
                <input
                  ref={omsetInputRef}
                  type="text"
                  inputMode="numeric"
                  value={omsetValue}
                  onChange={handleOmsetChange}
                  placeholder={copy.omsetPlaceholder}
                  className={inputOk}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300">{copy.pelangganBaruLabel}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pelangganBaru}
                  onChange={(e) => setPelangganBaru(e.target.value)}
                  placeholder={copy.pelangganBaruPlaceholder}
                  className={inputOk}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {copy.targetDepanLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={2}
                value={targetDepan}
                onChange={(e) => setTargetDepan(e.target.value)}
                onBlur={() => markTouched("targetDepan")}
                placeholder={copy.targetDepanPlaceholder}
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
