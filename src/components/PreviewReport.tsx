import { useEffect, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";

export type PreviewData = {
  businessHealthScore: number;
  statusLabel: string;
  summary: string;
  findings: string[];
  strengths: string;
  improvements: string;
  opportunity: string;
  // Rekomendasi Tier oleh Beemo (opsional — respons lama sebelum field ini
  // ditambah tidak akan punya ini, jadi UI harus tetap aman kalau undefined).
  recommendedTier?: "pro" | "platinum";
  recommendationNote?: string;
};

type PreviewReportProps = {
  data: WizardData;
  preview: PreviewData | null;
  error: string | null;
  onRetry: () => void;
  onRestart: () => void;
};

function PreviewReport({ data, preview, error, onRetry, onRestart }: PreviewReportProps) {
  const { t, lang } = useLanguage();
  const { user, session } = useAuth();
  const namaBisnis = data.namaBisnis || "Bisnis Anda";
  const isBaru = data.jenisAnalisis === "baru";
  const scoreLabel = isBaru ? t.previewReport.scoreLabelNew : t.previewReport.scoreLabelRunning;
  const [preparingPlan, setPreparingPlan] = useState<"pro" | "platinum" | null>(null);

  // Auto-promote draft (directive PO: "bisnis yang baru saya masukan...
  // tidak otomatis tersimpan... padahal emailnya sama"): promote-draft
  // sebelumnya HANYA dipanggil dari PaymentPage (setelah checkout). Kalau
  // pengunjung ternyata SUDAH punya sesi login aktif saat hasil gratis ini
  // muncul (mis. sudah jadi pelanggan di tab lain), business barunya
  // langsung "naik level" jadi business_profile asli di Workspace-nya —
  // tidak perlu nunggu sampai checkout. Untuk pengunjung anonim (belum
  // login), TIDAK berubah — draft tetap baru dipromosikan saat checkout
  // (lihat goToPayment di bawah / PaymentPage.tsx), supaya tidak membuat
  // business_profile permanen untuk orang yang cuma coba-coba gratis.
  const [autoSavedBusinessId, setAutoSavedBusinessId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    if (!preview || !user || !session?.access_token || autoSavedBusinessId || autoSaving) return;
    const accessToken = session.access_token;
    let cancelled = false;

    async function autoPromote() {
      setAutoSaving(true);
      try {
        const saveRes = await fetch("/api/save-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wizardData: data, preview, lang }),
        });
        const saveJson = await saveRes.json();
        if (!saveRes.ok || !saveJson.id) {
          console.error("auto-promote: save-submission gagal:", saveJson.error);
          return;
        }

        const promoteRes = await fetch("/api/promote-draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ draftId: saveJson.id }),
        });
        const promoteJson = await promoteRes.json();
        if (!cancelled && promoteRes.ok && promoteJson.businessProfileId) {
          setAutoSavedBusinessId(promoteJson.businessProfileId);
        } else if (!promoteRes.ok) {
          console.error("auto-promote: promote-draft gagal:", promoteJson.error);
        }
      } catch (err) {
        console.error("auto-promote error:", err);
      } finally {
        if (!cancelled) setAutoSaving(false);
      }
    }

    autoPromote();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sengaja cuma
    // reaktif ke preview/user/session, bukan `data` (WizardData berubah
    // identitas objeknya tiap render tapi isinya sama untuk preview yang sama).
  }, [preview, user, session?.access_token]);

  const analysisChecklist = t.previewReport.checklist.map((label, i) => ({
    label,
    done: i < 3,
  }));

  async function goToPayment(plan: "pro" | "platinum") {
    setPreparingPlan(plan);

    // Simpan wizard data + hasil preview sebagai draft anonim (wizard_drafts).
    // Draft ini BELUM terhubung ke business_profile/analysis manapun — itu
    // baru terjadi lewat /api/promote-draft, setelah user login di halaman
    // pembayaran. save-submission tidak butuh token sama sekali (memang
    // dirancang bisa dipanggil tanpa login).
    let draftId: string | null = null;
    try {
      const response = await fetch("/api/save-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardData: data, preview, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        draftId = json.id;
      } else {
        console.error("save-submission gagal:", json.error);
      }
    } catch (err) {
      console.error("save-submission error:", err);
      // Tidak menghalangi user lanjut ke pembayaran walau gagal simpan —
      // draftId akan null, PaymentPage akan minta user isi ulang data
      // secara manual (kurang ideal, tapi tidak fatal).
    }

    try {
      localStorage.setItem(
        "hive_pending_order",
        JSON.stringify({
          namaBisnis: data.namaBisnis,
          nama: data.nama,
          email: data.email,
          draftId,
        })
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

      {autoSavedBusinessId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-3 text-center sm:text-left">
          <p className="text-sm text-neutral-200">✓ {t.previewReport.autoSavedNote}</p>
          <button
            onClick={() => hardNavigate("workspace")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-transform hover:-translate-y-0.5"
          >
            {t.previewReport.autoSavedButton}
          </button>
        </div>
      )}

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

      {/* Preview SWOT — blur, bukan ikon gembok (supaya tidak terasa "dikunci") */}
      <BlurTeaser
        title={t.previewReport.swotTitle}
        lines={t.previewReport.swotMock}
        cta={t.previewReport.unlockCta}
      />

      {/* Preview Kompetitor */}
      <BlurTeaser
        title={t.previewReport.competitorTitle}
        lines={t.previewReport.competitorMock}
        cta={t.previewReport.unlockCta}
      />

      {/* Preview Rencana 30 Hari */}
      <BlurTeaser
        title={t.previewReport.planTitle}
        lines={t.previewReport.planMock}
        cta={t.previewReport.unlockCta}
        marginBottom="mb-8"
      />

      {/* Unlock Laporan Lengkap — dua paket */}
      <div id="unlock-section" className="mb-8 rounded-3xl border border-white/10 bg-surface p-6 sm:p-8">
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

        {/* Rekomendasi Beemo — halus, bukan hard-sell. Selalu bisa memilih
            paket lain, ini cuma saran dengan alasan konkret dari analisa. */}
        {preview.recommendationNote && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 sm:p-5">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
              🐝 {t.previewReport.recommendationTitle}
            </p>
            <p className="text-sm leading-relaxed text-neutral-200">{preview.recommendationNote}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* PRO */}
          <div
            className={
              "relative rounded-2xl border bg-black/20 p-6 text-center " +
              (preview.recommendedTier === "pro" ? "border-primary/60 ring-1 ring-primary/40" : "border-blue-500/30")
            }
          >
            {preview.recommendedTier === "pro" && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-black">
                🐝 {t.previewReport.recommendedBadge}
              </span>
            )}
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
              disabled={preparingPlan !== null}
              className="mt-6 w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preparingPlan === "pro" ? t.previewReport.preparingButton : t.previewReport.proButton}
            </button>
          </div>

          {/* PLATINUM */}
          <div
            className={
              "relative rounded-2xl border bg-black/20 p-6 text-center " +
              (preview.recommendedTier === "platinum" ? "border-primary/60 ring-1 ring-primary/40" : "border-purple-500/30")
            }
          >
            {preview.recommendedTier === "platinum" && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-black">
                🐝 {t.previewReport.recommendedBadge}
              </span>
            )}
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
              disabled={preparingPlan !== null}
              className="mt-6 w-full rounded-xl bg-purple-500 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preparingPlan === "platinum" ? t.previewReport.preparingButton : t.previewReport.platinumButton}
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

function BlurTeaser({
  title,
  lines,
  cta,
  marginBottom = "mb-4",
}: {
  title: string;
  lines: string[];
  cta: string;
  marginBottom?: string;
}) {
  function scrollToUnlock() {
    document.getElementById("unlock-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-5 ${marginBottom}`}>
      <p className="mb-3 font-bold text-neutral-200">{title}</p>
      <div aria-hidden="true" className="select-none space-y-2 blur-[3px]">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-neutral-400">
            {line}
          </p>
        ))}
      </div>
      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/85 via-black/50 to-transparent pb-4">
        <button
          onClick={scrollToUnlock}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

export default PreviewReport;
