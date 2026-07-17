import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, fillTemplate, LOCALE_MAP } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { hardNavigate } from "../utils/navigate";
import ChatBeemoPanel from "./ChatBeemoPanel";
import BusinessUpdateModal from "./BusinessUpdateModal";
import UpgradeModal from "./UpgradeModal";
import WizardCapBlocked from "./WizardCapBlocked";
import type { Translations } from "../i18n/translations";
import beemoMascot from "../assets/mascot/beemo.png";
import {
  WorkspaceCard,
  SectionHeader,
  WorkspaceSection,
  RetryButton,
  ErrorCard,
  SkeletonCard,
  UpgradeLockCard,
  EmptyState,
} from "./WorkspaceDesignSystem";

// "growth" (Journey) digabung ke "target" (audit Juli 2026: skor Journey
// tampil identik di 2 halaman terpisah — sekarang satu halaman "Target &
// Progress", lihat TargetPanel). Key lama tidak dipakai lagi.
type MenuKey =
  | "today"
  | "history"
  | "score"
  | "report"
  | "target"
  | "competitor"
  | "leads"
  | "chat"
  | "settings"
  | "businessUpdates"
  | "decisionJournal";

// Visual Priority (Phase 4, directive PO: "Mission Today/Score/Target/Chat
// Beemo diprioritaskan" — TAPI lewat visual hierarchy, BUKAN feature gating.
// PO secara eksplisit mengoreksi: "Saya TIDAK bermaksud membuat fitur
// di-gate... yang saya maksud adalah Visual Hierarchy, bukan Feature
// Gating"). SET TETAP, tidak bergantung stageDetail/tebakan "lagi di tahap
// mana" — dicoba dulu pemetaan dinamis ke STAGE_GROUPS berdasar stageDetail,
// tapi itu rapi untuk bisnis baru (linear) dan tidak untuk bisnis berjalan
// (stage-nya soal performa, bukan urutan aktivitas relevansi menu). Semua
// menu di sini maupun di luar sini TETAP 100% bisa diklik — ini murni
// penekanan visual (ikon/teks lebih terang, aksen kiri, badge "Fokus"),
// tidak ada yang disembunyikan/dikunci. Lihat render di sidebar STAGE_GROUPS.
const CORE_MENU_KEYS = new Set<MenuKey>(["today", "score", "target", "chat"]);

// Quick Start Onboarding (audit Juli 2026, ChatGPT Critical #1 + QA
// langsung: "user baru bisa kewalahan... terlalu banyak fitur, tidak tahu
// harus mulai dari mana"). Dikonfirmasi lewat video: sidebar menampilkan
// 7-9 tab sekaligus, semua berisi konten nyata (bukan cuma di Free -- Pro
// malah lebih "ramai" karena Competitor/Referensi tidak lagi terkunci).
// EMPAT langkah ini murni menyorot urutan yang DISARANKAN (bukan gating --
// semua tab tetap 100% bisa diklik kapan saja, sama prinsipnya dengan
// CORE_MENU_KEYS di atas). "today" sendiri tidak dihitung sebagai langkah
// karena itu tab default yang otomatis "dikunjungi" begitu Workspace dibuka.
type QuickStartKey = "score" | "businessUpdates" | "chat" | "competitor";
const QUICK_START_STEPS: Array<{ key: QuickStartKey; icon: string }> = [
  { key: "score", icon: "📊" },
  { key: "businessUpdates", icon: "📝" },
  { key: "chat", icon: "💬" },
  { key: "competitor", icon: "🔍" },
];
const QUICK_START_STORAGE_PREFIX = "hive_quickstart_v1_";

function loadQuickStartState(businessProfileId: string): { visited: Set<string>; dismissed: boolean } {
  try {
    const raw = window.localStorage.getItem(QUICK_START_STORAGE_PREFIX + businessProfileId);
    if (!raw) return { visited: new Set(), dismissed: false };
    const parsed = JSON.parse(raw) as { visited?: string[]; dismissed?: boolean } | null;
    return { visited: new Set(Array.isArray(parsed?.visited) ? parsed!.visited : []), dismissed: !!parsed?.dismissed };
  } catch {
    return { visited: new Set(), dismissed: false };
  }
}

function saveQuickStartState(businessProfileId: string, visited: Set<string>, dismissed: boolean) {
  try {
    window.localStorage.setItem(
      QUICK_START_STORAGE_PREFIX + businessProfileId,
      JSON.stringify({ visited: Array.from(visited), dismissed })
    );
  } catch {
    // no-op -- localStorage tidak tersedia, degradasi jujur (kartu bisa saja tampil lagi tiap sesi, tidak menggagalkan apa pun yang lain)
  }
}

/** Kartu "mulai dari sini" -- disorot di tab Today sampai keempat langkah
 * dikunjungi atau pengguna sendiri yang menyembunyikannya. Bukan wizard
 * modal terpisah (yang berisiko terasa seperti gerbang lagi setelah wizard
 * awal) -- cukup kartu di tempat yang sudah wajar dilihat pertama kali. */
function QuickStartCard({
  t,
  visited,
  onStepClick,
  onDismiss,
}: {
  t: Translations;
  visited: Set<string>;
  onStepClick: (key: QuickStartKey) => void;
  onDismiss: () => void;
}) {
  const doneCount = QUICK_START_STEPS.filter((s) => visited.has(s.key)).length;
  const nextStep = QUICK_START_STEPS.find((s) => !visited.has(s.key));

  return (
    <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">🐝 {t.workspace.quickStartTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.quickStartDesc}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-none text-xs font-semibold text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          {t.workspace.quickStartDismiss}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_START_STEPS.map((s) => {
          const done = visited.has(s.key);
          const isNext = !done && nextStep?.key === s.key;
          const label = t.workspace.quickStartSteps[s.key];
          return (
            <button
              key={s.key}
              onClick={() => onStepClick(s.key)}
              className={
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 " +
                (done
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : isNext
                    ? "border-primary/50 bg-primary/15 text-white"
                    : "border-white/15 bg-white/5 text-neutral-300 hover:border-primary/40 hover:text-white")
              }
            >
              <span aria-hidden="true">{done ? "✓" : s.icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(doneCount / QUICK_START_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// --- Tipe data mengikuti skema Domain Model (Tahap 1, 1.5, 1.6) ---
// Catatan penting: Workspace sekarang mendukung BANYAK business_profile per
// akun (Active Business Context), bukan lagi asumsi "1 user = 1 bisnis".

type BusinessProfileRow = {
  id: string;
  business_name: string;
  industry: string | null;
  // Business Context (Business Discovery & Dual Workspace directive) —
  // "start" = usaha baru, "grow" = usaha yang sudah berjalan. Nullable
  // karena pelanggan lama (sebelum migrasi business_type) belum punya
  // nilai ini — fallback ke "grow" dilakukan di titik pemakaian, BUKAN
  // ditebak di sini, supaya jelas mana data asli vs default.
  business_type?: "start" | "grow" | null;
};

type AnalysisRow = {
  id: string;
  raw_input: Record<string, string> | null;
  ai_output: PreviewOutput | null;
  is_baseline: boolean;
  created_at: string;
};

type PreviewOutput = {
  businessHealthScore?: number;
  statusLabel?: string;
  summary?: string;
  findings?: string[];
  strengths?: string;
  improvements?: string;
  opportunity?: string;
};

// Bentuk ini mengikuti Membership yang dihitung backend
// (services/membership/getActiveMembership.ts) — SATU-SATUNYA sumber
// kebenaran soal "apakah membership ini masih aktif". Jangan query tabel
// subscriptions langsung dari sini lagi.
type Membership = {
  tier: "free" | "pro" | "platinum";
  status: "active" | "expired" | "free";
  expiresAt: string | null;
};

function formatDate(iso: string, lang: "id" | "en") {
  return new Date(iso).toLocaleDateString(LOCALE_MAP[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysLeft(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}


/** Business Switcher — dropdown pindah bisnis + tombol tambah bisnis baru.
 * Sesuai arahan: cukup daftar bisnis + mana yang aktif + tombol tambah,
 * belum perlu dashboard gabungan atau statistik lintas bisnis. */
function BusinessSwitcher({
  businesses,
  activeId,
  onSwitch,
  onAddNew,
  addLabel,
}: {
  businesses: BusinessProfileRow[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAddNew: () => void;
  addLabel: string;
}) {
  const active = businesses.find((b) => b.id === activeId) || null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {businesses.length > 1 ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-surface px-3">
          <span className="text-base" aria-hidden="true">🏢</span>
          <div className="leading-tight">
            <select
              value={activeId}
              onChange={(e) => onSwitch(e.target.value)}
              className="block rounded-md bg-transparent text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id} className="bg-black">
                  {b.business_name}
                </option>
              ))}
            </select>
            {active?.industry && <span className="block text-[11px] text-neutral-500">{active.industry}</span>}
          </div>
        </div>
      ) : active ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-surface px-3">
          <span className="text-base" aria-hidden="true">🏢</span>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-white">{active.business_name}</span>
            {active.industry && <span className="block text-[11px] text-neutral-500">{active.industry}</span>}
          </div>
        </div>
      ) : null}
      <button
        onClick={onAddNew}
        className="flex h-10 flex-shrink-0 items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-neutral-300 transition-colors duration-200 hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        {addLabel}
      </button>
    </div>
  );
}

/** Kartu ringkasan status akses paling atas — menjawab pertanyaan
 * "aku sekarang punya akses apa, sampai kapan?" dalam sekali lihat. */
function AccessStatusCard({
  membership,
  loading,
  t,
  lang,
}: {
  membership: Membership | null;
  loading?: boolean;
  t: Translations;
  lang: "id" | "en";
}) {
  // Round 4 audit fix (Bug 4, "stale tier badge saat pindah bisnis"):
  // sebelumnya membership === null langsung dianggap "free" dan kartu
  // "Paket Gratis" tampil -- itu tetap data yang bisa KELIRU kalau bisnis
  // yang baru dipilih sebenarnya Pro/Platinum tapi getMembership belum
  // selesai. Sekarang selama loading=true, tampilkan skeleton netral (bukan
  // klaim tier apa pun) sampai data yang benar-benar milik bisnis aktif ini
  // selesai dimuat -- prinsip dari diskusi GPT: "belum ada data" lebih aman
  // daripada "data yang salah".
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-white/10 bg-surface p-5">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="mt-3 h-5 w-40 rounded bg-white/10" />
        <div className="mt-2 h-3 w-56 rounded bg-white/10" />
      </div>
    );
  }

  if (!membership || membership.status === "free") {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t.workspace.accessFreeLabel}</p>
        <p className="mt-2 text-lg font-bold text-neutral-200">{t.workspace.accessFreeTitle}</p>
        <p className="mt-1 text-sm text-neutral-400">{t.workspace.accessFreeDesc}</p>
      </div>
    );
  }

  if (membership.status === "expired") {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{t.workspace.accessExpiredLabel}</p>
        <p className="mt-2 text-lg font-bold text-amber-300">{t.workspace.accessExpiredTitle}</p>
        <p className="mt-1 text-sm text-neutral-300">
          {membership.expiresAt
            ? fillTemplate(t.workspace.accessExpiredDesc, { date: formatDate(membership.expiresAt, lang) })
            : t.workspace.accessExpiredDescNoDate}
        </p>
      </div>
    );
  }

  const isPlatinum = membership.tier === "platinum";
  const remaining = daysLeft(membership.expiresAt as string);

  return (
    <div
      className={
        "rounded-2xl border p-5 " +
        (isPlatinum ? "border-purple-500/40 bg-purple-500/10" : "border-blue-500/40 bg-blue-500/10")
      }
    >
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t.workspace.accessActiveLabel}</p>
      <p className={"mt-2 text-lg font-bold " + (isPlatinum ? "text-purple-300" : "text-blue-300")}>
        {fillTemplate(t.workspace.accessActiveTitle, { tier: membership.tier.toUpperCase() })}
      </p>
      <p className="mt-1 text-sm text-neutral-300">
        {fillTemplate(t.workspace.accessActiveRemaining, {
          days: remaining,
          date: formatDate(membership.expiresAt as string, lang),
        })}
      </p>
    </div>
  );
}

/** Final Reports (Task 13 — "riwayat diganti final reports"): dua PDF
 * SUNGGUHAN tersimpan di Supabase Storage (services/reports/), bukan lagi
 * daftar mentah `analyses` tanpa PDF/download. Kartu pertama = Laporan Awal
 * (baseline, dibuat sekali lewat tombol di sini kalau belum ada). Kartu
 * kedua = Laporan Perbandingan Periode terbaru (expiry, dibuat OTOMATIS
 * lewat cron di hari H expired — tidak ada tombol manual untuk itu). */
function FinalReportsList({
  tier,
  t,
  lang,
  reports,
  loading,
  error,
  onRetry,
  onUpgradeClick,
  generating,
  generateError,
  onGenerateBaseline,
  businessName,
}: {
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  reports: Array<Record<string, unknown>>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onUpgradeClick: () => void;
  generating: boolean;
  generateError: string | null;
  onGenerateBaseline: () => void;
  // Phase 6 (Monetization/Upgrade timing) — dipakai untuk mempersonalisasi
  // copy lock di bawah, lihat finalReportsLockedDescNamed.
  businessName: string;
}) {
  // Bugfix produk Juli 2026 ("PDF eksklusif PLATINUM, kurangi biaya generate
  // untuk PRO"): sebelumnya hanya tier "free" yang dikunci di sini — PRO
  // sudah bisa generate/lihat/download PDF Final Reports langsung. Sekarang
  // PRO ikut dikunci sama seperti Gratis: menu ini tetap TERLIHAT (bukan
  // disembunyikan dari sidebar), tapi begitu diklik langsung diarahkan ke
  // upgrade PLATINUM — satu-satunya tier yang boleh generate/lihat/download
  // PDF. onUpgradeClick di sini SELALU dipanggil dengan target platinum-only
  // (lihat pemanggil di bawah, openUpgradeModal(true)).
  if (tier === "free" || tier === "pro") {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuHistory} description={t.workspace.historySectionDesc} />
        <UpgradeLockCard
          description={
            businessName
              ? fillTemplate(t.workspace.finalReportsLockedDescNamed, { businessName })
              : t.workspace.finalReportsLockedDesc
          }
          buttonLabel={t.workspace.finalReportsUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      </WorkspaceSection>
    );
  }

  const baselineReport = reports.find((r) => r.reportType === "baseline") || null;
  // Task revisi Juli 2026: sebelumnya cuma laporan "expiry" TERBARU yang
  // ditampilkan (.find, ambil 1) — laporan bulanan lama yang sebenarnya
  // sudah ada di database (listReports.ts sudah mengembalikan SEMUA, sampai
  // 366 hari) jadi tidak pernah terlihat/bisa diunduh lagi. Sekarang
  // ditampilkan SEMUA sebagai daftar, masing-masing dengan tanggalnya
  // sendiri, supaya laporan lama tetap mudah diakses ("biar mudah diakses").
  const expiryReports = reports.filter((r) => r.reportType === "expiry"); // sudah terurut terbaru dulu (listReports.ts)

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuHistory} description={t.workspace.historySectionDesc} />

      {error && !loading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.menuHistory })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : loading ? (
        <>
          <SkeletonCard variant="default" />
          <SkeletonCard variant="default" />
        </>
      ) : (
        <div className="space-y-3">
          <WorkspaceCard>
            <h3 className="text-sm font-bold text-neutral-100">{t.workspace.finalReportsBaselineTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.finalReportsBaselineDesc}</p>
            {baselineReport ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  {t.workspace.finalReportsCreatedAtLabel}: {formatDate(baselineReport.createdAt as string, lang)}
                </p>
                {baselineReport.downloadUrl ? (
                  <a
                    href={baselineReport.downloadUrl as string}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                  >
                    {t.workspace.finalReportsDownloadButton}
                  </a>
                ) : (
                  // Bugfix (QA Juli 2026): listReports.ts bisa mengembalikan
                  // downloadUrl: null kalau signed URL Storage gagal dibuat
                  // (error transient) walau baris laporannya ADA -- sebelumnya
                  // tombol ini tetap dirender penuh warna/terlihat aktif tapi
                  // href-nya kosong, jadi diklik tidak melakukan apa-apa tanpa
                  // penjelasan. Sekarang jujur ditampilkan sebagai teks pudar.
                  <span className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-500">
                    {t.workspace.finalReportsDownloadUnavailable}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-xs text-neutral-500">{t.workspace.finalReportsBaselineEmptyDesc}</p>
                {generateError && <p className="mb-2 text-xs text-red-400">{generateError}</p>}
                <RetryButton
                  label={generating ? t.workspace.finalReportsGenerateLoading : t.workspace.finalReportsGenerateButton}
                  onRetry={onGenerateBaseline}
                />
              </div>
            )}
          </WorkspaceCard>

          <WorkspaceCard>
            <h3 className="text-sm font-bold text-neutral-100">{t.workspace.finalReportsExpiryTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.finalReportsExpiryDesc}</p>
            {expiryReports.length > 0 ? (
              <div className="mt-3 space-y-2">
                {expiryReports.map((r) => (
                  <div
                    key={r.id as string}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                  >
                    <p className="text-xs text-neutral-500">
                      {t.workspace.finalReportsCreatedAtLabel}: {formatDate(r.createdAt as string, lang)}
                    </p>
                    {r.downloadUrl ? (
                      <a
                        href={r.downloadUrl as string}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                      >
                        {t.workspace.finalReportsDownloadButton}
                      </a>
                    ) : (
                      <span className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-500">
                        {t.workspace.finalReportsDownloadUnavailable}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-neutral-500">{t.workspace.finalReportsExpiryEmptyDesc}</p>
            )}
          </WorkspaceCard>
        </div>
      )}
    </WorkspaceSection>
  );
}

/** Business Updates — arsip LENGKAP Business Update yang pernah dikirim,
 * dengan badge kategori (dimensi mana yang disinggung — reuse DIMENSION_LABELS,
 * SAMA dengan Business Score, bukan daftar kedua) dan tingkat perhatian
 * (Update Engine, services/updateEngine/classify.ts). Data SAMA dengan yang
 * dipakai Journey (listUpdates) — reuse state yang sudah ada, TIDAK fetch
 * baru, supaya tidak ada dua sumber "riwayat update" yang bisa beda. */
function BusinessUpdatesList({
  updates,
  tier,
  t,
  lang,
  loading,
  error,
  onRetry,
  onOpenUpdateModal,
  weeklyReview,
}: {
  updates: Array<Record<string, unknown>>;
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenUpdateModal: () => void;
  // Rekap Mingguan (revisi Juli 2026): dipindah dari halaman Today ke sini
  // — sesuai arahan "rekap mingguan dihapus dan dipindah ke halaman
  // bisnis update", supaya Today fokus ke hari ini, rekap 7-hari ada di
  // halaman riwayat update.
  weeklyReview: WeeklyReviewPayload | null;
}) {
  const severityBadgeClass: Record<string, string> = {
    high: "bg-red-500/15 text-red-300",
    medium: "bg-amber-500/15 text-amber-300",
    low: "bg-green-500/15 text-green-300",
  };
  const severityLabel: Record<string, string> = {
    high: t.workspace.updateSeverityHigh,
    medium: t.workspace.updateSeverityMedium,
    low: t.workspace.updateSeverityLow,
  };
  const kondisiPenjualanLabel: Record<string, string> = {
    naik: t.workspace.updateKondisiNaik,
    tetap: t.workspace.updateKondisiTetap,
    turun: t.workspace.updateKondisiTurun,
  };
  function formatRupiah(value: number): string {
    return `Rp${value.toLocaleString(lang === "id" ? "id-ID" : "en-US")}`;
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuBusinessUpdates} description={t.workspace.businessUpdatesSectionDesc} />

      {/* Rekap Mingguan (pindahan dari Today) — rule-based 7-hari-berjalan,
          di-cache backend (business_weekly_review). Angka JUJUR: score-delta
          null ditampilkan sebagai "-", bukan 0 palsu, kalau data pembanding
          belum cukup. */}
      {weeklyReview && (
        <WorkspaceCard>
          <h3 className="mb-1 text-sm font-bold text-neutral-100">{t.workspace.weeklyReviewTitle}</h3>
          <p className="mb-4 text-xs text-neutral-500">
            {fillTemplate(t.workspace.weeklyReviewRange, { start: weeklyReview.weekStart, end: weeklyReview.weekEnd })}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-black text-white">{weeklyReview.targetsCompleted}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.weeklyReviewTargetsCompleted}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-black text-white">{weeklyReview.decisionsMade}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.weeklyReviewDecisionsMade}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className={`text-lg font-black ${(weeklyReview.scoreDelta ?? 0) > 0 ? "text-green-400" : (weeklyReview.scoreDelta ?? 0) < 0 ? "text-red-400" : "text-white"}`}>
                {weeklyReview.scoreDelta === null ? "-" : weeklyReview.scoreDelta > 0 ? `+${weeklyReview.scoreDelta}` : weeklyReview.scoreDelta}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.weeklyReviewScoreDelta}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-black text-white">{weeklyReview.newOpportunities}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.weeklyReviewNewOpportunities}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-black text-white">{weeklyReview.newRisks}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.weeklyReviewNewRisks}
              </p>
            </div>
          </div>
        </WorkspaceCard>
      )}

      {error && !loading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.menuBusinessUpdates })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : loading ? (
        <>
          <SkeletonCard variant="default" />
          <SkeletonCard variant="default" />
          <SkeletonCard variant="default" />
        </>
      ) : updates.length === 0 ? (
        <EmptyState
          variant="default"
          icon="📝"
          title={t.workspace.businessUpdatesEmptyTitle}
          description={t.workspace.businessUpdatesEmptyDesc}
          ctaLabel={t.workspace.updateBusinessButton}
          onCtaClick={onOpenUpdateModal}
        />
      ) : (
        <>
          <div className="space-y-3">
            {updates.map((u) => {
              const category = (u.category as string) || null;
              const severity = (u.severity as string) || null;
              const dim = category ? DIMENSION_LABELS[category] : null;
              return (
                <WorkspaceCard key={u.id as string} variant="default">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-neutral-500">{formatDate(u.created_at as string, lang)}</p>
                    <div className="flex flex-wrap gap-2">
                      {dim && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-neutral-300">
                          {dim.icon} {lang === "id" ? dim.id : dim.en}
                        </span>
                      )}
                      {severity && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${severityBadgeClass[severity] || "bg-white/5 text-neutral-300"}`}
                        >
                          {severityLabel[severity] || severity}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-200">{u.content as string}</p>
                  {!!u.pencapaian && (
                    <p className="mt-2 text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-400">{t.workspace.businessUpdatesAchievementLabel}: </span>
                      {u.pencapaian as string}
                    </p>
                  )}
                  {!!u.tantangan && (
                    <p className="mt-1 text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-400">{t.workspace.businessUpdatesChallengeLabel}: </span>
                      {u.tantangan as string}
                    </p>
                  )}
                  {!!u.target_depan && (
                    <p className="mt-1 text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-400">{t.workspace.businessUpdatesNextTargetLabel}: </span>
                      {u.target_depan as string}
                    </p>
                  )}

                  {/* Detail form lengkap (audit Juli 2026: sebelumnya arsip ini
                      cuma tampilkan sebagian isi form, bukan detailnya). */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    {!!u.kondisi_penjualan && (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                        {t.workspace.businessUpdatesSalesLabel}: {kondisiPenjualanLabel[u.kondisi_penjualan as string] || (u.kondisi_penjualan as string)}
                      </span>
                    )}
                    {typeof u.omset_value === "number" && (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                        {t.workspace.businessUpdatesRevenueLabel}: {formatRupiah(u.omset_value as number)}
                      </span>
                    )}
                    {typeof u.pelanggan_baru === "number" && (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                        {t.workspace.businessUpdatesNewCustomersLabel}: {u.pelanggan_baru as number}
                      </span>
                    )}
                  </div>

                  {/* Insight Platinum — dari Update Engine (services/updateEngine/
                      classify.ts), sudah dihitung deterministik saat update
                      disimpan, bukan panggilan AI baru. Pro & Gratis tidak
                      lihat bagian ini (pembeda nyata, bukan cuma kuota). */}
                  {tier === "platinum" && !!u.insight_headline_key && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                      <p className="text-xs font-bold text-primary">🐝 {t.workspace.businessUpdatesInsightLabel}</p>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-200">
                        {fillTemplate(
                          (t.workspace as unknown as Record<string, string>)[u.insight_headline_key as string] || "",
                          (u.insight_headline_params as Record<string, string | number>) || {}
                        )}
                      </p>
                      {!!u.insight_action_key && (
                        <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                          {(t.workspace as unknown as Record<string, string>)[u.insight_action_key as string] || ""}
                        </p>
                      )}
                    </div>
                  )}
                </WorkspaceCard>
              );
            })}
          </div>

          <WorkspaceCard tone="primary" className="text-center">
            <h3 className="mb-2 text-sm font-bold text-primary">{t.workspace.targetCtaTitle}</h3>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-300">{t.workspace.businessUpdatesCtaDesc}</p>
            <RetryButton label={t.workspace.updateBusinessButton} onRetry={onOpenUpdateModal} />
          </WorkspaceCard>
        </>
      )}
    </WorkspaceSection>
  );
}

/** Decision Journal — "AI Business Mentor, bukan AI Reporter": tempat
 * pemilik usaha mengajukan keputusan besar (mis. "apa saya buka cabang?")
 * dan Beemo menyusun Tujuan/Risiko/Peluang/Data Pendukung/Rekomendasi/
 * Kesimpulan (services/decision/proposeDecision.ts), lalu arsipnya
 * tersimpan di sini — sama seperti mengobrol dengan Beemo, hanya hasilnya
 * yang disimpan (bukan transkrip chat).
 * Audit Juli 2026: dipersempit jadi eksklusif PLATINUM (sebelumnya
 * PRO+PLATINUM) — fitur analisa multi-peran + riset mendalam ini yang
 * paling membedakan Platinum dari Pro, gating dicek ulang di server
 * (proposeDecision.ts), ini cuma UI-nya. Riwayat juga sekarang menonjolkan
 * KEPUTUSAN (kesimpulan/rekomendasi) sebagai judul kartu, bukan pertanyaan
 * mentah yang diketik user. */
function DecisionJournalList({
  tier,
  t,
  lang,
  decisions,
  loading,
  error,
  onRetry,
  onUpgradeClick,
  businessName,
}: {
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  decisions: Array<Record<string, unknown>>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onUpgradeClick: () => void;
  // Phase 6 (Monetization/Upgrade timing) — dipakai untuk mempersonalisasi
  // copy lock di bawah, lihat decisionJournalLockedDescNamed.
  businessName: string;
}) {
  if (tier !== "platinum") {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuDecisionJournal} description={t.workspace.decisionJournalSectionDesc} />
        <UpgradeLockCard
          description={
            businessName
              ? fillTemplate(t.workspace.decisionJournalLockedDescNamed, { businessName })
              : t.workspace.decisionJournalLockedDesc
          }
          buttonLabel={t.workspace.competitorUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      </WorkspaceSection>
    );
  }

  const statusBadgeClass: Record<string, string> = {
    open: "bg-amber-500/15 text-amber-300",
    decided: "bg-green-500/15 text-green-300",
    dismissed: "bg-white/5 text-neutral-400",
  };
  const statusLabel: Record<string, string> = {
    open: t.workspace.decisionStatusOpen,
    decided: t.workspace.decisionStatusDecided,
    dismissed: t.workspace.decisionStatusDismissed,
  };

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuDecisionJournal} description={t.workspace.decisionJournalSectionDesc} />

      {/* Revisi Juli 2026: form "Ajukan keputusan baru" dihapus — Decision
          Journal sekarang MURNI riwayat. Keputusan besar terdeteksi otomatis
          di Chat Beemo (lihat services/beemo/chat.ts parseDecisionBlock) dan
          tersimpan ke sini tanpa form terpisah, supaya tidak terasa seperti
          "2 chat/2 tempat". */}

      {error && !loading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.menuDecisionJournal })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : loading ? (
        <>
          <SkeletonCard variant="default" />
          <SkeletonCard variant="default" />
        </>
      ) : decisions.length === 0 ? (
        <EmptyState variant="default" icon="🧭" title={t.workspace.decisionHistoryTitle} description={t.workspace.decisionHistoryEmpty} />
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => {
            const status = (d.status as string) || "open";
            const supportingData = Array.isArray(d.supportingData) ? (d.supportingData as string[]) : [];
            // Task 12 (audit Juli 2026): riwayat harus menonjolkan KEPUTUSAN
            // yang diambil (kesimpulan, atau rekomendasi kalau kesimpulan
            // kosong) sebagai judul kartu — bukan pertanyaan mentah yang
            // diketik user (itu sekarang jadi caption kecil di bawah judul).
            const decisionHeadline = (d.conclusion as string) || (d.recommendation as string) || (d.question as string);
            return (
              <WorkspaceCard key={d.id as string}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white">{decisionHeadline}</p>
                  <span className={`flex-none rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass[status] || "bg-white/5 text-neutral-400"}`}>
                    {statusLabel[status] || status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {t.workspace.decisionBasedOnQuestionLabel}: {d.question as string} · {formatDate(d.createdAt as string, lang)}
                </p>

                <div className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-300">
                  {!!d.goal && (
                    <p>
                      <span className="font-semibold text-neutral-100">{t.workspace.decisionGoalLabel}: </span>
                      {d.goal as string}
                    </p>
                  )}
                  {!!d.risk && (
                    <p>
                      <span className="font-semibold text-neutral-100">{t.workspace.decisionRiskLabel}: </span>
                      {d.risk as string}
                    </p>
                  )}
                  {!!d.opportunity && (
                    <p>
                      <span className="font-semibold text-neutral-100">{t.workspace.decisionOpportunityLabel}: </span>
                      {d.opportunity as string}
                    </p>
                  )}
                  {supportingData.length > 0 && (
                    <div>
                      <span className="font-semibold text-neutral-100">{t.workspace.decisionSupportingDataLabel}: </span>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-400">
                        {supportingData.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!d.recommendation && (
                    <p>
                      <span className="font-semibold text-neutral-100">{t.workspace.decisionRecommendationLabel}: </span>
                      {d.recommendation as string}
                    </p>
                  )}
                  {!!d.conclusion && (
                    <p className="rounded-xl bg-primary/5 p-3 text-primary/90">
                      <span className="font-semibold">{t.workspace.decisionConclusionLabel}: </span>
                      {d.conclusion as string}
                    </p>
                  )}
                </div>
              </WorkspaceCard>
            );
          })}
        </div>
      )}
    </WorkspaceSection>
  );
}

/** Ditampilkan sekilas kalau user sudah login tapi belum punya
 * business_profile SAMA SEKALI (belum pernah menyelesaikan analisis
 * apapun). Audit Juli 2026 (directive PO: "satu-satunya pintu untuk analisa
 * bisnis... hanya lewat chat wizzard") — sebelumnya cuma tombol manual balik
 * ke Beranda, sekarang auto-redirect langsung ke Chat Wizard (#mulai) tanpa
 * perlu klik apapun, supaya email yang belum pernah dianalisa tidak nyasar
 * lihat Workspace kosong. Tombol tetap ditaruh sebagai fallback kalau
 * redirect gagal (mis. JS dinonaktifkan/diblokir). */
function NoBusinessYet({ t }: { t: Translations }) {
  useEffect(() => {
    hardNavigate("mulai");
  }, []);

  return (
    <section className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-extrabold">{t.workspace.noBusinessTitle}</h1>
      <p className="mt-3 text-sm text-neutral-400">{t.workspace.noBusinessDesc}</p>
      <button
        onClick={() => hardNavigate("mulai")}
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black hover:opacity-90"
      >
        {t.workspace.startAnalysisButton}
      </button>
    </section>
  );
}

type Tier = "free" | "pro" | "platinum";

// Sinyal mentah per dimensi dari services/workspace/getBusinessHealth.ts —
// dipakai untuk menyusun kalimat "kenapa skor ini segini + solusinya apa"
// (audit Juli 2026: sebelumnya cuma teks statis dari analisa AI hari
// pertama, tidak pernah berubah walau Business Update/checklist terisi).
type DimensionSignal =
  | { type: "checklist"; done: number; total: number }
  | { type: "update"; hasUpdate: boolean; trend?: string | null; omsetTrend?: string | null; pelangganBaru?: number | null };
type DimensionSignals = Record<string, DimensionSignal> | null;

/** Business Score — gratis lihat ringkasan (skor+status saja), PRO lihat
 * lengkap, PLATINUM lengkap + Insight Beemo. */
const DIMENSION_LABELS: Record<string, { id: string; en: string; icon: string }> = {
  marketing: { id: "Marketing", en: "Marketing", icon: "📣" },
  sales: { id: "Penjualan", en: "Sales", icon: "💰" },
  operations: { id: "Operasional", en: "Operations", icon: "⚙️" },
  finance: { id: "Keuangan", en: "Finance", icon: "🧾" },
  customer: { id: "Pelanggan", en: "Customer", icon: "🧑‍🤝‍🧑" },
  brand: { id: "Brand", en: "Brand", icon: "✨" },
};

/** Menyusun kalimat "kenapa skor dimensi ini segini + apa yang bisa
 * dilakukan" dari sinyal MENTAH (dimensionSignals, lihat
 * services/workspace/getBusinessHealth.ts) — bukan AI, murni template +
 * data nyata, supaya otomatis berubah begitu Business Update/checklist baru
 * masuk (audit Juli 2026: sebelumnya "Ringkasan Singkat"/"Insight Beemo"
 * yang tampil di sini adalah teks AI statis dari hari pertama, sama persis
 * tiap kali dibuka). */
function dimensionReasonText(t: Translations, lang: "id" | "en", dim: string, signal: DimensionSignal | undefined): string {
  const dimensionLabel = DIMENSION_LABELS[dim]?.[lang] || dim;
  if (!signal) return "";
  if (signal.type === "checklist") {
    if (signal.total === 0) return "";
    if (signal.done === 0) return fillTemplate(t.workspace.healthReasonChecklistNone, { dimension: dimensionLabel });
    if (signal.done < signal.total)
      return fillTemplate(t.workspace.healthReasonChecklistPartial, { dimension: dimensionLabel, done: signal.done, total: signal.total });
    return fillTemplate(t.workspace.healthReasonChecklistDone, { dimension: dimensionLabel });
  }
  // type "update"
  if (!signal.hasUpdate) return t.workspace.healthReasonNoUpdate;
  if (dim === "sales") {
    if (signal.trend === "naik") return t.workspace.healthReasonSalesUp;
    if (signal.trend === "turun") return t.workspace.healthReasonSalesDown;
    return t.workspace.healthReasonSalesFlat;
  }
  if (dim === "finance") {
    if (!signal.omsetTrend) return t.workspace.healthReasonFinanceNoData;
    if (signal.omsetTrend === "up") return t.workspace.healthReasonFinanceUp;
    if (signal.omsetTrend === "down") return t.workspace.healthReasonFinanceDown;
    return t.workspace.healthReasonFinanceFlat;
  }
  if (dim === "customer") {
    if (signal.pelangganBaru == null) return t.workspace.healthReasonCustomerNoData;
    if (signal.pelangganBaru > 0) return fillTemplate(t.workspace.healthReasonCustomerUp, { count: signal.pelangganBaru });
    return t.workspace.healthReasonCustomerNone;
  }
  return "";
}

function BusinessScorePanel({
  preview,
  health,
  tier,
  businessType,
  t,
  lang,
  loading,
  error,
  onRetry,
  onUpgradeClick,
  onOpenUpdateModal,
  scoreHistory,
}: {
  preview: PreviewOutput | null;
  health: { dimensions: Record<string, number> | null; overall: number | null; dimensionSignals?: DimensionSignals };
  tier: Tier;
  businessType: "start" | "grow";
  t: Translations;
  lang: "id" | "en";
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onUpgradeClick: () => void;
  onOpenUpdateModal: () => void;
  // Audit Juli 2026 (masukan ChatGPT + QA langsung: "skor cuma angka polos,
  // lebih bagus ada panah tren/target") — reuse scoreHistory yang sudah
  // dimuat untuk grafik Today (today_snapshot), BUKAN data baru. Opsional
  // supaya pemanggil lain (kalau ada) tidak wajib menyediakannya.
  scoreHistory?: Array<{ date: string; score: number | null }>;
}) {
  const hasHealthData = health.overall !== null && health.dimensions !== null;
  const score = hasHealthData ? (health.overall as number) : preview?.businessHealthScore;

  // Business Context: skor dan cara hitungnya SAMA PERSIS untuk start/grow
  // (tidak ada logic baru) — yang berbeda HANYA judul & deskripsi halaman,
  // supaya usaha yang belum buka membaca ini sebagai "seberapa siap saya
  // membuka usaha ini", bukan "kesehatan bisnis" yang belum relevan buat
  // mereka (arahan directive: "Business Score tetap ada, tapi konteksnya
  // Kesiapan Membuka Usaha, bukan Kesehatan Bisnis").
  const sectionTitle = businessType === "start" ? t.workspace.scoreSectionTitleStart : t.workspace.scoreSectionTitle;
  const sectionDesc = businessType === "start" ? t.workspace.scoreSectionDescStart : t.workspace.scoreSectionDesc;

  // Identitas halaman — dipasang SEKALI di sini lewat SectionHeader,
  // dipakai juga oleh Report/Target/Competitor/dst berikutnya. Dibungkus
  // WorkspaceSection supaya jarak antar bagian konsisten tanpa spacing
  // manual per halaman.
  return (
    <WorkspaceSection>
      <SectionHeader title={sectionTitle} description={sectionDesc} />

      {/* Error state — retry HANYA memuat ulang Business Health (lihat
          reloadBusinessHealth di Workspace()), bukan reload seluruh
          halaman. Diprioritaskan sebelum skeleton/konten supaya tidak ada
          data basi yang tampil diam-diam saat fetch gagal. */}
      {error && !loading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: sectionTitle })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : loading ? (
        <>
          <SkeletonCard variant="hero" />
          <SkeletonCard variant="default" />
        </>
      ) : typeof score !== "number" ? (
        <EmptyState
          variant="default"
          icon="📊"
          title={t.workspace.scoreEmptyTitle}
          description={t.workspace.noAnalysisYet}
          ctaLabel={t.workspace.startAnalysisButton}
          onCtaClick={() => hardNavigate("")}
        />
      ) : (
        <ScoreContent
          health={health}
          hasHealthData={hasHealthData}
          score={score}
          tier={tier}
          t={t}
          lang={lang}
          onUpgradeClick={onUpgradeClick}
          onOpenUpdateModal={onOpenUpdateModal}
          scoreHistory={scoreHistory}
        />
      )}
    </WorkspaceSection>
  );
}

/** Isi Business Score setelah dipastikan ada skor untuk ditampilkan —
 * dipisah dari BusinessScorePanel murni supaya percabangan loading/error/
 * empty di atas tetap ringkas dan mudah dibaca. */
/** Warna highlight angka per dimensi — ambang sama dengan statusLabel skor
 * keseluruhan (>=70 baik, >=45 perlu perhatian, di bawah itu perlu perhatian
 * serius), supaya konsisten dipahami di satu halaman yang sama. */
function dimensionScoreTone(value: number): { text: string; bg: string } {
  if (value >= 70) return { text: "text-green-400", bg: "bg-green-500/10" };
  if (value >= 45) return { text: "text-amber-400", bg: "bg-amber-500/10" };
  return { text: "text-red-400", bg: "bg-red-500/10" };
}

function ScoreContent({
  health,
  hasHealthData,
  score,
  tier,
  t,
  lang,
  onUpgradeClick,
  onOpenUpdateModal,
  scoreHistory,
}: {
  health: { dimensions: Record<string, number> | null; overall: number | null; dimensionSignals?: DimensionSignals };
  hasHealthData: boolean;
  score: number;
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
  onOpenUpdateModal: () => void;
  scoreHistory?: Array<{ date: string; score: number | null }>;
}) {
  // Audit Juli 2026 (masukan ChatGPT + QA langsung: skor selama ini tampil
  // polos tanpa arah) — bandingkan titik data PALING AWAL yang tersedia di
  // scoreHistory (today_snapshot) dengan titik TERBARU untuk dapat delta
  // yang jujur, bukan dikarang. Kalau datanya kurang dari 2 titik (bisnis
  // baru banget), jangan tampilkan apa-apa sama sekali -- sama prinsipnya
  // dengan hasChartData di TodayPanel (JUJUR soal jumlah data).
  const historyPoints = (scoreHistory || []).filter((h): h is { date: string; score: number } => h.score !== null);
  const scoreDelta = historyPoints.length >= 2 ? historyPoints[historyPoints.length - 1].score - historyPoints[0].score : null;
  // Catatan: statusLabel SELALU dihitung dari skor numerik lewat kunci i18n,
  // bukan diambil dari preview.statusLabel mentah — field itu adalah teks
  // yang ditulis AI saat analisis dibuat (beku dalam bahasa saat itu), jadi
  // tidak ikut berubah saat pengguna toggle bahasa UI. Menghitung ulang dari
  // angka memastikan label ini selalu mengikuti bahasa aktif.
  const statusLabel =
    score >= 70
      ? t.workspace.healthStatusGood
      : score >= 45
        ? t.workspace.healthStatusNeedsAttention
        : t.workspace.healthStatusNeedsSeriousAttention;

  const dimensionEntries = health.dimensions ? Object.entries(health.dimensions) : [];
  // Teaser Gratis (audit Juli 2026: kunci total membuat user "beli buta" —
  // sekarang Gratis lihat 1 dimensi LENGKAP dengan penjelasannya, sisanya
  // dikunci dengan jelas, supaya kualitasnya kelihatan dulu sebelum bayar).
  const freePreviewDim = dimensionEntries[0];
  const lockedDimCount = Math.max(dimensionEntries.length - 1, 0);

  return (
    <>
      <WorkspaceCard variant="hero" className="text-center">
        <p className="text-5xl font-black text-primary">
          {score}
          <span className="text-lg text-neutral-500">/100</span>
        </p>
        {scoreDelta !== null && scoreDelta !== 0 && (
          <p className={`mt-1 text-xs font-bold ${scoreDelta > 0 ? "text-green-400" : "text-red-400"}`}>
            {scoreDelta > 0 ? "▲" : "▼"} {scoreDelta > 0 ? "+" : ""}
            {scoreDelta} {lang === "en" ? "since you started" : "sejak mulai dipantau"}
          </p>
        )}
        <p className="mt-2 text-sm font-bold uppercase tracking-wide text-neutral-300">{statusLabel}</p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
        </div>
        {hasHealthData && <p className="mt-3 text-xs text-neutral-500">{t.workspace.healthCalculatedNote}</p>}
      </WorkspaceCard>

      {hasHealthData && health.dimensions && (
        <WorkspaceCard>
          <h3 className="mb-1 text-sm font-bold text-neutral-200">{t.workspace.healthBreakdownTitle}</h3>
          <p className="mb-4 text-xs leading-relaxed text-neutral-500">{t.workspace.healthBreakdownSubtitle}</p>
          <div className="space-y-3">
            {(tier === "free" ? dimensionEntries.slice(0, 1) : dimensionEntries).map(([dim, dimScore]) => {
              const signal = health.dimensionSignals?.[dim];
              // Kasus "belum ada Business Update sama sekali" diganti CTA
              // singkat yang bisa diklik langsung (directive: "diganti
              // 'update bisnismu!!' atau yang sesuai") — kasus lain (sudah
              // ada sinyal checklist/tren nyata) TETAP pakai penjelasan
              // aslinya, supaya tidak kehilangan konteks kenapa skornya
              // begitu saat datanya memang sudah ada.
              const isNoUpdateYet = signal?.type === "update" && !signal.hasUpdate;
              const tone = dimensionScoreTone(dimScore);
              return (
                <div key={dim} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">{DIMENSION_LABELS[dim]?.icon}</span>
                      <p className="text-sm font-bold text-neutral-100">{DIMENSION_LABELS[dim]?.[lang] || dim}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-lg font-black ${tone.text} ${tone.bg}`}>{dimScore}</span>
                  </div>
                  {isNoUpdateYet ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs leading-relaxed text-neutral-400">{t.workspace.healthReasonNoUpdateCta}</p>
                      <button
                        onClick={onOpenUpdateModal}
                        className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        {t.workspace.updateBusinessButton}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                      {dimensionReasonText(t, lang, dim, signal)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </WorkspaceCard>
      )}

      {tier === "free" && (
        <UpgradeLockCard
          description={
            lockedDimCount > 0
              ? fillTemplate(t.workspace.scoreTeaserLockedDesc, {
                  count: lockedDimCount,
                  dimension: freePreviewDim ? DIMENSION_LABELS[freePreviewDim[0]]?.[lang] || "" : "",
                })
              : t.workspace.scoreLockedDesc
          }
          buttonLabel={t.workspace.competitorUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      )}
    </>
  );
}

/** Report — sama untuk semua tier (ringkasan analisa penuh). Laporan
 * lengkap PDF PRO/PLATINUM menyusul di Tahap B, tidak menggantikan ini. */
/** Report (dipasarkan sebagai "Insights" di sidebar — lihat menuReport)
 * — dibangun ulang mengikuti struktur "executive summary" yang diminta:
 * Ringkasan → Temuan → Yang Sudah Baik → Yang Perlu Diperbaiki → Peluang →
 * Rekomendasi Prioritas → Langkah Berikutnya. Backend HANYA menyediakan 5
 * field (summary/findings/strengths/improvements/opportunity) — Rekomendasi
 * Prioritas & Langkah Berikutnya BUKAN insight AI baru: keduanya murni
 * menyusun ulang/mengurutkan teks yang sudah ada (Rekomendasi Prioritas)
 * atau CTA generik yang selalu benar (Langkah Berikutnya), sesuai prinsip
 * "sintesis boleh, mengarang tidak boleh". Kalau nanti backend punya field
 * priorityRecommendations[]/nextActions[] sendiri, tinggal ganti sumber
 * data di sini tanpa mengubah desain. */
function ReportPanel({
  preview,
  t,
  loading,
  error,
  onRetry,
  onOpenUpdateModal,
}: {
  preview: PreviewOutput | null;
  t: Translations;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenUpdateModal: () => void;
}) {
  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuReport} description={t.workspace.reportSectionDesc} />

      {error && !loading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.menuReport })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : loading ? (
        <>
          <SkeletonCard variant="hero" />
          <SkeletonCard variant="default" />
          <SkeletonCard variant="default" />
        </>
      ) : !preview ? (
        <EmptyState
          variant="default"
          icon="📄"
          title={t.workspace.reportEmptyTitle}
          description={t.workspace.noAnalysisYet}
          ctaLabel={t.workspace.startAnalysisButton}
          onCtaClick={() => hardNavigate("")}
        />
      ) : (
        <ReportContent preview={preview} t={t} onOpenUpdateModal={onOpenUpdateModal} />
      )}
    </WorkspaceSection>
  );
}

