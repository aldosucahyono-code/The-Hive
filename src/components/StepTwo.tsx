import { useRef, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { isValidLocation, isValidOmset, isValidPastDate, isValidFreeText, getTodayString } from "../utils/validation";

type StepTwoProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  next: () => void;
  back: () => void;
};

const todayString = getTodayString();

function formatOmset(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return "Rp" + Number(digits).toLocaleString("id-ID") + ",-";
}

const inputBase = "w-full rounded-lg border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary";
const inputOk = inputBase + " border-white/10";
const inputErr = inputBase + " border-red-500";
const textareaOk = inputOk + " resize-none";
const textareaErr = inputErr + " resize-none";

function StepTwo({ data, updateField, next, back }: StepTwoProps) {
  const isBaru = data.jenisAnalisis === "baru";
  const omsetInputRef = useRef<HTMLInputElement>(null);

  // Bug yang diperbaiki: field ini mem-format ulang SELURUH teks jadi
  // "Rp1.000.000,-" setiap kali diketik. Kalau kursor tidak dijaga secara
  // manual, browser otomatis melempar kursor ke paling akhir setelah teks
  // diganti — jadi backspace di tengah angka terasa tidak berfungsi, dan
  // pengguna terpaksa hapus semua lalu ketik ulang. Solusinya: hitung ada
  // berapa digit SEBELUM posisi kursor sebelum diformat ulang, lalu setelah
  // teks baru terpasang, taruh kursor persis setelah digit ke-N yang sama.
  function handleOmsetChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? rawValue.length;
    const digitsBeforeCursor = rawValue.slice(0, cursorPos).replace(/[^0-9]/g, "").length;

    updateField("omsetBulanan", formatOmset(rawValue));

    requestAnimationFrame(() => {
      const el = omsetInputRef.current;
      if (!el) return;
      let seen = 0;
      let newPos = el.value.length;
      if (digitsBeforeCursor === 0) {
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
    omsetBulanan: false,
    targetPelanggan: false,
  });
  const [error, setError] = useState(false);

  const lokasiValid = isValidLocation(data.lokasi);
  const sejakKapanValid = isValidPastDate(data.sejakKapan);
  const omsetValid = isValidOmset(data.omsetBulanan);
  const targetPelangganValid = isValidFreeText(data.targetPelanggan, 7, 2);

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleNext() {
    if (isBaru) {
      setTouched((prev) => ({ ...prev, lokasi: true, targetPelanggan: true, omsetBulanan: true }));
      if (!lokasiValid || !targetPelangganValid || !omsetValid) {
        setError(true);
        return;
      }
    } else {
      setTouched({ lokasi: true, sejakKapan: true, omsetBulanan: true, targetPelanggan: true });
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
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">STEP 2 OF 4</div>

      <div className="mb-5">
        <label className="mb-2 block text-sm">
          {isBaru ? "Lokasi Rencana Bisnis Anda" : "Lokasi Bisnis Anda"} <span className="text-primary">*</span>
          {touched.lokasi && !lokasiValid && (
            <span className="ml-2 text-amber-400" title="Minimal 2 kata, tidak boleh asal/berulang">⚠</span>
          )}
        </label>
        <input
          type="text"
          placeholder="Contoh : Sukun, Kota Malang"
          value={data.lokasi}
          onChange={(e) => updateField("lokasi", e.target.value)}
          onBlur={() => markTouched("lokasi")}
          className={touched.lokasi && !lokasiValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Sertakan kecamatan/kota (minimal 2 kata), jangan disingkat/asal ketik.</p>
      </div>

      {isBaru ? (
        <div className="mb-5">
          <label className="mb-2 block text-sm">
            Target Pelanggan Anda <span className="text-primary">*</span>
            {touched.targetPelanggan && !targetPelangganValid && (
              <span className="ml-2 text-amber-400" title="Minimal 2 kata, jangan asal ketik">⚠</span>
            )}
          </label>
          <textarea
            rows={3}
            placeholder="Contoh : Mahasiswa dan pekerja muda usia 18-30 tahun di sekitar kampus..."
            value={data.targetPelanggan}
            onChange={(e) => updateField("targetPelanggan", e.target.value)}
            onBlur={() => markTouched("targetPelanggan")}
            className={touched.targetPelanggan && !targetPelangganValid ? textareaErr : textareaOk}
          />
          <p className="mt-1.5 text-xs text-neutral-500">Ceritakan siapa calon pelanggan utama Anda.</p>
        </div>
      ) : (
        <div className="mb-5">
          <label className="mb-2 block text-sm">
            Sejak Kapan Bisnis Berjalan <span className="text-primary">*</span>
            {touched.sejakKapan && !sejakKapanValid && (
              <span className="ml-2 text-amber-400" title="Tidak boleh tanggal di masa depan">⚠</span>
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
          <p className="mt-1.5 text-xs text-neutral-500">Pilih tanggal mulai bisnis Anda beroperasi (tidak boleh tanggal yang belum terjadi).</p>
        </div>
      )}

      <div className="mb-6">
        <label className="mb-2 block text-sm">
          {isBaru ? "Estimasi Modal Awal" : "Rata-rata Omset Bulanan Saat Ini"} <span className="text-primary">*</span>
          {touched.omsetBulanan && !omsetValid && (
            <span className="ml-2 text-amber-400" title="Isi dengan angka">⚠</span>
          )}
        </label>
        <input
          ref={omsetInputRef}
          type="text"
          inputMode="numeric"
          placeholder={isBaru ? "Contoh : Rp10.000.000,-" : "Contoh : Rp15.000.000,-"}
          value={data.omsetBulanan}
          onChange={handleOmsetChange}
          onBlur={() => markTouched("omsetBulanan")}
          className={touched.omsetBulanan && !omsetValid ? inputErr : inputOk}
        />
        <p className="mt-1.5 text-xs text-neutral-500">Cukup ketik angkanya, format Rupiah otomatis menyesuaikan.</p>
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

export default StepTwo;
