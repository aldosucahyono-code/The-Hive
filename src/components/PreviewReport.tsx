import { useEffect, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { hardNavigate } from "../utils/navigate";
import { useLanguage, fillTemplate } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

// Bugfix Juli 2026 (directive PO: "upgrade hanya diworkspace saja") —
// halaman preview report ini TIDAK LAGI menampilkan PricingCards/memicu
// checkout langsung. Satu-satunya jalur upgrade Pro/Platinum sekarang ada di
// dalam Workspace (lihat UpgradeModal.tsx, yang masih pakai PricingCards.tsx
// seperti biasa). Di sini kita cuma funnel ke Workspace gratis.

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
  // Audit Juli 2026 (hasil preview kini disimpan segera ke wizard_drafts
  // lewat save-submission di ChatWizard.tsx, lihat komentar di sana) — kalau
  // id ini sudah ada, autoPromote di bawah cukup panggil promoteDraft
  // langsung, TIDAK perlu save-submission kedua kalinya.
  draftId?: string | null;
};

function PreviewReport({ data, preview, error, onRetry, onRestart, draftId }: PreviewReportProps) {
  const { t, lang } = useLanguage();
  const { user, session } = useAuth();
  const namaBisnis = data.namaBisnis || "Bisnis Anda";
  const isBaru = data.jenisAnalisis === "baru";
  const scoreLabel = isBaru ? t.previewReport.scoreLabelNew : t.previewReport.scoreLabelRunning;

  // Auto-promote draft (directive PO: "bisnis yang baru saya masukan...
  // tidak otomatis tersimpan... padahal emailnya sama"): promote-draft
  // sebelumnya HANYA dipanggil dari PaymentPage (setelah checkout). Kalau
  // pengunjung ternyata SUDAH punya sesi login aktif saat hasil gratis ini
  // muncul (mis. sudah jadi pelanggan di tab lain), business barunya
  // langsung "naik level" jadi business_profile asli di Workspace-nya —
  // tidak perlu nunggu sampai checkout. Untuk pengunjung anonim (belum
  // login), TIDAK berubah — draft tetap baru dipromosikan saat checkout di
  // dalam Workspace (lihat PaymentPage.tsx), supaya tidak membuat
  // business_profile permanen untuk orang yang cuma coba-coba gratis.
  const [autoSavedBusinessId, setAutoSavedBusinessId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  // Batas jumlah usaha per akun (services/business/checkBusinessCap.ts) —
  // kalau user sudah di batas, auto-promote tidak membuat business_profile
  // baru; tampilkan pemberitahuan yang jelas + arahkan upgrade, alih-alih
  // diam-diam gagal (log error saja) seperti sebelumnya.
  const [autoSaveCapped, setAutoSaveCapped] = useState(false);

  // CTA "Coba Gratis, Masuk ke Workspace" (directive PO: pelanggan yang
  // belum siap bayar tetap harus bisa merasakan Workspace pribadinya
  // langsung dari hasil analisa gratis ini, supaya lebih tertarik upgrade
  // nanti — bukan cuma diarahkan ke Pro/Platinum). Reuse AuthModal +
  // autoPromote effect di atas yang SUDAH ADA (sebelumnya cuma jalan kalau
  // pengunjung kebetulan sudah login di tab lain) — di sini kita cuma
  // menambah pemicu login-nya untuk pengunjung anonim.
  const [showAuthModal, setShowAuthModal] = useState(false);
  // BUGFIX Juli 2026 (QA: "OTP sudah diisi, harusnya langsung ke Workspace,
  // bukan balik ke halaman laporan gratis + klik 'Buka Workspace' lagi").
  // Ditandai TRUE hanya saat user SENGAJA klik CTA "Coba Gratis, Masuk ke
  // Workspace" (bukan kasus pasif "kebetulan sudah login duluan" -- itu
  // tetap pakai banner + tombol manual seperti sebelumnya, supaya orang
  // yang cuma numpang lihat laporan gratis tidak tiba-tiba dilempar ke
  // Workspace tanpa diminta). Begitu autoPromote di bawah selesai SUKSES,
  // effect kedua di bawah langsung hardNavigate ke Workspace tanpa perlu
  // klik tambahan -- menepati janji tombolnya sendiri ("Masuk ke Workspace").
  const [explicitWorkspaceIntent, setExplicitWorkspaceIntent] = useState(false);

  useEffect(() => {
    // Tutup modal otomatis begitu login sukses (session tersinkron lewat
    // magic link yang dibuka di tab lain) — tanpa ini modal "Cek Email
    // Kamu" akan tetap menutupi layar walau user sudah login.
    if (user && showAuthModal) setShowAuthModal(false);
  }, [user, showAuthModal]);

  useEffect(() => {
    if (!preview || !user || !session?.access_token || autoSavedBusinessId || autoSaving) return;
    const accessToken = session.access_token;
    let cancelled = false;

    async function autoPromote() {
      setAutoSaving(true);
      try {
        // Reuse id yang sudah tersimpan segera setelah preview jadi (lihat
        // runPreviewAnalysis di ChatWizard.tsx) -- kalau karena suatu alasan
        // belum ada (mis. save-submission awal itu sempat gagal), baru
        // panggil save-submission di sini sebagai fallback, sama seperti
        // perilaku sebelumnya.
        let usableDraftId = draftId || null;
        if (!usableDraftId) {
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
          usableDraftId = saveJson.id;
        }

        const promoteRes = await fetch("/api/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action: "promoteDraft", draftId: usableDraftId }),
        });
        const promoteJson = await promoteRes.json();
        if (!cancelled && promoteRes.ok && promoteJson.businessProfileId) {
          setAutoSavedBusinessId(promoteJson.businessProfileId);
        } else if (!cancelled && promoteJson.capExceeded) {
          setAutoSaveCapped(true);
        } else if (!cancelled && promoteJson.emailMismatch) {
          // Sesi login di browser ini BUKAN pemilik email yang baru saja
          // diisi di wizard (mis. developer sedang login sendiri saat
          // pengunjung lain mengisi form) — jangan auto-save ke akun yang
          // salah. Diamkan saja di sini (sama seperti kasus belum login):
          // draft tetap tersimpan anonim, nanti dipromosikan ulang lewat
          // alur checkout normal (PaymentPage), yang menampilkan pesan
          // jelas ke pengguna kalau terjadi mismatch yang sama.
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

  // BUGFIX Juli 2026 (lihat komentar di explicitWorkspaceIntent): begitu
  // autoPromote() di atas berhasil menyimpan bisnis ini (autoSavedBusinessId
  // terisi) DAN user memang baru saja login lewat CTA "Coba Gratis" (bukan
  // kebetulan sudah login sebelumnya), langsung pindah ke Workspace tanpa
  // menunggu klik tombol "Buka Workspace" lagi. Kasus autoSaveCapped
  // (batas usaha tercapai) SENGAJA tidak di-auto-redirect di sini -- itu
  // pesan penting yang harus sempat dibaca user dulu sebelum dia pilih
  // lanjut ke Workspace (usaha lamanya) secara manual.
  useEffect(() => {
    if (explicitWorkspaceIntent && autoSavedBusinessId) {
      hardNavigate("workspace");
    }
  }, [explicitWorkspaceIntent, autoSavedBusinessId]);

  const analysisChecklist = t.previewReport.checklist.map((label, i) => ({
    label,
    done: i < 3,
  }));

  // Phase 2 (Preview Experience, review PO "WOW moment") — skor "menghitung
  // naik" dari 0 ke angka aslinya begitu preview muncul, dibarengi progress
  // ring yang ikut terisi. Murni animasi sisi klien (requestAnimationFrame),
  // TIDAK ada angka yang dikarang -- target akhirnya tetap persis
  // preview.businessHealthScore dari Claude. Hook ini harus tetap dipanggil
  // tanpa syarat (sebelum early-return error di bawah) sesuai aturan Hooks.
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const target = preview?.businessHealthScore;
    if (typeof target !== "number") {
      setDisplayScore(0);
      return;
    }
    // Bugfix (Vercel build gagal, TS18048): narrowing "typeof target ===
    // number" di atas TIDAK ikut terbawa ke dalam function declaration
    // bersarang (tick) -- TypeScript menganalisa isinya terpisah dari CFA
    // titik deklarasi. Re-bind ke const baru dengan tipe eksplisit supaya
    // tidak ambigu number|undefined lagi di dalam closure manapun.
    const targetScore: number = target;
    const durationMs = 1400;
    const startTime = performance.now();
    let frameId: number;
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayScore(Math.round(eased * targetScore));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [preview?.businessHealthScore]);

  // Preview gagal dibuat (API error/timeout) — tampilkan pesan jujur dan
  // tombol coba lagi, JANGAN tampilkan template/data yang dikarang.
  if (error || !preview) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.previewReport.eyebrow}</span>
          <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-white p-8">
          <p className="text-sm text-neutral-700">
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
          <button onClick={onRestart} className="text-sm text-neutral-600 underline">
            {t.previewReport.restartLink}
          </button>
        </div>
      </section>
    );
  }

  // Bugfix Juli 2026 (directive PO: skor rendah tapi label bilang "Cukup
  // Baik" -- membingungkan & bikin laporan kurang dipercaya): sebelumnya
  // "status" diambil mentah dari preview.statusLabel, teks bebas yang
  // dikarang AI saat analisis dibuat -- penilaiannya bisa tidak konsisten
  // dengan angka skornya sendiri (skor 34/100 pernah dapat "Cukup Baik").
  // Sekarang dihitung langsung dari angka skor lewat kunci i18n yang SAMA
  // dengan yang sudah dipakai di Workspace.tsx (t.workspace.healthStatus*),
  // supaya bahasanya konsisten & jujur di seluruh aplikasi -- termasuk
  // otomatis ikut bahasa aktif (statusLabel dari AI beku dalam bahasa saat
  // analisis dibuat, tidak ikut berubah kalau user toggle bahasa).
  // Dihitung dari preview.businessHealthScore (nilai akhir tetap), BUKAN
  // displayScore (angka yang lagi animasi count-up) -- supaya label tidak
  // ikut "kedip" berpindah tingkat selagi angkanya masih berjalan naik.
  const finalScore = typeof preview.businessHealthScore === "number" ? preview.businessHealthScore : displayScore;
  const status =
    finalScore >= 70
      ? t.workspace.healthStatusGood
      : finalScore >= 45
        ? t.workspace.healthStatusNeedsAttention
        : t.workspace.healthStatusNeedsSeriousAttention;
  const findings = preview.findings.slice(0, 3);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">

      <div className="mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.previewReport.eyebrow}</span>
        <h2 className="mt-2 text-2xl font-extrabold">{namaBisnis}</h2>
      </div>

      {autoSavedBusinessId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-3 text-center sm:text-left">
          <p className="text-sm text-neutral-800">✓ {t.previewReport.autoSavedNote}</p>
          <button
            onClick={() => hardNavigate("workspace")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-transform hover:-translate-y-0.5"
          >
            {t.previewReport.autoSavedButton}
          </button>
        </div>
      )}

      {autoSaveCapped && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-3 text-center sm:text-left">
          <p className="text-sm text-neutral-800">🔒 {t.previewReport.autoSaveCappedNote}</p>
          <button
            onClick={() => hardNavigate("workspace")}
            className="rounded-full border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-700 transition-transform hover:-translate-y-0.5"
          >
            {t.previewReport.autoSaveCappedButton}
          </button>
        </div>
      )}

      {/* Reward badge (Phase 2, review PO "reward") — pesan pencapaian
          singkat, murni copy + emoji, tanpa efek visual berat. */}
      <div className="mb-4 text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          {fillTemplate(t.previewReport.rewardBadge, { namaBisnis })}
        </span>
      </div>

      {/* Business Health/Readiness Score */}
      <div className="mb-6 rounded-2xl border border-primary/30 bg-white p-6 text-center">
        <p className="text-sm text-neutral-600">{scoreLabel}</p>
        <p className="mt-1 text-5xl font-black text-primary">
          {displayScore}<span className="text-xl text-neutral-500">/100</span>
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-700">{status}</p>
        <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${displayScore}%` }}></div>
        </div>
      </div>

      {/* AI sedang menganalisa */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="mb-3 font-bold">{t.previewReport.checklistTitle}</h3>
        <ul className="grid grid-cols-2 gap-2">
          {analysisChecklist.map((item) => (
            <li key={item.label} className={"flex items-center gap-2 text-sm " + (item.done ? "text-neutral-800" : "text-neutral-500")}>
              <span>{item.done ? "✓" : "🔒"}</span> {item.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Ringkasan Singkat — dari Claude */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="mb-2 font-bold">{t.previewReport.summaryTitle}</h3>
        <p className="text-sm leading-relaxed text-neutral-700">{preview.summary}</p>
      </div>

      {/* Temuan Penting — dari Claude */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="mb-3 font-bold">{t.previewReport.findingsTitle}</h3>
        <ol className="space-y-2 text-sm text-neutral-700">
          {findings.map((f, i) => (
            <li key={i}><strong className="text-primary">{i + 1}.</strong> {f}</li>
          ))}
        </ol>
      </div>

      {/* Sudah Baik / Perlu Diperbaiki / Peluang — dari Claude */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.strengthsTitle}</p>
          <p className="text-sm text-neutral-700">{preview.strengths}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.improvementsTitle}</p>
          <p className="text-sm text-neutral-700">{preview.improvements}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.opportunityTitle}</p>
          <p className="text-sm text-neutral-700">{preview.opportunity}</p>
        </div>
      </div>

      {/* CTA "Coba Gratis" — sengaja ditaruh di sini, SEBELUM bagian yang
          di-blur (SWOT/Kompetitor/Rencana 30 Hari) dan pitch Pro/Platinum,
          supaya siapapun yang cuma mau eksplorasi Workspace-nya sendiri
          langsung ketemu pilihan itu tanpa scroll ngelewatin pitch bayar
          dulu. Disembunyikan begitu banner autoSavedNote/autoSaveCapped di
          atas sudah tampil, supaya tidak ada ajakan ganda. */}
      {!autoSavedBusinessId && !autoSaveCapped && (
        <div className="mb-6 rounded-2xl border-2 border-primary/50 bg-primary/[0.08] p-6 text-center shadow-[0_0_30px_-10px_rgba(255,152,0,0.5)]">
          <p className="text-base font-extrabold text-neutral-900">🐝 {t.previewReport.freeCtaTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-700">{t.previewReport.freeCtaDesc}</p>
          <button
            onClick={() => {
              if (!user) {
                setExplicitWorkspaceIntent(true);
                setShowAuthModal(true);
              }
            }}
            disabled={autoSaving}
            className="mt-4 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-black shadow-[0_0_20px_-6px_rgba(255,152,0,0.6)] transition-transform hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoSaving ? t.previewReport.freeCtaPreparing : t.previewReport.freeCtaButton}
          </button>
        </div>
      )}

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
      <div id="unlock-section" className="mb-8 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {t.previewReport.unlockEyebrow}
          </span>
          <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">
            {t.previewReport.unlockTitle}
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
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
            <p className="text-sm leading-relaxed text-neutral-800">{preview.recommendationNote}</p>
          </div>
        )}

        {/* Bugfix Juli 2026 (directive PO: "upgrade hanya diworkspace saja")
            -- tombol di bawah ini TIDAK memicu checkout. Satu-satunya tujuan
            adalah masuk ke Workspace gratis; upgrade Pro/Platinum baru
            dilakukan dari SANA (lihat UpgradeModal.tsx). */}
        <div className="text-center">
          <button
            onClick={() => {
              if (autoSavedBusinessId) {
                hardNavigate("workspace");
              } else if (!user) {
                setExplicitWorkspaceIntent(true);
                setShowAuthModal(true);
              }
            }}
            disabled={autoSaving}
            className="rounded-xl bg-primary px-7 py-3 text-sm font-bold text-black shadow-[0_0_20px_-6px_rgba(255,152,0,0.6)] transition-transform hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoSaving ? t.previewReport.unlockSectionPreparing : t.previewReport.unlockSectionButton}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          {t.previewReport.footerNote}
        </p>
      </div>

      <div className="mt-4 text-center">
        <button onClick={onRestart} className="text-sm text-neutral-600 underline">
          {t.previewReport.restartLink}
        </button>
      </div>

      {showAuthModal && (
        // onSuccess = tutup modal saja, JANGAN hardNavigate ke workspace
        // langsung (lihat catatan AuthModalProps.onSuccess di AuthModal.tsx)
        // -- membiarkan halaman ini tetap terbuka setelah login supaya
        // efek autoPromote di atas (butuh `user` terisi dulu) benar-benar
        // sempat jalan: simpan wizard jadi draft + promote ke business_profile
        // SEBELUM pengguna dipindah ke Workspace-nya sendiri.
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} defaultEmail={data.email} />
      )}

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
    <div className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-5 ${marginBottom}`}>
      <p className="mb-3 font-bold text-neutral-800">{title}</p>
      <div aria-hidden="true" className="select-none space-y-2 blur-[3px]">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-neutral-600">
            {line}
          </p>
        ))}
      </div>
      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-white/95 via-white/75 to-transparent pb-4">
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
