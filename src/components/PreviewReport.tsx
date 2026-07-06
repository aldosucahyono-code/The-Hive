import type { WizardData } from "./ChatWizard";
import { hardNavigate } from "../utils/navigate";

export type PreviewData = {
  businessHealthScore: number;
  statusLabel: string;
  summary: string;
  findings: string[];
  strengths: string;
  improvements: string;
  opportunity: string;
};

type PreviewReportProps = {
  data: WizardData;
  preview: PreviewData | null;
  error: string | null;
  onRetry: () => void;
  onRestart: () => void;
};

const analysisChecklist = [
  { label: "Kondisi Bisnis", done: true },
  { label: "Peluang", done: true },
  { label: "Target", done: true },
  { label: "SWOT", done: false },
  { label: "Kompetitor", done: false },
  { label: "Strategi Marketing", done: false },
  { label: "Rencana 30 Hari", done: false },
  { label: "Ide Pengembangan", done: false },
];

const proChecklist = [
  "Analisis praktis & mudah dipahami",
  "SWOT, kompetitor, strategi marketing",
  "Peluang pasar & rekomendasi operasional",
  "Rencana aksi 30-60-90 hari",
  "Langsung bisa diterapkan",
];

const platinumChecklist = [
  "Semua fitur PRO",
  "Executive & Competitive Intelligence",
  "AI Consultant & Dashboard Profesional",
  "Scenario Planning & Decision Matrix",
  "Insight mendalam untuk pertumbuhan jangka panjang",
];

function PreviewReport({ data, preview, error, onRetry, onRestart }: PreviewReportProps) {
  const namaBisnis = data.namaBisnis || "Bisnis Anda";

  function goToPayment(plan: "pro" | "platinum") {
    try {
      localStorage.setItem(
        "hive_pending_order",
        JSON.stringify({ namaBisnis: data.namaBisnis, nama: data.nama, email: data.email })
      );
    } catch {
      // localStorage tidak tersedia — halaman pembayaran akan tampil tanpa ringkasan data.
    }
    hardNavigate(plan === "pro" ? "bayar-pro" : "bayar-platinum");
  }

  // Preview gagal dibuat (API error/timeout) — tampilkan pesan jujur dan
  // tombol coba lagi, JANGAN tampilkan template/data yang dikarang.
  if (error || !preview) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Hasil Analisa (Gratis)</span>
          <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-surface p-8">
          <p className="text-sm text-neutral-300">
            {error || "Analisis AI belum berhasil dibuat."}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Kami tidak menampilkan hasil karangan — silakan coba lagi.
          </p>
          <button
            onClick={onRetry}
            className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black"
          >
            🔄 Coba Analisis Lagi
          </button>
        </div>
        <div className="mt-6">
          <button onClick={onRestart} className="text-sm text-neutral-400 underline">
            Mulai analisis baru
          </button>
        </div>
      </section>
    );
  }

  const score = preview.businessHealthScore;
  const status = preview.statusLabel;
  const findings = preview.findings.slice(0, 3);

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">

      <div className="mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">Hasil Analisa (Gratis)</span>
        <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
      </div>

      {/* Business Health Score */}
      <div className="mb-6 rounded-2xl border border-primary/30 bg-surface p-6 text-center">
        <p className="text-sm text-neutral-400">Skor Kesehatan Bisnis</p>
        <p className="mt-1 text-5xl font-black text-primary">
          {score}<span className="text-xl text-neutral-500">/100</span>
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-300">{status}</p>
        <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${score}%` }}></div>
        </div>
      </div>

      {/* AI sedang menganalisa */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-surface p-6">
        <h3 className="mb-3 font-bold">AI Sudah Menganalisa</h3>
        <ul className="grid grid-cols-2 gap-2">
          {analysisChecklist.map((item) => (
            <li key={item.label} className={"flex items-center gap-2 text-sm " + (item.done ? "text-neutral-200" : "text-neutral-500")}>
              <span>{item.done ? "✓" : "🔒"}</span> {item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Ringkasan Singkat — dari Claude */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-surface p-6">
        <h3 className="mb-2 font-bold">Ringkasan Singkat</h3>
        <p className="text-sm leading-relaxed text-neutral-300">{preview.summary}</p>
      </div>

      {/* Temuan Penting — dari Claude */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-surface p-6">
        <h3 className="mb-3 font-bold">Temuan Penting</h3>
        <ol className="space-y-2 text-sm text-neutral-300">
          {findings.map((f, i) => (
            <li key={i}><strong className="text-primary">{i + 1}.</strong> {f}</li>
          ))}
        </ol>
      </div>

      {/* Sudah Baik / Perlu Diperbaiki / Peluang — dari Claude */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">Yang Sudah Baik</p>
          <p className="text-sm text-neutral-300">{preview.strengths}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">Yang Perlu Diperbaiki</p>
          <p className="text-sm text-neutral-300">{preview.improvements}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">Peluang</p>
          <p className="text-sm text-neutral-300">{preview.opportunity}</p>
        </div>
      </div>

      {/* Preview SWOT terkunci */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">Analisa SWOT</p>
            <p className="text-sm text-neutral-400">Tersedia lengkap di laporan PRO/PLATINUM.</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Preview Kompetitor */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">Analisa Kompetitor</p>
            <p className="text-sm text-neutral-400">Identifikasi kompetitor tersedia di laporan berbayar.</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Preview Rencana 30 Hari */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">Rencana 30 Hari</p>
            <p className="text-sm text-neutral-400">Roadmap langkah demi langkah tersedia di laporan berbayar.</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Unlock Laporan Lengkap — dua paket */}
      <div className="mb-8 rounded-3xl border border-white/10 bg-surface p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            🔒 Unlock Laporan Lengkap
          </span>
          <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">
            Pilih Paket yang Sesuai Kebutuhan Anda
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            Dua pilihan paket untuk analisis bisnis yang lebih mendalam dan siap Anda terapkan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* PRO */}
          <div className="rounded-2xl border border-blue-500/30 bg-black/20 p-6 text-center">
            <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">
              PRO
            </span>
            <p className="mt-3 text-sm text-neutral-400">Untuk UMKM &amp; Bisnis Mikro</p>
            <p className="mt-2 text-3xl font-black text-blue-400">Rp99.000</p>
            <ul className="mt-5 space-y-2.5 text-left">
              {proChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-200">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => goToPayment("pro")}
              className="mt-6 w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              🔓 Unlock PRO
            </button>
          </div>

          {/* PLATINUM */}
          <div className="rounded-2xl border border-purple-500/30 bg-black/20 p-6 text-center">
            <span className="inline-block rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
              PLATINUM
            </span>
            <p className="mt-3 text-sm text-neutral-400">Untuk Perusahaan &amp; Keputusan Strategis</p>
            <p className="mt-2 text-3xl font-black text-purple-400">Rp299.000</p>
            <ul className="mt-5 space-y-2.5 text-left">
              {platinumChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-200">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => goToPayment("platinum")}
              className="mt-6 w-full rounded-xl bg-purple-500 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              🔓 Unlock PLATINUM
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          🔒 Laporan akan dikirim dalam format PDF ke email Anda.
        </p>
      </div>

      <div className="mt-4 text-center">
        <button onClick={onRestart} className="text-sm text-neutral-400 underline">
          Mulai analisis baru
        </button>
      </div>

    </section>
  );
}

export default PreviewReport;
