import { useState } from "react";
import type { WizardData } from "./ChatWizard";

type StepReviewProps = {
  data: WizardData;
  onEdit: (step: number) => void;
  back: () => void;
  startTime: number;
  onSuccess: () => void;
};

const MIN_FILL_TIME_MS = 5000;

function StepReview({ data, onEdit, back, startTime, onSuccess }: StepReviewProps) {
  const [loading, setLoading] = useState(false);
  const [botError, setBotError] = useState(false);

  function handleProses() {
    const elapsed = Date.now() - startTime;
    const looksLikeBot = data.honeypot.trim().length > 0 || elapsed < MIN_FILL_TIME_MS;

    if (looksLikeBot) {
      setBotError(true);
      return;
    }

    setBotError(false);
    setLoading(true);
    onSuccess();
  }

  return (
    <>
      <div className="mb-6 text-xs font-bold uppercase tracking-widest text-primary">STEP 4 OF 4 — KONFIRMASI DATA</div>

      <p className="mb-6 text-sm text-neutral-300">
        Cek dulu data di bawah sebelum diproses. Pastikan semuanya sudah
        benar, karena hasil analisis akan mengikuti data yang Anda isi.
      </p>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Identitas</h4>
          <button onClick={() => onEdit(1)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">Edit</button>
        </div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">Nama</span><strong>{data.nama}</strong></div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">Profesi</span><strong>{data.profesi}</strong></div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">Nama Bisnis/Brand</span><strong>{data.namaBisnis}</strong></div>
        <div className="flex justify-between py-1.5 text-sm"><span className="text-neutral-400">Jenis Bisnis</span><strong>{data.jenisBisnis}</strong></div>
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Lokasi & Kondisi Bisnis</h4>
          <button onClick={() => onEdit(2)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">Edit</button>
        </div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">Lokasi</span><strong>{data.lokasi}</strong></div>
        <div className="flex justify-between border-b border-white/5 py-1.5 text-sm"><span className="text-neutral-400">Sejak Kapan Berjalan</span><strong>{data.sejakKapan}</strong></div>
        <div className="flex justify-between py-1.5 text-sm"><span className="text-neutral-400">Omset Bulanan Saat Ini</span><strong>{data.omsetBulanan}</strong></div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-black/20 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Tantangan & Target</h4>
          <button onClick={() => onEdit(3)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">Edit</button>
        </div>
        <div className="border-b border-white/5 py-2 text-sm">
          <span className="block text-neutral-400">Tantangan Terbesar</span>
          <strong>{data.tantangan}</strong>
        </div>
        <div className="py-2 text-sm">
          <span className="block text-neutral-400">Target/Harapan</span>
          <strong>{data.target}</strong>
        </div>
      </div>

      {botError && (
        <p className="mb-4 text-sm text-red-400">
          Verifikasi gagal. Mohon isi ulang formulir secara manual, lalu coba lagi.
        </p>
      )}

      <div className="mb-3 flex justify-start">
        <button onClick={back} className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-neutral-200">
          ← Kembali
        </button>
      </div>

      <button
        onClick={handleProses}
        disabled={loading}
        className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-4 text-black disabled:opacity-60"
      >
        <span className="text-base font-bold">
          {loading ? "Memproses Analisis..." : "🚀 Proses Analisis Sekarang"}
        </span>
        <span className="text-xs font-medium opacity-80">
          Pastikan data sudah benar sebelum lanjut
        </span>
      </button>
    </>
  );
}

export default StepReview;