function ReportContent({
  preview,
  t,
  onOpenUpdateModal,
}: {
  preview: PreviewOutput;
  t: Translations;
  onOpenUpdateModal: () => void;
}) {
  const hasPriority = Boolean(preview.improvements || preview.opportunity);

  return (
    <>
      {/* Ringkasan Singkat — hero, ini "executive summary"-nya halaman. */}
      {preview.summary && (
        <WorkspaceCard variant="hero">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            {t.previewReport.summaryTitle}
          </h3>
          <p className="text-base leading-relaxed text-neutral-100">{preview.summary}</p>
        </WorkspaceCard>
      )}

      {/* Temuan Penting */}
      {preview.findings && preview.findings.length > 0 && (
        <WorkspaceCard>
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.previewReport.findingsTitle}</h3>
          <ul className="space-y-2">
            {preview.findings.map((f, i) => (
              <li key={i} className="text-sm leading-relaxed text-neutral-400">
                {i + 1}. {f}
              </li>
            ))}
          </ul>
        </WorkspaceCard>
      )}

      {/* Yang Sudah Baik + Yang Perlu Diperbaiki berdampingan — hijau vs
          amber, mengikuti semantik warna yang sudah ditetapkan Today. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {preview.strengths && (
          <WorkspaceCard tone="success">
            <h3 className="mb-1 text-xs font-bold uppercase text-green-400">{t.previewReport.strengthsTitle}</h3>
            <p className="text-sm leading-relaxed text-neutral-300">{preview.strengths}</p>
          </WorkspaceCard>
        )}
        {preview.improvements && (
          <WorkspaceCard tone="warning">
            <h3 className="mb-1 text-xs font-bold uppercase text-amber-400">{t.previewReport.improvementsTitle}</h3>
            <p className="text-sm leading-relaxed text-neutral-300">{preview.improvements}</p>
          </WorkspaceCard>
        )}
      </div>

      {/* Peluang */}
      {preview.opportunity && (
        <WorkspaceCard tone="success">
          <h3 className="mb-1 text-xs font-bold uppercase text-green-400">{t.previewReport.opportunityTitle}</h3>
          <p className="text-sm leading-relaxed text-neutral-300">{preview.opportunity}</p>
        </WorkspaceCard>
      )}

      {/* Rekomendasi Prioritas — BUKAN insight baru. Murni menyusun ulang
          Yang Perlu Diperbaiki + Peluang jadi satu daftar berurutan
          ("sintesis": mengurutkan informasi yang sudah ada, bukan
          mengarang kalimat baru). */}
      {hasPriority && (
        <WorkspaceCard tone="primary">
          <h3 className="mb-3 text-sm font-bold text-primary">{t.workspace.reportPriorityTitle}</h3>
          <ol className="space-y-2">
            {preview.improvements && (
              <li className="text-sm leading-relaxed text-neutral-200">1. {preview.improvements}</li>
            )}
            {preview.opportunity && (
              <li className="text-sm leading-relaxed text-neutral-200">
                {preview.improvements ? "2. " : "1. "}
                {preview.opportunity}
              </li>
            )}
          </ol>
        </WorkspaceCard>
      )}

      {/* Langkah Berikutnya — CTA jujur (arahan nyata yang sudah ada di
          aplikasi: Update Bisnis), bukan langkah yang dikarang seolah
          spesifik untuk bisnis ini. */}
      <WorkspaceCard tone="primary" className="text-center">
        <h3 className="mb-2 text-sm font-bold text-primary">{t.workspace.reportNextStepsTitle}</h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-300">{t.workspace.reportNextStepsDesc}</p>
        <RetryButton label={t.workspace.updateBusinessButton} onRetry={onOpenUpdateModal} />
      </WorkspaceCard>
    </>
  );
}

/** Target — target yang pelanggan isi sendiri di wizard. PLATINUM
 * ditambah bagian Progress (placeholder transparan, bukan "coming soon",
 * sampai Business Engine di Tahap 2 jalan). */
/** Target — menjawab satu pertanyaan: "seberapa dekat aku ke tujuanku?"
 * Hero = target (teks bebas pengguna) + Business Score journey (satu-
 * satunya indikator numerik objektif yang benar-benar ada). TIDAK PERNAH
 * menghitung/menampilkan persentase target-tercapai atau angka pelanggan —
 * field `target` cuma teks bebas, tidak ada data numerik target vs
 * tercapai di backend. Kalau suatu hari Business Engine punya
 * target_value/current_value/completion_percentage, Hero Card ini tinggal
 * diganti isinya tanpa mengubah struktur/desain halaman (lihat arahan
 * Product Owner). Progress+Perbandingan tetap PLATINUM; Free/Pro dapat
 * UpgradeLockCard, bukan halaman kosong. Prioritas BUKAN insight baru —
 * murni reuse improvements+opportunity yang sama dengan Rekomendasi
 * Prioritas di Report (satu sumber data, sesuai prinsip "sintesis boleh,
 * mengarang tidak boleh"). */
/** Target & Progress — digabung dari 2 halaman terpisah (Target + Journey)
 * yang sebelumnya menampilkan skor Journey yang SAMA PERSIS dua kali (audit
 * Juli 2026). Sekarang satu cerita: apa targetnya -> sudah sejalan atau
 * belum -> apa yang sudah dilakukan (timeline+achievement). Free terkunci
 * total (sama seperti Journey lama). Pro tetap dapat timeline/achievement
 * (seperti sebelumnya di Journey) — HANYA skor Progress numerik yang tetap
 * eksklusif Platinum (sama seperti Target lama), supaya tidak ada yang
 * "hilang" diam-diam dari Pro dibanding sebelum digabung. */
function TargetPanel({
  rawInput,
  preview,
  tier,
  t,
  lang,
  progress,
  analysesLoading,
  analysesError,
  onRetryAnalyses,
  progressLoading,
  progressError,
  onRetryProgress,
  onUpgradeClick,
  onOpenUpdateModal,
  healthTrend,
  updates,
  updatesLoading,
  achievements,
  achievementsLoading,
  updateHistoryError,
  achievementsError,
  onRetryTimeline,
}: {
  rawInput: Record<string, string> | null;
  preview: PreviewOutput | null;
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  progress: {
    journey: { baselineScore: number; currentScore: number; delta: number } | null;
    period: { previousScore: number; currentScore: number; delta: number } | null;
  };
  analysesLoading: boolean;
  analysesError: boolean;
  onRetryAnalyses: () => void;
  progressLoading: boolean;
  progressError: boolean;
  onRetryProgress: () => void;
  onUpgradeClick: () => void;
  onOpenUpdateModal: () => void;
  healthTrend: HealthTrend;
  updates: Array<Record<string, unknown>>;
  updatesLoading: boolean;
  achievements: {
    unlocked: Array<Record<string, unknown>>;
    nextMilestone: Record<string, unknown> | null;
  };
  achievementsLoading: boolean;
  updateHistoryError: boolean;
  achievementsError: boolean;
  onRetryTimeline: () => void;
}) {
  const target = rawInput?.target;
  const hasPriority = Boolean(preview?.improvements || preview?.opportunity);
  const periodDimensions = ["sales", "finance", "customer"] as const;
  const timelineLoading = updatesLoading || achievementsLoading;
  const timelineError = updateHistoryError || achievementsError;

  function deltaLabel(delta: number): string {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }

  function deltaColor(delta: number): string {
    if (delta > 0) return "text-green-400";
    if (delta < 0) return "text-red-400";
    return "text-neutral-400";
  }

  if (tier === "free") {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.targetSectionTitle} description={t.workspace.targetSectionDesc} />
        <UpgradeLockCard
          // Phase 6 (Monetization/Upgrade timing, directive PO: "teaser
          // lebih personal") — sebut target ASLI pengguna (rawInput.target,
          // sudah tersedia di scope ini) kalau ada, bukan copy generik yang
          // sama untuk semua orang.
          description={target ? fillTemplate(t.workspace.growthLockedDescNamed, { target: target.length > 80 ? target.slice(0, 80).trim() + "…" : target }) : t.workspace.growthLockedDesc}
          buttonLabel={t.workspace.growthUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      </WorkspaceSection>
    );
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.targetSectionTitle} description={t.workspace.targetSectionDesc} />

      {/* Target Hero — rawInput bersumber dari analyses (analisis terakhir),
          jadi error/retry-nya reuse analysesError/reloadAnalyses yang sama
          dipakai Report (satu sumber data, satu error state). */}
      {analysesError && !analysesLoading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.targetSectionTitle })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetryAnalyses}
        />
      ) : analysesLoading ? (
        <SkeletonCard variant="hero" />
      ) : target ? (
        <WorkspaceCard variant="hero">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            {t.workspace.targetTitle}
          </h3>
          <p className="text-base leading-relaxed text-neutral-100">{target}</p>
        </WorkspaceCard>
      ) : (
        <EmptyState
          variant="default"
          icon="🎯"
          title={t.workspace.targetEmptyTitle}
          description={t.workspace.targetEmptyDesc}
          ctaLabel={t.workspace.updateBusinessButton}
          onCtaClick={onOpenUpdateModal}
        />
      )}

      {/* Progress & Journey — skor numerik tetap eksklusif PLATINUM (sama
          seperti sebelum digabung). Pro dapat penjelasan manfaat + CTA
          upgrade, bukan bagian yang hilang diam-diam. */}
      {tier !== "platinum" ? (
        <UpgradeLockCard
          description={target ? fillTemplate(t.workspace.targetProgressLockedDescNamed, { target: target.length > 80 ? target.slice(0, 80).trim() + "…" : target }) : t.workspace.targetProgressLockedDesc}
          buttonLabel={t.workspace.competitorUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      ) : progressError && !progressLoading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.targetProgressTitle })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetryProgress}
        />
      ) : progressLoading ? (
        <SkeletonCard variant="default" />
      ) : !progress.journey ? (
        <EmptyState
          variant="default"
          icon="📈"
          title={t.workspace.targetProgressEmptyTitle}
          description={t.workspace.targetProgressPlaceholder}
          ctaLabel={t.workspace.updateBusinessButton}
          onCtaClick={onOpenUpdateModal}
        />
      ) : (
        <>
          <WorkspaceCard>
            <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthJourneyTitle}</h3>
            <WorkspaceCard variant="compact">
              <p className="mb-1 text-xs font-bold uppercase text-neutral-400">{t.workspace.growthOverallScoreLabel}</p>
              <p className="text-2xl font-black text-white">
                {progress.journey.baselineScore} → {progress.journey.currentScore}
                <span className="ml-1 text-sm font-normal text-neutral-500">/100</span>
              </p>
              <p className={`text-sm font-semibold ${deltaColor(progress.journey.delta)}`}>
                {deltaLabel(progress.journey.delta)} {t.workspace.pointsUnit}
              </p>
            </WorkspaceCard>

            {healthTrend.biggestMoverDimension && healthTrend.journeyByDimension && (
              <WorkspaceCard variant="compact" tone="primary" className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase text-primary">{t.workspace.growthBiggestMoverLabel}</p>
                <p className="text-sm font-semibold text-white">
                  {DIMENSION_LABELS[healthTrend.biggestMoverDimension]?.[lang] || healthTrend.biggestMoverDimension}{" "}
                  <span className={deltaColor(healthTrend.journeyByDimension[healthTrend.biggestMoverDimension].delta)}>
                    ({deltaLabel(healthTrend.journeyByDimension[healthTrend.biggestMoverDimension].delta)})
                  </span>
                </p>
              </WorkspaceCard>
            )}

            {/* Riwayat — menggabungkan update bisnis dengan momen Achievement
                terbuka, diurutkan kronologis, supaya halaman ini benar-benar
                menceritakan perjalanan bisnis, bukan cuma daftar Business
                Update. */}
            <div className="mt-4 border-t border-white/10 pt-4">
              <h4 className="mb-3 text-xs font-bold uppercase text-neutral-500">{t.workspace.growthTimelineTitle}</h4>
              {timelineError && !timelineLoading ? (
                <ErrorCard
                  title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.growthTimelineTitle })}
                  description={t.workspace.workspaceSectionErrorDesc}
                  retryLabel={t.workspace.workspaceRetryButton}
                  onRetry={onRetryTimeline}
                />
              ) : (
                <GrowthTimeline
                  t={t}
                  lang={lang}
                  updates={updates}
                  updatesLoading={updatesLoading}
                  unlockedAchievements={achievements.unlocked}
                  achievementsLoading={achievementsLoading}
                />
              )}
            </div>
          </WorkspaceCard>

          {/* Perubahan Minggu Ini — minggu lalu vs minggu ini, per dimensi. */}
          <WorkspaceCard>
            <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthPeriodTitle}</h3>
            {!progress.period || !healthTrend.periodByDimension ? (
              <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.growthPeriodEmptyDesc}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <WorkspaceCard variant="compact" className="text-center">
                  <p className="text-xs font-bold uppercase text-neutral-400">{t.workspace.growthOverallScoreLabel}</p>
                  <p className={`mt-1 text-sm font-bold ${deltaColor(progress.period.delta)}`}>
                    {deltaLabel(progress.period.delta)}
                  </p>
                </WorkspaceCard>
                {periodDimensions.map((dim) => {
                  const d = healthTrend.periodByDimension?.[dim];
                  if (!d) return null;
                  return (
                    <WorkspaceCard key={dim} variant="compact" className="text-center">
                      <p className="text-xs font-bold uppercase text-neutral-400">{DIMENSION_LABELS[dim]?.[lang]}</p>
                      <p className={`mt-1 text-sm font-bold ${deltaColor(d.delta)}`}>{deltaLabel(d.delta)}</p>
                    </WorkspaceCard>
                  );
                })}
              </div>
            )}
          </WorkspaceCard>
        </>
      )}

      {/* Timeline/Achievement untuk PRO (sebelumnya di halaman Journey
          terpisah, tetap tersedia di sini walau bukan Platinum — TIDAK
          mengambil apa pun yang sudah dipunyai Pro sebelum digabung). */}
      {tier === "pro" && (
        <WorkspaceCard>
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthTimelineTitle}</h3>
          {timelineError && !timelineLoading ? (
            <ErrorCard
              title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.growthTimelineTitle })}
              description={t.workspace.workspaceSectionErrorDesc}
              retryLabel={t.workspace.workspaceRetryButton}
              onRetry={onRetryTimeline}
            />
          ) : (
            <GrowthTimeline
              t={t}
              lang={lang}
              updates={updates}
              updatesLoading={updatesLoading}
              unlockedAchievements={achievements.unlocked}
              achievementsLoading={achievementsLoading}
            />
          )}
        </WorkspaceCard>
      )}

      {/* Achievements — murni baca dari business_achievements. Tidak ada
          badge/skor game — hanya judul, deskripsi singkat, dan tanggal
          terbuka. Tersedia Pro+Platinum (sama seperti Journey sebelumnya). */}
      {achievementsError && !achievementsLoading ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.growthAchievementsTitle })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetryTimeline}
        />
      ) : (
        <WorkspaceCard>
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthAchievementsTitle}</h3>
          {achievementsLoading ? (
            <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>
          ) : achievements.unlocked.length === 0 ? (
            <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.growthAchievementsEmptyDesc}</p>
          ) : (
            <div className="space-y-3">
              {achievements.unlocked.map((a) => {
                const difficulty = a.difficulty as string | undefined;
                const difficultyLabel =
                  difficulty === "bronze"
                    ? t.workspace.difficultyBronze
                    : difficulty === "silver"
                      ? t.workspace.difficultySilver
                      : difficulty === "gold"
                        ? t.workspace.difficultyGold
                        : difficulty === "platinum"
                          ? t.workspace.difficultyPlatinum
                          : null;
                const businessValue = lang === "id" ? (a.businessValueId as string | null) : (a.businessValueEn as string | null);
                return (
                  <WorkspaceCard key={a.code as string} variant="compact" className="transition-colors hover:border-primary/20">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span aria-hidden="true">🏆</span>
                        {lang === "id" ? (a.titleId as string) : (a.titleEn as string)}
                      </p>
                      {difficultyLabel && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
                          {difficultyLabel}
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-sm text-neutral-400">
                      {lang === "id" ? (a.descriptionId as string) : (a.descriptionEn as string)}
                    </p>
                    {businessValue && <p className="mb-2 text-sm italic text-primary/80">{businessValue}</p>}
                    <p className="text-xs text-neutral-500">
                      {new Date(a.unlockedAt as string).toLocaleDateString(LOCALE_MAP[lang], {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </WorkspaceCard>
                );
              })}
            </div>
          )}
        </WorkspaceCard>
      )}

      {/* Next Milestone — satu kalimat motivasi, dipilih dari achievement
          yang belum terbuka dengan remainingRatio terkecil. */}
      {!achievementsError && (
        <WorkspaceCard>
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthNextMilestoneTitle}</h3>
          {achievementsLoading ? (
            <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>
          ) : !achievements.nextMilestone ? (
            <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.growthNextMilestoneNone}</p>
          ) : (
            <WorkspaceCard variant="compact" tone="primary">
              <p className="text-sm font-semibold leading-relaxed text-white">
                {fillTemplate(t.workspace.growthNextMilestoneTemplate, {
                  remaining: achievements.nextMilestone.remaining as number,
                  unit: lang === "id" ? (achievements.nextMilestone.unitId as string) : (achievements.nextMilestone.unitEn as string),
                  title: lang === "id" ? (achievements.nextMilestone.titleId as string) : (achievements.nextMilestone.titleEn as string),
                })}
              </p>
            </WorkspaceCard>
          )}
        </WorkspaceCard>
      )}

      {/* Prioritas — BUKAN insight baru, reuse improvements+opportunity
          yang sama dengan Rekomendasi Prioritas di Report. */}
      {!analysesError && !analysesLoading && hasPriority && (
        <WorkspaceCard tone="primary">
          <h3 className="mb-3 text-sm font-bold text-primary">{t.workspace.targetPriorityTitle}</h3>
          <ol className="space-y-2">
            {preview?.improvements && (
              <li className="text-sm leading-relaxed text-neutral-200">1. {preview.improvements}</li>
            )}
            {preview?.opportunity && (
              <li className="text-sm leading-relaxed text-neutral-200">
                {preview?.improvements ? "2. " : "1. "}
                {preview.opportunity}
              </li>
            )}
          </ol>
        </WorkspaceCard>
      )}

    </WorkspaceSection>
  );
}

