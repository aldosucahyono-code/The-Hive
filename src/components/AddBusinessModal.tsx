import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import {
  isValidBrandName,
  isValidNameLike,
  isValidLocation,
  isValidFreeText,
  isValidOmset,
  isValidPastDate,
  isValidFutureDate,
  getTodayString,
} from "../utils/validation";

type AddBusinessModalProps = {
  onClose: () => void;
  onCreated: (businessProfileId: string) => void;
};

type JenisAnalisis = "baru" | "berjalan";
type Phase = "choose" | "form" | "analyzing";

const todayString = getTodayString();

function AddBusinessModal({ onClose, onCreated }: AddBusinessModalProps) {
  const { t, lang } = useLanguage();
  const { session } = useAuth();

  const [phase, setPhase] = useState<Phase>("choose");
  const [jenisAnalisis, setJenisAnalisis] = useState<JenisAnalisis | null>(null);

  const [namaBisnis, setNamaBisnis] = useState("");
  const [jenisBisnis, setJenisBisnis] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [sejakKapan, setSejakKapan] = useState("");
  const [rencanaLaunching, setRencanaLaunching] = useState("");
  const [omsetBulanan, setOmsetBulanan] = useState("");
  const [targetPelanggan, setTargetPelanggan] = useState("");
  const [tantangan, setTantangan] = useState("");
  const [target, setTarget] = useState("");
  const [ceritaVisi, setCeritaVisi] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const omsetInputRef = useRef<HTMLInputElement>(null);

  function handleOmsetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const oldValue = omsetBulanan;
    const rawValue = e.target.value;
    const newCursorPos = e.target.selectionStart ?? rawValue.length;
    const isSingleBackspace = rawValue.length === oldValue.length - 1;

    let workingDigits: string;
    let digitsBeforeCursor: number;

    const deletedChar = isSingleBackspace ? oldValue[newCursorPos] : undefined;

    if (isSingleBackspace && deletedChar && !/[0-9]/.test(deletedChar)) {
      // Backspace mengenai tanda format, bukan angka — geser ke angka terdekat.
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
    setOmsetBulanan(formatted);

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

  const isBaru = jenisAnalisis === "baru";

  const namaBisnisValid = isValidBrandName(namaBisnis);
  const jenisBisnisValid = isValidNameLike(jenisBisnis);
  const lokasiValid = isValidLocation(lokasi);
  const sejakKapanValid = isValidPastDate(sejakKapan);
  const rencanaLaunchingValid = isValidFutureDate(rencanaLaunching);
  const omsetValid = isValidOmset(omsetBulanan);
  const targetPelangganValid = isValidFreeText(targetPelanggan, 7, 2);
  const tantanganValid = isValidFreeText(tantangan);
  const targetValid = isValidFreeText(target);
  const ceritaVisiValid = isValidFreeText(ceritaVisi, 40, 10);

  const inputBase = "w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-primary";
  const inputOk = inputBase + " border-white/15";
  const inputErr = inputBase + " border-red-500";
  const textareaOk = inputOk + " resize-none";
  const textareaErr = inputErr + " resize-none";

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function isAllValid(): boolean {
    if (!namaBisnisValid || !jenisBisnisValid || !lokasiValid || !omsetValid || !tantanganValid || !targetValid || !ceritaVisiValid) {
      return false;
    }
    if (isBaru) {
      return targetPelangganValid && rencanaLaunchingValid;
    }
    return sejakKapanValid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      namaBisnis: true,
      jenisBisnis: true,
      lokasi: true,
      sejakKapan: true,
      rencanaLaunching: true,
      omsetBulanan: true,
      targetPelanggan: true,
      tantangan: true,
      target: true,
      ceritaVisi: true,
    });

    if (!isAllValid() || !session?.access_token) {
      setFormError(true);
      return;
    }
    setFormError(false);
    setServerError(null);
    setPhase("analyzing");

    const wizardData = {
      jenisAnalisis,
      nama: session.user?.email?.split("@")[0] || t.addBusinessModal.defaultOwnerName,
      namaBisnis,
      jenisBisnis,
      lokasi,
      sejakKapan: isBaru ? "" : sejakKapan,
      rencanaLaunching: isBaru ? rencanaLaunching : "",
      omsetBulanan,
      targetPelanggan: isBaru ? targetPelanggan : "",
      tantangan,
      target,
      ceritaVisi,
    };

    try {
      // 1. Buat business_profile baru
      const bizResponse = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          businessName: namaBisnis,
          industry: jenisBisnis,
          businessStage: isBaru ? "idea" : "running",
        }),
      });
      const bizJson = await bizResponse.json();
      if (!bizResponse.ok) {
        setServerError(bizJson.error || t.addBusinessModal.genericError);
        setPhase("form");
        return;
      }
      const businessProfileId = bizJson.businessProfileId as string;

      // 2. Jalankan analisa awal (preview gratis — sama seperti pelanggan baru
      // pertama kali coba THE HIVE; tier bisnis lain tidak otomatis menular).
      const previewResponse = await fetch("/api/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardData, lang }),
      });
      const previewJson = await previewResponse.json();
      const preview = previewResponse.ok ? previewJson.preview : null;

      // 3. Simpan hasil analisa (kalau gagal pun, business_profile tetap ada —
      // tidak fatal, user masih bisa lihat bisnisnya di Workspace).
      if (preview) {
        await fetch("/api/business", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "saveAnalysis", businessProfileId, wizardData, preview }),
        });
      }

      onCreated(businessProfileId);
    } catch (err) {
      console.error("AddBusinessModal submit error:", err);
      setServerError(t.addBusinessModal.networkError);
      setPhase("form");
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (phase === "analyzing") return;
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-6 backdrop-blur-md sm:p-8">
        {phase !== "analyzing" && (
          <button
            onClick={onClose}
            aria-label={t.addBusinessModal.closeLabel}
            className="absolute right-4 top-4 text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        )}

        <h2 className="mb-1 text-xl font-extrabold text-white">{t.addBusinessModal.title}</h2>
        <p className="mb-6 text-sm text-neutral-400">{t.addBusinessModal.subtitle}</p>

        {phase === "choose" && (
          <div>
            <p className="mb-4 text-sm font-semibold text-neutral-300">{t.addBusinessModal.chooseTitle}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  setJenisAnalisis("baru");
                  setPhase("form");
                }}
                className="rounded-xl border border-white/10 bg-surface p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="mb-2 text-xl">🌱</div>
                <h3 className="mb-1 text-sm font-bold text-white">{t.addBusinessModal.chooseNewTitle}</h3>
                <p className="text-xs leading-relaxed text-neutral-400">{t.addBusinessModal.chooseNewDesc}</p>
              </button>
              <button
                onClick={() => {
                  setJenisAnalisis("berjalan");
                  setPhase("form");
                }}
                className="rounded-xl border border-white/10 bg-surface p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="mb-2 text-xl">📈</div>
                <h3 className="mb-1 text-sm font-bold text-white">{t.addBusinessModal.chooseRunningTitle}</h3>
                <p className="text-xs leading-relaxed text-neutral-400">{t.addBusinessModal.chooseRunningDesc}</p>
              </button>
            </div>
          </div>
        )}

        {phase === "analyzing" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-neutral-300">{t.addBusinessModal.analyzingLabel}</p>
          </div>
        )}

        {phase === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setPhase("choose")}
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
                onBlur={() => markTouched("namaBisnis")}
                placeholder={t.addBusinessModal.namaBisnisPlaceholder}
                className={touched.namaBisnis && !namaBisnisValid ? inputErr : inputOk}
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
                onBlur={() => markTouched("jenisBisnis")}
                placeholder={t.addBusinessModal.jenisBisnisPlaceholder}
                className={touched.jenisBisnis && !jenisBisnisValid ? inputErr : inputOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {isBaru ? t.stepTwo.lokasiLabelNew : t.stepTwo.lokasiLabelRunning} <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                onBlur={() => markTouched("lokasi")}
                placeholder={t.stepTwo.lokasiPlaceholder}
                className={touched.lokasi && !lokasiValid ? inputErr : inputOk}
              />
              <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.lokasiHelper}</p>
            </div>

            {isBaru ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm text-neutral-300">
                    {t.stepTwo.targetPelangganLabel} <span className="text-primary">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={targetPelanggan}
                    onChange={(e) => setTargetPelanggan(e.target.value)}
                    onBlur={() => markTouched("targetPelanggan")}
                    placeholder={t.stepTwo.targetPelangganPlaceholder}
                    className={touched.targetPelanggan && !targetPelangganValid ? textareaErr : textareaOk}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-neutral-300">
                    {t.stepTwo.rencanaLaunchingLabel} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="date"
                    min={todayString}
                    value={rencanaLaunching}
                    onChange={(e) => setRencanaLaunching(e.target.value)}
                    onBlur={() => markTouched("rencanaLaunching")}
                    className={(touched.rencanaLaunching && !rencanaLaunchingValid ? inputErr : inputOk) + " [color-scheme:dark]"}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300">
                  {t.stepTwo.sejakKapanLabel} <span className="text-primary">*</span>
                </label>
                <input
                  type="date"
                  max={todayString}
                  value={sejakKapan}
                  onChange={(e) => setSejakKapan(e.target.value)}
                  onBlur={() => markTouched("sejakKapan")}
                  className={(touched.sejakKapan && !sejakKapanValid ? inputErr : inputOk) + " [color-scheme:dark]"}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {isBaru ? t.stepTwo.modalAwalLabel : t.stepTwo.omsetLabel} <span className="text-primary">*</span>
              </label>
              <input
                ref={omsetInputRef}
                type="text"
                inputMode="numeric"
                value={omsetBulanan}
                onChange={handleOmsetChange}
                onBlur={() => markTouched("omsetBulanan")}
                placeholder={isBaru ? t.stepTwo.omsetPlaceholderNew : t.stepTwo.omsetPlaceholderRunning}
                className={touched.omsetBulanan && !omsetValid ? inputErr : inputOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {isBaru ? t.stepThree.tantanganLabelNew : t.stepThree.tantanganLabelRunning} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={3}
                value={tantangan}
                onChange={(e) => setTantangan(e.target.value)}
                onBlur={() => markTouched("tantangan")}
                placeholder={isBaru ? t.stepThree.tantanganPlaceholderNew : t.stepThree.tantanganPlaceholderRunning}
                className={touched.tantangan && !tantanganValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.stepThree.targetLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={3}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onBlur={() => markTouched("target")}
                placeholder={isBaru ? t.stepThree.targetPlaceholderNew : t.stepThree.targetPlaceholderRunning}
                className={touched.target && !targetValid ? textareaErr : textareaOk}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-neutral-300">
                {t.stepFour.title} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={4}
                value={ceritaVisi}
                onChange={(e) => setCeritaVisi(e.target.value)}
                onBlur={() => markTouched("ceritaVisi")}
                placeholder={t.stepFour.placeholder}
                className={touched.ceritaVisi && !ceritaVisiValid ? textareaErr : textareaOk}
              />
              <p className="mt-1.5 text-xs text-neutral-500">{t.stepFour.helper}</p>
            </div>

            {formError && <p className="text-sm text-red-400">{t.addBusinessModal.formError}</p>}
            {serverError && <p className="text-sm text-red-400">{serverError}</p>}

            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-black transition-opacity hover:opacity-90"
            >
              {t.addBusinessModal.submitButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddBusinessModal;
