import { useRef, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidLocation, isValidOmset, isValidPastDate, isValidFutureDate, isValidFreeText, getTodayString } from "../utils/validation";
import { useLanguage } from "../i18n/LanguageContext";

type StepTwoProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  next: () => void;
  back: () => void;
};

const todayString = getTodayString();

const inputBase = "w-full rounded-lg border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary";
const inputOk = inputBase + " border-white/10";
const inputErr = inputBase + " border-red-500";
const textareaOk = inputOk + " resize-none";
const textareaErr = inputErr + " resize-none";

function StepTwo({ data, updateField, next, back }: StepTwoProps) {
  const { t } = useLanguage();
  const isBaru = data.jenisAnalisis === "baru";
  const omsetInputRef = useRef<HTMLInputElement>(null);

  // Bug yang diperbaiki: field ini mem-format ulang SELURUH teks jadi
  // "Rp1.000.000,-" setiap kali diketik. Kalau kursor tidak dijaga secara
  // manual, browser otomatis melempar kursor ke paling akhir setelah teks
  // diganti — jadi backspace di tengah angka terasa tidak berfungsi, dan
  // pengguna terpaksa hapus semua lalu ketik ulang. Solusinya: hitung ada
  // berapa digit SEBELUM posisi kursor sebelum diformat ulang, lalu setelah
  // teks baru terpasang, taruh kursor persis setelah digit ke-N yang sama.
  // Perbaikan tambahan: kalau backspace kebetulan "memakan" karakter format
  // (titik/koma/strip, bukan angka), pemformatan ulang akan langsung
  // menambahkan karakter itu lagi karena formatnya selalu tetap — hasilnya backspace
  // terasa tidak berfungsi sama sekali, terutama saat kursor di ujung akhir
  // teks. Solusinya: deteksi kasus ini, lalu hapus ANGKA terdekat sebelum
  // tanda baca itu, bukan tanda bacanya sendiri.
  function handleOmsetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const oldValue = data.omsetBulanan;
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
    updateField("omsetBulanan", formatted);

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

  const [touched, setTouched] = useState({
    lokasi: false,
    sejakKapan: false,
    rencanaLaunching: false,
    omsetBulanan: false,
    targetPelanggan: false,
  });
  const [error, setError] = useState(false);

  const lokasiValid = isValidLocation(data.lokasi);
  const sejakKapanValid = isValidPastDate(data.sejakKapan);
  const rencanaLaunchingValid = isValidFutureDate(data.rencanaLaunching);
  const omsetValid = isValidOmset(data.omsetBulanan);
  const targetPelangganValid = isValidFreeText(data.targetPelanggan, 7, 2);

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleNext() {
    if (isBaru) {
      setTouched((prev) => ({
        ...prev,
        lokasi: true,
        targetPelanggan: true,
        omsetBulanan: true,
        rencanaLaunching: true,
      }));
      if (!lokasiValid || !targetPelangganValid || !omsetValid || !rencanaLaunchingValid) {
        setError(true);
        return;
      }
    } else {
      setTouched({
        lokasi: true,
        sejakKapan: true,
        omsetBulanan: true,
        targetPelanggan: true,
        rencanaLaunching: false,
      });
      if (!lokasiValid || !sejakKapanValid || !omsetValid) {
        setError(true);
        return;
      }
    }

    setError(false);
    next();
  }

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">{t.stepTwo.stepLabel}</div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {isBaru ? t.stepTwo.lokasiLabelNew : t.stepTwo.lokasiLabelRunning} <span className="text-primary">*</span>
          {touched.lokasi && !lokasiValid && (
            <span className="ml-2 text-amber-400" title={t.stepTwo.lokasiWarningTitle}>⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder={t.stepTwo.lokasiPlaceholder}
          value={data.lokasi}
          onChange={(e) => updateField("lokasi", e.target.value)}
          onBlur={() => markTouched("lokasi")}
          className={touched.lokasi && !lokasiValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.lokasiHelper}</p>
      </div>

      {isBaru ? (
        <>
          <div className="mb-5">
            <label className="mb-2 block text-sm">
              {t.stepTwo.targetPelangganLabel} <span className="text-primary">*</span>
              {touched.targetPelanggan && !targetPelangganValid && (
                <span className="ml-2 text-amber-400" title={t.stepTwo.targetPelangganWarningTitle}>⚠</span>
              )}
            </label>
            <textarea
              rows={3}
              placeholder={t.stepTwo.targetPelangganPlaceholder}
              value={data.targetPelanggan}
              onChange={(e) => updateField("targetPelanggan", e.target.value)}
              onBlur={() => markTouched("targetPelanggan")}
              className={touched.targetPelanggan && !targetPelangganValid ? textareaErr : textareaOk}
            />
            <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.targetPelangganHelper}</p>
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm">
              {t.stepTwo.rencanaLaunchingLabel} <span className="text-primary">*</span>
              {touched.rencanaLaunching && !rencanaLaunchingValid && (
                <span className="ml-2 text-amber-400" title={t.stepTwo.rencanaLaunchingWarningTitle}>⚠</span>
              )}
            </label>
            <input
              type="date"
              min={todayString}
              value={data.rencanaLaunching}
              onChange={(e) => updateField("rencanaLaunching", e.target.value)}
              onBlur={() => markTouched("rencanaLaunching")}
              className={(touched.rencanaLaunching && !rencanaLaunchingValid ? inputErr : inputOk) + " [color-scheme:dark]"}
            />
            <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.rencanaLaunchingHelper}</p>
          </div>
        </>
      ) : (
        <div className="mb-5">
          <label className="mb-2 block text-sm">
            {t.stepTwo.sejakKapanLabel} <span className="text-primary">*</span>
            {touched.sejakKapan && !sejakKapanValid && (
              <span className="ml-2 text-amber-400" title={t.stepTwo.sejakKapanWarningTitle}>⚠</span>
            )}
          </label>
          <input
            type="date"
            max={todayString}
            value={data.sejakKapan}
            onChange={(e) => updateField("sejakKapan", e.target.value)}
            onBlur={() => markTouched("sejakKapan")}
            className={(touched.sejakKapan && !sejakKapanValid ? inputErr : inputOk) + " [color-scheme:dark]"}
          />
          <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.sejakKapanHelper}</p>
        </div>
      )}

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          {isBaru ? t.stepTwo.modalAwalLabel : t.stepTwo.omsetLabel} <span className="text-primary">*</span>
          {touched.omsetBulanan && !omsetValid && (
            <span className="ml-2 text-amber-400" title={t.stepTwo.omsetWarningTitle}>⚠</span>
          )}
        </label>
        <input
          ref={omsetInputRef}
          type="text"
          inputMode="numeric"
          placeholder={isBaru ? t.stepTwo.omsetPlaceholderNew : t.stepTwo.omsetPlaceholderRunning}
          value={data.omsetBulanan}
          onChange={handleOmsetChange}
          onBlur={() => markTouched("omsetBulanan")}
          className={touched.omsetBulanan && !omsetValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.stepTwo.omsetHelper}</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{t.stepTwo.formError}</p>
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

export default StepTwo;