/** Competitor — menjawab satu pertanyaan: "bagaimana posisi bisnisku
 * dibanding pesaing?" (siapa mereka, kekuatan mereka, peluang yang bisa
 * dimanfaatkan). SectionHeader menjelaskan pertanyaan itu di atas, supaya
 * pengguna langsung paham fungsi halaman ini WALAU datanya belum ada.
 * Free tetap terkunci total (upsell).
 *
 * Master Product Directive Fase 2: Competitor bukan lagi halaman statis,
 * tapi Engine sungguhan (services/competitor/*) — provider (Google Places/
 * OpenStreetMap/Mock) -> normalizer -> Competitor Engine -> Opportunity
 * Engine -> Recommendation Engine, semuanya dengan evidence, tidak ada
 * insight yang dikarang. Kalau lokasi/industri bisnis belum lengkap, atau
 * pipeline gagal, halaman ini menampilkan Empty/Error State yang jujur —
 * BUKAN data kompetitor palsu. */
type CompetitorRecordData = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  priceLevel: number | null;
  distanceLabel: string | null;
  sourceUrl: string | null;
};
type OpportunityData = {
  id: string;
  title: string;
  businessValue: string;
  difficulty: string;
  impact: string;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  action: string;
  source: string;
  evidence: string;
};
type RecommendationData = {
  id: string;
  bucket: "today" | "this_week" | "this_month" | "next_90_days";
  title: string;
  reason: string;
  action: string;
  source: string;
};
type FormattedInsightData = {
  id: string;
  category: "market_position" | "strength" | "weakness" | "opportunity" | "recommendation";
  categoryLabelId: string;
  categoryLabelEn: string;
  headline: string;
  evidenceSummary: string;
  evidenceDetail: string;
  priority?: "critical" | "high" | "medium" | "low";
  bucket?: "today" | "this_week" | "this_month" | "next_90_days";
};
type CompetitorAnalysisData = {
  competitor: {
    dataSource: "google_places" | "openstreetmap" | "claude_web_search" | "mock";
    marketSummary: { totalCompetitorsFound: number; averageRating: number | null; averageReviewCount: number | null };
    competitors: CompetitorRecordData[];
    marketPosition: "leader" | "competitive" | "developing" | "unknown";
    marketPositionReason: string;
    competitorStrengths: Array<{ text: string; evidence: string }>;
    competitorWeaknesses: Array<{ text: string; evidence: string }>;
    userStrengths: Array<{ text: string; evidence: string }>;
    fetchedAt: string;
  };
  opportunities: OpportunityData[];
  recommendations: RecommendationData[];
  insights: FormattedInsightData[];
};

const RECOMMENDATION_BUCKET_ORDER: RecommendationData["bucket"][] = [
  "today",
  "this_week",
  "this_month",
  "next_90_days",
];

/** Medsos Kompetitor (Task 14b, Juli 2026) — bagian dari tab Kompetitor,
 * bukan tab terpisah, karena datanya memang tentang kompetitor yang sama.
 * dataSource bisa "mock" (belum ada token Apify/gagal) atau "live_api"
 * (Task 49, Juli 2026 — data asli username+followers via Apify) — UI WAJIB
 * menampilkan label jujur sesuai sumber sebenarnya (lihat
 * services/socialMedia/getSocialMediaAnalysis.ts). */
type SocialMediaRecordData = {
  competitorName: string;
  platform: "instagram" | "tiktok" | "facebook";
  followers: number;
  postsPerMonth: number;
  engagementRatePct: number;
};
type SocialMediaInsightData = {
  id: string;
  category: "summary" | "strength" | "weakness" | "opportunity";
  headline: string;
  evidenceSummary: string;
};
// Data ASLI (Apify) — HANYA username+followers, sengaja tidak ada
// postsPerMonth/engagementRatePct (lihat catatan ToS di
// services/socialMedia/instagramProvider.ts).
type SocialMediaLiveRecordData = {
  competitorName: string;
  platform: "instagram";
  username: string;
  followers: number;
};
type SocialMediaAnalysisData = {
  socialMedia: {
    dataSource: "mock" | "live_api";
    records: SocialMediaRecordData[]; // diisi hanya saat dataSource "mock"
    liveRecords: SocialMediaLiveRecordData[]; // diisi hanya saat dataSource "live_api"
    summary: {
      totalProfilesFound: number;
      averageFollowers: number | null;
      averageEngagementRatePct: number | null;
      mostActivePlatform: "instagram" | "tiktok" | "facebook" | null;
      platformsNotFound: Array<"instagram" | "tiktok" | "facebook">;
    };
    insights: SocialMediaInsightData[]; // diisi hanya saat dataSource "mock"
    aiSummary: string | null; // diisi hanya saat dataSource "live_api"
    fetchedAt: string;
  };
  tier: Tier;
};

/** Ekonomi Makro (Task 14c, Juli 2026) — halaman baru, tidak tergantung
 * business_profile (data sama untuk semua pengguna), tidak tier-gated
 * (konteks umum, bukan analisis pribadi bisnis). Lihat
 * services/macro/getMacroSnapshot.ts. */
type MacroIndicatorData = {
  key: "usd_idr" | "inflation_yoy" | "bi_rate";
  labelId: string;
  labelEn: string;
  valueDisplay: string;
  rawValue: number;
  source: "live_api" | "static";
  asOf: string;
};
type MacroSnapshotData = {
  macro: {
    indicators: MacroIndicatorData[];
    insights: Array<{ id: string; headline: string }>;
    fetchedAt: string;
  };
};

/** Rencana Aksi Beemo (Phase 3) — satu item aksi untuk satu hari (dayOffset
 * 0 = hari ini), lihat migrations/2026-07-16_business_action_plan.sql &
 * services/workspace/actionPlan/*.ts. */
type ActionPlanItemData = {
  id: string;
  batch_id: string;
  day_offset: number;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  generated_at: string;
};

/** Lonceng Notifikasi (Juli 2026) — lihat services/notifications/getNotifications.ts
 * untuk bagaimana daftar ini dihitung (on-the-fly dari achievement/decision/
 * report/subscription-expiring/update-reminder, bukan tabel notifikasi
 * tersendiri). menuKey null berarti notifikasi ini tidak mengarah ke
 * halaman spesifik (klik tidak pindah menu). */
type NotificationItemData = {
  id: string;
  type: "achievement" | "decision" | "report" | "subscription_expiring" | "update_reminder";
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
  menuKey: MenuKey | null;
};

/** Referensi Pelanggan Baru (Juli 2026) — lihat
 * services/workspace/leads/generateLeadReferrals.ts. "company" wajib hasil
 * pencarian web sungguhan (sourceUrl WAJIB ada), "individual" adalah
 * profil/segmen (bukan nama orang asli) jadi sourceUrl/address boleh
 * kosong. Sengaja HARDCODE bahasa Indonesia di panel ini (tidak lewat
 * translations.ts) — lihat catatan di LeadReferralsPanel di bawah. */
type LeadReferralItem = {
  id: string;
  batch_id: string;
  lead_type: "company" | "individual";
  name: string;
  description: string | null;
  address: string | null;
  source_url: string | null;
  generated_at: string;
};

function CompetitorPanel({
  tier,
  t,
  lang,
  onUpgradeClick,
  data,
  loading,
  error,
  notReadyMessage,
  onRetry,
  socialMedia,
  socialMediaLoading,
  socialMediaError,
  onRetrySocialMedia,
}: {
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
  data: CompetitorAnalysisData | null;
  loading: boolean;
  error: boolean;
  notReadyMessage: string | null;
  onRetry: () => void;
  socialMedia: SocialMediaAnalysisData | null;
  socialMediaLoading: boolean;
  socialMediaError: boolean;
  onRetrySocialMedia: () => void;
}) {
  if (loading) {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuCompetitor} description={t.workspace.competitorSectionDesc} />
        <SkeletonCard />
        <SkeletonCard />
      </WorkspaceSection>
    );
  }

  if (error) {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuCompetitor} description={t.workspace.competitorSectionDesc} />
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.menuCompetitor })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      </WorkspaceSection>
    );
  }

  if (notReadyMessage) {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuCompetitor} description={t.workspace.competitorSectionDesc} />
        <EmptyState variant="default" icon="🔍" title={t.workspace.competitorEmptyTitle} description={notReadyMessage} />
      </WorkspaceSection>
    );
  }

  if (!data) {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuCompetitor} description={t.workspace.competitorSectionDesc} />
        <EmptyState
          variant="default"
          icon="🔍"
          title={t.workspace.competitorEmptyTitle}
          description={t.workspace.competitorProPlatinumMessage}
        />
      </WorkspaceSection>
    );
  }

  const { competitor, insights } = data;
  const isMock = competitor.dataSource === "mock";
  const isWebSearch = competitor.dataSource === "claude_web_search";

  const marketPositionInsight = insights.find((i) => i.category === "market_position") || null;
  const strengthInsights = insights.filter((i) => i.category === "strength");
  const weaknessInsights = insights.filter((i) => i.category === "weakness");
  const opportunityInsights = insights.filter((i) => i.category === "opportunity");
  const recommendationInsights = insights.filter((i) => i.category === "recommendation");

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuCompetitor} description={t.workspace.competitorSectionDesc} />

      {isMock && (
        <WorkspaceCard tone="warning">
          <p className="text-sm font-semibold text-amber-300">{t.workspace.competitorMockDataBadge}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.competitorMockDataDesc}</p>
        </WorkspaceCard>
      )}

      {isWebSearch && (
        <WorkspaceCard tone="success">
          <p className="text-sm font-semibold text-emerald-300">{t.workspace.competitorWebSearchBadge}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.competitorWebSearchDesc}</p>
        </WorkspaceCard>
      )}

      <WorkspaceCard>
        <h3 className="mb-1 text-sm font-bold text-white">{t.workspace.competitorMarketSummaryTitle}</h3>
        <p className="text-xs text-neutral-400">
          {fillTemplate(t.workspace.competitorTotalFound, { count: String(competitor.marketSummary.totalCompetitorsFound) })}
          {competitor.marketSummary.averageRating != null &&
            ` · ${fillTemplate(t.workspace.competitorAverageRating, { rating: competitor.marketSummary.averageRating.toFixed(1) })}`}
        </p>
      </WorkspaceCard>

      {/* Teaser Gratis (audit Juli 2026): sebelumnya halaman ini terkunci
          TOTAL untuk Gratis (0 data terlihat) — sekarang Gratis tetap lihat
          1 kompetitor asli lengkap (bukti kualitas data sebelum bayar),
          sisanya + analisa kekuatan/kelemahan/peluang dikunci jelas. */}
      {competitor.competitors.length > 0 && (
        <WorkspaceCard>
          <h3 className="mb-3 text-sm font-bold text-white">{t.workspace.competitorListTitle}</h3>
          <div className="space-y-2">
            {competitor.competitors.slice(0, tier === "free" ? 1 : 8).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  {c.address && <p className="text-xs text-neutral-500">{c.address}</p>}
                  <a
                    href={googleMapsSearchUrl(c.name, c.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    📍 {t.workspace.competitorMapsLinkLabel}
                  </a>
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 ml-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      🔗 {t.workspace.competitorSourceLinkLabel}
                    </a>
                  )}
                </div>
                <div className="text-right text-xs text-neutral-400">
                  {c.rating != null ? `${c.rating}★` : t.workspace.competitorNoRatingData}
                  {c.reviewCount != null && ` · ${c.reviewCount} ${t.workspace.competitorReviewsLabel}`}
                </div>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      )}

      {/* Urutan halaman (revisi Juli 2026): (1) Ringkasan Pasar + Daftar
          Kompetitor di atas (data asli area/kota pengguna, sudah ada di
          atas), (2) Peluang + Posisi Pasar/Kekuatan/Kelemahan, (3) Medsos
          Kompetitor, (4) "yang sebaiknya kamu lakukan" (Rekomendasi) paling
          akhir — supaya alur bacanya: kondisi pasar -> apa peluangnya ->
          bukti sosial media -> baru actionnya, bukan rekomendasi duluan
          sebelum konteksnya jelas. */}
      {tier === "free" ? (
        <UpgradeLockCard
          description={
            competitor.competitors.length > 1
              ? fillTemplate(t.workspace.competitorTeaserLockedDesc, { count: competitor.competitors.length - 1 })
              : t.workspace.competitorLockedDesc
          }
          buttonLabel={t.workspace.competitorUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      ) : (
        <>
          {opportunityInsights.length > 0 && (
            <InsightGroup t={t} title={lang === "id" ? opportunityInsights[0].categoryLabelId : opportunityInsights[0].categoryLabelEn} insightList={opportunityInsights} lang={lang} showPriority />
          )}

          {marketPositionInsight && (
            <InsightGroup
              t={t}
              title={lang === "id" ? marketPositionInsight.categoryLabelId : marketPositionInsight.categoryLabelEn}
              insightList={[marketPositionInsight]}
              lang={lang}
            />
          )}

          {strengthInsights.length > 0 && (
            <InsightGroup t={t} title={lang === "id" ? strengthInsights[0].categoryLabelId : strengthInsights[0].categoryLabelEn} insightList={strengthInsights} lang={lang} tone="success" />
          )}

          {weaknessInsights.length > 0 && (
            <InsightGroup t={t} title={lang === "id" ? weaknessInsights[0].categoryLabelId : weaknessInsights[0].categoryLabelEn} insightList={weaknessInsights} lang={lang} />
          )}
        </>
      )}

      <p className="text-center text-[11px] text-neutral-600">
        {fillTemplate(t.workspace.competitorLastUpdated, { date: new Date(competitor.fetchedAt).toLocaleDateString(lang === "id" ? "id-ID" : "en-US") })}
      </p>

      <SocialMediaSection
        t={t}
        lang={lang}
        tier={tier}
        data={socialMedia}
        loading={socialMediaLoading}
        error={socialMediaError}
        onRetry={onRetrySocialMedia}
        onUpgradeClick={onUpgradeClick}
      />

      {tier !== "free" && recommendationInsights.length > 0 && (
        <div className="border-t border-white/10 pt-6">
          <WorkspaceCard>
            <h3 className="mb-3 text-sm font-bold text-white">{lang === "id" ? recommendationInsights[0].categoryLabelId : recommendationInsights[0].categoryLabelEn}</h3>
            <div className="space-y-4">
              {RECOMMENDATION_BUCKET_ORDER.filter((bucket) => recommendationInsights.some((r) => r.bucket === bucket)).map((bucket) => {
                const bucketLabelMap: Record<RecommendationData["bucket"], string> = {
                  today: t.workspace.competitorBucketToday,
                  this_week: t.workspace.competitorBucketThisWeek,
                  this_month: t.workspace.competitorBucketThisMonth,
                  next_90_days: t.workspace.competitorBucketNext90Days,
                };
                return (
                  <div key={bucket}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{bucketLabelMap[bucket]}</p>
                    <InsightList t={t} insightList={recommendationInsights.filter((r) => r.bucket === bucket)} lang={lang} />
                  </div>
                );
              })}
            </div>
          </WorkspaceCard>
        </div>
      )}
    </WorkspaceSection>
  );
}

/** Medsos Kompetitor (Task 14b) — bagian dari tab Kompetitor. Sama pola
 * teaser Gratis dengan bagian Kompetitor di atas: 1 profil terlihat, sisanya
 * + insight terkunci. dataSource selalu "mock" hari ini (belum ada provider
 * data medsos sungguhan) — badge jujur WAJIB tampil, sama seperti badge
 * "Contoh/Simulasi" di Competitor Engine. */
const PLATFORM_ICON: Record<SocialMediaRecordData["platform"], string> = {
  instagram: "📸",
  tiktok: "🎵",
  facebook: "👍",
};

const PLATFORM_DISPLAY_NAME: Record<SocialMediaRecordData["platform"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

/** Link "cari di [platform]" — TIDAK butuh API key apapun, cuma URL search
 * bawaan tiap platform. Dipakai untuk kompetitor dari data contoh/simulasi
 * (nama bukan akun asli, jadi tidak bisa link langsung ke profil), supaya
 * pengguna tetap punya sesuatu yang bisa diklik alih-alih teks statis. Untuk
 * data ASLI (Apify, live_api) dipakai link profil langsung, lihat
 * instagramProfileUrl() di bawah. */
function socialSearchUrl(platform: SocialMediaRecordData["platform"], competitorName: string): string {
  const q = encodeURIComponent(competitorName);
  if (platform === "instagram") return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
  if (platform === "tiktok") return `https://www.tiktok.com/search?q=${q}`;
  return `https://www.facebook.com/search/top?q=${q}`;
}

function instagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

/** Link "buka di Google Maps" — juga cuma URL search publik, tidak butuh
 * GOOGLE_PLACES_API_KEY. Berlaku sama untuk kompetitor dari provider mana
 * pun (Google Places, OpenStreetMap, atau contoh/simulasi) karena hanya
 * memakai nama + alamat sebagai kata kunci pencarian. */
function googleMapsSearchUrl(name: string, address: string | null): string {
  const query = address ? `${name} ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Referensi Pelanggan Baru (Juli 2026) — string HARDCODE bahasa Indonesia
 * (lihat catatan di ALL_MENU_ITEMS.leads soal kenapa tidak lewat
 * translations.ts). Struktur mengikuti pola CompetitorPanel di atas
 * (loading/error/empty/data), ditambah satu tombol aksi "Cari Referensi
 * Baru" yang memicu batch generate baru (bukan sekadar retry riwayat). */
function LeadReferralsPanel({
  tier,
  leads,
  loading,
  error,
  onRetry,
  generating,
  generateError,
  onGenerate,
  leadQuota,
}: {
  tier: Tier;
  leads: LeadReferralItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  generating: boolean;
  generateError: string | null;
  onGenerate: () => void;
  leadQuota: number | null;
}) {
  const quotaLabel: Record<Tier, number> = { free: 1, pro: 2, platinum: 5 };
  const displayQuota = leadQuota ?? quotaLabel[tier] ?? 1;

  // Kelompokkan riwayat per batch_id supaya jelas mana "1x klik Cari
  // Referensi Baru" — batch terbaru duluan (leads sudah datang urut
  // generated_at desc dari backend/state).
  const batches: { batchId: string; items: LeadReferralItem[] }[] = [];
  for (const lead of leads) {
    const last = batches[batches.length - 1];
    if (last && last.batchId === lead.batch_id) {
      last.items.push(lead);
    } else {
      batches.push({ batchId: lead.batch_id, items: [lead] });
    }
  }

  return (
    <WorkspaceSection>
      <SectionHeader
        title="Referensi Pelanggan Baru"
        // Bugfix Juli 2026 (QA users: copy lama terlalu teknis/kaku — "dicari
        // lewat pencarian web sungguhan, bukan karangan" -- ganti jadi
        // kalimat yang lebih mudah dipahami & menarik, sekaligus menonjolkan
        // insentif upgrade sesuai quotaLabel di atas (free:1, pro:2,
        // platinum:5) tanpa mengubah cara kerja fiturnya sama sekali).
        description="Kami menemukan calon pelanggan potensial di sekitar lokasimu — hasil pencarian web nyata, bukan karangan. Upgrade ke PRO/PLATINUM buat dapat lebih banyak referensi setiap kali cari."
      />

      <WorkspaceCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Kuota paketmu: {displayQuota} referensi per pencarian</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Setiap klik "Cari Referensi Baru" menghasilkan calon pelanggan baru (maksimal {displayQuota}) — hasil
              lama tetap tersimpan di bawah.
            </p>
          </div>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Mencari..." : "Cari Referensi Baru"}
          </button>
        </div>
        {generateError && <p className="mt-3 text-xs font-semibold text-amber-300">{generateError}</p>}
      </WorkspaceCard>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : error ? (
        <ErrorCard
          title="Gagal memuat riwayat referensi"
          description="Terjadi kendala saat memuat data. Coba lagi."
          retryLabel="Coba Lagi"
          onRetry={onRetry}
        />
      ) : batches.length === 0 ? (
        <EmptyState
          variant="default"
          icon="🎯"
          title="Belum ada referensi"
          description='Klik "Cari Referensi Baru" di atas untuk mendapatkan calon pelanggan pertamamu.'
        />
      ) : (
        batches.map((batch, idx) => (
          <WorkspaceCard key={batch.batchId}>
            <h3 className="mb-3 text-sm font-bold text-white">
              {idx === 0 ? "Pencarian Terbaru" : `Pencarian ${new Date(batch.items[0].generated_at).toLocaleDateString("id-ID")}`}
            </h3>
            <div className="space-y-3">
              {batch.items.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.name}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          lead.lead_type === "company" ? "bg-primary/20 text-primary" : "bg-white/10 text-neutral-300"
                        }`}
                      >
                        {lead.lead_type === "company" ? "Perusahaan/Bisnis" : "Segmen Perorangan"}
                      </span>
                    </div>
                  </div>
                  {lead.description && <p className="mt-2 text-xs leading-relaxed text-neutral-400">{lead.description}</p>}
                  {lead.address && <p className="mt-1 text-xs text-neutral-500">📍 {lead.address}</p>}
                  {lead.source_url && (
                    <a
                      href={lead.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      🔗 Lihat sumber
                    </a>
                  )}
                </div>
              ))}
            </div>
          </WorkspaceCard>
        ))
      )}
    </WorkspaceSection>
  );
}

