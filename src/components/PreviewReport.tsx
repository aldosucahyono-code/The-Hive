import type { WizardData } from "./ChatWizard";
import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";

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

function PreviewReport({ data, preview, error, onRetry, onRestart }: PreviewReportProps) {
  const { t } = useLanguage();
  const namaBisnis = data.namaBisnis || "Bisnis Anda";
  const isBaru = data.jenisAnalisis === "baru";
  const scoreLabel = isBaru ? t.previewReport.scoreLabelNew : t.previewReport.scoreLabelRunning;

  const analysisChecklist = t.previewReport.checklist.map((label, i) => ({
    label,
    done: i < 3,
  }));

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
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.previewReport.eyebrow}</span>
          <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-surface p-8">
          <p className="text-sm text-neutral-300">
            {error || t.previewReport.errorFallback}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            {t.previewReport.errorNote}
          </p>
          <button
            onClick={onRetry}
            className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-black"
          >
            {t.previewReport.retryButton}
          </button>
        </div>
        <div className="mt-6">
          <button onClick={onRestart} className="text-sm text-neutral-400 underline">
            {t.previewReport.restartLink}
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
        <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.previewReport.eyebrow}</span>
        <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
      </div>

      {/* Business Health/Readiness Score */}
      <div className="mb-6 rounded-2xl border border-primary/30 bg-surface p-6 text-center">
        <p className="text-sm text-neutral-400">{scoreLabel}</p>
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
        <h3 className="mb-3 font-bold">{t.previewReport.checklistTitle}</h3>
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
        <h3 className="mb-2 font-bold">{t.previewReport.summaryTitle}</h3>
        <p className="text-sm leading-relaxed text-neutral-300">{preview.summary}</p>
      </div>

      {/* Temuan Penting — dari Claude */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-surface p-6">
        <h3 className="mb-3 font-bold">{t.previewReport.findingsTitle}</h3>
        <ol className="space-y-2 text-sm text-neutral-300">
          {findings.map((f, i) => (
            <li key={i}><strong className="text-primary">{i + 1}.</strong> {f}</li>
          ))}
        </ol>
      </div>

      {/* Sudah Baik / Perlu Diperbaiki / Peluang — dari Claude */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.strengthsTitle}</p>
          <p className="text-sm text-neutral-300">{preview.strengths}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.improvementsTitle}</p>
          <p className="text-sm text-neutral-300">{preview.improvements}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.opportunityTitle}</p>
          <p className="text-sm text-neutral-300">{preview.opportunity}</p>
        </div>
      </div>

      {/* Preview SWOT terkunci */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">{t.previewReport.swotTitle}</p>
            <p className="text-sm text-neutral-400">{t.previewReport.swotDesc}</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Preview Kompetitor */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">{t.previewReport.competitorTitle}</p>
            <p className="text-sm text-neutral-400">{t.previewReport.competitorDesc}</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Preview Rencana 30 Hari */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-neutral-200">{t.previewReport.planTitle}</p>
            <p className="text-sm text-neutral-400">{t.previewReport.planDesc}</p>
          </div>
          <span className="text-2xl">🔒</span>
        </div>
      </div>

      {/* Unlock Laporan Lengkap — dua paket */}
      <div className="mb-8 rounded-3xl border border-white/10 bg-surface p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {t.previewReport.unlockEyebrow}
          </span>
          <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">
            {t.previewReport.unlockTitle}
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            {t.previewReport.unlockSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* PRO */}
          <div className="rounded-2xl border border-blue-500/30 bg-black/20 p-6 text-center">
            <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">
              PRO
            </span>
            <p className="mt-3 text-sm text-neutral-400">{t.previewReport.proAudience}</p>
            <p className="mt-2 text-3xl font-black text-blue-400">Rp99.000</p>
            <ul className="mt-5 space-y-2.5 text-left">
              {t.previewReport.proChecklist.map((item) => (
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
              {t.previewReport.proButton}
            </button>
          </div>

          {/* PLATINUM */}
          <div className="rounded-2xl border border-purple-500/30 bg-black/20 p-6 text-center">
            <span className="inline-block rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
              PLATINUM
            </span>
            <p className="mt-3 text-sm text-neutral-400">{t.previewReport.platinumAudience}</p>
            <p className="mt-2 text-3xl font-black text-purple-400">Rp299.000</p>
            <ul className="mt-5 space-y-2.5 text-left">
              {t.previewReport.platinumChecklist.map((item) => (
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
              {t.previewReport.platinumButton}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          {t.previewReport.footerNote}
        </p>
      </div>

      <div className="mt-4 text-center">
        <button onClick={onRestart} className="text-sm text-neutral-400 underline">
          {t.previewReport.restartLink}
        </button>
      </div>

    </section>
  );
}

export default PreviewReport;