function SocialMediaSection({
  t,
  lang,
  tier,
  data,
  loading,
  error,
  onRetry,
  onUpgradeClick,
}: {
  t: Translations;
  lang: "id" | "en";
  tier: Tier;
  data: SocialMediaAnalysisData | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onUpgradeClick: () => void;
}) {
  const isLive = data?.socialMedia.dataSource === "live_api";
  const visibleCount = !data ? 0 : isLive ? data.socialMedia.liveRecords.length : data.socialMedia.records.length;

  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="mb-1 text-sm font-bold text-white">{t.workspace.socialMediaSectionTitle}</h3>
      <p className="mb-3 text-xs leading-relaxed text-neutral-400">{t.workspace.socialMediaSectionDesc}</p>

      {loading ? (
        <SkeletonCard variant="compact" />
      ) : error ? (
        <ErrorCard
          title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.socialMediaSectionTitle })}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetry}
        />
      ) : !data || visibleCount === 0 ? (
        <EmptyState variant="default" icon="📱" title={t.workspace.socialMediaEmptyTitle} description={t.workspace.socialMediaEmptyDesc} />
      ) : (
        <>
          {isLive ? (
            <WorkspaceCard tone="success">
              <p className="text-sm font-semibold text-emerald-300">{t.workspace.socialMediaLiveDataBadge}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.socialMediaLiveDataDesc}</p>
            </WorkspaceCard>
          ) : (
            <WorkspaceCard tone="warning">
              <p className="text-sm font-semibold text-amber-300">{t.workspace.socialMediaMockDataBadge}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.socialMediaMockDataDesc}</p>
            </WorkspaceCard>
          )}

          <WorkspaceCard className="mt-3">
            <div className="space-y-2">
              {isLive
                ? data.socialMedia.liveRecords.map((r, i) => (
                    <div key={`${r.username}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {PLATFORM_ICON[r.platform]} {r.competitorName}
                        </p>
                        <p className="text-xs text-neutral-500">@{r.username}</p>
                        <a
                          href={instagramProfileUrl(r.username)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {t.workspace.socialMediaViewProfileLabel}
                        </a>
                      </div>
                      <div className="text-right text-xs text-neutral-400">
                        {fillTemplate(t.workspace.socialMediaFollowersLabel, { count: r.followers.toLocaleString(lang === "id" ? "id-ID" : "en-US") })}
                      </div>
                    </div>
                  ))
                : data.socialMedia.records.map((r, i) => (
                    <div key={`${r.competitorName}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {PLATFORM_ICON[r.platform]} {r.competitorName}
                        </p>
                        <p className="text-xs text-neutral-500">{fillTemplate(t.workspace.socialMediaFollowersLabel, { count: r.followers.toLocaleString(lang === "id" ? "id-ID" : "en-US") })}</p>
                        <a
                          href={socialSearchUrl(r.platform, r.competitorName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          {fillTemplate(t.workspace.socialMediaSearchLinkLabel, { platform: PLATFORM_DISPLAY_NAME[r.platform] })}
                        </a>
                      </div>
                      <div className="text-right text-xs text-neutral-400">{fillTemplate(t.workspace.socialMediaEngagementLabel, { pct: String(r.engagementRatePct) })}</div>
                    </div>
                  ))}
            </div>
          </WorkspaceCard>

          {tier === "free" ? (
            <div className="mt-3">
              <UpgradeLockCard description={t.workspace.socialMediaLockedDesc} buttonLabel={t.workspace.competitorUpgradeButton} onUpgradeClick={onUpgradeClick} />
            </div>
          ) : isLive ? (
            data.socialMedia.aiSummary && (
              <div className="mt-3">
                <WorkspaceCard>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.workspace.socialMediaAiSummaryTitle}</p>
                  <p className="text-sm leading-relaxed text-neutral-200">{data.socialMedia.aiSummary}</p>
                </WorkspaceCard>
              </div>
            )
          ) : (
            data.socialMedia.insights.length > 0 && (
              <div className="mt-3 space-y-2">
                {data.socialMedia.insights.map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm leading-relaxed text-neutral-200">{insight.headline}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// Catatan: MacroPanel (halaman Ekonomi Makro berdiri sendiri) dihapus —
// digabung ke TodayPanel (revisi Juli 2026), lihat kartu "Kondisi Ekonomi
// Hari Ini" di dalam TodayPanel. MacroSnapshotData tetap dipakai sebagai
// tipe data untuk prop `macro` di TodayPanel.

// Hanya key di Translations["workspace"] yang nilainya string (bukan object/array)
// yang boleh dipakai di sini -- mencegah TS2322 kalau ada key baru berupa object
// (mis. quickStartSteps) yang bikin union type t.workspace[key] melebar ke ReactNode.
type WorkspaceStringKeys = {
  [K in keyof Translations["workspace"]]: Translations["workspace"][K] extends string ? K : never;
}[keyof Translations["workspace"]];

const INSIGHT_PRIORITY_LABEL: Record<NonNullable<FormattedInsightData["priority"]>, WorkspaceStringKeys> = {
  critical: "competitorPriorityCritical",
  high: "competitorPriorityHigh",
  medium: "competitorPriorityMedium",
  low: "competitorPriorityLow",
};

const INSIGHT_PRIORITY_STYLE: Record<NonNullable<FormattedInsightData["priority"]>, string> = {
  critical: "bg-red-500/15 text-red-300",
  high: "bg-amber-500/15 text-amber-300",
  medium: "bg-primary/15 text-primary",
  low: "bg-white/10 text-neutral-400",
};

/** Satu insight: kalimat manusia dulu (headline), lalu tombol "Lihat Data
 * Pendukung" yang membuka evidence mentah — supaya tampilan utama selalu
 * bahasa sederhana (arahan directive §BAHASA), sementara evidence tetap
 * bisa diverifikasi pengguna yang penasaran, tidak disembunyikan permanen. */
function InsightItem({ t, insight, showPriority }: { t: Translations; insight: FormattedInsightData; showPriority?: boolean }) {
  const [showEvidence, setShowEvidence] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      {showPriority && insight.priority && (
        <span className={"mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " + INSIGHT_PRIORITY_STYLE[insight.priority]}>
          {t.workspace[INSIGHT_PRIORITY_LABEL[insight.priority]]}
        </span>
      )}
      <p className="text-sm leading-relaxed text-neutral-200">{insight.headline}</p>
      <button
        onClick={() => setShowEvidence((v) => !v)}
        className="mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        {showEvidence ? t.workspace.competitorHideEvidence : t.workspace.competitorShowEvidence}
      </button>
      {showEvidence && <p className="mt-2 text-xs leading-relaxed text-neutral-500">{insight.evidenceDetail}</p>}
    </div>
  );
}

function InsightList({ t, insightList, lang }: { t: Translations; insightList: FormattedInsightData[]; lang: "id" | "en" }) {
  void lang;
  return (
    <div className="space-y-2">
      {insightList.map((insight) => (
        <InsightItem key={insight.id} t={t} insight={insight} showPriority={insight.category === "opportunity"} />
      ))}
    </div>
  );
}

function InsightGroup({
  t,
  title,
  insightList,
  lang,
  tone,
  showPriority,
}: {
  t: Translations;
  title: string;
  insightList: FormattedInsightData[];
  lang: "id" | "en";
  tone?: "success";
  showPriority?: boolean;
}) {
  void lang;
  return (
    <WorkspaceCard tone={tone}>
      <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
      <div className="space-y-2">
        {insightList.map((insight) => (
          <InsightItem key={insight.id} t={t} insight={insight} showPriority={showPriority} />
        ))}
      </div>
    </WorkspaceCard>
  );
}

type HealthTrendDimension = { first?: number; previous?: number; current: number; delta: number };
type HealthTrend = {
  journeyByDimension: Record<string, HealthTrendDimension> | null;
  periodByDimension: Record<string, HealthTrendDimension> | null;
  biggestMoverDimension: string | null;
};

type TimelineEntry =
  | { kind: "update"; date: string; update: Record<string, unknown> }
  | { kind: "achievement"; date: string; achievement: Record<string, unknown> };

/** Growth Timeline — menggabungkan riwayat Business Update (sumber yang sama
 * dengan toggle "Riwayat Update Bisnis" di bawah halaman) dengan momen
 * Achievement terbuka, diurutkan kronologis, supaya Timeline benar-benar
 * menceritakan perjalanan bisnis (Product Owner review v3 §5) — bukan cuma
 * daftar Business Update. Murni menggabung & mengurutkan data yang sudah
 * ada, tidak ada perhitungan baru. */
function GrowthTimeline({
  t,
  lang,
  updates,
  updatesLoading,
  unlockedAchievements,
  achievementsLoading,
}: {
  t: Translations;
  lang: "id" | "en";
  updates: Array<Record<string, unknown>>;
  updatesLoading: boolean;
  unlockedAchievements: Array<Record<string, unknown>>;
  achievementsLoading: boolean;
}) {
  if (updatesLoading || achievementsLoading) {
    return <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>;
  }

  const entries: TimelineEntry[] = [
    ...updates.map((u): TimelineEntry => ({ kind: "update", date: u.created_at as string, update: u })),
    ...unlockedAchievements.map(
      (a): TimelineEntry => ({ kind: "achievement", date: a.unlockedAt as string, achievement: a })
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">{t.workspace.updateHistoryEmpty}</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        if (entry.kind === "update") {
          const u = entry.update;
          return (
            <div key={`update-${u.id as string}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  {new Date(u.created_at as string).toLocaleDateString(LOCALE_MAP[lang], {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                  {u.kondisi_penjualan === "naik" ? "📈" : u.kondisi_penjualan === "turun" ? "📉" : "➡️"}
                </span>
              </div>
              <p className="text-sm text-neutral-300">{u.content as string}</p>
            </div>
          );
        }
        const a = entry.achievement;
        return (
          <div key={`achievement-${a.code as string}`} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">
                {new Date(a.unlockedAt as string).toLocaleDateString(LOCALE_MAP[lang], {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <span className="rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary">
                🏆
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              {lang === "id" ? (a.titleId as string) : (a.titleEn as string)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Settings — menjawab satu pertanyaan: "bagaimana saya mengatur Workspace
 * dan akun saya?" Murni konsolidasi UI dari aksi/data yang SUDAH ADA di
 * tempat lain (AccessStatusCard, dropdown header untuk Keluar/Hapus Bisnis,
 * setLang dari LanguageContext, ringkasan Business Score/Update/Achievement
 * yang sudah difetch Workspace()) — bukan fitur baru, tidak ada logic atau
 * fetch baru. Field yang TIDAK ada di data model (lokasi bisnis, status
 * bisnis, tanggal mulai membership) sengaja TIDAK ditampilkan, bukan
 * dikarang — konsisten dengan aturan data-honesty yang sama dipakai di
 * Target Hero Card. Edit Profil/ubah password/dll belum ada, jadi CTA-nya
 * jujur "Segera Hadir", bukan editor palsu. */
function SettingsPanel({
  t,
  lang,
  setLang,
  activeBusiness,
  activeBusinessId,
  membership,
  membershipLoading,
  tier,
  businessHealth,
  updateHistory,
  achievements,
  progressData,
  reports,
  reportsLoading,
  reportsError,
  onUpgradeClick,
  onSignOut,
  onDeleteBusiness,
}: {
  t: Translations;
  lang: "id" | "en";
  setLang: (lang: "id" | "en") => void;
  activeBusiness: BusinessProfileRow | null;
  activeBusinessId: string | null;
  membership: Membership | null;
  membershipLoading: boolean;
  tier: Tier;
  businessHealth: { dimensions: Record<string, number> | null; overall: number | null };
  updateHistory: Array<Record<string, unknown>>;
  achievements: { unlocked: Array<Record<string, unknown>>; nextMilestone: Record<string, unknown> | null };
  reports: Array<Record<string, unknown>>;
  reportsLoading: boolean;
  reportsError: boolean;
  progressData: {
    journey: { baselineScore: number; currentScore: number; delta: number } | null;
    period: { previousScore: number; currentScore: number; delta: number } | null;
  };
  onUpgradeClick: () => void;
  onSignOut: () => void;
  onDeleteBusiness: () => void;
}) {
  const latestUpdate = [...updateHistory].sort(
    (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  )[0];

  // Laporan Bulanan (Platinum-only, on-request): fetch PDF langsung dari
  // endpoint dedicated (api/generate-monthly-report.ts) — BUKAN wizard/
  // baseline report, murni narasi di atas data yang sudah dihitung Business
  // OS Engine (business_monthly_snapshot). Tombol ini hanya tampil untuk
  // tier platinum aktif; endpoint tetap menge-gate ulang di server.
  const [monthlyReportState, setMonthlyReportState] = useState<"idle" | "loading" | "error">("idle");

  async function handleDownloadMonthlyReport() {
    if (!activeBusinessId) return;
    setMonthlyReportState("loading");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMonthlyReportState("error");
        return;
      }
      const response = await fetch("/api/generate-monthly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ businessProfileId: activeBusinessId, lang }),
      });
      if (!response.ok) {
        setMonthlyReportState("error");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `THE-HIVE-Laporan-Bulanan-${activeBusiness?.business_name || "bisnis"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMonthlyReportState("idle");
    } catch (err) {
      console.error("handleDownloadMonthlyReport error:", err);
      setMonthlyReportState("error");
    }
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuSettings} description={t.workspace.settingsSectionDesc} />

      <WorkspaceCard>
        <h3 className="mb-4 text-sm font-bold text-neutral-200">{t.workspace.settingsProfileTitle}</h3>
        {activeBusiness ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-bold text-white">{activeBusiness.business_name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {t.workspace.settingsProfileIndustryLabel}: {activeBusiness.industry || t.workspace.settingsProfileIndustryEmpty}
              </p>
            </div>
            <button
              disabled
              className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-500"
            >
              {t.workspace.settingsEditProfileButton}
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">{t.workspace.settingsProfileIndustryEmpty}</p>
        )}
      </WorkspaceCard>

      <WorkspaceCard>
        <h3 className="mb-1 text-sm font-bold text-neutral-200">{t.workspace.settingsMembershipTitle}</h3>
        <p className="mb-4 text-xs italic text-neutral-500">
          {tier === "platinum"
            ? t.workspace.membershipTaglinePlatinum
            : tier === "pro"
              ? t.workspace.membershipTaglinePro
              : t.workspace.membershipTaglineFree}
        </p>
        <AccessStatusCard membership={membership} loading={membershipLoading} t={t} lang={lang} />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsMembershipTierLabel}</p>
            <p className="mt-1 text-sm font-bold text-white">{(membership?.tier || "free").toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsMembershipStatusLabel}</p>
            <p className="mt-1 text-sm font-bold text-white">
              {!membership || membership.status === "free"
                ? t.workspace.settingsMembershipStatusFree
                : membership.status === "expired"
                  ? t.workspace.settingsMembershipStatusExpired
                  : t.workspace.settingsMembershipStatusActive}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsMembershipExpiresLabel}</p>
            <p className="mt-1 text-sm font-bold text-white">
              {membership?.expiresAt ? formatDate(membership.expiresAt, lang) : t.workspace.settingsMembershipNoExpiry}
            </p>
          </div>
        </div>
        <div className="mt-4">
          {tier === "platinum" ? (
            <span className="inline-flex items-center rounded-full bg-purple-500/15 px-4 py-2 text-xs font-bold text-purple-300">
              {t.workspace.settingsMembershipActiveBadge}
            </span>
          ) : (
            <RetryButton
              label={tier === "pro" ? t.workspace.settingsUpgradeToPlatinum : t.workspace.settingsUpgradeViewPlans}
              onRetry={onUpgradeClick}
            />
          )}
        </div>
      </WorkspaceCard>

      {tier === "platinum" && (
        <WorkspaceCard>
          <h3 className="mb-1 text-sm font-bold text-neutral-200">{t.workspace.settingsMonthlyReportTitle}</h3>
          <p className="mb-4 text-xs text-neutral-500">{t.workspace.settingsMonthlyReportDesc}</p>
          <button
            onClick={handleDownloadMonthlyReport}
            disabled={monthlyReportState === "loading"}
            className="rounded-full bg-purple-500 px-5 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {monthlyReportState === "loading" ? t.workspace.settingsMonthlyReportLoading : t.workspace.settingsMonthlyReportButton}
          </button>
          {monthlyReportState === "error" && (
            <p className="mt-3 text-xs text-red-400">{t.workspace.settingsMonthlyReportError}</p>
          )}
        </WorkspaceCard>
      )}

      {/* Arsip Laporan (Task 13 — "pengaturan berisi semua data file pdf
          selama setahun, yang bisa didownload sewaktu waktu"): dibaca dari
          state `reports` yang SAMA dipakai panel Final Reports
          (loadReports() satu sumber, dipicu useEffect activeMenu ===
          "history" || "settings") — bukan fetch kedua. */}
      {tier === "platinum" && (
        <WorkspaceCard>
          <h3 className="mb-1 text-sm font-bold text-neutral-200">{t.workspace.settingsArchiveTitle}</h3>
          <p className="mb-4 text-xs text-neutral-500">{t.workspace.settingsArchiveDesc}</p>
          {reportsLoading ? (
            <SkeletonCard variant="compact" />
          ) : reportsError ? (
            <p className="text-xs text-red-400">{t.workspace.workspaceSectionErrorDesc}</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-neutral-500">{t.workspace.settingsArchiveEmpty}</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id as string} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-100">
                      {r.reportType === "baseline" ? t.workspace.settingsArchiveBaselineLabel : t.workspace.settingsArchiveExpiryLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">{formatDate(r.createdAt as string, lang)}</p>
                  </div>
                  {r.downloadUrl ? (
                    <a
                      href={r.downloadUrl as string}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-neutral-200 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      {t.workspace.finalReportsDownloadButton}
                    </a>
                  ) : (
                    <span className="cursor-not-allowed rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-500">
                      {t.workspace.finalReportsDownloadUnavailable}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </WorkspaceCard>
      )}

      <WorkspaceCard>
        <h3 className="mb-1 text-sm font-bold text-neutral-200">{t.workspace.settingsLanguageTitle}</h3>
        <p className="mb-4 text-xs text-neutral-500">{t.workspace.settingsLanguageDesc}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLang("id")}
            aria-pressed={lang === "id"}
            className={
              "rounded-full px-4 py-2.5 text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
              (lang === "id" ? "bg-primary text-black" : "border border-white/15 text-neutral-300 hover:text-white")
            }
          >
            {t.workspace.settingsLangIndonesian}
          </button>
          <button
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            className={
              "rounded-full px-4 py-2.5 text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
              (lang === "en" ? "bg-primary text-black" : "border border-white/15 text-neutral-300 hover:text-white")
            }
          >
            {t.workspace.settingsLangEnglish}
          </button>
        </div>
      </WorkspaceCard>

      <WorkspaceCard>
        <h3 className="mb-4 text-sm font-bold text-neutral-200">{t.workspace.settingsWorkspaceTitle}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsWorkspaceScoreLabel}</p>
            <p className="mt-1 text-lg font-bold text-white">
              {businessHealth.overall != null ? Math.round(businessHealth.overall) : t.workspace.settingsWorkspaceScoreEmpty}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsWorkspaceJourneyLabel}</p>
            <p className="mt-1 text-lg font-bold text-white">
              {progressData.journey ? Math.round(progressData.journey.currentScore) : t.workspace.settingsWorkspaceJourneyEmpty}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsWorkspaceUpdateLabel}</p>
            <p className="mt-1 text-lg font-bold text-white">
              {latestUpdate ? formatDate(latestUpdate.created_at as string, lang) : t.workspace.settingsWorkspaceUpdateEmpty}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsWorkspaceUpdateCountLabel}</p>
            <p className="mt-1 text-lg font-bold text-white">{updateHistory.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.workspace.settingsWorkspaceAchievementLabel}</p>
            <p className="mt-1 text-lg font-bold text-white">{achievements.unlocked.length}</p>
          </div>
        </div>
      </WorkspaceCard>

      <WorkspaceCard>
        <h3 className="mb-4 text-sm font-bold text-neutral-200">{t.workspace.settingsSecurityTitle}</h3>
        <RetryButton label={t.workspace.signOutButton} onRetry={onSignOut} />
      </WorkspaceCard>

      {activeBusiness && (
        <WorkspaceCard tone="danger">
          <h3 className="mb-4 text-sm font-bold text-neutral-200">{t.workspace.settingsAccountTitle}</h3>
          <button
            onClick={onDeleteBusiness}
            className="rounded-full bg-red-500/15 px-4 py-2.5 text-xs font-bold text-red-300 transition-colors duration-150 hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {t.workspace.deleteBusinessButton}
          </button>
        </WorkspaceCard>
      )}
    </WorkspaceSection>
  );
}

/** Business Pulse — bukan skor baru, bukan chart. Ambang sederhana atas
 * data yang sudah dihitung Business Engine (lihat services/today/computeSnapshot.ts
 * §4.2 dokumen arsitektur). Warna & kalimat dipilih dari `pulseLevel`, satu-
 * satunya "opini" yang ditambahkan adalah ambang kapan sesuatu dianggap
 * stabil/perlu perhatian — bukan angka yang dikarang. */
function pulseVisual(level: string): { emoji: string; pillClasses: string } {
  switch (level) {
    case "stable":
      return { emoji: "🟢", pillClasses: "bg-green-500/10 text-green-300" };
    case "attention":
      return { emoji: "🟡", pillClasses: "bg-amber-500/10 text-amber-300" };
    case "action_required":
      return { emoji: "🔴", pillClasses: "bg-red-500/10 text-red-300" };
    default:
      return { emoji: "🟡", pillClasses: "bg-amber-500/10 text-amber-300" };
  }
}

/** Headline/subheadline pulse & sapaan waktu — dipakai bersama oleh header
 * (Workspace()) dan TodayPanel, supaya teks "Bisnismu berjalan baik hari
 * ini" yang tampil di header besar sama persis dengan yang dipakai di
 * badan halaman Today, bukan dua sumber teks yang bisa tidak sinkron.
 *
 * pulseLevel "stable" murni berarti "data baru & tidak sedang menurun" (lihat
 * services/today/computeSnapshot.ts §4.2) — BUKAN sinyal skor tinggi. Tanpa
 * kalibrasi, bisnis dengan Business Score 50/100 bisa tetap dapat headline
 * "Bisnismu berjalan baik hari ini." yang menyesatkan (directive PO: "bukan
 * template, melainkan workspace yang hidup"). Jadi untuk level "stable",
 * teksnya dikalibrasi lagi dari skor aktual — bukan cuma dari pulseLevel. */
function pulseHeadlineText(
  t: Translations,
  level: "preparation" | "stable" | "attention" | "action_required",
  score: number | null
): string {
  if (level === "attention") return t.workspace.todayPulseHeadlineAttention;
  if (level === "action_required") return t.workspace.todayPulseHeadlineActionRequired;
  if (level === "preparation") return t.workspace.todayPulseHeadlinePreparation;
  // level === "stable"
  if (score == null) return t.workspace.todayPulseHeadlineStable;
  if (score >= 75) return t.workspace.todayPulseHeadlineStable;
  if (score >= 50) return t.workspace.todayPulseHeadlineStableMid;
  return t.workspace.todayPulseHeadlineStableLow;
}

function pulseSubheadlineText(t: Translations, level: "preparation" | "stable" | "attention" | "action_required"): string {
  return level === "stable"
    ? t.workspace.todaySubheadlineStable
    : level === "attention"
      ? t.workspace.todaySubheadlineAttention
      : level === "action_required"
        ? t.workspace.todaySubheadlineActionRequired
        : t.workspace.todaySubheadlinePreparation;
}

// Living Business Loop: label tampilan untuk stageDetail granular dari Stage
// Engine (services/stage/determineStage.ts) — murni lookup i18n, TIDAK ada
// logic penentuan stage di frontend (itu semua di backend, berbasis event).
function stageDetailLabel(t: Translations, stageDetail: string): string {
  const map: Record<string, string> = {
    idea: t.workspace.stageDetailIdea,
    validasi: t.workspace.stageDetailValidasi,
    persiapan: t.workspace.stageDetailPersiapan,
    supplier: t.workspace.stageDetailSupplier,
    legalitas: t.workspace.stageDetailLegalitas,
    branding: t.workspace.stageDetailBranding,
    marketing: t.workspace.stageDetailMarketing,
    soft_opening: t.workspace.stageDetailSoftOpening,
    grand_opening: t.workspace.stageDetailGrandOpening,
    operasional: t.workspace.stageDetailOperasional,
    growth: t.workspace.stageDetailGrowth,
    stabil: t.workspace.stageDetailStabil,
    bertumbuh: t.workspace.stageDetailBertumbuh,
    optimasi: t.workspace.stageDetailOptimasi,
    ekspansi: t.workspace.stageDetailEkspansi,
    scale: t.workspace.stageDetailScale,
    systemize: t.workspace.stageDetailSystemize,
  };
  return map[stageDetail] || stageDetail;
}

// Round 2 GAPTEK review (kolaborasi GPT, difilter user 17 Juli 2026): badge
// "Tahap: X" saja belum tentu dipahami user gaptek -- satu kalimat penjelas
// pendek per tahap, ditampilkan kecil di bawah badge. Fallback string kosong
// (bukan stageDetail mentah) kalau tahapnya tidak dikenali -- lebih baik
// tidak menampilkan apa pun daripada menampilkan kode internal ke user.
function stageDetailDescription(t: Translations, stageDetail: string): string {
  const map: Record<string, string> = {
    idea: t.workspace.stageDetailDescIdea,
    validasi: t.workspace.stageDetailDescValidasi,
    persiapan: t.workspace.stageDetailDescPersiapan,
    supplier: t.workspace.stageDetailDescSupplier,
    legalitas: t.workspace.stageDetailDescLegalitas,
    branding: t.workspace.stageDetailDescBranding,
    marketing: t.workspace.stageDetailDescMarketing,
    soft_opening: t.workspace.stageDetailDescSoftOpening,
    grand_opening: t.workspace.stageDetailDescGrandOpening,
    operasional: t.workspace.stageDetailDescOperasional,
    growth: t.workspace.stageDetailDescGrowth,
    stabil: t.workspace.stageDetailDescStabil,
    bertumbuh: t.workspace.stageDetailDescBertumbuh,
    optimasi: t.workspace.stageDetailDescOptimasi,
    ekspansi: t.workspace.stageDetailDescEkspansi,
    scale: t.workspace.stageDetailDescScale,
    systemize: t.workspace.stageDetailDescSystemize,
  };
  return map[stageDetail] || "";
}

function greetingPrefix(t: Translations): string {
  // new Date().getHours() sudah otomatis mengikuti timezone lokal browser
  // pengguna (bukan server) — jadi "Selamat pagi/siang/sore/malam" ini
  // sudah sesuai waktu setempat pengguna tanpa perlu logic tambahan.
  const hour = new Date().getHours();
  if (hour < 11) return t.workspace.todayGreetingMorning;
  if (hour < 15) return t.workspace.todayGreetingAfternoon;
  if (hour < 19) return t.workspace.todayGreetingEvening;
  return t.workspace.todayGreetingNight;
}

/** Sapaan personal header Today: "{Salam}, {Nama}{, Profesi} - {NamaBisnis}!"
 * — nama/profesi opsional (fallback jujur ke email/nama bisnis kalau kosong,
 * bukan mengarang), supaya workspace terasa hidup bukan template statis. */
function personalGreeting(
  t: Translations,
  opts: { nama: string; profesi: string; businessName: string; fallbackName: string }
): string {
  const prefix = greetingPrefix(t);
  const namePart = opts.nama || opts.fallbackName;
  const profesiPart = opts.profesi ? `, ${opts.profesi}` : "";
  const businessPart = opts.businessName ? ` - ${opts.businessName}` : "";
  return `${prefix} ${namePart}${profesiPart}${businessPart}! 👋`;
}

/** Label waktu relatif untuk item lonceng Notifikasi — reuse
 * t.workspace.todayDaysAgo ("{days} hari lalu") yang sudah ada, supaya
 * tidak ada dua definisi "X hari lalu" berbeda. Di bawah 1 hari dianggap
 * "baru saja", tidak dipecah ke jam/menit (tidak perlu presisi setinggi
 * itu untuk notifikasi ringkasan). */
function relativeTimeLabel(timestamp: string, t: Translations): string {
  const days = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return t.workspace.notificationsJustNow;
  return fillTemplate(t.workspace.todayDaysAgo, { days });
}

type RuleItem = { key: string; params?: Record<string, string | number>; whyKey?: string };

type TodaySnapshotPayload = {
  stageGroup: "preparation" | "running";
  // Living Business Loop: stage rinci (11 langkah start / 6 langkah grow)
  // dari Stage Engine — string bebas (bukan union ketat di FE) supaya daftar
  // stage bisa berkembang tanpa menyentuh tipe frontend setiap kali.
  stageDetail: string;
  pulseLevel: "preparation" | "stable" | "attention" | "action_required";
  pulseReasons: Array<{ key: string; params?: Record<string, string | number> }>;
  score: number | null;
  journeyDelta: number | null;
  // periodDelta & lastUpdateAt sudah lama dikirim backend (lihat
  // services/today/computeSnapshot.ts) tapi belum tercermin di tipe FE ini —
  // ditambahkan di sini murni supaya UI bisa memakai data yang sudah ada
  // (trend Business Score, tanggal update persis), bukan field baru.
  periodDelta: number | null;
  daysSinceUpdate: number | null;
  lastUpdateAt: string | null;
  priorities: RuleItem[];
  topRisk: RuleItem | null;
  opportunity: RuleItem | null;
  whatChanged: Array<{ dimension: string; delta: number }> | null;
  nextMilestone: { titleId: string; titleEn: string; remaining: number; unitId: string; unitEn: string } | null;
  // Business OS Engine — peluang bersumber Competitor Engine (Evidence/
  // Reason/Action teks bebas per-kompetitor, pengecualian yang sudah
  // dijustifikasi sejak Living Business Loop) + target minggu/bulan ini.
  competitorOpportunity: { title: string; reason: string; action: string; evidence: string } | null;
  targetThisWeek: string | null;
  targetThisMonth: string | null;
};

// Business OS Engine — Weekly Review: rekap rule-based 7-hari-berjalan,
// di-cache backend (business_weekly_review), murni ditampilkan di sini.
type WeeklyReviewPayload = {
  weekStart: string;
  weekEnd: string;
  targetsCompleted: number;
  decisionsMade: number;
  scoreDelta: number | null;
  newOpportunities: number;
  newRisks: number;
};

// Urutan ini mengikuti directive "Business Discovery & Dual Workspace" —
// mission mentor membuka usaha (Cari supplier -> Pelajari regulasi ->
// Analisa lokasi -> Bandingkan franchise -> Hitung modal -> Google Business
// -> nama/logo -> Soft Opening -> Grand Opening -> harga jual). Ini panduan
// umum yang berlaku untuk semua jenis usaha baru — bukan data yang dikarang
// spesifik untuk satu bisnis (data honesty tetap utuh: ini saran langkah,
// bukan klaim fakta).
const PREPARATION_CHECKLIST_KEYS = [
  "prep1",
  "prep2",
  "prep3",
  "prep4",
  "prep5",
  "prep6",
  "prep7",
  "prep8",
  "prep9",
  "prep10",
] as const;
const RUNNING_CHECKLIST_KEYS = ["run1", "run2", "run3", "run4", "run5", "run6", "run7"] as const;

// Sama persis dengan services/business/checklistDimensionMap.ts (backend,
// yang benar-benar menghitung skor) — salinan di sini MURNI untuk
// menampilkan ikon dimensi di sebelah tiap checklist, supaya user langsung
// lihat korelasinya ("centang ini -> dimensi ini yang bergerak"), bukan
// sumber perhitungan. run4 sengaja tidak dipetakan (lihat catatan backend).
const CHECKLIST_DIMENSION_DISPLAY: Record<string, string> = {
  run1: "customer",
  run2: "finance",
  run3: "operations",
  run5: "operations",
  run6: "marketing",
  run7: "brand",
};

function checklistLabel(t: Translations, key: string): string {
  const map: Record<string, string> = {
    prep1: t.workspace.todayChecklistPrep1,
    prep2: t.workspace.todayChecklistPrep2,
    prep3: t.workspace.todayChecklistPrep3,
    prep4: t.workspace.todayChecklistPrep4,
    prep5: t.workspace.todayChecklistPrep5,
    prep6: t.workspace.todayChecklistPrep6,
    prep7: t.workspace.todayChecklistPrep7,
    prep8: t.workspace.todayChecklistPrep8,
    prep9: t.workspace.todayChecklistPrep9,
    prep10: t.workspace.todayChecklistPrep10,
    run1: t.workspace.todayChecklistRun1,
    run2: t.workspace.todayChecklistRun2,
    run3: t.workspace.todayChecklistRun3,
    run4: t.workspace.todayChecklistRun4,
    run5: t.workspace.todayChecklistRun5,
    run6: t.workspace.todayChecklistRun6,
    run7: t.workspace.todayChecklistRun7,
  };
  return map[key] || key;
}

/** Rencana Aksi Beemo (Phase 3) — label hari untuk dayOffset (0 = hari ini),
 * dipakai untuk mengelompokkan item rencana di TodayPanel. Murni presentasi,
 * bukan tanggal kalender sungguhan (rencana dibuat relatif terhadap kapan
 * di-generate, bukan dijadwalkan ulang tiap tengah malam). */
function actionPlanDayLabel(t: Translations, dayOffset: number): string {
  if (dayOffset === 0) return t.workspace.actionPlanDayToday;
  if (dayOffset === 1) return t.workspace.actionPlanDayTomorrow;
  if (dayOffset === 2) return t.workspace.actionPlanDayAfterTomorrow;
  return fillTemplate(t.workspace.actionPlanDayInNDays, { n: dayOffset });
}

/** TODAY — halaman utama Business Command Center (Fase 1). Tidak menghitung
 * apapun sendiri: seluruh angka datang dari today_snapshot (Today Engine),
 * yang membaca Business Engine lewat service yang sudah ada. Lihat
 * THE-HIVE-BUSINESS-COMMAND-CENTER-ARCHITECTURE.md §4/§7 untuk rancangan
 * lengkap — halaman ini adalah versi Fase 1 (tanpa AI Insight, tanpa
 * checklist interaktif persisten; itu menyusul Fase 2/8 setelah review). */
function TodayPanel({
  t,
  lang,
  businessProfileId,
  businessType,
  snapshot,
  snapshotLoading,
  snapshotError,
  onRetrySnapshot,
  onOpenUpdateModal,
  onNavigateToInsights,
  onOpenChat,
  onOpenCompetitor,
  scoreHistory,
  macro,
  macroLoading,
  macroError,
  onRetryMacro,
  actionPlanItems,
  actionPlanLoading,
  actionPlanError,
  onRegenerateActionPlan,
  onToggleActionPlanItem,
}: {
  t: Translations;
  lang: "id" | "en";
  businessProfileId: string;
  // Journey stepper (revisi Juli 2026): bisnis baru ("start", belum buka)
  // vs bisnis eksisting ("grow", sudah berjalan) harus start dari titik
  // journey yang berbeda — lihat currentJourneyIndex di bawah.
  businessType: "start" | "grow";
  snapshot: TodaySnapshotPayload | null;
  snapshotLoading: boolean;
  snapshotError: boolean;
  onRetrySnapshot: () => void;
  onOpenUpdateModal: () => void;
  onNavigateToInsights: () => void;
  onOpenChat: () => void;
  // Business OS Engine: cross-linking — Peluang Kompetitor di kartu kanan
  // bisa diklik langsung menuju tab Kompetitor ("satu cerita terhubung"),
  // BUKAN UI/halaman baru — hanya navigasi ke tab yang sudah ada.
  onOpenCompetitor: () => void;
  // Grafik Performa (revisi Juli 2026): data asli dari today_snapshot
  // harian, bukan dummy SVG lagi.
  scoreHistory: Array<{ date: string; score: number | null }>;
  // Ekonomi Makro (revisi Juli 2026): digabung ke Today, halaman terpisah
  // dihapus — indikator + insight ditampilkan ringkas di sini.
  macro: MacroSnapshotData | null;
  macroLoading: boolean;
  macroError: boolean;
  onRetryMacro: () => void;
  // Rencana Aksi Beemo (Phase 3): rencana multi-hari AI-generated, terpisah
  // dari Mission Today (rule engine, hari ini saja) di atas — lihat
  // services/workspace/actionPlan/*.ts.
  actionPlanItems: ActionPlanItemData[];
  actionPlanLoading: boolean;
  actionPlanError: string | null;
  onRegenerateActionPlan: () => void;
  onToggleActionPlanItem: (itemId: string, completed: boolean) => void;
}) {
  const { session } = useAuth();
  const [missionDone, setMissionDone] = useState(false);
  // Living Business Loop: checklist SEKARANG persisten di backend
  // (business_checklist_progress) — dimuat sekali per bisnis, dan setiap
  // toggle memicu Today Snapshot forceRecompute (Stage/Mission ikut
  // berubah), bukan lagi state lokal yang hilang saat reload.
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadChecklistProgress() {
      if (!businessProfileId || !session?.access_token) return;
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "getChecklistProgress", businessProfileId }),
        });
        const json = await response.json();
        if (!cancelled && response.ok) {
          setCheckedItems(new Set((json.completedKeys as string[]) || []));
        }
      } catch (err) {
        console.error("getChecklistProgress error:", err);
      }
    }
    loadChecklistProgress();
    return () => {
      cancelled = true;
    };
  }, [businessProfileId, session?.access_token]);

  async function toggleChecklistItem(key: string) {
    const wasCompleted = checkedItems.has(key);
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    if (!session?.access_token) return;
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "toggleChecklistItem", businessProfileId, itemKey: key, completed: !wasCompleted }),
      });
      if (response.ok) {
        // Event Pipeline: checklist ikut memicu Stage/Mission recompute di
        // backend — muat ulang snapshot supaya Workspace ikut berubah SAAT
        // ITU JUGA, bukan menunggu buka halaman lain.
        onRetrySnapshot();
      } else {
        // Gagal tersimpan di server — kembalikan tampilan ke kondisi semula
        // supaya tidak menampilkan status yang tidak benar-benar tersimpan.
        setCheckedItems((prev) => {
          const next = new Set(prev);
          if (wasCompleted) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    } catch (err) {
      console.error("toggleChecklistItem error:", err);
    }
  }

  // Error state — kalau getTodaySnapshot gagal dimuat, JANGAN diam di
  // skeleton selamanya, dan JANGAN lanjut render kartu Reminder (yang kalau
  // dipaksa render tanpa data akan salah menampilkan badge "Aman", padahal
  // sebenarnya gagal dimuat, bukan benar-benar aman). Tombol "Coba Lagi"
  // hanya reload snapshot ini saja (lihat reloadTodaySnapshot di Workspace()),
  // bukan seluruh halaman.
  if (snapshotError && !snapshotLoading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/5 p-10 text-center">
        <div className="mb-3 text-2xl" aria-hidden="true">⚠️</div>
        <p className="text-base font-bold text-neutral-100">{t.workspace.todaySnapshotErrorTitle}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
          {t.workspace.todaySnapshotErrorDesc}
        </p>
        <button
          onClick={onRetrySnapshot}
          className="mt-5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-black transition-transform duration-200 hover:scale-[1.03] hover:opacity-90 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {t.workspace.todaySnapshotRetryButton}
        </button>
      </div>
    );
  }

  if (snapshotLoading || !snapshot) {
    // Loading skeleton, bukan teks "Memuat data..." polos — supaya transisi
    // ke konten asli terasa hidup (micro-interaction), bukan kedip mendadak.
    return (
      <div className="animate-pulse space-y-6" aria-label={t.workspace.loadingDataLabel}>
        <div className="space-y-3">
          <div className="h-5 w-28 rounded-full bg-white/10" />
          <div className="h-10 w-3/4 rounded-lg bg-white/10 sm:w-1/2" />
          <div className="h-4 w-2/3 rounded-lg bg-white/5" />
        </div>
        <div className="h-28 rounded-2xl bg-white/5" />
        <div className="h-16 rounded-2xl bg-white/5" />
      </div>
    );
  }

  const pulse = pulseVisual(snapshot.pulseLevel);
  const pulseLabel =
    snapshot.pulseLevel === "stable"
      ? t.workspace.todayPulseStable
      : snapshot.pulseLevel === "attention"
        ? t.workspace.todayPulseAttention
        : snapshot.pulseLevel === "action_required"
          ? t.workspace.todayPulseActionRequired
          : t.workspace.todayPulsePreparation;
  function reasonText(reason: { key: string; params?: Record<string, string | number> }): string {
    const template =
      reason.key === "neverUpdated"
        ? t.workspace.todayReasonNeverUpdated
        : reason.key === "updateOverdue"
          ? t.workspace.todayReasonUpdateOverdue
          : reason.key === "scoreDown"
            ? t.workspace.todayReasonScoreDown
            : reason.key === "scoreUp"
              ? t.workspace.todayReasonScoreUp
              : "";
    return reason.params ? fillTemplate(template, reason.params) : template;
  }

  const nextMilestoneText = snapshot?.nextMilestone
    ? fillTemplate(t.workspace.growthNextMilestoneTemplate, {
        remaining: snapshot.nextMilestone.remaining,
        unit: lang === "id" ? snapshot.nextMilestone.unitId : snapshot.nextMilestone.unitEn,
        title: lang === "id" ? snapshot.nextMilestone.titleId : snapshot.nextMilestone.titleEn,
      })
    : t.workspace.growthNextMilestoneNone;

  // Prioritas — semua rule-based dari Today Engine (§ komentar di
  // computeSnapshot.ts). "achievementNudge" sengaja ambil teksnya dari
  // nextMilestoneText yang sudah dihitung di atas, bukan dari params sendiri,
  // supaya tidak ada data achievement yang diduplikasi/tidak sinkron.
  function priorityText(item: { key: string; params?: Record<string, string | number> }): string {
    if (item.key === "achievementNudge") return nextMilestoneText;
    const params = { ...item.params };
    if (item.key === "focusWeakDimension" && params.dimension) {
      params.dimension = DIMENSION_LABELS[params.dimension as string]?.[lang] || (params.dimension as string);
    }
    const template =
      item.key === "startFirstUpdate"
        ? t.workspace.todayFocusStartFirstUpdate
        : item.key === "fillBusinessUpdate"
          ? t.workspace.todayFocusFillBusinessUpdate
          : item.key === "inactivityWarning"
            ? t.workspace.todayFocusInactivityWarning
            : item.key === "neverUpdatedYet"
              ? t.workspace.todayFocusNeverUpdatedYet
              : item.key === "celebrateAchievement"
              ? t.workspace.todayFocusCelebrateAchievement
              : item.key === "decisionFollowUp"
                ? t.workspace.todayFocusDecisionFollowUp
                : item.key === "targetStalled"
                  ? t.workspace.todayFocusTargetStalled
                  : item.key === "newCompetitorDetected"
                    ? t.workspace.todayFocusNewCompetitorDetected
                    : item.key === "focusWeakDimension"
                      ? t.workspace.todayFocusWeakDimension
                      : t.workspace.todayFocusKeepGoing;
    return fillTemplate(template, params);
  }

  function riskText(item: { key: string; params?: Record<string, string | number> } | null): string {
    if (!item) return t.workspace.todayRiskNone;
    const params = { ...item.params };
    if (item.key === "riskWeakDimension" && params.dimension) {
      params.dimension = DIMENSION_LABELS[params.dimension as string]?.[lang] || (params.dimension as string);
    }
    const template =
      item.key === "riskUpdateOverdue"
        ? t.workspace.todayRiskUpdateOverdue
        : item.key === "riskScoreDown"
          ? t.workspace.todayRiskScoreDown
          : t.workspace.todayRiskWeakDimension;
    return fillTemplate(template, params);
  }

  function opportunityText(item: { key: string } | null): string | null {
    if (!item) return null;
    const map: Record<string, string> = {
      opportunityMarketing: t.workspace.opportunityMarketing,
      opportunitySales: t.workspace.opportunitySales,
      opportunityFinance: t.workspace.opportunityFinance,
      opportunityCustomer: t.workspace.opportunityCustomer,
      opportunityOperations: t.workspace.opportunityOperations,
      opportunityBrand: t.workspace.opportunityBrand,
      opportunityGeneric: t.workspace.opportunityGeneric,
    };
    return map[item.key] || null;
  }

  const isPreparation = snapshot.stageGroup === "preparation";
  const lastUpdateText =
    snapshot.daysSinceUpdate === null
      ? t.workspace.todayQuickStatsNever
      : snapshot.daysSinceUpdate === 0
        ? t.workspace.todayLastUpdateToday
        : fillTemplate(t.workspace.todayDaysAgo, { days: snapshot.daysSinceUpdate });

  const checklistKeys = isPreparation ? PREPARATION_CHECKLIST_KEYS : RUNNING_CHECKLIST_KEYS;
  const checklistDoneCount = checklistKeys.filter((k) => checkedItems.has(k)).length;

  // Prioritas fase persiapan bukan dari Today Engine (yang cuma tahu
  // "startFirstUpdate") — checklist itemnya SENDIRI yang jadi daftar
  // prioritas, supaya tidak ada 2 sumber "apa yang harus dikerjakan" yang
  // tumpang tindih untuk pelanggan baru.
  const priorityLines: string[] = isPreparation
    ? checklistKeys.slice(0, 3).map((k) => checklistLabel(t, k))
    : snapshot.priorities.map((p) => priorityText(p));

  // "Insight dari Beemo" — BUKAN teks AI. Murni menyusun ulang whatChanged
  // (data getHealthTrend yang sudah ada) jadi satu kalimat, memakai i18n key
  // todayBiggestMoverTemplate yang sudah ada sejak versi sebelumnya. Kalau
  // belum ada perbandingan sama sekali, jatuh ke nextMilestone, baru ke
  // pesan kosong yang jujur (bukan mengarang insight).
  let biggestMoverInsight: string = t.workspace.todayInsightEmpty;
  if (snapshot.whatChanged && snapshot.whatChanged.length > 0) {
    const biggest = snapshot.whatChanged.reduce(
      (max, c) => (Math.abs(c.delta) > Math.abs(max.delta) ? c : max),
      snapshot.whatChanged[0]
    );
    const dimLabel = DIMENSION_LABELS[biggest.dimension]?.[lang] || biggest.dimension;
    biggestMoverInsight = fillTemplate(t.workspace.todayBiggestMoverTemplate, { dimension: dimLabel });
  } else if (snapshot.nextMilestone) {
    biggestMoverInsight = nextMilestoneText;
  }

  // Reminder — UI selalu punya 3 slot mengikuti struktur mockup, walau Rule
  // Engine saat ini cuma menghasilkan maksimal 1 sinyal risiko (topRisk).
  // Slot yang tidak ada datanya ditandai jujur sebagai kosong ("Belum ada
  // pengingat tambahan"), BUKAN diisi pengingat karangan.
  const reminderSlots: Array<{ text: string; badge: string; badgeColor: string; empty: boolean }> = [];
  if (snapshot.topRisk) {
    const badge =
      snapshot.topRisk.key === "riskUpdateOverdue"
        ? { label: t.workspace.todayReminderBadgeUrgent, color: "bg-red-500/15 text-red-300" }
        : snapshot.topRisk.key === "riskScoreDown"
          ? { label: t.workspace.todayReminderBadgeFocus, color: "bg-amber-500/15 text-amber-300" }
          : { label: t.workspace.todayReminderBadgeWatch, color: "bg-blue-500/15 text-blue-300" };
    reminderSlots.push({ text: riskText(snapshot.topRisk), badge: badge.label, badgeColor: badge.color, empty: false });
  } else {
    reminderSlots.push({
      text: t.workspace.todayRiskNone,
      badge: t.workspace.todayReminderBadgeSafe,
      badgeColor: "bg-green-500/15 text-green-300",
      empty: false,
    });
  }
  while (reminderSlots.length < 3) {
    reminderSlots.push({ text: t.workspace.todayReminderEmptySlot, badge: "", badgeColor: "", empty: true });
  }

  // Journey stepper — Business Stage Engine v1 baru bisa membedakan 2 fase
  // (preparation/running), belum 8 fase penuh dari roadmap. Supaya tidak
  // mengarang tahu-persis di fase mana pengguna berada, node ke-2 dst untuk
  // fase "running" ditandai sebagai titik AWAL yang sudah pasti terlewati
  // (bukan klaim presisi), dan sisanya ditandai "upcoming" apa adanya —
  // sesuai arahan eksplisit: placeholder visual boleh, data tidak boleh
  // dikarang.
  const JOURNEY_STAGES = [
    t.workspace.todayJourneyStagePreparation,
    t.workspace.todayJourneyStageSoftOpening,
    t.workspace.todayJourneyStageLaunching,
    t.workspace.todayJourneyStageOperational,
    t.workspace.todayJourneyStageGrowth,
    t.workspace.todayJourneyStageScaleUp,
    t.workspace.todayJourneyStageSystemizing,
    t.workspace.todayJourneyStageAutomation,
  ];
  // Revisi Juli 2026: bisnis "start" (belum buka/baru buka) tetap mulai
  // dari node pertama (Persiapan) kalau memang masih fase persiapan.
  // Bisnis "grow" (sudah eksis sebelum daftar ke platform) TIDAK pernah
  // benar-benar di fase Persiapan/Soft Opening/Launching secara nyata —
  // titik paling jujur untuk mereka adalah "Operasional" (index 3), bukan
  // index 1 yang menyiratkan mereka baru saja soft-opening.
  const currentJourneyIndex = isPreparation ? 0 : businessType === "grow" ? 3 : 1;

  // Grafik Performa (revisi Juli 2026) — dulu dummy SVG statis berlabel
  // "Preview", sekarang memakai scoreHistory asli dari today_snapshot.
  // JUJUR soal jumlah data: bisnis baru yang baru punya 1-2 hari data tidak
  // dipaksa tampil seolah 7 hari penuh — kalau kurang dari 2 titik, tampilkan
  // pesan "belum cukup data" alih-alih chart kosong/karangan.
  const chartPoints = scoreHistory.filter((h): h is { date: string; score: number } => h.score !== null);
  const hasChartData = chartPoints.length >= 2;
  let chartPolylinePoints = "";
  let chartPolygonPoints = "";
  let chartDotX = 0;
  let chartDotY = 0;
  if (hasChartData) {
    const scores = chartPoints.map((p) => p.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;
    const stepX = 300 / (chartPoints.length - 1);
    const coords = chartPoints.map((p, i) => ({
      x: i * stepX,
      y: 95 - ((p.score - minScore) / range) * 80,
    }));
    chartPolylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    chartPolygonPoints = `0,110 ${chartPolylinePoints} ${coords[coords.length - 1].x.toFixed(1)},110`;
    chartDotX = coords[coords.length - 1].x;
    chartDotY = coords[coords.length - 1].y;
  }

  // Ringkasan Perkembangan (revisi Juli 2026, gantikan "Prioritas Minggu
  // Ini" yang tadinya cuma daftar tugas) — "harian" dari 2 titik terakhir
  // scoreHistory, "mingguan" dari periodDelta yang sudah dihitung Today
  // Engine (progress.period). Null jujur kalau data pembanding belum ada.
  const dailyScoreDelta =
    chartPoints.length >= 2 ? chartPoints[chartPoints.length - 1].score - chartPoints[chartPoints.length - 2].score : null;

  return (
    <div className="space-y-8">
      {/* Catatan: headline "Bisnismu berjalan baik hari ini" dkk sudah
          ditampilkan di header bersama (lihat Workspace(), memakai
          pulseHeadlineText yang sama persis), supaya tidak dobel dengan
          badan halaman ini. */}
      {/* Baris metrik — 5 kartu ringkas berdampingan, semua angka dari
          today_snapshot yang sama, hanya disusun ulang secara visual. Target
          Bulan Ini sengaja ditampilkan sebagai placeholder kosong yang jujur
          (belum ada angka target di Business Engine), bukan dikarang. */}
      {/* Semua kartu metrik pakai struktur 3-baris yang sama persis (label /
          nilai / baris sekunder yang SELALU dirender, walau kosong berupa
          spasi) supaya tinggi & alignment vertikal identik — tidak ada
          kartu yang "naik turun sendiri" dibanding yang lain. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-4" style={{ minHeight: 128 }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayPulseLabel}</p>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${pulse.pillClasses}`}>
              <span aria-hidden="true">{pulse.emoji}</span> {pulseLabel}
            </span>
          </div>
          <p className="mt-auto pt-2 text-[11px] leading-snug text-neutral-500">
            {snapshot.pulseReasons.length > 0
              ? snapshot.pulseReasons.map((r) => reasonText(r)).join(" · ")
              : pulseSubheadlineText(t, snapshot.pulseLevel)}
          </p>
        </div>
        <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-4" style={{ minHeight: 128 }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsScore}</p>
          <p className="mt-3 text-2xl font-black text-white">
            {snapshot.score ?? "—"}
            <span className="text-xs font-normal text-neutral-500">/100</span>
          </p>
          <p
            className={`mt-auto pt-2 text-[11px] font-semibold ${
              snapshot.periodDelta === null
                ? "text-neutral-600"
                : snapshot.periodDelta > 0
                  ? "text-green-400"
                  : snapshot.periodDelta < 0
                    ? "text-red-400"
                    : "text-neutral-500"
            }`}
          >
            {snapshot.periodDelta !== null
              ? fillTemplate(snapshot.periodDelta >= 0 ? t.workspace.todayReasonScoreUp : t.workspace.todayReasonScoreDown, {
                  points: Math.abs(snapshot.periodDelta),
                })
              : " "}
          </p>
        </div>
        <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-4" style={{ minHeight: 128 }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsJourney}</p>
          <p className="mt-3 text-2xl font-black text-white">
            {snapshot.journeyDelta !== null ? `${snapshot.journeyDelta > 0 ? "+" : ""}${snapshot.journeyDelta}` : "—"}
          </p>
          <p className="mt-auto truncate pt-2 text-[11px] text-neutral-500">
            {snapshot.journeyDelta !== null ? t.workspace.todayJourneyPointsSuffix + " · " : ""}
            {isPreparation ? t.workspace.todayStageBadgePreparation : t.workspace.todayStageBadgeRunning}
          </p>
        </div>
        <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-4" style={{ minHeight: 128 }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayMetricTargetLabel}</p>
          <p className="mt-3 text-sm font-bold text-neutral-500">{t.workspace.todayMetricTargetEmpty}</p>
          <p className="mt-auto pt-2 text-[11px] text-neutral-600">{" "}</p>
        </div>
        <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-4" style={{ minHeight: 128 }}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsLastUpdate}</p>
          <p className="mt-3 text-sm font-bold text-white">{lastUpdateText}</p>
          <p className="mt-auto truncate pt-2 text-[11px] text-neutral-600">
            {snapshot.lastUpdateAt ? formatDate(snapshot.lastUpdateAt, lang) : " "}
          </p>
        </div>
      </div>

      {/* Dua kolom: Mission Today + Checklist/Perubahan/Prioritas di kiri,
          Insight/Opportunity/Reminder di kanan. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Mission Today — kartu terbesar di halaman, memuat priorities[0]
              dari Rule Engine (bukan konsep baru, cuma disorot lebih besar). */}
          <div className="relative flex min-h-[380px] items-center justify-between gap-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-8 shadow-[0_0_28px_-10px_rgba(255,152,0,0.18)] sm:p-10">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                🎯 {t.workspace.todayMissionBadge}
              </span>
              <h2 className="mt-4 text-2xl font-black leading-snug text-white sm:text-3xl md:text-4xl">
                {priorityLines[0] || t.workspace.todayFocusKeepGoing}
              </h2>
              {snapshot.pulseReasons.length > 0 && (
                <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-400">
                  {snapshot.pulseReasons.map((r) => reasonText(r)).join(" · ")}
                </p>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={onOpenUpdateModal}
                  disabled={missionDone}
                  className="rounded-2xl bg-primary px-6 py-3 text-base font-bold text-black shadow-[0_0_24px_-6px_rgba(255,152,0,0.6)] transition-transform duration-200 hover:scale-[1.03] hover:opacity-90 disabled:opacity-40 disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  {isPreparation ? t.workspace.updateBusinessButton : t.workspace.todayMissionStartButton}
                </button>
                {!isPreparation && (
                  <button
                    onClick={() => setMissionDone((v) => !v)}
                    className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-neutral-300 transition-colors duration-200 hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    ✅ {t.workspace.todayMissionDoneButton}
                  </button>
                )}
              </div>
              {missionDone && <p className="mt-3 text-xs text-neutral-500">{t.workspace.todayMissionDoneNote}</p>}
            </div>
            {/* Beemo — Hero Character, bukan ikon kecil. Ukuran & posisi
                disengaja besar & sedikit keluar ke kanan supaya jadi focal
                point pertama sebelum tombol aksi. Glow dibuat lembut & blur
                lebih kecil (blur-2xl, bukan blur-3xl) supaya tetap terasa
                premium tanpa filter yang berat di perangkat menengah. */}
            <div
              className="relative hidden flex-shrink-0 items-center justify-center sm:flex sm:-mr-2 sm:translate-x-3"
              style={{ width: 280, height: 300 }}
            >
              <div className="absolute inset-0 rounded-full bg-primary/15 blur-2xl" aria-hidden="true" />
              <img
                src={beemoMascot}
                alt=""
                className="relative z-10 h-full w-full object-contain drop-shadow-[0_6px_18px_rgba(255,152,0,0.25)]"
              />
              {/* Progress Hari Ini — mengisi ruang kosong di sisi kanan
                  dengan data yang SUDAH nyata (checklist, bukan estimasi
                  durasi/dampak yang dikarang), supaya komposisi seimbang
                  tanpa menambah klaim baru. */}
              <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] font-semibold text-neutral-200">
                {fillTemplate(t.workspace.todayChecklistCount, { done: checklistDoneCount, total: checklistKeys.length })}
              </div>
            </div>
          </div>

          {/* Rencana Aksi Beemo (Phase 3, directive PO: "user tau apa saja
              yang harus dilakukan hari ini, besok, lusa dst... jadi kita
              benar2 menjadi mentor") — AI-generated, multi-hari, terpisah
              dari Mission Today di atas (rule engine, hari ini saja). Lihat
              services/workspace/actionPlan/*.ts. Ditaruh langsung setelah
              Mission Today (bukan tab terpisah) supaya jadi hal kedua yang
              dilihat pengguna begitu buka Workspace. */}
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">🗓️ {t.workspace.actionPlanTitle}</h3>
                <p className="mt-1 text-sm text-neutral-500">{t.workspace.actionPlanSubtitle}</p>
              </div>
              {actionPlanItems.length > 0 && (
                <button
                  onClick={onRegenerateActionPlan}
                  disabled={actionPlanLoading}
                  className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionPlanLoading ? t.workspace.actionPlanRegenerating : t.workspace.actionPlanRegenerateButton}
                </button>
              )}
            </div>

            {actionPlanLoading && actionPlanItems.length === 0 ? (
              <div className="space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-neutral-100" />
                <p className="pt-2 text-xs text-neutral-400">{t.workspace.actionPlanGenerating}</p>
              </div>
            ) : actionPlanError && actionPlanItems.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {actionPlanError}{" "}
                <button onClick={onRegenerateActionPlan} className="font-semibold underline">
                  {t.workspace.actionPlanRetryButton}
                </button>
              </div>
            ) : actionPlanItems.length === 0 ? (
              <p className="text-sm text-neutral-500">{t.workspace.actionPlanEmpty}</p>
            ) : (
              <div className="space-y-4">
                {Array.from(new Set(actionPlanItems.map((it) => it.day_offset)))
                  .sort((a, b) => a - b)
                  .map((dayOffset) => {
                    const dayItems = actionPlanItems.filter((it) => it.day_offset === dayOffset);
                    return (
                      <div key={dayOffset}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
                          {actionPlanDayLabel(t, dayOffset)}
                        </p>
                        <ul className="space-y-2">
                          {dayItems.map((item) => (
                            <li key={item.id} className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                              <button
                                onClick={() => onToggleActionPlanItem(item.id, !item.completed)}
                                className={
                                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border text-xs " +
                                  (item.completed ? "border-primary bg-primary text-black" : "border-neutral-300 text-transparent")
                                }
                                aria-label={item.completed ? t.workspace.actionPlanMarkIncomplete : t.workspace.actionPlanMarkComplete}
                              >
                                ✓
                              </button>
                              <div className="min-w-0">
                                <p className={"text-sm font-semibold " + (item.completed ? "text-neutral-400 line-through" : "text-neutral-800")}>
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className={"mt-0.5 text-xs " + (item.completed ? "text-neutral-300" : "text-neutral-500")}>
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Checklist + Yang Berubah berdampingan (fase persiapan hanya
              menampilkan Checklist, karena belum ada data perbandingan). */}
          <div className={`grid grid-cols-1 gap-6 ${isPreparation ? "" : "sm:grid-cols-2"}`}>
            <div className="rounded-[20px] border border-white/10 bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-100">{t.workspace.todayChecklistTitle}</h3>
                <span className="text-xs text-neutral-500">
                  {fillTemplate(t.workspace.todayChecklistCount, { done: checklistDoneCount, total: checklistKeys.length })}
                </span>
              </div>
              {/* Bugfix Juli 2026 (QA users, lihat catatan panjang di
                  todayChecklistBeemoInsightPrefix): item hari-ini dari
                  Rencana Aksi Beemo (AI, digrounded ke tantangan/target
                  bisnis ini) ditarik ke atas checklist rutin -- supaya
                  hal PERTAMA yang dilihat pengguna di sini adalah analisa
                  nyata, bukan daftar rutin generik. actionPlanItems sudah
                  di-fetch untuk panel Rencana Aksi di bawah, jadi tidak ada
                  panggilan AI/loading tambahan di sini. */}
              {actionPlanItems.some((it) => it.day_offset === 0) && (
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">{t.workspace.todayChecklistBeemoInsightPrefix}</p>
                  <ul className="mt-1.5 space-y-1">
                    {actionPlanItems
                      .filter((it) => it.day_offset === 0)
                      .map((it) => (
                        <li key={it.id} className="text-sm text-neutral-200">
                          <span className="font-medium">{it.title}</span>
                          {it.description && <span className="text-neutral-400"> — {it.description}</span>}
                        </li>
                      ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-neutral-600">{t.workspace.todayChecklistBeemoInsightNote}</p>
                </div>
              )}
              <div className="space-y-1">
                {checklistKeys.map((key) => {
                  const done = checkedItems.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleChecklistItem(key)}
                      role="checkbox"
                      aria-checked={done}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-200 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-lg border text-[11px] transition-all duration-200 ${
                          done
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : "border-white/20 text-transparent group-hover:border-primary/60 group-hover:shadow-[0_0_0_3px_rgba(255,152,0,0.15)]"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={`flex-1 text-sm ${done ? "text-neutral-600 line-through" : "text-neutral-300"}`}>
                        {checklistLabel(t, key)}
                      </span>
                      {/* Ikon dimensi — jujur menunjukkan checklist ini terhubung ke
                          dimensi Business Score mana (audit Juli 2026: sebelumnya
                          checklist tidak terlihat berdampak apa-apa ke skor). */}
                      {CHECKLIST_DIMENSION_DISPLAY[key] && (
                        <span
                          aria-hidden="true"
                          title={DIMENSION_LABELS[CHECKLIST_DIMENSION_DISPLAY[key]]?.[lang]}
                          className="flex-none text-xs opacity-60"
                        >
                          {DIMENSION_LABELS[CHECKLIST_DIMENSION_DISPLAY[key]]?.icon}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 px-2 text-xs text-neutral-700">{t.workspace.todayChecklistSessionNote}</p>
            </div>

            {!isPreparation && (
              <div className="rounded-[20px] border border-white/10 bg-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-100">{t.workspace.todayWhatChangedTitle}</h3>
                  {snapshot.whatChanged && snapshot.whatChanged.length > 0 && (
                    <button
                      onClick={onNavigateToInsights}
                      className="rounded text-xs font-semibold text-primary hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {t.workspace.todayWhatChangedSeeDetail}
                    </button>
                  )}
                </div>
                {!snapshot.whatChanged || snapshot.whatChanged.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t.workspace.todayWhatChangedEmpty}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {snapshot.whatChanged.map((c) => {
                      const isUp = c.delta > 0;
                      const isDown = c.delta < 0;
                      return (
                        <div key={c.dimension}>
                          <p className="text-xs text-neutral-500">{DIMENSION_LABELS[c.dimension]?.[lang] || c.dimension}</p>
                          <span
                            className={`flex items-center gap-1 text-lg font-bold ${
                              isUp ? "text-green-400" : isDown ? "text-red-400" : "text-neutral-500"
                            }`}
                          >
                            <span aria-hidden="true">{isUp ? "▲" : isDown ? "▼" : "●"}</span>
                            {Math.abs(c.delta)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ringkasan Perkembangan (revisi Juli 2026) — gantikan "Prioritas
              Minggu Ini" (dulu daftar tugas) dengan ringkasan data harian +
              mingguan yang sebenarnya, sesuai arahan "ganti total jadi
              ringkasan data". Prioritas per-item (dengan Why Card & cross-
              link) tetap ada di kartu Reminder/Insight kolom kanan — tidak
              hilang, hanya tidak lagi dobel di sini. */}
          {!isPreparation && (
            <div className="rounded-[20px] border border-white/10 bg-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-neutral-100">{t.workspace.todayProgressSummaryTitle}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayProgressDailyLabel}</p>
                  {dailyScoreDelta === null ? (
                    <p className="mt-2 text-sm text-neutral-500">{t.workspace.todayProgressNotEnoughData}</p>
                  ) : (
                    <span
                      className={`mt-2 flex items-center gap-1 text-lg font-black ${
                        dailyScoreDelta > 0 ? "text-green-400" : dailyScoreDelta < 0 ? "text-red-400" : "text-white"
                      }`}
                    >
                      <span aria-hidden="true">{dailyScoreDelta > 0 ? "▲" : dailyScoreDelta < 0 ? "▼" : "●"}</span>
                      {fillTemplate(t.workspace.todayProgressPointsSuffix, { points: Math.abs(dailyScoreDelta) })}
                    </span>
                  )}
                  <p className="mt-2 text-xs text-neutral-500">{t.workspace.todayProgressDailyDesc}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayProgressWeeklyLabel}</p>
                  {snapshot.periodDelta === null ? (
                    <p className="mt-2 text-sm text-neutral-500">{t.workspace.todayProgressNotEnoughData}</p>
                  ) : (
                    <span
                      className={`mt-2 flex items-center gap-1 text-lg font-black ${
                        snapshot.periodDelta > 0 ? "text-green-400" : snapshot.periodDelta < 0 ? "text-red-400" : "text-white"
                      }`}
                    >
                      <span aria-hidden="true">{snapshot.periodDelta > 0 ? "▲" : snapshot.periodDelta < 0 ? "▼" : "●"}</span>
                      {fillTemplate(t.workspace.todayProgressPointsSuffix, { points: Math.abs(snapshot.periodDelta) })}
                    </span>
                  )}
                  <p className="mt-2 text-xs text-neutral-500">{t.workspace.todayProgressWeeklyDesc}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ekonomi Makro (revisi Juli 2026) — digabung ke Today, halaman
              & menu terpisah dihapus sesuai arahan. Indikator kurs USD/IDR
              ditandai "Live" (source live_api), inflasi/BI-rate ditandai
              "per tanggal X" (source static) — jujur soal mana yang
              real-time vs periodik, bukan diseragamkan seolah semua live. */}
          <div className="rounded-[20px] border border-white/10 bg-surface p-6">
            <h3 className="mb-4 text-sm font-bold text-neutral-100">{t.workspace.todayMacroTitle}</h3>
            {macroLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              </div>
            ) : macroError || !macro ? (
              <ErrorCard
                title={fillTemplate(t.workspace.workspaceSectionErrorTitle, { page: t.workspace.todayMacroTitle })}
                description={t.workspace.workspaceSectionErrorDesc}
                retryLabel={t.workspace.workspaceRetryButton}
                onRetry={onRetryMacro}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {macro.macro.indicators.map((ind) => (
                    <div key={ind.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <p className="text-[11px] font-semibold text-neutral-500">{lang === "id" ? ind.labelId : ind.labelEn}</p>
                      <p className="mt-1 text-lg font-black text-white">{ind.valueDisplay}</p>
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ind.source === "live_api" ? "bg-green-500/15 text-green-300" : "bg-white/10 text-neutral-400"
                        }`}
                      >
                        {ind.source === "live_api"
                          ? t.workspace.macroSourceLive
                          : fillTemplate(t.workspace.macroAsOf, { date: new Date(ind.asOf).toLocaleDateString(lang === "id" ? "id-ID" : "en-US") })}
                      </span>
                    </div>
                  ))}
                </div>
                {macro.macro.insights.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {macro.macro.insights.map((insight) => (
                      <div key={insight.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-sm leading-relaxed text-neutral-200">{insight.headline}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-center text-[11px] text-neutral-600">
                  {fillTemplate(t.workspace.competitorLastUpdated, { date: new Date(macro.macro.fetchedAt).toLocaleDateString(lang === "id" ? "id-ID" : "en-US") })}
                </p>
              </>
            )}
          </div>

          {/* Performa 7 Hari Terakhir — revisi Juli 2026: dulu dummy SVG
              statis berlabel "Preview", sekarang memakai scoreHistory asli
              dari today_snapshot (services/today/computeSnapshot.ts). Bisnis
              baru yang baru punya <2 hari data ditampilkan jujur sebagai
              "belum cukup data", bukan chart karangan. */}
          <div className="relative rounded-[20px] border border-white/10 bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">{t.workspace.todayChartTitle}</h3>
              {hasChartData && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  {fillTemplate(t.workspace.todayChartDaysBadge, { count: chartPoints.length })}
                </span>
              )}
            </div>
            {!hasChartData ? (
              <p className="py-8 text-center text-sm text-neutral-500">{t.workspace.todayChartNotEnoughData}</p>
            ) : (
            <>
            <div className="relative">
              {/* Tooltip skor hari terakhir — posisinya mengikuti titik data
                  asli (chartDotX/chartDotY), bukan lagi posisi tetap. */}
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[160%] rounded-lg border border-white/10 bg-black/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg"
                style={{ left: `${(chartDotX / 300) * 100}%`, top: `${(chartDotY / 110) * 100}%` }}
              >
                {chartPoints[chartPoints.length - 1].score}
              </div>
              <svg viewBox="0 0 300 110" className="h-28 w-full" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="todayChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                    <stop offset="55%" stopColor="var(--color-primary)" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 45, 70, 95].map((y) => (
                  <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(255,255,255,0.045)" strokeWidth="0.75" />
                ))}
                <polygon points={chartPolygonPoints} fill="url(#todayChartFill)" stroke="none" />
                <polyline
                  points={chartPolylinePoints}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={chartDotX} cy={chartDotY} r="4" fill="var(--color-primary)" stroke="#000" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
              {chartPoints.map((p, i) => (
                <span key={i}>{new Date(p.date).toLocaleDateString(LOCALE_MAP[lang], { day: "numeric", month: "short" })}</span>
              ))}
            </div>
            </>
            )}
          </div>
        </div>

        {/* Kolom kanan: Insight, Opportunity, Reminder — 3 konsep yang sudah
            ada (whatChanged/opportunity/topRisk), hanya dipisah jadi 3 kartu
            berbeda mengikuti tata letak mockup. Tidak ada AI baru — "Beemo"
            di sini murni persona/branding untuk hasil Rule Engine. */}
        {/* Insight / Opportunity / Reminder — 3 kartu disengaja identik:
            padding sama (p-6), header sama (ikon bulat 32px + judul bold),
            CTA selalu di baris paling bawah. Hanya warna aksen yang beda
            per kategori (primary/hijau/amber) supaya tetap bisa dibedakan
            tanpa terasa seperti 3 desain berbeda. */}
        <div className="space-y-6">
          <div className="flex flex-col rounded-[20px] border border-primary/20 bg-primary/5 p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 p-1.5" aria-hidden="true">
                <img src={beemoMascot} alt="" className="h-full w-full object-contain" />
              </span>
              <h3 className="text-sm font-bold text-primary">{t.workspace.todayInsightTitle}</h3>
            </div>
            <p className="text-sm leading-relaxed text-neutral-200">{biggestMoverInsight}</p>
            <button
              onClick={onNavigateToInsights}
              className="mt-4 rounded text-xs font-semibold text-primary hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {t.workspace.todayInsightLink}
            </button>
          </div>

          {!isPreparation && (
            <div className="flex flex-col rounded-[20px] border border-white/10 bg-surface p-6">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 text-base" aria-hidden="true">
                  📈
                </span>
                <h3 className="text-sm font-bold text-neutral-100">{t.workspace.todayOpportunityTitle}</h3>
              </div>
              {/* Business OS Engine: kalau ada peluang bersumber Competitor
                  Engine (contoh PO: "Kompetitor baru belum memiliki Google
                  Business"), utamakan itu — teksnya memang bebas per-
                  kompetitor (exception yang sudah dijustifikasi), dan CTA-nya
                  menuju halaman Competitor (cross-link), bukan Insights. */}
              {snapshot.competitorOpportunity ? (
                <>
                  <p className="text-sm font-semibold text-neutral-100">{snapshot.competitorOpportunity.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-300">{snapshot.competitorOpportunity.reason}</p>
                  <button
                    onClick={onOpenCompetitor}
                    className="mt-4 rounded text-xs font-semibold text-green-400 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70"
                  >
                    {t.workspace.todayOpportunityCta}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-neutral-300">
                    {opportunityText(snapshot.opportunity) || t.workspace.opportunityGeneric}
                  </p>
                  <button onClick={onNavigateToInsights} className="mt-4 rounded text-xs font-semibold text-green-400 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/70">
                    {t.workspace.todayOpportunityCta}
                  </button>
                </>
              )}
            </div>
          )}

          {!isPreparation && (
            <div className="flex flex-col rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-6">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-base" aria-hidden="true">
                  🔔
                </span>
                <h3 className="text-sm font-bold text-amber-300">{t.workspace.todayReminderTitle}</h3>
              </div>
              <div className="space-y-3">
                {reminderSlots.map((slot, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                    <p className={`text-sm leading-snug ${slot.empty ? "text-neutral-600" : "text-neutral-200"}`}>{slot.text}</p>
                    {slot.badge && (
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${slot.badgeColor}`}>
                        {slot.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={onNavigateToInsights} className="mt-4 rounded text-xs font-semibold text-amber-300 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
                {t.workspace.todayReminderCta}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Journey stepper — full-width, 8 fase dari roadmap. Business Stage
          Engine v1 baru membedakan preparation/running, jadi hanya node
          pertama yang benar-benar pasti; sisanya ditandai "upcoming" apa
          adanya (lihat komentar currentJourneyIndex di atas) — bukan
          dikarang sudah sampai fase tertentu. */}
      <div className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-10">
        <h3 className="mb-8 text-sm font-bold uppercase tracking-widest text-neutral-500">{t.workspace.todayJourneyStepperTitle}</h3>
        <div className="overflow-x-auto">
        <div className="flex min-w-[760px] items-start">
          {JOURNEY_STAGES.map((label, i) => {
            const state = i < currentJourneyIndex ? "done" : i === currentJourneyIndex ? "current" : "upcoming";
            const lineDone = i < currentJourneyIndex;
            return (
              <div key={label} className="flex flex-1 flex-col items-center px-2">
                <div className="flex w-full items-center">
                  <div className={`h-0.5 flex-1 ${i === 0 ? "invisible" : lineDone || state === "current" ? "bg-primary" : "bg-white/10"}`} />
                  <div
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-shadow duration-300 ${
                      state === "done"
                        ? "border-green-500 bg-green-500/15 text-green-400"
                        : state === "current"
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_28px_6px_rgba(255,152,0,0.55)]"
                          : "border-white/15 text-neutral-600"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </div>
                  <div className={`h-0.5 flex-1 ${i === JOURNEY_STAGES.length - 1 ? "invisible" : lineDone ? "bg-primary" : "bg-white/10"}`} />
                </div>
                <span
                  className={`mt-3 max-w-[90px] text-center text-xs font-semibold leading-tight ${state === "upcoming" ? "text-neutral-600" : "text-neutral-100"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        </div>
        <p className="mt-8 text-xs text-neutral-600">{t.workspace.todayJourneyUpcomingNote}</p>
      </div>

      {/* Tombol Chat Beemo mengambang — mengarahkan ke tab Chat yang sudah
          ada, bukan fitur baru. */}
      <button
        onClick={onOpenChat}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-black shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <img src={beemoMascot} alt="" className="h-5 w-5 object-contain" aria-hidden="true" /> {t.workspace.todayChatFloatingLabel}
      </button>
    </div>
  );
}

/** Ikon sidebar — outline SVG sederhana, bukan library ikon baru (tidak
 * ada dependency baru ditambah). Menggantikan emoji supaya sidebar terasa
 * lebih modern/premium sesuai arahan desain, murni visual. */
function MenuIcon({ name }: { name: MenuKey }) {
  // Semua ikon sidebar disengaja seragam 20px dengan stroke tipis (1.6),
  // supaya tidak ada satu ikon pun (Target/Pengaturan/Riwayat) yang terasa
  // lebih "berat"/besar dari yang lain — fokus tetap ke isi dashboard.
  const common = "h-5 w-5 flex-shrink-0";
  const props = {
    className: common,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "today":
      return (
        <svg {...props}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case "score":
      return (
        <svg {...props}>
          <path d="M4 20V12" />
          <path d="M12 20V6" />
          <path d="M20 20v-8" />
        </svg>
      );
    case "report":
      return (
        <svg {...props}>
          <path d="M7 3h6l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M13 3v5h5" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "target":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.75" />
          <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "competitor":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m14.5 9.5-2 5-5 2 2-5Z" />
        </svg>
      );
    case "leads":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M20 20a5.5 5.5 0 0 0-4.5-5.4" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.9A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
    case "businessUpdates":
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
          <path d="M21 4v4h-4" />
          <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
          <path d="M3 20v-4h4" />
        </svg>
      );
    case "decisionJournal":
      return (
        <svg {...props}>
          <path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M8 8h7M8 12h7M8 16h4" />
        </svg>
      );
    default:
      return null;
  }
}

function Workspace() {
  const { user, session, loading, signOut } = useAuth();

  // Audit Juli 2026 (directive PO: "apabila workspace tidak aktif diakses
  // selama 30 menit, otomatis log out") -- keamanan sesi: kalau Workspace
  // dibuka lalu ditinggal tanpa aktivitas apapun (mouse/keyboard/scroll/
  // tap) selama 30 menit, sesi login diakhiri otomatis dan pengguna
  // dikembalikan ke landing page. Timer di-reset setiap kali ada aktivitas
  // -- BUKAN 30 menit sejak Workspace dibuka, tapi 30 menit sejak
  // AKTIVITAS TERAKHIR.
  useEffect(() => {
    if (!user) return;
    const IDLE_LOGOUT_MS = 30 * 60 * 1000;
    let idleTimer: number;

    function resetIdleTimer() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        signOut().then(() => hardNavigate(""));
      }, IDLE_LOGOUT_MS);
    }

    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer));
    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const { t, lang, setLang } = useLanguage();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("today");
  const [businesses, setBusinesses] = useState<BusinessProfileRow[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  // Audit Juli 2026 (ChatGPT Critical #1 + QA langsung: "user baru bisa
  // kewalahan" -- Workspace langsung menampilkan 7-9 tab sekaligus tanpa
  // urutan "mulai dari sini"). Quick Start murni berbasis tab mana yang
  // SUDAH PERNAH dibuka (bukan data baru di backend) -- disimpan per bisnis
  // di localStorage supaya tidak perlu migrasi/endpoint baru, dan otomatis
  // "selesai" begitu pengguna wajar menjelajah Workspace-nya sendiri (tidak
  // memaksa urutan kaku, cuma menyorot langkah berikutnya yang disarankan).
  const [visitedMenus, setVisitedMenus] = useState<Set<string>>(new Set());
  const [quickStartDismissed, setQuickStartDismissed] = useState(false);

  // Muat status Quick Start begitu bisnis aktif diketahui/berganti --
  // per-bisnis (bukan global) supaya pindah ke bisnis lain di akun yang
  // sama tetap disambut Quick Start-nya sendiri, bukan status bisnis lain.
  useEffect(() => {
    if (!activeBusinessId) return;
    const loaded = loadQuickStartState(activeBusinessId);
    setVisitedMenus(loaded.visited);
    setQuickStartDismissed(loaded.dismissed);
  }, [activeBusinessId]);

  // Tandai tab yang sedang dibuka sebagai "dikunjungi" tiap kali activeMenu
  // berubah -- satu tempat saja, tidak perlu mengubah tiap pemanggil
  // setActiveMenu() satu-satu di seluruh file.
  useEffect(() => {
    if (!activeBusinessId) return;
    setVisitedMenus((prev) => {
      if (prev.has(activeMenu)) return prev;
      const next = new Set(prev);
      next.add(activeMenu);
      saveQuickStartState(activeBusinessId, next, quickStartDismissed);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, activeBusinessId]);

  function dismissQuickStart() {
    setQuickStartDismissed(true);
    if (activeBusinessId) saveQuickStartState(activeBusinessId, visitedMenus, true);
  }

  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  // Error/retry state Report — sebelumnya fetch "analyses" (sumber
  // latestPreview yang dipakai Report & fallback Business Score) juga cuma
  // console.error diam-diam kalau gagal. Sekarang eksplisit, pola sama
  // dengan businessHealthError/todaySnapshotError.
  const [analysesError, setAnalysesError] = useState(false);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [membership, setMembership] = useState<Membership | null>(null);
  // BUGFIX QA Juli 2026 (round 4, "Bug 4" -- lanjutan dari reset di
  // resetPerBusinessCaches di bawah): reset membership ke null saja TIDAK
  // cukup, karena AccessStatusCard memperlakukan membership === null sama
  // seperti tier "free" dan langsung menampilkan kartu "Paket Gratis" --
  // itu tetap data yang BISA salah kalau bisnis yang baru dipilih
  // sebenarnya Pro/Platinum, cuma belum selesai di-fetch. Prinsip dari
  // diskusi GPT: lebih baik pengguna melihat "belum ada data" (skeleton)
  // daripada "data yang salah" (kartu Gratis yang keliru sesaat).
  // membershipLoading membedakan dua state itu secara eksplisit.
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [businessHealth, setBusinessHealth] = useState<{
    dimensions: Record<string, number> | null;
    overall: number | null;
    dimensionSignals: DimensionSignals;
  }>({
    dimensions: null,
    overall: null,
    dimensionSignals: null,
  });
  // Error/retry state Business Score — sebelumnya getBusinessHealth yang
  // gagal cuma diam (tidak ada console.error sekalipun) dan diam-diam jatuh
  // ke skor lama dari analisis terakhir. Sekarang eksplisit: kalau gagal,
  // tampilkan ErrorCard + retry yang cuma reload bagian ini saja.
  const [businessHealthError, setBusinessHealthError] = useState(false);
  const [businessHealthLoading, setBusinessHealthLoading] = useState(false);
  // Error/retry state Progress (getProgress) — dipakai section Progress/
  // Perbandingan di Target, pola sama dengan Business Health di atas:
  // sebelumnya gagal diam-diam, sekarang eksplisit + retry section-scoped.
  const [progressError, setProgressError] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressData, setProgressData] = useState<{
    journey: { baselineScore: number; currentScore: number; delta: number } | null;
    period: { previousScore: number; currentScore: number; delta: number } | null;
  }>({ journey: null, period: null });
  const [healthTrend, setHealthTrend] = useState<HealthTrend>({
    journeyByDimension: null,
    periodByDimension: null,
    biggestMoverDimension: null,
  });
  const [achievements, setAchievements] = useState<{
    unlocked: Array<Record<string, unknown>>;
    nextMilestone: Record<string, unknown> | null;
  }>({ unlocked: [], nextMilestone: null });
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  // Error state Timeline/Achievements/Next Milestone (Journey) — updates
  // dan achievements sebelumnya gagal diam-diam (cuma console.error), lalu
  // Timeline/daftar Achievement/Next Milestone diam-diam tampil "kosong"
  // padahal datanya gagal dimuat, bukan benar-benar belum ada. Satu error
  // state gabungan karena Timeline butuh KEDUA sumber ini sekaligus.
  const [updateHistoryError, setUpdateHistoryError] = useState(false);
  const [achievementsError, setAchievementsError] = useState(false);
  // Business Memory (Master Product Directive, Fase 1) — fakta yang
  // diusulkan Beemo lewat Chat dan masih menunggu persetujuan pemilik
  // bisnis. Dimuat saat tab Chat Beemo dibuka, pola sama dengan
  // achievements di Growth.
  const [pendingMemoryFacts, setPendingMemoryFacts] = useState<
    Array<{ id: string; factKey: string; factValue: unknown; proposedAt: string }>
  >([]);
  const [pendingMemoryFactsLoading, setPendingMemoryFactsLoading] = useState(false);
  const [pendingMemoryFactsError, setPendingMemoryFactsError] = useState(false);
  const [reviewingFactId, setReviewingFactId] = useState<string | null>(null);
  // Competitor Engine (Master Product Directive, Fase 2) — dimuat saat tab
  // Competitor dibuka, pola sama dengan loadAchievements/loadPendingMemoryFacts.
  // null = belum dimuat/tidak ada data; competitorAnalysisNotReady membedakan
  // "gagal memuat" (error, bisa dicoba lagi) dari "belum lengkap datanya"
  // (lokasi/industri belum ada — bukan error, jangan tampilkan sebagai error).
  const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysisData | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState(false);
  const [competitorNotReadyMessage, setCompetitorNotReadyMessage] = useState<string | null>(null);
  // Medsos Kompetitor (Task 14b) — dimuat BERSAMAAN dengan Competitor Engine
  // (tab yang sama), lihat useEffect activeMenu === "competitor" di bawah.
  const [socialMediaAnalysis, setSocialMediaAnalysis] = useState<SocialMediaAnalysisData | null>(null);
  const [socialMediaLoading, setSocialMediaLoading] = useState(false);
  const [socialMediaError, setSocialMediaError] = useState(false);
  // Referensi Pelanggan Baru (Juli 2026) — riwayat dimuat sekali saat tab
  // dibuka (leadReferralsLoading), lalu "Cari Referensi Baru" memicu batch
  // BARU lewat generateLeadReferrals (leadReferralsGenerating terpisah
  // supaya tombol generate tidak menampilkan skeleton seolah riwayat kosong
  // sedang dimuat ulang). leadQuota null = belum pernah tahu kuota tier ini
  // (baru terisi setelah generate pertama berhasil/gagal karena rate limit).
  const [leadReferrals, setLeadReferrals] = useState<LeadReferralItem[]>([]);
  const [leadReferralsLoading, setLeadReferralsLoading] = useState(false);
  const [leadReferralsError, setLeadReferralsError] = useState(false);
  const [leadReferralsGenerating, setLeadReferralsGenerating] = useState(false);
  const [leadReferralsGenerateError, setLeadReferralsGenerateError] = useState<string | null>(null);
  const [leadQuota, setLeadQuota] = useState<number | null>(null);
  // Ekonomi Makro (Task 14c) — tab sendiri, tidak per-bisnis (sama untuk
  // semua pengguna) jadi TIDAK direset di resetPerBusinessCaches().
  const [macroSnapshot, setMacroSnapshot] = useState<MacroSnapshotData | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState(false);
  // Lonceng Notifikasi (Juli 2026) — dimuat begitu activeBusinessId siap
  // (bukan menunggu tombol lonceng diklik) supaya badge unread langsung
  // terlihat begitu Workspace dibuka. Lihat useEffect [activeBusinessId]
  // di bawah dan services/notifications/getNotifications.ts.
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshotPayload | null>(null);
  const [todaySnapshotLoading, setTodaySnapshotLoading] = useState(false);
  // Error state Today — supaya gagal memuat snapshot tidak tampil sebagai
  // skeleton selamanya, dan Reminder tidak salah menampilkan "Aman" padahal
  // datanya gagal dimuat (bukan benar-benar aman). Lihat reloadTodaySnapshot.
  const [todaySnapshotError, setTodaySnapshotError] = useState(false);
  // Business OS Engine — dimuat bersamaan dengan Today Snapshot lewat action
  // getBusinessOS (satu panggilan, satu object), lihat services/businessOS/
  // getBusinessOS.ts.
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewPayload | null>(null);
  // Grafik Performa (revisi Juli 2026): riwayat skor harian ASLI (sampai 7
  // hari terakhir), dari today_snapshot yang memang sudah tersimpan 1
  // baris/hari — bukan lagi dummy chart. Diambil bersamaan dengan Today
  // Snapshot lewat action getBusinessOS yang sama (lihat getBusinessOS.ts).
  const [scoreHistory, setScoreHistory] = useState<Array<{ date: string; score: number | null }>>([]);
  // Rencana Aksi Beemo (Phase 3, directive PO: "user tau apa saja yang
  // harus dilakukan hari ini, besok, lusa dst"). Dipisah dari todaySnapshot
  // (rule engine, hari ini saja) — ini AI-generated, multi-hari, lihat
  // services/workspace/actionPlan/generateActionPlan.ts. actionPlanFetched
  // menandai "sudah pernah dicoba dimuat sekali" (bukan `items.length===0`)
  // supaya auto-generate hanya terpicu SEKALI, bukan berulang tiap render
  // kalau memang hasilnya genuinely kosong.
  const [actionPlanItems, setActionPlanItems] = useState<ActionPlanItemData[]>([]);
  const [actionPlanFetched, setActionPlanFetched] = useState(false);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionPlanGenerating, setActionPlanGenerating] = useState(false);
  const [actionPlanError, setActionPlanError] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Array<Record<string, unknown>>>([]);
  const [dataLoading, setDataLoading] = useState(true);
  // Bugfix Juli 2026 (laporan nyata pengguna: video menunjukkan Workspace
  // dan wizard "#mulai" bergantian berulang-ulang setelah OTP berhasil --
  // ternyata SEBELUM ini, kalau query business_profiles gagal (gangguan
  // jaringan/Supabase sesaat, BUKAN akun yang benar-benar kosong),
  // dataLoading tetap diset false dengan `businesses` tetap [] -- kondisi
  // itu 100% SAMA dengan "akun baru belum punya bisnis", jadi NoBusinessYet
  // auto-redirect ke #mulai walau bisnisnya sebenarnya ADA. State terpisah
  // ini membedakan "genuinely kosong" dari "gagal dimuat", supaya
  // pengguna lama TIDAK PERNAH diarahkan ke wizard hanya karena satu query
  // gagal -- ditampilkan pesan jelas + tombol coba lagi.
  const [businessesLoadError, setBusinessesLoadError] = useState(false);
  const [businessesReloadTick, setBusinessesReloadTick] = useState(0);
  const [businessDataLoading, setBusinessDataLoading] = useState(true);
  // Audit Juli 2026 (directive PO: "user ketika login lagi, sebelum alamat
  // workspace, wajib diberi keterangan untuk hapus salah satu bisninsya,
  // atau upgrade") — akun bisa MELEBIHI batas paketnya bukan lewat bug,
  // tapi lewat langganan yang kedaluwarsa (mis. count=3 tapi cap balik ke 2
  // begitu Pro-nya tidak diperpanjang). null = belum dicek, true = kelebihan
  // slot (wajib diselesaikan dulu sebelum lihat Workspace sama sekali).
  const [overLimitBlocked, setOverLimitBlocked] = useState<boolean | null>(null);
  const [showBusinessUpdate, setShowBusinessUpdate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Bugfix produk Juli 2026 ("PDF eksklusif PLATINUM"): kalau modal ini
  // dibuka dari fitur yang HANYA terbuka di PLATINUM (Final Reports/PDF),
  // kartu PRO harus disembunyikan sama sekali — lihat UpgradeModal.tsx
  // `platinumOnly`. Direset ke false tiap kali modal ditutup supaya
  // pemanggilan generik openUpgradeModal() dari fitur lain (Kompetitor,
  // Medsos, dst — yang tetap boleh ditawari PRO) tidak ikut kena batasan ini.
  const [upgradePlatinumOnly, setUpgradePlatinumOnly] = useState(false);
  const [checkingUpgrade, setCheckingUpgrade] = useState(false);
  const [upgradeOutcome, setUpgradeOutcome] = useState<"expired" | "pending" | "failed" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updateHistory, setUpdateHistory] = useState<Array<Record<string, unknown>>>([]);
  const [showUpdateHistory, setShowUpdateHistory] = useState(false);
  const [updateHistoryLoading, setUpdateHistoryLoading] = useState(false);
  // Decision Journal — murni riwayat sejak revisi Juli 2026 (form "Ajukan
  // keputusan baru" dihapus, keputusan besar terdeteksi otomatis di Chat
  // Beemo — lihat DecisionJournalList & ChatBeemoPanel.tsx).
  const [decisions, setDecisions] = useState<Array<Record<string, unknown>>>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [decisionsError, setDecisionsError] = useState(false);
  const [decisionsLoaded, setDecisionsLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Final Reports (Task 13 — "riwayat diganti final reports"): dua PDF
  // sungguhan (baseline + expiry) tersimpan di Storage, dibaca lewat action
  // "listReports" (services/reports/listReports.ts). `reportsGenerating`
  // dipakai tombol "Buat PDF Awal" supaya tidak bisa diklik dobel selagi
  // Claude+Playwright masih memproses.
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportsGenerating, setReportsGenerating] = useState(false);
  const [reportsGenerateError, setReportsGenerateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);
  const [deletedBusinesses, setDeletedBusinesses] = useState<BusinessProfileRow[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmingPermanentDeleteId, setConfirmingPermanentDeleteId] = useState<string | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState(false);
  const [permanentDeleteError, setPermanentDeleteError] = useState<string | null>(null);
  // Header disederhanakan (arahan Product Principles #6/revisi #4): "Hapus
  // Bisnis" & "Keluar" bukan aksi yang sering dipakai, jadi dipindah ke
  // dropdown kecil di belakang tombol titik-tiga, supaya baris header utama
  // cukup Bell/Bantuan/Switcher/Update Bisnis saja.
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Muat daftar business_profiles + Active Business Context (sekali per sesi user)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadBusinesses() {
      setDataLoading(true);
      setBusinessesLoadError(false);

      const [profilesRes, prefsRes, deletedCountRes] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("id, business_name, industry, business_type")
          .eq("active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_preferences")
          .select("active_business_profile_id")
          .maybeSingle(),
        supabase
          .from("business_profiles")
          .select("id", { count: "exact", head: true })
          .eq("active", false),
      ]);

      if (cancelled) return;

      setDeletedCount(deletedCountRes.count || 0);

      if (profilesRes.error) {
        console.error("Gagal memuat business_profiles:", profilesRes.error);
        // JANGAN biarkan `businesses` diam-diam tetap [] di sini -- kalau
        // begitu, blok render di bawah (!dataLoading && businesses.length
        // === 0) akan salah mengira akun ini "belum pernah punya bisnis"
        // dan auto-redirect ke wizard #mulai lewat NoBusinessYet, PADAHAL
        // bisnisnya ada, cuma query ini yang gagal sesaat. Tandai sebagai
        // error eksplisit supaya UI menampilkan pesan + tombol coba lagi.
        setBusinessesLoadError(true);
        setDataLoading(false);
        return;
      }

      const profiles = (profilesRes.data as BusinessProfileRow[]) || [];
      setBusinesses(profiles);

      if (profiles.length === 0) {
        setActiveBusinessId(null);
        setDataLoading(false);
        return;
      }

      const storedActiveId = prefsRes.data?.active_business_profile_id as string | null | undefined;
      const validStoredId = storedActiveId && profiles.some((p) => p.id === storedActiveId) ? storedActiveId : null;
      const resolvedActiveId = validStoredId || profiles[0].id;

      setActiveBusinessId(resolvedActiveId);

      // Kalau belum ada konteks aktif tersimpan (user baru pertama kali
      // login), simpan defaultnya sekarang supaya konsisten di sesi berikutnya.
      if (!validStoredId && user) {
        await supabase
          .from("user_preferences")
          .update({ active_business_profile_id: resolvedActiveId })
          .eq("user_id", user.id);
      }

      setDataLoading(false);
    }

    loadBusinesses();

    return () => {
      cancelled = true;
    };
    // businessesReloadTick sengaja ditambah ke dependency HANYA supaya
    // tombol "Coba Lagi" (lihat render businessesLoadError di bawah) bisa
    // memicu ulang fetch ini -- nilainya sendiri tidak pernah dibaca di
    // dalam effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, businessesReloadTick]);

  // Gate wajib begitu login (lihat overLimitBlocked di atas) — dicek SEKALI
  // begitu daftar bisnis selesai dimuat, terpisah dari pengecekan cap di
  // ChatWizard (yang cuma jalan saat mau MENAMBAH bisnis baru). Di sini
  // kondisinya lebih ketat: count > cap (BENAR-BENAR kelebihan), bukan cuma
  // count === cap (pas di batas itu normal, tidak perlu memblokir apapun,
  // cuma tidak bisa nambah lagi).
  useEffect(() => {
    if (dataLoading || businesses.length === 0 || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/business", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "getCap" }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && typeof json.count === "number" && typeof json.cap === "number") {
          setOverLimitBlocked(json.count > json.cap);
        }
      } catch (err) {
        console.error("Workspace overLimit check error:", err);
        // Gagal cek -> jangan mengunci user gara-gara masalah jaringan sesaat.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataLoading, businesses.length, session?.access_token]);

  // Muat analyses + subscription untuk business yang sedang aktif
  useEffect(() => {
    if (!activeBusinessId) return;

    let cancelled = false;

    async function loadBusinessData() {
      setBusinessDataLoading(true);

      const analysesRes = await supabase
        .from("analyses")
        .select("id, raw_input, ai_output, is_baseline, created_at")
        .eq("business_profile_id", activeBusinessId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (analysesRes.error) {
        console.error("Gagal memuat analyses:", analysesRes.error);
        setAnalysesError(true);
      } else {
        setAnalyses((analysesRes.data as AnalysisRow[]) || []);
        setAnalysesError(false);
      }

      if (session?.access_token) {
        setTodaySnapshotLoading(true);
        try {
          // Membership TIDAK dibaca langsung dari tabel subscriptions di
          // sini lagi — selalu lewat action "getMembership", supaya
          // pengecekan expires_at konsisten dengan services/beemo/chat.ts
          // (satu sumber kebenaran: services/membership/getActiveMembership.ts).
          const [healthResponse, progressResponse, membershipResponse, healthTrendResponse, todayResponse] = await Promise.all([
            fetch("/api/workspace", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "getBusinessHealth", businessProfileId: activeBusinessId }),
            }),
            fetch("/api/workspace", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "getProgress", businessProfileId: activeBusinessId }),
            }),
            fetch("/api/workspace", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "getMembership", businessProfileId: activeBusinessId }),
            }),
            fetch("/api/workspace", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "getHealthTrend", businessProfileId: activeBusinessId }),
            }),
            fetch("/api/workspace", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "getBusinessOS", businessProfileId: activeBusinessId }),
            }),
          ]);
          const healthJson = await healthResponse.json();
          const progressJson = await progressResponse.json();
          const membershipJson = await membershipResponse.json();
          const healthTrendJson = await healthTrendResponse.json();
          const todayJson = await todayResponse.json();
          if (!cancelled) {
            if (healthResponse.ok) {
              setBusinessHealth({ dimensions: healthJson.dimensions, overall: healthJson.overall, dimensionSignals: healthJson.dimensionSignals ?? null });
              setBusinessHealthError(false);
            } else {
              console.error("Gagal memuat Business Health:", healthJson.error);
              setBusinessHealthError(true);
            }
            if (progressResponse.ok) {
              setProgressData({ journey: progressJson.journey, period: progressJson.period });
              setProgressError(false);
            } else {
              console.error("Gagal memuat Progress:", progressJson.error);
              setProgressError(true);
            }
            if (membershipResponse.ok) {
              setMembership(membershipJson.membership as Membership);
            } else {
              console.error("Gagal memuat membership:", membershipJson.error);
            }
            // Bug 4 fix: baik sukses maupun gagal, loading harus berhenti di
            // sini supaya skeleton tidak menggantung selamanya kalau
            // fetch gagal -- kegagalan tetap ditangani AccessStatusCard
            // sebagai membership null/"free", bukan tier bisnis lama.
            setMembershipLoading(false);
            if (healthTrendResponse.ok) {
              setHealthTrend({
                journeyByDimension: healthTrendJson.journeyByDimension,
                periodByDimension: healthTrendJson.periodByDimension,
                biggestMoverDimension: healthTrendJson.biggestMoverDimension,
              });
            }
            if (todayResponse.ok) {
              setTodaySnapshot(todayJson.snapshot as TodaySnapshotPayload);
              setWeeklyReview((todayJson.weeklyReview as WeeklyReviewPayload) || null);
              setScoreHistory((todayJson.scoreHistory as Array<{ date: string; score: number | null }>) || []);
              setTodaySnapshotError(false);
            } else {
              console.error("Gagal memuat Today snapshot:", todayJson.error);
              setTodaySnapshotError(true);
            }
          }
        } catch (err) {
          console.error("getBusinessHealth/getProgress/getMembership/getHealthTrend/getTodaySnapshot error:", err);
          if (!cancelled) {
            setTodaySnapshotError(true);
            setBusinessHealthError(true);
            setProgressError(true);
          }
        } finally {
          if (!cancelled) setTodaySnapshotLoading(false);
        }
      } else if (!cancelled) {
        // Tidak ada session token -> fetch membership tidak pernah jalan,
        // jadi loading harus dimatikan manual di sini juga supaya skeleton
        // STATUS AKSES tidak menggantung selamanya.
        setMembershipLoading(false);
      }

      setBusinessDataLoading(false);
    }

    loadBusinessData();

    return () => {
      cancelled = true;
    };
  }, [activeBusinessId, refreshKey]);

  // Lonceng Notifikasi — dimuat begitu activeBusinessId siap/berganti
  // (bukan menunggu dropdown diklik), supaya badge unread langsung akurat
  // saat Workspace dibuka. TIDAK diikutkan ke Promise.all besar di atas
  // supaya kalau panel utama gagal dimuat, lonceng tetap bisa jalan sendiri
  // (dan sebaliknya).
  useEffect(() => {
    if (activeBusinessId) loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  // Reload Today snapshot SAJA (bukan seluruh Promise.all di atas) — dipakai
  // tombol "Coba Lagi" di kartu error Today, supaya retry ringan & cepat,
  // tidak memicu ulang fetch getBusinessHealth/getProgress/getMembership/
  // getHealthTrend yang sudah berhasil.
  async function reloadTodaySnapshot() {
    if (!activeBusinessId || !session?.access_token) return;
    setTodaySnapshotLoading(true);
    setTodaySnapshotError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getBusinessOS", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setTodaySnapshot(json.snapshot as TodaySnapshotPayload);
        setWeeklyReview((json.weeklyReview as WeeklyReviewPayload) || null);
        setScoreHistory((json.scoreHistory as Array<{ date: string; score: number | null }>) || []);
      } else {
        console.error("Gagal memuat ulang Today snapshot:", json.error);
        setTodaySnapshotError(true);
      }
    } catch (err) {
      console.error("reloadTodaySnapshot error:", err);
      setTodaySnapshotError(true);
    } finally {
      setTodaySnapshotLoading(false);
    }
  }

  // Reload Business Health SAJA — dipakai tombol "Coba Lagi" di ErrorCard
  // Business Score (dan halaman lain yang memakai data ini nanti), pola
  // yang sama dengan reloadTodaySnapshot: retry ringan per-section, bukan
  // reload seluruh halaman.
  async function reloadBusinessHealth() {
    if (!activeBusinessId || !session?.access_token) return;
    setBusinessHealthLoading(true);
    setBusinessHealthError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getBusinessHealth", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setBusinessHealth({ dimensions: json.dimensions, overall: json.overall, dimensionSignals: json.dimensionSignals ?? null });
      } else {
        console.error("Gagal memuat ulang Business Health:", json.error);
        setBusinessHealthError(true);
      }
    } catch (err) {
      console.error("reloadBusinessHealth error:", err);
      setBusinessHealthError(true);
    } finally {
      setBusinessHealthLoading(false);
    }
  }

  // Reload analyses SAJA — dipakai tombol "Coba Lagi" di ErrorCard Report,
  // pola sama seperti dua reload di atas.
  async function reloadAnalyses() {
    if (!activeBusinessId) return;
    setAnalysesLoading(true);
    setAnalysesError(false);
    const analysesRes = await supabase
      .from("analyses")
      .select("id, raw_input, ai_output, is_baseline, created_at")
      .eq("business_profile_id", activeBusinessId)
      .order("created_at", { ascending: false });
    if (analysesRes.error) {
      console.error("Gagal memuat ulang analyses:", analysesRes.error);
      setAnalysesError(true);
    } else {
      setAnalyses((analysesRes.data as AnalysisRow[]) || []);
    }
    setAnalysesLoading(false);
  }

  // Reload Progress (getProgress) SAJA — dipakai tombol "Coba Lagi" di
  // ErrorCard bagian Progress/Perbandingan Target, pola sama seperti
  // reload lain di atas.
  async function reloadProgress() {
    if (!activeBusinessId || !session?.access_token) return;
    setProgressLoading(true);
    setProgressError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getProgress", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setProgressData({ journey: json.journey, period: json.period });
      } else {
        console.error("Gagal memuat ulang Progress:", json.error);
        setProgressError(true);
      }
    } catch (err) {
      console.error("reloadProgress error:", err);
      setProgressError(true);
    } finally {
      setProgressLoading(false);
    }
  }

  useEffect(() => {
    if (checkingUpgrade && membership && membership.tier !== "free") {
      setCheckingUpgrade(false);
      setUpgradeOutcome(null);
    }
  }, [membership, checkingUpgrade]);

  // Setelah polling di handleUpgraded menyerah (subscription masih "free"),
  // tanya langsung ke payments lewat backend apa status transaksi terakhirnya
  // — supaya user dikasih tahu JELAS kalau transaksinya kadaluarsa, bukan
  // dibiarkan diam melihat "Paket Gratis" tanpa penjelasan.
  async function checkLatestPaymentOutcome() {
    if (!activeBusinessId || !session?.access_token) return;
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getLatestPayment", businessProfileId: activeBusinessId }),
      });
      if (!response.ok) return;
      const json = await response.json();
      const status = json.payment?.status;
      if (status === "expired") setUpgradeOutcome("expired");
      else if (status === "pending") setUpgradeOutcome("pending");
      else if (status === "failed") setUpgradeOutcome("failed");
    } catch (err) {
      console.error("checkLatestPaymentOutcome error:", err);
    }
  }

  // Bugfix Juli 2026 (QA: "user gratis mau upgrade, pilihannya cuma
  // Platinum saja, Pro tidak muncul"): akar masalahnya BUKAN di sini,
  // tapi enam dari tujuh pemanggil generik ini menulis
  // `onUpgradeClick={openUpgradeModal}` TANPA dibungkus arrow function --
  // karena tombolnya (RetryButton) memakai `<button onClick={onRetry}>`,
  // React meneruskan objek MouseEvent mentah sebagai argumen pertama.
  // MouseEvent selalu truthy, jadi `platinumOnly` kebaca `true` di SETIAP
  // klik upgrade generik (Business Score, Target, Competitor, Chat,
  // Settings, Decision Journal) -- padahal cuma Final Reports yang memang
  // seharusnya platinum-only. Perbaikan dua lapis: (1) semua pemanggil di
  // bawah sekarang dibungkus `() => openUpgradeModal()` supaya tidak ada
  // argumen tak sengaja yang lolos, (2) fungsi ini sendiri dikeraskan
  // dengan `=== true` supaya SEKALIPUN ada pemanggil baru nanti yang lupa
  // membungkus, sebuah objek event tidak akan pernah diam-diam dibaca
  // sebagai true lagi.
  function openUpgradeModal(platinumOnly: unknown = false) {
    setUpgradeOutcome(null);
    setUpgradePlatinumOnly(platinumOnly === true);
    setShowUpgradeModal(true);
  }

  // Audit Juli 2026 ("sediakan notifikasi/pop up workspace yang ketika
  // diklik perpanjangan masuk langsung untuk melakukan pembayaran"): link
  // "Perpanjang Sekarang" di email pengingat H-2 (lihat
  // services/subscriptions/sendExpiryReminders.ts) menunjuk ke
  // thehive-bisnis.com/?upgrade=1 -- efek ini membuka modal upgrade
  // otomatis begitu Workspace dimuat lewat link itu, lalu membersihkan
  // ?upgrade=1 dari URL (sekali saja, supaya refresh/back tidak membuka
  // modal berulang-ulang).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") !== "1") return;
    window.history.replaceState({}, "", window.location.pathname);
    openUpgradeModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUpgraded() {
    setShowUpgradeModal(false);
    setCheckingUpgrade(true);
    setUpgradeOutcome(null);
    let attempts = 0;
    const maxAttempts = 5;
    const interval = setInterval(() => {
      attempts += 1;
      setRefreshKey((k) => k + 1);
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setCheckingUpgrade(false);
        checkLatestPaymentOutcome();
      }
    }, 2500);
  }

  // Audit Juli 2026 (bug data-nyasar antar-bisnis): Kompetitor/Riwayat
  // Update/Decision Journal/Final Reports semua di-fetch lewat gate "sudah
  // dimuat belum" (competitorAnalysis !== null, updateHistory.length > 0,
  // decisionsLoaded/reportsLoaded) yang TIDAK ikut reset saat ganti bisnis
  // aktif — akibatnya data bisnis LAMA masih tampil sesaat (atau sampai
  // pengguna pindah menu lalu balik lagi) setelah pindah ke bisnis lain.
  // Dipanggil di SETIAP tempat yang mengubah activeBusinessId (switch,
  // hapus-lalu-fallback, bisnis baru dibuat) supaya satu-satunya sumber
  // "data ini sudah basi, muat ulang" konsisten di semua tempat.
  function resetPerBusinessCaches() {
    // BUGFIX QA Juli 2026: membership TIDAK ikut direset di sini sebelumnya
    // — akibatnya badge "STATUS AKSES" di header sempat menampilkan tier
    // bisnis LAMA (mis. "PLATINUM Aktif") selama beberapa detik setelah
    // pindah ke bisnis baru yang sebenarnya masih Gratis, sampai fetch
    // getMembership untuk bisnis baru selesai.
    // Round 4 audit (GPT): reset ke null saja ternyata masih menampilkan
    // data yang BISA salah, karena AccessStatusCard memperlakukan
    // membership === null sama seperti tier "free" -- kalau bisnis baru itu
    // sebenarnya Pro/Platinum, pengguna sempat melihat "Paket Gratis" yang
    // keliru sesaat. Sekarang membershipLoading=true dipasang bersamaan,
    // supaya AccessStatusCard menampilkan skeleton (bukan kartu tier
    // apa pun) sampai getMembership untuk bisnis baru benar-benar selesai.
    setMembership(null);
    setMembershipLoading(true);
    setCompetitorAnalysis(null);
    setCompetitorError(false);
    setCompetitorNotReadyMessage(null);
    setSocialMediaAnalysis(null);
    setSocialMediaError(false);
    setLeadReferrals([]);
    setLeadReferralsError(false);
    setLeadReferralsGenerateError(null);
    setLeadQuota(null);
    setUpdateHistory([]);
    setUpdateHistoryError(false);
    setDecisions([]);
    setDecisionsLoaded(false);
    setDecisionsError(false);
    setReports([]);
    setReportsLoaded(false);
    setReportsError(false);
    setNotifications([]);
    setNotificationsUnreadCount(0);
    setActionPlanItems([]);
    setActionPlanFetched(false);
    setActionPlanError(null);
  }

  async function handleSwitchBusiness(id: string) {
    setActiveBusinessId(id);
    resetPerBusinessCaches();
    setConfirmingDelete(false);
    setDeleteError(null);
    if (user) {
      await supabase
        .from("user_preferences")
        .update({ active_business_profile_id: id })
        .eq("user_id", user.id);
    }
  }

  async function handleDeleteBusiness() {
    if (!activeBusinessId || !session?.access_token) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "archive", businessProfileId: activeBusinessId }),
      });

      if (!response.ok) {
        const json = await response.json();
        setDeleteError(json.error || t.workspace.deleteError);
        setDeleting(false);
        return;
      }

      const remaining = businesses.filter((b) => b.id !== activeBusinessId);
      setBusinesses(remaining);
      setConfirmingDelete(false);
      setDeleting(false);
      setDeletedCount((prev) => prev + 1);

      if (remaining.length > 0) {
        await handleSwitchBusiness(remaining[0].id);
      } else {
        setActiveBusinessId(null);
      }
    } catch (err) {
      console.error("deactivate-business error:", err);
      setDeleteError(t.workspace.deleteError);
      setDeleting(false);
    }
  }

  async function toggleRecycleBin() {
    const next = !showRecycleBin;
    setShowRecycleBin(next);

    if (next && deletedBusinesses.length === 0 && deletedCount > 0) {
      setRecycleBinLoading(true);
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id, business_name, industry")
        .eq("active", false)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDeletedBusinesses(data as BusinessProfileRow[]);
      }
      setRecycleBinLoading(false);
    }
  }

  async function handleRestore(businessProfileId: string) {
    if (!session?.access_token) return;
    setRestoringId(businessProfileId);
    setRestoreError(null);

    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "restore", businessProfileId }),
      });

      if (!response.ok) {
        const json = await response.json();
        console.error("restore-business error:", json.error);
        setRestoreError(json.error || t.workspace.restoreError);
        setRestoringId(null);
        return;
      }

      const restored = deletedBusinesses.find((b) => b.id === businessProfileId);
      setDeletedBusinesses((prev) => prev.filter((b) => b.id !== businessProfileId));
      setDeletedCount((prev) => Math.max(0, prev - 1));
      if (restored) {
        setBusinesses((prev) => [...prev, restored]);
        await handleSwitchBusiness(businessProfileId);
      }
      setRestoringId(null);
    } catch (err) {
      console.error("restore-business error:", err);
      setRestoreError(t.workspace.restoreError);
      setRestoringId(null);
    }
  }

  async function handlePermanentDelete(businessProfileId: string) {
    if (!session?.access_token) return;
    setPermanentDeleting(true);
    setPermanentDeleteError(null);

    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "delete", businessProfileId }),
      });

      if (!response.ok) {
        const json = await response.json();
        setPermanentDeleteError(json.error || t.workspace.permanentDeleteError);
        setPermanentDeleting(false);
        return;
      }

      setDeletedBusinesses((prev) => prev.filter((b) => b.id !== businessProfileId));
      setDeletedCount((prev) => Math.max(0, prev - 1));
      setConfirmingPermanentDeleteId(null);
      setPermanentDeleting(false);
    } catch (err) {
      console.error("permanently-delete-business error:", err);
      setPermanentDeleteError(t.workspace.permanentDeleteError);
      setPermanentDeleting(false);
    }
  }

  // Dipakai berdua: toggle "Riwayat Update Bisnis" di bawah halaman DAN
  // Growth Timeline di menu Growth — satu sumber data (listUpdates), bukan
  // fetch terpisah untuk hal yang sama.
  async function loadUpdateHistory() {
    if (!activeBusinessId || !session?.access_token) return;
    setUpdateHistoryLoading(true);
    setUpdateHistoryError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "listUpdates", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setUpdateHistory(json.updates || []);
      } else {
        console.error("listUpdates error:", json.error);
        setUpdateHistoryError(true);
      }
    } catch (err) {
      console.error("listUpdates error:", err);
      setUpdateHistoryError(true);
    }
    setUpdateHistoryLoading(false);
  }

  async function loadDecisions() {
    if (!activeBusinessId || !session?.access_token) return;
    setDecisionsLoading(true);
    setDecisionsError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "listDecisions", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setDecisions(json.decisions || []);
        setDecisionsLoaded(true);
      } else {
        console.error("listDecisions error:", json.error);
        setDecisionsError(true);
      }
    } catch (err) {
      console.error("listDecisions error:", err);
      setDecisionsError(true);
    }
    setDecisionsLoading(false);
  }

  async function toggleUpdateHistory() {
    const next = !showUpdateHistory;
    setShowUpdateHistory(next);
    if (next) await loadUpdateHistory();
  }

  // Final Reports (Task 13): satu loader dipakai DUA tempat — panel Final
  // Reports (activeMenu === "history") dan arsip di Pengaturan — supaya
  // tidak ada dua definisi "daftar laporan bisnis ini" yang berbeda.
  async function loadReports() {
    if (!activeBusinessId || !session?.access_token) return;
    setReportsLoading(true);
    setReportsError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "listReports", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setReports(json.reports || []);
        setReportsLoaded(true);
      } else {
        console.error("listReports error:", json.error);
        setReportsError(true);
      }
    } catch (err) {
      console.error("listReports error:", err);
      setReportsError(true);
    }
    setReportsLoading(false);
  }

  async function handleGenerateBaselineReport() {
    if (!activeBusinessId || !session?.access_token) return;
    setReportsGenerating(true);
    setReportsGenerateError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "generateBaselineReport", businessProfileId: activeBusinessId, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        await loadReports();
      } else {
        setReportsGenerateError(json.error || t.workspace.finalReportsGenerateError);
      }
    } catch (err) {
      console.error("generateBaselineReport error:", err);
      setReportsGenerateError(t.workspace.finalReportsGenerateError);
    }
    setReportsGenerating(false);
  }

  // Achievement Engine (Tahap 2.4) — murni baca, tidak menghitung apapun di
  // frontend. getAchievements juga men-trigger evaluateAchievements() sekali
  // di server (lihat services/workspace/getAchievements.ts) supaya
  // achievement berbasis waktu murni (member_since_days) tertangkap begitu
  // Growth tab dibuka, bukan cuma saat submit Business Update.
  async function loadAchievements() {
    if (!activeBusinessId || !session?.access_token) return;
    setAchievementsLoading(true);
    setAchievementsError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getAchievements", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setAchievements({ unlocked: json.unlocked || [], nextMilestone: json.nextMilestone || null });
      } else {
        console.error("getAchievements error:", json.error);
        setAchievementsError(true);
      }
    } catch (err) {
      console.error("getAchievements error:", err);
      setAchievementsError(true);
    }
    setAchievementsLoading(false);
  }

  // Business Memory (Master Product Directive, Fase 1) — muat fakta yang
  // diusulkan Beemo dan masih menunggu persetujuan, setiap kali tab Chat
  // dibuka (pola sama dengan loadAchievements di Growth).
  async function loadPendingMemoryFacts() {
    if (!activeBusinessId || !session?.access_token) return;
    setPendingMemoryFactsLoading(true);
    setPendingMemoryFactsError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getPendingMemoryFacts", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setPendingMemoryFacts(json.pending || []);
      } else {
        console.error("getPendingMemoryFacts error:", json.error);
        setPendingMemoryFactsError(true);
      }
    } catch (err) {
      console.error("getPendingMemoryFacts error:", err);
      setPendingMemoryFactsError(true);
    }
    setPendingMemoryFactsLoading(false);
  }

  // Competitor Engine (Master Product Directive, Fase 2) — dimuat saat tab
  // Competitor dibuka. Pipeline penuh (provider->normalizer->engine->
  // opportunity->recommendation) dijalankan di server (lihat
  // services/competitor/getCompetitorAnalysis.ts); di sini murni menampilkan
  // hasilnya. status 422 ("lokasi/industri belum lengkap") BUKAN error teknis
  // — dibedakan supaya tidak menampilkan ErrorCard "Coba Lagi" untuk sesuatu
  // yang retry tidak akan memperbaiki.
  async function loadCompetitorAnalysis(forceRefresh?: boolean) {
    if (!activeBusinessId || !session?.access_token) return;
    setCompetitorLoading(true);
    setCompetitorError(false);
    setCompetitorNotReadyMessage(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "getCompetitorAnalysis", businessProfileId: activeBusinessId, forceRefresh: Boolean(forceRefresh), lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setCompetitorAnalysis(json as CompetitorAnalysisData);
      } else if (response.status === 422) {
        setCompetitorNotReadyMessage(json.error || t.workspace.competitorProPlatinumMessage);
      } else {
        console.error("getCompetitorAnalysis error:", json.error);
        setCompetitorError(true);
      }
    } catch (err) {
      console.error("getCompetitorAnalysis error:", err);
      setCompetitorError(true);
    }
    setCompetitorLoading(false);
  }

  // Medsos Kompetitor (Task 14b) — dipanggil bersamaan dengan
  // loadCompetitorAnalysis (tab yang sama). Selalu berhasil (data mock,
  // tidak bergantung provider eksternal) kecuali business profile tidak
  // valid — tetap ada error state untuk jaga-jaga (network/auth gagal).
  async function loadSocialMediaAnalysis() {
    if (!activeBusinessId || !session?.access_token) return;
    setSocialMediaLoading(true);
    setSocialMediaError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getSocialMediaAnalysis", businessProfileId: activeBusinessId, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setSocialMediaAnalysis(json as SocialMediaAnalysisData);
      } else {
        console.error("getSocialMediaAnalysis error:", json.error);
        setSocialMediaError(true);
      }
    } catch (err) {
      console.error("getSocialMediaAnalysis error:", err);
      setSocialMediaError(true);
    }
    setSocialMediaLoading(false);
  }

  // Referensi Pelanggan Baru (Juli 2026) — riwayat (bukan generate baru),
  // dimuat saat tab dibuka supaya hasil pencarian sebelumnya tidak hilang
  // begitu halaman di-refresh. Lihat services/workspace/leads/listLeadReferrals.ts.
  async function loadLeadReferrals() {
    if (!activeBusinessId || !session?.access_token) return;
    setLeadReferralsLoading(true);
    setLeadReferralsError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "listLeadReferrals", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setLeadReferrals(Array.isArray(json.leads) ? json.leads : []);
      } else {
        console.error("listLeadReferrals error:", json.error);
        setLeadReferralsError(true);
      }
    } catch (err) {
      console.error("listLeadReferrals error:", err);
      setLeadReferralsError(true);
    }
    setLeadReferralsLoading(false);
  }

  // Tombol "Cari Referensi Baru" — memicu batch BARU (biaya nyata: Claude +
  // web search), dibatasi kuota per tier (gratis 1, pro 2, platinum 5) dan
  // rate limit 10x/hari per bisnis di backend. Hasil baru ditaruh di DEPAN
  // riwayat yang sudah ada (bukan menggantikan) — lihat
  // services/workspace/leads/generateLeadReferrals.ts.
  async function generateNewLeadReferrals() {
    if (!activeBusinessId || !session?.access_token) return;
    setLeadReferralsGenerating(true);
    setLeadReferralsGenerateError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "generateLeadReferrals", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setLeadQuota(typeof json.leadQuota === "number" ? json.leadQuota : null);
        const newLeads = Array.isArray(json.leads) ? (json.leads as LeadReferralItem[]) : [];
        if (newLeads.length === 0) {
          setLeadReferralsGenerateError(
            "Belum menemukan calon pelanggan baru yang benar-benar terverifikasi untuk saat ini. Coba lagi nanti.",
          );
        } else {
          setLeadReferrals((prev) => [...newLeads, ...prev]);
        }
      } else {
        setLeadReferralsGenerateError(json.error || "Gagal mencari referensi pelanggan. Coba lagi.");
      }
    } catch (err) {
      console.error("generateLeadReferrals error:", err);
      setLeadReferralsGenerateError("Gagal mencari referensi pelanggan. Coba lagi.");
    }
    setLeadReferralsGenerating(false);
  }

  // Ekonomi Makro (Task 14c) — tidak butuh businessProfileId (data sama
  // untuk semua pengguna), cukup login.
  async function loadMacroSnapshot() {
    if (!session?.access_token) return;
    setMacroLoading(true);
    setMacroError(false);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getMacroSnapshot", lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setMacroSnapshot(json as MacroSnapshotData);
      } else {
        console.error("getMacroSnapshot error:", json.error);
        setMacroError(true);
      }
    } catch (err) {
      console.error("getMacroSnapshot error:", err);
      setMacroError(true);
    }
    setMacroLoading(false);
  }

  // Rencana Aksi Beemo (Phase 3) — dimuat begitu tab Today dibuka (useEffect
  // di bawah). Kalau belum pernah ada rencana untuk bisnis ini (hasPlan
  // false), langsung susun otomatis SEKALI supaya pengguna tidak perlu klik
  // apa pun untuk melihat rencana pertamanya (lihat generateActionPlanNow).
  async function loadActionPlan() {
    if (!activeBusinessId || !session?.access_token) return;
    setActionPlanLoading(true);
    setActionPlanError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "listActionPlan", businessProfileId: activeBusinessId }),
      });
      const json = await response.json();
      if (response.ok) {
        setActionPlanItems((json.items as ActionPlanItemData[]) || []);
        setActionPlanFetched(true);
        if (!json.hasPlan) {
          await generateActionPlanNow();
        }
      } else {
        console.error("listActionPlan error:", json.error);
        setActionPlanFetched(true);
      }
    } catch (err) {
      console.error("listActionPlan error:", err);
      setActionPlanFetched(true);
    }
    setActionPlanLoading(false);
  }

  async function generateActionPlanNow() {
    if (!activeBusinessId || !session?.access_token) return;
    setActionPlanGenerating(true);
    setActionPlanError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "generateActionPlan", businessProfileId: activeBusinessId, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setActionPlanItems((json.items as ActionPlanItemData[]) || []);
      } else {
        setActionPlanError(json.error || t.workspace.actionPlanGenericError);
      }
    } catch (err) {
      console.error("generateActionPlan error:", err);
      setActionPlanError(t.workspace.actionPlanGenericError);
    }
    setActionPlanGenerating(false);
  }

  // Optimistic toggle (langsung terlihat dicentang), dibatalkan kalau
  // ternyata gagal tersimpan di server — pola sama dengan toggleChecklistItem
  // di TodayPanel.
  async function toggleActionPlanItemNow(itemId: string, completed: boolean) {
    setActionPlanItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, completed, completed_at: completed ? new Date().toISOString() : null } : it))
    );
    if (!activeBusinessId || !session?.access_token) return;
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "toggleActionPlanItem", businessProfileId: activeBusinessId, itemId, completed }),
      });
      if (!response.ok) {
        setActionPlanItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, completed: !completed, completed_at: !completed ? new Date().toISOString() : null } : it))
        );
      }
    } catch (err) {
      console.error("toggleActionPlanItem error:", err);
      setActionPlanItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, completed: !completed } : it)));
    }
  }

  // Lonceng Notifikasi — dimuat begitu activeBusinessId siap (useEffect di
  // bawah), bukan cuma saat dropdown dibuka, supaya badge unread langsung
  // terlihat begitu Workspace dibuka. Gagal diam-diam (log saja) — lonceng
  // bukan bagian kritis, tidak perlu ErrorCard/retry seperti panel utama.
  async function loadNotifications() {
    if (!activeBusinessId || !session?.access_token) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getNotifications", businessProfileId: activeBusinessId, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setNotifications((json.notifications as NotificationItemData[]) || []);
        setNotificationsUnreadCount((json.unreadCount as number) || 0);
      } else {
        console.error("getNotifications error:", json.error);
      }
    } catch (err) {
      console.error("getNotifications error:", err);
    }
    setNotificationsLoading(false);
  }

  // Dipanggil begitu dropdown lonceng dibuka — tandai semua notifikasi saat
  // ini sudah dibaca (baik di server lewat markNotificationsSeen, maupun
  // langsung di state lokal supaya badge hilang seketika tanpa nunggu
  // roundtrip lagi).
  function openNotifications() {
    setShowNotifications(true);
    if (notificationsUnreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setNotificationsUnreadCount(0);
    if (activeBusinessId && session?.access_token) {
      fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "markNotificationsSeen", businessProfileId: activeBusinessId }),
      }).catch((err) => console.error("markNotificationsSeen error:", err));
    }
  }

  async function reviewMemoryFactDecision(factId: string, decision: "approve" | "reject") {
    if (!session?.access_token) return;
    setReviewingFactId(factId);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "reviewMemoryFact", factId, decision }),
      });
      if (response.ok) {
        setPendingMemoryFacts((prev) => prev.filter((f) => f.id !== factId));
      } else {
        const json = await response.json();
        console.error("reviewMemoryFact error:", json.error);
      }
    } catch (err) {
      console.error("reviewMemoryFact error:", err);
    }
    setReviewingFactId(null);
  }

  // Reload Timeline (updates + achievements) SAJA — dipakai tombol "Coba
  // Lagi" di ErrorCard bagian Timeline/Achievements/Next Milestone Journey.
  // Satu fungsi retry karena Timeline butuh kedua sumber sekaligus.
  function reloadJourneyTimeline() {
    loadUpdateHistory();
    loadAchievements();
  }

  function handleUpdateSaved(newlyUnlockedFromSave?: Array<Record<string, unknown>>) {
    setShowBusinessUpdate(false);
    // Business Update baru saja memicu Business Health + Progress Engine
    // di server (lihat submitUpdate.ts) — refreshKey memuat ulang health/
    // progress/healthTrend/membership supaya Business Score, Target, dan
    // Growth langsung menampilkan angka terbaru, bukan data basi.
    setRefreshKey((k) => k + 1);
    if (showUpdateHistory || activeMenu === "target") loadUpdateHistory();
    if (newlyUnlockedFromSave && newlyUnlockedFromSave.length > 0) {
      setNewlyUnlocked(newlyUnlockedFromSave);
    }
    loadAchievements();
    // Today Engine di-cache 1x/hari (lihat services/today/computeSnapshot.ts)
    // supaya tidak menghitung ulang tiap kali halaman dibuka. Tapi begitu
    // pelanggan baru saja mengisi Business Update, Today HARUS langsung
    // terasa berubah saat itu juga (inti Daily Operating Loop) — jadi di
    // sini secara eksplisit minta forceRecompute, bukan menunggu cache besok.
    if (session?.access_token && activeBusinessId) {
      setTodaySnapshotLoading(true);
      fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getBusinessOS", businessProfileId: activeBusinessId, forceRecompute: true }),
      })
        .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
          if (ok) {
            setTodaySnapshot(json.snapshot as TodaySnapshotPayload);
            setWeeklyReview((json.weeklyReview as WeeklyReviewPayload) || null);
          }
        })
        .catch((err) => console.error("getBusinessOS forceRecompute error:", err))
        .finally(() => setTodaySnapshotLoading(false));
    }
  }

  // Growth Timeline butuh riwayat Business Update — muat sekali saat menu
  // Growth pertama kali dibuka (kalau belum pernah dimuat lewat toggle di
  // bawah halaman), bukan di setiap render. Achievements & Next Milestone
  // dimuat ulang SETIAP kali Growth dibuka (bukan cuma sekali) supaya
  // achievement berbasis waktu murni (member_since_days) ikut tertangkap.
  useEffect(() => {
    if (activeMenu === "target") {
      if (!showUpdateHistory && updateHistory.length === 0 && !updateHistoryLoading) {
        loadUpdateHistory();
      }
      loadAchievements();
    }
    if (activeMenu === "chat") {
      loadPendingMemoryFacts();
    }
    // Audit Juli 2026: Gratis dulu dikunci total (fetch di-skip sebelum
    // sampai ke server) — sekarang tetap diambil (OpenStreetMap gratis,
    // tidak ada biaya tambahan) supaya Gratis bisa lihat 1 kompetitor asli
    // sebagai teaser sebelum upgrade, bukan beli buta. Kalau nanti Google
    // Places (berbayar) diaktifkan, pertimbangkan ulang baris ini supaya
    // Gratis tetap hanya memakai sumber gratis.
    if (activeMenu === "competitor" && !competitorAnalysis && !competitorLoading) {
      loadCompetitorAnalysis();
    }
    if (activeMenu === "competitor" && !socialMediaAnalysis && !socialMediaLoading) {
      loadSocialMediaAnalysis();
    }
    if (activeMenu === "leads" && leadReferrals.length === 0 && !leadReferralsLoading) {
      loadLeadReferrals();
    }
    if (activeMenu === "today" && !macroSnapshot && !macroLoading) {
      loadMacroSnapshot();
    }
    if (activeMenu === "today" && !actionPlanFetched && !actionPlanLoading) {
      loadActionPlan();
    }
    if (activeMenu === "businessUpdates" && !showUpdateHistory && updateHistory.length === 0 && !updateHistoryLoading) {
      loadUpdateHistory();
    }
    if (activeMenu === "decisionJournal" && tier === "platinum" && !decisionsLoaded && !decisionsLoading) {
      loadDecisions();
    }
    if ((activeMenu === "history" || activeMenu === "settings") && tier !== "free" && !reportsLoaded && !reportsLoading) {
      loadReports();
    }
    // Audit Juli 2026 ("cari celah, dan perbaiki"): bug nyata ditemukan lewat
    // QA production langsung -- efek ini SEBELUMNYA hanya bergantung pada
    // [activeMenu]. Karena "today" adalah tab default saat komponen pertama
    // kali mount, efek ini jalan SEKALI di awal render, tepat saat
    // activeBusinessId/session?.access_token bisa jadi BELUM siap (restore
    // sesi Supabase + daftar bisnis sama-sama async). loadActionPlan() dan
    // loadMacroSnapshot() punya guard "if (!activeBusinessId || !session...)
    // return" -- jadi diam-diam batal tanpa menandai fetched/error apa pun.
    // Karena activeMenu tidak pernah berubah lagi (pengguna tetap di tab
    // Today), efek ini TIDAK PERNAH jalan ulang -- hasilnya "Rencana Beemo
    // Minggu Ini" & "Kondisi Ekonomi Hari Ini" macet permanen di pesan error/
    // kosong walau data sebenarnya ada di server (dibuktikan lewat panggilan
    // API langsung yang berhasil). Menambahkan activeBusinessId &
    // session?.access_token ke dependency array supaya efek ini otomatis
    // jalan ulang begitu keduanya benar-benar siap -- aman dari loop tak
    // berkesudahan karena tiap pemanggilan di dalam sudah dijaga guard
    // "belum pernah dimuat/tidak sedang memuat" masing-masing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, activeBusinessId, session?.access_token]);

  if (loading) {
    return (
      <section className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-6 py-20 text-center">
        <p className="text-neutral-400">{t.workspace.loadingLabel}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold">{t.workspace.notLoggedInTitle}</h1>
        <p className="mt-3 text-sm text-neutral-400">{t.workspace.notLoggedInDesc}</p>
        <button
          onClick={() => hardNavigate("")}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.backToHomeButton}
        </button>
      </section>
    );
  }

  async function handleSignOut() {
    await signOut();
    hardNavigate("");
  }

  // HARUS dicek SEBELUM blok NoBusinessYet di bawah -- lihat catatan di
  // definisi businessesLoadError di atas (bugfix Juli 2026, laporan video
  // pengguna nyata). Query gagal sesaat TIDAK BOLEH diperlakukan sama
  // seperti "akun ini memang belum punya bisnis".
  if (!dataLoading && businessesLoadError) {
    return (
      <section className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold">{t.workspace.loadErrorTitle}</h1>
        <p className="mt-3 text-sm text-neutral-400">{t.workspace.loadErrorDesc}</p>
        <button
          onClick={() => setBusinessesReloadTick((n) => n + 1)}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.loadErrorRetryButton}
        </button>
      </section>
    );
  }

  if (!dataLoading && businesses.length === 0) {
    return <NoBusinessYet t={t} />;
  }

  if (overLimitBlocked) {
    return <WizardCapBlocked variant="overLimit" onUnblocked={() => setOverLimitBlocked(false)} />;
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) || null;
  const latestAnalysis = analyses[0] || null;
  const latestPreview = latestAnalysis?.ai_output || null;
  const latestRawInput = latestAnalysis?.raw_input || null;
  // Sapaan personal di header Today (directive PO: "bukan template, workspace
  // yang hidup") — nama & profesi diambil dari analisa BASELINE (identitas
  // ditetapkan sekali saat wizard pertama, bukan diulang tiap Business
  // Update), fallback ke analisa terbaru kalau baseline entah kenapa tidak
  // ketemu, lalu ke string kosong (jujur — bukan mengarang "Owner" default).
  const baselineAnalysis = analyses.find((a) => a.is_baseline) || latestAnalysis;
  const ownerNama = ((baselineAnalysis?.raw_input as Record<string, string> | null)?.nama || "").trim();
  const ownerProfesi = ((baselineAnalysis?.raw_input as Record<string, string> | null)?.profesi || "").trim();
  const tier = membership?.tier || "free";
  // Business Context (Business Discovery & Dual Workspace directive) —
  // "SATU FIELD, SATU STATUS" yang dibaca seluruh Workspace untuk memilih
  // versi mentor. Pelanggan lama tanpa business_type (sebelum migrasi)
  // fallback ke "grow" — bukan ditebak sebagai fakta baru, hanya supaya
  // Workspace tidak kosong/rusak untuk mereka.
  const businessType: "start" | "grow" = activeBusiness?.business_type === "start" ? "start" : "grow";

  // Navigasi Workspace (directive PO — penyelarasan visi funnel lengkap):
  // sidebar TIDAK LAGI daftar 11 menu flat ("kok terlalu banyak menu ya").
  // Menu yang sama dikelompokkan jadi 4 TAHAP mengikuti alur pikir pelanggan
  // yang natural — urutan tahap BEDA untuk usaha baru vs usaha berjalan,
  // sesuai gambaran eksplisit PO. Ini TIDAK menghapus satu pun fitur/route
  // yang sudah ada (semua MenuKey tetap valid & bisa dituju), murni
  // pengelompokan tampilan — jadi tidak ada logic content-rendering yang
  // berubah, hanya struktur sidebar.
  type MenuItemDef = { key: MenuKey; label: string; subtitle: string };
  const ALL_MENU_ITEMS: Record<Exclude<MenuKey, "settings">, MenuItemDef> = {
    today: { key: "today", label: t.workspace.menuToday, subtitle: t.workspace.todayNavSubtitleToday },
    businessUpdates: {
      key: "businessUpdates",
      label: t.workspace.menuBusinessUpdates,
      subtitle: t.workspace.todayNavSubtitleBusinessUpdates,
    },
    report: { key: "report", label: t.workspace.menuReport, subtitle: t.workspace.todayNavSubtitleReport },
    score: { key: "score", label: t.workspace.menuScore, subtitle: t.workspace.todayNavSubtitleScore },
    competitor: { key: "competitor", label: t.workspace.menuCompetitor, subtitle: t.workspace.todayNavSubtitleCompetitor },
    // Referensi Pelanggan Baru (Juli 2026) — string HARDCODE bahasa
    // Indonesia (bukan lewat t.workspace.*), pola yang sama dengan
    // AdminPage.tsx: menghindari risiko korupsi pada translations.ts (file
    // besar bilingual) untuk satu fitur baru yang memang dari awal
    // Indonesia-saja di produk ini.
    leads: { key: "leads", label: "Referensi Pelanggan", subtitle: "Calon pelanggan baru yang relevan untukmu" },
    // Ekonomi Makro (revisi Juli 2026): halaman/menu berdiri sendiri dihapus,
    // digabung ke dalam Today — lihat kartu "Kondisi Ekonomi Hari Ini".
    // Digabung dengan Journey (audit Juli 2026) — label/subtitle diperbarui
    // supaya mencerminkan isi gabungan (target + progres perjalanan bisnis).
    target: { key: "target", label: t.workspace.menuTarget, subtitle: t.workspace.todayNavSubtitleTargetMerged },
    decisionJournal: {
      key: "decisionJournal",
      label: t.workspace.menuDecisionJournal,
      subtitle: t.workspace.todayNavSubtitleDecisionJournal,
    },
    history: { key: "history", label: t.workspace.menuHistory, subtitle: t.workspace.todayNavSubtitleHistory },
    chat: { key: "chat", label: t.workspace.menuChat, subtitle: t.workspace.todayNavSubtitleChat },
  };
  // Dipertahankan sebagai daftar datar (dipakai untuk lookup judul halaman
  // di header — lihat MENU_ITEMS.find di bawah) — bukan lagi sumber render sidebar.
  const MENU_ITEMS: MenuItemDef[] = Object.values(ALL_MENU_ITEMS);

  const STAGE_GROUPS: { stageLabel: string; items: MenuItemDef[] }[] =
    businessType === "start"
      ? [
          // 1. Kelayakan — "benar/tidak saya mau buka bisnis ini" + PDF baseline.
          { stageLabel: t.workspace.stageStartFeasibility, items: [ALL_MENU_ITEMS.report] },
          // 2. Riset Pasar — laku/tidak, lokasi, peta kompetitor, referensi
          // calon pelanggan pertama begitu tahu produk/lokasinya.
          {
            stageLabel: t.workspace.stageStartMarketFit,
            items: [ALL_MENU_ITEMS.score, ALL_MENU_ITEMS.competitor, ALL_MENU_ITEMS.leads],
          },
          // 3. Persiapan & Pendampingan — 0 sampai launching, dari data PDF.
          {
            stageLabel: t.workspace.stageStartPreparation,
            items: [ALL_MENU_ITEMS.today, ALL_MENU_ITEMS.businessUpdates, ALL_MENU_ITEMS.decisionJournal, ALL_MENU_ITEMS.chat],
          },
          // 4. Progres — kemana arah bisnis ini (Journey digabung ke Target).
          { stageLabel: t.workspace.stageStartProgress, items: [ALL_MENU_ITEMS.target, ALL_MENU_ITEMS.history] },
        ]
      : [
          // 1. Panduan awal — hasil PDF dipandu sesuai tantangan/harapan.
          { stageLabel: t.workspace.stageGrowGuidance, items: [ALL_MENU_ITEMS.report] },
          // 2. Solusi & pendampingan harian — saran, ide, dikawal tiap hari.
          {
            stageLabel: t.workspace.stageGrowDailySupport,
            items: [ALL_MENU_ITEMS.today, ALL_MENU_ITEMS.score, ALL_MENU_ITEMS.businessUpdates, ALL_MENU_ITEMS.chat],
          },
          // 3. Pendukung keputusan — solusi relevan berbasis data+AI untuk
          // setiap masalah, termasuk referensi calon pelanggan baru.
          {
            stageLabel: t.workspace.stageGrowDecisionSupport,
            items: [ALL_MENU_ITEMS.decisionJournal, ALL_MENU_ITEMS.competitor, ALL_MENU_ITEMS.leads],
          },
          // 4. Laporan & progres — kemajuan bisnis + apa saja yang sudah dilakukan (Journey digabung ke Target).
          { stageLabel: t.workspace.stageGrowReview, items: [ALL_MENU_ITEMS.target, ALL_MENU_ITEMS.history] },
        ];

  const SETTINGS_ITEM = { key: "settings" as const, label: t.workspace.menuSettings, subtitle: t.workspace.todayNavSubtitleSettings };

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-400">
            {personalGreeting(t, {
              nama: ownerNama,
              profesi: ownerProfesi,
              businessName: activeBusiness?.business_name || "",
              fallbackName: user.email || "",
            })}
          </p>
          {activeMenu === "today" && todaySnapshot ? (
            <>
              <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {pulseHeadlineText(t, todaySnapshot.pulseLevel, todaySnapshot.score)}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">{pulseSubheadlineText(t, todaySnapshot.pulseLevel)}</p>
            </>
          ) : (
            <>
              <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {fillTemplate(t.workspace.greetingHello, { name: activeBusiness?.business_name || user.email || "" })}
              </h1>
              {/* Master Product Directive Fase 2 (Business Discovery Split):
                  Workspace harus "berubah mengikuti tipe bisnis" — Start
                  Business = mentor membuka usaha, Grow Business = mentor
                  mengembangkan usaha. Kita reuse stageGroup yang SUDAH
                  dihitung Business Stage Engine (services/stage/determineStage.ts,
                  sudah dipakai Today) — bukan membangun sinyal baru — dan
                  menerapkannya sebagai satu baris framing di header, bukan
                  mengubah struktur menu/Design System. */}
              {todaySnapshot && (
                <p className="mt-1 text-sm text-neutral-500">
                  {todaySnapshot.stageGroup === "preparation" ? t.workspace.mentorTonePreparation : t.workspace.mentorToneRunning}
                </p>
              )}
              {/* Living Business Loop: stage rinci (Stage Engine) — badge
                  kecil terpisah dari kalimat mentor tone di atas, supaya
                  pelanggan lihat progresnya berubah berdasarkan event
                  nyata, bukan cuma dua kelompok kasar. */}
              {todaySnapshot && (
                <div className="mt-2">
                  <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {stageDetailLabel(t, todaySnapshot.stageDetail)}
                  </span>
                  {/* Round 2 GAPTEK review: badge saja ("TAHAP: VALIDASI")
                      belum tentu dipahami user gaptek -- satu kalimat
                      penjelas kecil di bawahnya, murni lookup i18n statis. */}
                  {stageDetailDescription(t, todaySnapshot.stageDetail) && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {stageDetailDescription(t, todaySnapshot.stageDetail)}
                    </p>
                  )}
                </div>
              )}
              {/* Business OS Engine — "Target minggu ini" / "Target bulan
                  ini" dari Business Daily Brief. JUJUR: tidak tampil sama
                  sekali kalau belum ada data (bukan placeholder karangan). */}
              {todaySnapshot && (todaySnapshot.targetThisWeek || todaySnapshot.targetThisMonth) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                  {todaySnapshot.targetThisWeek && (
                    <span>
                      <span className="font-semibold text-neutral-300">{t.workspace.targetThisWeekLabel}:</span> {todaySnapshot.targetThisWeek}
                    </span>
                  )}
                  {todaySnapshot.targetThisMonth && (
                    <span>
                      <span className="font-semibold text-neutral-300">{t.workspace.targetThisMonthLabel}:</span> {todaySnapshot.targetThisMonth}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {/* Semua kontrol di baris ini pakai tinggi h-10 (40px) yang sama
            persis supaya center-aligned secara pixel — sebelumnya bell/
            Bantuan/switcher/tombol punya tinggi berbeda-beda (py-1.5 vs
            py-2 vs py-2.5) yang membuat baris terasa tidak rata. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              title={t.workspace.todayNotifTooltip}
              aria-label={t.workspace.todayNotifTooltip}
              onClick={() => (showNotifications ? setShowNotifications(false) : openNotifications())}
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-surface text-neutral-400 transition-colors duration-200 hover:border-primary/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notificationsUnreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {notificationsUnreadCount > 9 ? "9+" : notificationsUnreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              // Anchor kiri (bukan kanan) — bugfix Juli 2026: tombol lonceng
              // ini SELALU jadi kontrol paling kiri di barisnya, jadi
              // "right-0" (buka melebar ke KIRI dari tombol) sering kehabisan
              // ruang dan panel w-80 (320px) terpotong keluar tepi kiri layar
              // — teks jadi tidak terbaca sebagian (dilaporkan pengguna).
              // "left-0" (buka melebar ke KANAN, searah sisa toolbar) selalu
              // ada cukup ruang karena area konten jauh lebih lebar di sana.
              <div className="absolute left-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-bold text-white">{t.workspace.notificationsTitle}</p>
                  <button
                    onClick={() => setShowNotifications(false)}
                    aria-label={t.workspace.notificationsCloseLabel}
                    className="text-neutral-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading && notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-neutral-500">{t.workspace.notificationsLoading}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-neutral-500">{t.workspace.notificationsEmpty}</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          // Audit Juli 2026 ("ketika diklik perpanjangan
                          // masuk langsung untuk melakukan pembayaran"):
                          // notifikasi "waktu langganan akan habis" TIDAK
                          // cukup pindah ke tab Settings (menuKey lama) --
                          // langsung buka modal pembayaran/upgrade supaya
                          // pelanggan tidak perlu cari sendiri tombol
                          // perpanjang.
                          if (n.type === "subscription_expiring") {
                            openUpgradeModal();
                          } else if (n.menuKey) {
                            setActiveMenu(n.menuKey);
                          }
                          setShowNotifications(false);
                        }}
                        disabled={!n.menuKey && n.type !== "subscription_expiring"}
                        className={
                          "block w-full border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 " +
                          (n.menuKey ? "hover:bg-white/5 cursor-pointer" : "cursor-default") +
                          (n.unread ? " bg-primary/[0.04]" : "")
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-white">{n.title}</p>
                          {n.unread && <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-400">{n.body}</p>
                        <p className="mt-1.5 text-[10px] text-neutral-600">{relativeTimeLabel(n.timestamp, t)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Bugfix (QA Juli 2026): tombol ini TIDAK punya onClick sama sekali —
              fiturnya memang belum ada (tooltip sudah jujur bilang "Bantuan
              segera hadir"), tapi sebelumnya masih pakai style hover/focus
              interaktif penuh (border+teks berubah saat hover, ring saat
              focus) persis seperti tombol yang benar-benar berfungsi, jadi
              terlihat seperti tombol rusak/tidak bisa diklik. Disamakan
              dengan pola "Segera Hadir" di Pengaturan -> Edit Profil
              (disabled + cursor-not-allowed + warna pudar, tanpa hover). */}
          <button
            disabled
            title={t.workspace.todayHelpTooltip}
            className="hidden h-10 flex-shrink-0 cursor-not-allowed items-center gap-1.5 rounded-2xl border border-white/10 bg-surface px-4 text-xs font-semibold text-neutral-500 sm:flex"
          >
            <span aria-hidden="true">❔</span> {t.workspace.todayHelpButton}
          </button>
          {activeBusinessId && (
            <>
              <BusinessSwitcher
                businesses={businesses}
                activeId={activeBusinessId}
                onSwitch={handleSwitchBusiness}
                onAddNew={() => hardNavigate("mulai")}
                addLabel={t.workspace.addBusinessButton}
              />
              <button
                onClick={() => setShowBusinessUpdate(true)}
                className="flex h-10 flex-shrink-0 items-center rounded-2xl bg-primary px-5 text-sm font-bold text-black shadow-[0_0_20px_-6px_rgba(255,152,0,0.5)] transition-transform duration-200 hover:scale-[1.03] hover:opacity-90 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {t.workspace.updateBusinessButton}
              </button>
            </>
          )}
          {/* Aksi jarang dipakai (Hapus Bisnis, Keluar) disembunyikan di
              belakang menu titik-tiga supaya header utama tidak penuh —
              cuma Bell/Bantuan/Switcher/Update Bisnis yang selalu terlihat. */}
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              aria-label={t.workspace.accountMenuLabel}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-surface text-neutral-400 transition-colors duration-200 hover:border-primary/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {showAccountMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAccountMenu(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lg">
                  {activeBusinessId && (
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        setConfirmingDelete(true);
                        setDeleteError(null);
                      }}
                      className="block w-full px-4 py-3 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
                    >
                      {t.workspace.deleteBusinessButton}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      handleSignOut();
                    }}
                    className="block w-full px-4 py-3 text-left text-xs font-semibold text-neutral-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
                  >
                    {t.workspace.signOutButton}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmingDelete && activeBusiness && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="text-sm text-neutral-200">
            {fillTemplate(t.workspace.deleteConfirmMessage, { name: activeBusiness.business_name })}
          </p>
          {deleteError && <p className="mt-2 text-sm text-red-400">{deleteError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleDeleteBusiness}
              disabled={deleting}
              className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? t.workspace.deleting : t.workspace.deleteConfirmYes}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
            >
              {t.workspace.deleteConfirmCancel}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <AccessStatusCard membership={membership} loading={membershipLoading} t={t} lang={lang} />
        {checkingUpgrade && (
          <p className="mt-2 text-xs text-neutral-400">{t.workspace.upgradeChecking}</p>
        )}
        {!checkingUpgrade && upgradeOutcome && (
          <p
            className={
              "mt-2 rounded-lg border px-3 py-2 text-xs " +
              (upgradeOutcome === "expired"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : upgradeOutcome === "failed"
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-blue-500/40 bg-blue-500/10 text-blue-300")
            }
          >
            {upgradeOutcome === "expired"
              ? t.workspace.upgradeExpiredMessage
              : upgradeOutcome === "failed"
                ? t.workspace.upgradeFailedMessage
                : t.workspace.upgradePendingMessage}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[264px_1fr]">
        {/* Sidebar — logo, item 2-baris (label+subtitle), indikator aktif
            solid, divider + Pengaturan (masuk fallback ComingSoon yang
            sudah ada, bukan halaman baru), kartu profil di bawah. */}
        <div className="flex flex-col gap-6 md:sticky md:top-6 md:self-start">
          <div className="hidden items-center gap-2.5 px-1 md:flex">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-black text-black">
              🐝
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black tracking-wide text-white">THE HIVE</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{t.workspace.brandTagline}</p>
            </div>
          </div>

          <nav className="flex gap-1.5 overflow-x-auto rounded-[20px] border border-white/5 bg-surface/40 p-3 md:flex-col md:overflow-visible">
            {STAGE_GROUPS.map((group, groupIdx) => (
              <div key={group.stageLabel} className={"flex flex-shrink-0 gap-1.5 md:flex-col " + (groupIdx === 0 ? "" : "md:mt-2")}>
                <p className="hidden px-4 pt-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600 md:block">
                  {groupIdx + 1}. {group.stageLabel}
                </p>
                {group.items.map((item) => {
                  const isActive = activeMenu === item.key;
                  // Visual Priority (Phase 4) — lihat komentar CORE_MENU_KEYS
                  // di atas. Murni tampilan: aksen kiri + teks lebih terang +
                  // badge "Fokus" untuk 4 menu inti saat TIDAK aktif (begitu
                  // aktif, treatment bg-primary yang sudah ada sudah paling
                  // menonjol, tidak perlu badge tambahan). Menu lain sedikit
                  // diredupkan (bukan disembunyikan) supaya kontrasnya terasa.
                  const isCore = CORE_MENU_KEYS.has(item.key);
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveMenu(item.key)}
                      className={
                        "flex flex-shrink-0 items-center gap-3 rounded-2xl border-l-2 px-4 py-2.5 text-left transition-all duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:flex-shrink " +
                        (isActive
                          ? "border-transparent bg-primary text-black shadow-[0_0_16px_-2px_rgba(255,152,0,0.5)]"
                          : isCore
                            ? "border-primary/70 bg-primary/[0.08] text-neutral-200 hover:translate-x-0.5 hover:bg-primary/[0.14] hover:text-white motion-reduce:hover:translate-x-0"
                            : "border-transparent text-neutral-500 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white motion-reduce:hover:translate-x-0")
                      }
                    >
                      <MenuIcon name={item.key} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className={"block text-sm font-bold " + (!isActive && !isCore ? "font-semibold" : "")}>{item.label}</span>
                        <span className={`hidden text-[11px] font-medium md:block ${isActive ? "text-black/60" : isCore ? "text-primary/80" : "text-neutral-600"}`}>
                          {item.subtitle}
                        </span>
                      </span>
                      {isCore && !isActive && (
                        <span className="hidden flex-shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary/80 md:block">
                          {t.workspace.navFocusBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="my-1 hidden border-t border-white/5 md:block" />

            <button
              onClick={() => setActiveMenu("settings")}
              className={
                "flex flex-shrink-0 items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-all duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:flex-shrink " +
                (activeMenu === "settings"
                  ? "bg-primary text-black shadow-[0_0_16px_-2px_rgba(255,152,0,0.5)]"
                  : "text-neutral-400 hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white motion-reduce:hover:translate-x-0")
              }
            >
              <MenuIcon name="settings" />
              <span className="leading-tight">
                <span className="block text-sm font-bold">{SETTINGS_ITEM.label}</span>
                <span className={`hidden text-[11px] font-medium md:block ${activeMenu === "settings" ? "text-black/60" : "text-neutral-500"}`}>
                  {SETTINGS_ITEM.subtitle}
                </span>
              </span>
            </button>
          </nav>

          {/* Kartu profil — data asli (nama bisnis aktif + tier membership),
              bukan foto sungguhan (avatar inisial), murni dekoratif/display,
              tidak ada aksi baru. */}
          {activeBusiness && (
            <div className="hidden items-center gap-3 rounded-[20px] border border-white/5 bg-surface/40 p-3 md:flex">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-black text-primary">
                {activeBusiness.business_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold text-white">{activeBusiness.business_name}</p>
                <p className="truncate text-[11px] font-medium text-neutral-500">
                  {tier === "platinum"
                    ? t.workspace.memberTierPlatinum
                    : tier === "pro"
                      ? t.workspace.memberTierPro
                      : t.workspace.accessFreeTitle}
                </p>
              </div>
            </div>
          )}
        </div>

            {/* Content */}
        <div>
          {businessDataLoading ? (
            <div className="space-y-6" aria-label={t.workspace.loadingDataLabel}>
              <SkeletonCard variant="compact" className="w-48" />
              <SkeletonCard variant="hero" />
              <SkeletonCard variant="default" />
            </div>
          ) : activeMenu === "today" ? (
            <>
              {!quickStartDismissed && QUICK_START_STEPS.some((s) => !visitedMenus.has(s.key)) && (
                <QuickStartCard t={t} visited={visitedMenus} onStepClick={(key) => setActiveMenu(key)} onDismiss={dismissQuickStart} />
              )}
              <TodayPanel
                t={t}
                lang={lang}
                businessProfileId={activeBusinessId || ""}
                businessType={businessType}
                snapshot={todaySnapshot}
                snapshotLoading={todaySnapshotLoading}
                snapshotError={todaySnapshotError}
                onRetrySnapshot={reloadTodaySnapshot}
                onOpenUpdateModal={() => setShowBusinessUpdate(true)}
                onNavigateToInsights={() => setActiveMenu("score")}
                onOpenChat={() => setActiveMenu("chat")}
                onOpenCompetitor={() => setActiveMenu("competitor")}
                scoreHistory={scoreHistory}
                macro={macroSnapshot}
                macroLoading={macroLoading}
                macroError={macroError}
                onRetryMacro={loadMacroSnapshot}
                actionPlanItems={actionPlanItems}
                actionPlanLoading={actionPlanLoading || actionPlanGenerating}
                actionPlanError={actionPlanError}
                onRegenerateActionPlan={generateActionPlanNow}
                onToggleActionPlanItem={toggleActionPlanItemNow}
              />
            </>
          ) : activeMenu === "history" ? (
            <FinalReportsList
              tier={tier}
              t={t}
              lang={lang}
              reports={reports}
              loading={reportsLoading}
              error={reportsError}
              onRetry={loadReports}
              onUpgradeClick={() => openUpgradeModal(true)}
              generating={reportsGenerating}
              generateError={reportsGenerateError}
              onGenerateBaseline={handleGenerateBaselineReport}
              businessName={activeBusiness?.business_name || ""}
            />
          ) : activeMenu === "score" ? (
            <BusinessScorePanel
              preview={latestPreview}
              health={businessHealth}
              tier={tier}
              businessType={businessType}
              t={t}
              lang={lang}
              loading={businessHealthLoading}
              error={businessHealthError}
              onRetry={reloadBusinessHealth}
              onUpgradeClick={() => openUpgradeModal()}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
              scoreHistory={scoreHistory}
            />
          ) : activeMenu === "report" ? (
            <ReportPanel
              preview={latestPreview}
              t={t}
              loading={analysesLoading}
              error={analysesError}
              onRetry={reloadAnalyses}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
            />
          ) : activeMenu === "target" ? (
            // Journey digabung ke sini (audit Juli 2026) — TargetPanel sekarang
            // juga menerima props yang dulu punya GrowthPanel sendiri.
            <TargetPanel
              rawInput={latestRawInput}
              preview={latestPreview}
              tier={tier}
              t={t}
              lang={lang}
              progress={progressData}
              analysesLoading={analysesLoading}
              analysesError={analysesError}
              onRetryAnalyses={reloadAnalyses}
              progressLoading={progressLoading}
              progressError={progressError}
              onRetryProgress={reloadProgress}
              onUpgradeClick={() => openUpgradeModal()}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
              healthTrend={healthTrend}
              updates={updateHistory}
              updatesLoading={updateHistoryLoading}
              achievements={achievements}
              achievementsLoading={achievementsLoading}
              updateHistoryError={updateHistoryError}
              achievementsError={achievementsError}
              onRetryTimeline={reloadJourneyTimeline}
            />
          ) : activeMenu === "competitor" ? (
            <CompetitorPanel
              tier={tier}
              t={t}
              lang={lang}
              onUpgradeClick={() => openUpgradeModal()}
              data={competitorAnalysis}
              loading={competitorLoading}
              error={competitorError}
              notReadyMessage={competitorNotReadyMessage}
              onRetry={() => loadCompetitorAnalysis(true)}
              socialMedia={socialMediaAnalysis}
              socialMediaLoading={socialMediaLoading}
              socialMediaError={socialMediaError}
              onRetrySocialMedia={loadSocialMediaAnalysis}
            />
          ) : activeMenu === "leads" ? (
            <LeadReferralsPanel
              tier={tier}
              leads={leadReferrals}
              loading={leadReferralsLoading}
              error={leadReferralsError}
              onRetry={loadLeadReferrals}
              generating={leadReferralsGenerating}
              generateError={leadReferralsGenerateError}
              onGenerate={generateNewLeadReferrals}
              leadQuota={leadQuota}
            />
          ) : activeMenu === "chat" ? (
            activeBusinessId && (
              <ChatBeemoPanel
                businessProfileId={activeBusinessId}
                tier={tier}
                businessType={businessType}
                t={t}
                lang={lang}
                onUpgradeClick={() => openUpgradeModal()}
                pendingMemoryFacts={pendingMemoryFacts}
                pendingMemoryFactsLoading={pendingMemoryFactsLoading}
                pendingMemoryFactsError={pendingMemoryFactsError}
                reviewingFactId={reviewingFactId}
                onReviewMemoryFact={reviewMemoryFactDecision}
                onRetryPendingMemoryFacts={loadPendingMemoryFacts}
              />
            )
          ) : activeMenu === "settings" ? (
            <SettingsPanel
              t={t}
              lang={lang}
              setLang={setLang}
              activeBusiness={activeBusiness}
              activeBusinessId={activeBusinessId}
              membership={membership}
              membershipLoading={membershipLoading}
              tier={tier}
              businessHealth={businessHealth}
              updateHistory={updateHistory}
              achievements={achievements}
              progressData={progressData}
              reports={reports}
              reportsLoading={reportsLoading}
              reportsError={reportsError}
              onUpgradeClick={() => openUpgradeModal()}
              onSignOut={handleSignOut}
              onDeleteBusiness={() => {
                setConfirmingDelete(true);
                setDeleteError(null);
              }}
            />
          ) : activeMenu === "businessUpdates" ? (
            <BusinessUpdatesList
              updates={updateHistory}
              tier={tier}
              t={t}
              lang={lang}
              loading={updateHistoryLoading}
              error={updateHistoryError}
              onRetry={loadUpdateHistory}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
              weeklyReview={weeklyReview}
            />
          ) : activeMenu === "decisionJournal" ? (
            <DecisionJournalList
              tier={tier}
              t={t}
              lang={lang}
              decisions={decisions}
              loading={decisionsLoading}
              error={decisionsError}
              onRetry={loadDecisions}
              onUpgradeClick={() => openUpgradeModal()}
              businessName={activeBusiness?.business_name || ""}
            />
          ) : (
            <EmptyState
              variant="hero"
              title={MENU_ITEMS.find((m) => m.key === activeMenu)?.label || SETTINGS_ITEM.label}
              description={t.workspace.comingSoonDesc}
              badge={t.workspace.comingSoonBadge}
              note={t.workspace.comingSoonNextUpdate}
            />
          )}
        </div>
      </div>

      {/* Riwayat Update Bisnis */}
      {activeBusinessId && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <button onClick={toggleUpdateHistory} className="text-xs font-semibold text-neutral-400 hover:text-white">
            {t.workspace.updateHistoryToggle}
          </button>

          {showUpdateHistory && (
            <div className="mt-4 space-y-3">
              {updateHistoryLoading ? (
                <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>
              ) : updateHistory.length === 0 ? (
                <p className="text-sm text-neutral-500">{t.workspace.updateHistoryEmpty}</p>
              ) : (
                updateHistory.map((u) => (
                  <div key={u.id as string} className="rounded-xl border border-white/10 bg-surface p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500">
                        {new Date(u.created_at as string).toLocaleDateString(LOCALE_MAP[lang], {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                        {u.kondisi_penjualan === "naik" ? "📈" : u.kondisi_penjualan === "turun" ? "📉" : "➡️"}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-300">{u.content as string}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Recycle Bin — bisnis yang di-soft-delete, bisa dipulihkan atau
          dihapus permanen. Sengaja diletakkan di bawah, tidak mencolok. */}
      {deletedCount > 0 && (
        <div className="mt-8 border-t border-white/10 pt-6">
          <button
            onClick={toggleRecycleBin}
            className="text-xs font-semibold text-neutral-400 hover:text-white"
          >
            {fillTemplate(t.workspace.recycleBinToggle, { count: deletedCount })}
          </button>

          {showRecycleBin && (
            <div className="mt-4 space-y-3">
              {restoreError && <p className="text-sm text-red-400">{restoreError}</p>}
              {recycleBinLoading ? (
                <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>
              ) : deletedBusinesses.length === 0 ? (
                <p className="text-sm text-neutral-500">{t.workspace.recycleBinEmpty}</p>
              ) : (
                deletedBusinesses.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-white/10 bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-neutral-200">{b.business_name}</p>
                        {b.industry && <p className="text-xs text-neutral-500">{b.industry}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRestore(b.id)}
                          disabled={restoringId === b.id}
                          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {restoringId === b.id ? t.workspace.restoring : t.workspace.restoreButton}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmingPermanentDeleteId(b.id);
                            setPermanentDeleteError(null);
                          }}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-500/50"
                        >
                          {t.workspace.permanentDeleteButton}
                        </button>
                      </div>
                    </div>

                    {confirmingPermanentDeleteId === b.id && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                        <p className="text-xs text-neutral-200">
                          {fillTemplate(t.workspace.permanentDeleteConfirmMessage, { name: b.business_name })}
                        </p>
                        {permanentDeleteError && (
                          <p className="mt-1.5 text-xs text-red-400">{permanentDeleteError}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => handlePermanentDelete(b.id)}
                            disabled={permanentDeleting}
                            className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {permanentDeleting ? t.workspace.permanentDeleting : t.workspace.permanentDeleteConfirmYes}
                          </button>
                          <button
                            onClick={() => setConfirmingPermanentDeleteId(null)}
                            disabled={permanentDeleting}
                            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white"
                          >
                            {t.workspace.deleteConfirmCancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}



      {showBusinessUpdate && activeBusinessId && (
        <BusinessUpdateModal
          businessProfileId={activeBusinessId}
          businessType={businessType}
          onClose={() => setShowBusinessUpdate(false)}
          onSaved={handleUpdateSaved}
        />
      )}

      {newlyUnlocked.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[110] max-w-sm space-y-2">
          {newlyUnlocked.map((a) => {
            const message =
              lang === "id"
                ? (a.celebrationMessageId as string | null) || (a.titleId as string)
                : (a.celebrationMessageEn as string | null) || (a.titleEn as string);
            return (
              <div
                key={a.code as string}
                className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-black/95 p-4 shadow-lg backdrop-blur-md"
              >
                <div>
                  <p className="mb-0.5 text-xs font-bold uppercase text-primary">{t.workspace.achievementUnlockedToast}</p>
                  <p className="text-sm text-neutral-200">{message}</p>
                </div>
                <button
                  onClick={() => setNewlyUnlocked((prev) => prev.filter((u) => u.code !== a.code))}
                  aria-label={t.workspace.achievementUnlockedDismiss}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showUpgradeModal && activeBusinessId && (
        <UpgradeModal
          businessProfileId={activeBusinessId}
          businessName={activeBusiness?.business_name || ""}
          currentTier={membership && membership.status === "active" ? membership.tier : "free"}
          platinumOnly={upgradePlatinumOnly}
          onClose={() => {
            setShowUpgradeModal(false);
            setUpgradePlatinumOnly(false);
          }}
          onUpgraded={handleUpgraded}
        />
      )}
    </section>
  );
}

export default Workspace;
