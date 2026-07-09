import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, fillTemplate, LOCALE_MAP } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { hardNavigate } from "../utils/navigate";
import AddBusinessModal from "./AddBusinessModal";
import ChatBeemoPanel from "./ChatBeemoPanel";
import BusinessUpdateModal from "./BusinessUpdateModal";
import UpgradeModal from "./UpgradeModal";
import type { Translations } from "../i18n/translations";

type MenuKey = "today" | "history" | "score" | "report" | "target" | "competitor" | "growth" | "chat";

// --- Tipe data mengikuti skema Domain Model (Tahap 1, 1.5, 1.6) ---
// Catatan penting: Workspace sekarang mendukung BANYAK business_profile per
// akun (Active Business Context), bukan lagi asumsi "1 user = 1 bisnis".

type BusinessProfileRow = {
  id: string;
  business_name: string;
  industry: string | null;
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {businesses.length > 1 ? (
        <select
          value={activeId}
          onChange={(e) => onSwitch(e.target.value)}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 focus:border-primary/50 focus:outline-none"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id} className="bg-black">
              {b.business_name}
            </option>
          ))}
        </select>
      ) : null}
      <button
        onClick={onAddNew}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:border-primary/40 hover:text-white"
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
  t,
  lang,
}: {
  membership: Membership | null;
  t: Translations;
  lang: "id" | "en";
}) {
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

function HistoryList({ analyses, t, lang }: { analyses: AnalysisRow[]; t: Translations; lang: "id" | "en" }) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-neutral-400">{t.workspace.historyEmpty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analyses.map((item) => {
        const namaBisnis = item.raw_input?.namaBisnis || t.workspace.historyUnnamedBusiness;
        const jenisBisnis = item.raw_input?.jenisBisnis || "";
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface p-4"
          >
            <div>
              <p className="font-semibold text-neutral-100">{namaBisnis}</p>
              {jenisBisnis && <p className="text-xs text-neutral-500">{jenisBisnis}</p>}
              <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at, lang)}</p>
            </div>
            {item.is_baseline && (
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-bold uppercase text-neutral-300">
                {t.workspace.historyBaselineBadge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComingSoon({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
      <p className="text-lg font-bold text-neutral-200">{label}</p>
      <p className="mt-2 text-sm text-neutral-500">{desc}</p>
    </div>
  );
}

/** Ditampilkan kalau user sudah login tapi belum punya business_profile
 * SAMA SEKALI (belum pernah menyelesaikan analisis apapun). */
function NoBusinessYet({ t }: { t: Translations }) {
  return (
    <section className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-extrabold">{t.workspace.noBusinessTitle}</h1>
      <p className="mt-3 text-sm text-neutral-400">{t.workspace.noBusinessDesc}</p>
      <button
        onClick={() => hardNavigate("")}
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black hover:opacity-90"
      >
        {t.workspace.startAnalysisButton}
      </button>
    </section>
  );
}

type Tier = "free" | "pro" | "platinum";

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

function BusinessScorePanel({
  preview,
  health,
  tier,
  t,
  lang,
}: {
  preview: PreviewOutput | null;
  health: { dimensions: Record<string, number> | null; overall: number | null };
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
}) {
  const hasHealthData = health.overall !== null && health.dimensions !== null;
  const score = hasHealthData ? (health.overall as number) : preview?.businessHealthScore;

  if (typeof score !== "number") {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-neutral-400">{t.workspace.noAnalysisYet}</p>
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-surface p-6 text-center">
        <p className="text-5xl font-black text-primary">
          {score}
          <span className="text-lg text-neutral-500">/100</span>
        </p>
        <p className="mt-2 text-sm font-bold uppercase tracking-wide text-neutral-300">{statusLabel}</p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
        </div>
        {hasHealthData && (
          <p className="mt-3 text-xs text-neutral-500">
            {t.workspace.healthCalculatedNote}
          </p>
        )}
      </div>

      {tier !== "free" && hasHealthData && health.dimensions && (
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="mb-3 text-sm font-bold text-neutral-200">
            {t.workspace.healthBreakdownTitle}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(health.dimensions).map(([dim, dimScore]) => (
              <div key={dim} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-lg">{DIMENSION_LABELS[dim]?.icon}</div>
                <p className="mt-1 text-xs text-neutral-400">{DIMENSION_LABELS[dim]?.[lang] || dim}</p>
                <p className="text-lg font-bold text-white">{dimScore}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tier !== "free" && preview?.summary && (
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="mb-2 text-sm font-bold text-neutral-200">{t.previewReport.summaryTitle}</h3>
          <p className="text-sm leading-relaxed text-neutral-400">{preview.summary}</p>
        </div>
      )}

      {tier === "platinum" && (preview?.improvements || preview?.opportunity) && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
          <h3 className="mb-2 text-sm font-bold text-primary">{t.workspace.insightBeemoTitle}</h3>
          {preview?.improvements && <p className="text-sm leading-relaxed text-neutral-200">{preview.improvements}</p>}
          {preview?.opportunity && (
            <p className="mt-2 text-sm leading-relaxed text-neutral-200">{preview.opportunity}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Report — sama untuk semua tier (ringkasan analisa penuh). Laporan
 * lengkap PDF PRO/PLATINUM menyusul di Tahap B, tidak menggantikan ini. */
function ReportPanel({ preview, t }: { preview: PreviewOutput | null; t: Translations }) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-neutral-400">{t.workspace.noAnalysisYet}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preview.summary && (
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="mb-2 text-sm font-bold text-neutral-200">{t.previewReport.summaryTitle}</h3>
          <p className="text-sm leading-relaxed text-neutral-400">{preview.summary}</p>
        </div>
      )}

      {preview.findings && preview.findings.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.previewReport.findingsTitle}</h3>
          <ul className="space-y-2">
            {preview.findings.map((f, i) => (
              <li key={i} className="text-sm leading-relaxed text-neutral-400">
                {i + 1}. {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {preview.strengths && (
          <div className="rounded-2xl border border-white/10 bg-surface p-4">
            <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.strengthsTitle}</p>
            <p className="text-sm text-neutral-400">{preview.strengths}</p>
          </div>
        )}
        {preview.improvements && (
          <div className="rounded-2xl border border-white/10 bg-surface p-4">
            <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.improvementsTitle}</p>
            <p className="text-sm text-neutral-400">{preview.improvements}</p>
          </div>
        )}
        {preview.opportunity && (
          <div className="rounded-2xl border border-white/10 bg-surface p-4">
            <p className="mb-1 text-xs font-bold uppercase text-primary">{t.previewReport.opportunityTitle}</p>
            <p className="text-sm text-neutral-400">{preview.opportunity}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Target — target yang pelanggan isi sendiri di wizard. PLATINUM
 * ditambah bagian Progress (placeholder transparan, bukan "coming soon",
 * sampai Business Engine di Tahap 2 jalan). */
function TargetPanel({
  rawInput,
  tier,
  t,
  progress,
}: {
  rawInput: Record<string, string> | null;
  tier: Tier;
  t: Translations;
  progress: {
    journey: { baselineScore: number; currentScore: number; delta: number } | null;
    period: { previousScore: number; currentScore: number; delta: number } | null;
  };
}) {
  const target = rawInput?.target;

  function deltaLabel(delta: number): string {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }

  function deltaColor(delta: number): string {
    if (delta > 0) return "text-green-400";
    if (delta < 0) return "text-red-400";
    return "text-neutral-400";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <h3 className="mb-2 text-sm font-bold text-neutral-200">{t.workspace.targetTitle}</h3>
        {target ? (
          <p className="text-sm leading-relaxed text-neutral-400">{target}</p>
        ) : (
          <p className="text-sm text-neutral-500">{t.workspace.targetEmpty}</p>
        )}
      </div>

      {tier === "platinum" && (
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.targetProgressTitle}</h3>

          {!progress.journey ? (
            <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.targetProgressPlaceholder}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="mb-1 text-xs font-bold uppercase text-neutral-400">
                  {t.workspace.targetJourneyLabel}
                </p>
                <p className="text-2xl font-black text-white">
                  {progress.journey.baselineScore} → {progress.journey.currentScore}
                </p>
                <p className={`text-sm font-semibold ${deltaColor(progress.journey.delta)}`}>
                  {deltaLabel(progress.journey.delta)} {t.workspace.pointsUnit}
                </p>
              </div>

              {progress.period ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-xs font-bold uppercase text-neutral-400">
                    {t.workspace.targetWeekCompareLabel}
                  </p>
                  <p className="text-2xl font-black text-white">
                    {progress.period.previousScore} → {progress.period.currentScore}
                  </p>
                  <p className={`text-sm font-semibold ${deltaColor(progress.period.delta)}`}>
                    {deltaLabel(progress.period.delta)} {t.workspace.pointsUnit}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-neutral-500">
                    {t.workspace.targetWeeklyComparisonPending}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Competitor — terkunci total untuk Gratis (dengan upsell), transparan
 * (bukan "Segera Hadir") untuk PRO/PLATINUM yang menunggu Tahap B. */
function CompetitorPanel({ tier, t, onUpgradeClick }: { tier: Tier; t: Translations; onUpgradeClick: () => void }) {
  if (tier === "free") {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <div className="mb-3 text-2xl">🔒</div>
        <p className="mx-auto max-w-sm text-sm text-neutral-400">{t.workspace.competitorLockedDesc}</p>
        <button
          onClick={onUpgradeClick}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.competitorUpgradeButton}
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
      <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-300">
        {t.workspace.competitorProPlatinumMessage}
      </p>
    </div>
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

/** Growth (Tahap 2.3.1) — TIDAK menghitung apapun sendiri. Menu ini murni
 * membaca hasil Business Engine yang sudah ada: progress_snapshots (lewat
 * getProgress, sudah dipakai TargetPanel), business_health historis (lewat
 * getHealthTrend, baru — baca saja, lihat services/workspace/getHealthTrend.ts),
 * dan business_updates (lewat listUpdates, sudah dipakai toggle riwayat di
 * bawah halaman). Tidak ada AI di sini — itu tugas Tahap AI Engine nanti. */
function GrowthPanel({
  tier,
  t,
  lang,
  onUpgradeClick,
  onOpenUpdateModal,
  progress,
  healthTrend,
  updates,
  updatesLoading,
  achievements,
  achievementsLoading,
}: {
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
  onOpenUpdateModal: () => void;
  progress: {
    journey: { baselineScore: number; currentScore: number; delta: number } | null;
    period: { previousScore: number; currentScore: number; delta: number } | null;
  };
  healthTrend: HealthTrend;
  updates: Array<Record<string, unknown>>;
  updatesLoading: boolean;
  achievements: {
    unlocked: Array<Record<string, unknown>>;
    nextMilestone: Record<string, unknown> | null;
  };
  achievementsLoading: boolean;
}) {
  if (tier === "free") {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <div className="mb-3 text-2xl">🔒</div>
        <p className="mx-auto max-w-sm text-sm text-neutral-400">{t.workspace.growthLockedDesc}</p>
        <button
          onClick={onUpgradeClick}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.growthUpgradeButton}
        </button>
      </div>
    );
  }

  function deltaLabel(delta: number): string {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }

  function deltaColor(delta: number): string {
    if (delta > 0) return "text-green-400";
    if (delta < 0) return "text-red-400";
    return "text-neutral-400";
  }

  if (!progress.journey) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <div className="mb-3 text-2xl">🌱</div>
        <h3 className="mb-2 text-sm font-bold text-neutral-200">{t.workspace.growthEmptyTitle}</h3>
        <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-neutral-400">{t.workspace.growthEmptyDesc}</p>
        <button
          onClick={onOpenUpdateModal}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.updateBusinessButton}
        </button>
      </div>
    );
  }

  const periodDimensions = ["sales", "finance", "customer"] as const;

  return (
    <div className="space-y-4">
      {/* Journey Progress — baseline (Business Update pertama) vs sekarang. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthJourneyTitle}</h3>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-1 text-xs font-bold uppercase text-neutral-400">{t.workspace.growthOverallScoreLabel}</p>
          <p className="text-2xl font-black text-white">
            {progress.journey.baselineScore} → {progress.journey.currentScore}
          </p>
          <p className={`text-sm font-semibold ${deltaColor(progress.journey.delta)}`}>
            {deltaLabel(progress.journey.delta)} {t.workspace.pointsUnit}
          </p>
        </div>

        {healthTrend.biggestMoverDimension && healthTrend.journeyByDimension && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="mb-1 text-xs font-bold uppercase text-primary">{t.workspace.growthBiggestMoverLabel}</p>
            <p className="text-sm font-semibold text-white">
              {DIMENSION_LABELS[healthTrend.biggestMoverDimension]?.[lang] || healthTrend.biggestMoverDimension}{" "}
              <span className={deltaColor(healthTrend.journeyByDimension[healthTrend.biggestMoverDimension].delta)}>
                ({deltaLabel(healthTrend.journeyByDimension[healthTrend.biggestMoverDimension].delta)})
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Period Progress — minggu lalu vs minggu ini, per dimensi. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthPeriodTitle}</h3>
        {!progress.period || !healthTrend.periodByDimension ? (
          <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.growthPeriodEmptyDesc}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <p className="text-xs font-bold uppercase text-neutral-400">{t.workspace.growthOverallScoreLabel}</p>
              <p className={`mt-1 text-sm font-bold ${deltaColor(progress.period.delta)}`}>
                {deltaLabel(progress.period.delta)}
              </p>
            </div>
            {periodDimensions.map((dim) => {
              const d = healthTrend.periodByDimension?.[dim];
              if (!d) return null;
              return (
                <div key={dim} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs font-bold uppercase text-neutral-400">{DIMENSION_LABELS[dim]?.[lang]}</p>
                  <p className={`mt-1 text-sm font-bold ${deltaColor(d.delta)}`}>{deltaLabel(d.delta)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Growth Timeline — menggabungkan riwayat Business Update (sumber
          yang sama dengan toggle "Riwayat Update Bisnis" di bawah halaman)
          dengan momen Achievement terbuka, diurutkan kronologis, supaya
          Timeline benar-benar menceritakan perjalanan bisnis (Product Owner
          review v3 §5) — bukan cuma daftar Business Update. Murni
          menggabung & mengurutkan data yang sudah ada, tidak ada perhitungan
          baru. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthTimelineTitle}</h3>
        <GrowthTimeline
          t={t}
          lang={lang}
          updates={updates}
          updatesLoading={updatesLoading}
          unlockedAchievements={achievements.unlocked}
          achievementsLoading={achievementsLoading}
        />
      </div>

      {/* Achievements — murni baca dari business_achievements (lihat
          services/workspace/getAchievements.ts). Tidak ada badge/skor game —
          hanya judul, deskripsi singkat, dan tanggal terbuka, supaya terasa
          elegan dan profesional, bukan gamifikasi. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
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
                <div
                  key={a.code as string}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-primary/20"
                >
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
                  {businessValue && (
                    <p className="mb-2 text-sm italic text-primary/80">{businessValue}</p>
                  )}
                  <p className="text-xs text-neutral-500">
                    {new Date(a.unlockedAt as string).toLocaleDateString(LOCALE_MAP[lang], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next Milestone — satu kalimat motivasi, dipilih dari achievement
          yang belum terbuka dengan remainingRatio terkecil (lihat
          evaluateAchievements.ts). Tidak menampilkan progress bar/angka
          teknis supaya tetap terasa memotivasi, bukan seperti dashboard game. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <h3 className="mb-3 text-sm font-bold text-neutral-200">{t.workspace.growthNextMilestoneTitle}</h3>
        {achievementsLoading ? (
          <p className="text-sm text-neutral-500">{t.workspace.loadingDataLabel}</p>
        ) : !achievements.nextMilestone ? (
          <p className="text-sm leading-relaxed text-neutral-500">{t.workspace.growthNextMilestoneNone}</p>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold leading-relaxed text-white">
              {fillTemplate(t.workspace.growthNextMilestoneTemplate, {
                remaining: achievements.nextMilestone.remaining as number,
                unit: lang === "id" ? (achievements.nextMilestone.unitId as string) : (achievements.nextMilestone.unitEn as string),
                title:
                  lang === "id"
                    ? (achievements.nextMilestone.titleId as string)
                    : (achievements.nextMilestone.titleEn as string),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
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

type RuleItem = { key: string; params?: Record<string, string | number> };

type TodaySnapshotPayload = {
  stageGroup: "preparation" | "running";
  pulseLevel: "preparation" | "stable" | "attention" | "action_required";
  pulseReasons: Array<{ key: string; params?: Record<string, string | number> }>;
  score: number | null;
  journeyDelta: number | null;
  daysSinceUpdate: number | null;
  priorities: RuleItem[];
  topRisk: RuleItem | null;
  opportunity: RuleItem | null;
  whatChanged: Array<{ dimension: string; delta: number }> | null;
  nextMilestone: { titleId: string; titleEn: string; remaining: number; unitId: string; unitEn: string } | null;
};

const PREPARATION_CHECKLIST_KEYS = ["prep1", "prep2", "prep3", "prep4", "prep5", "prep6"] as const;
const RUNNING_CHECKLIST_KEYS = ["run1", "run2", "run3", "run4", "run5"] as const;

function checklistLabel(t: Translations, key: string): string {
  const map: Record<string, string> = {
    prep1: t.workspace.todayChecklistPrep1,
    prep2: t.workspace.todayChecklistPrep2,
    prep3: t.workspace.todayChecklistPrep3,
    prep4: t.workspace.todayChecklistPrep4,
    prep5: t.workspace.todayChecklistPrep5,
    prep6: t.workspace.todayChecklistPrep6,
    run1: t.workspace.todayChecklistRun1,
    run2: t.workspace.todayChecklistRun2,
    run3: t.workspace.todayChecklistRun3,
    run4: t.workspace.todayChecklistRun4,
    run5: t.workspace.todayChecklistRun5,
  };
  return map[key] || key;
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
  snapshot,
  snapshotLoading,
  onOpenUpdateModal,
  onNavigateToInsights,
  onOpenChat,
}: {
  t: Translations;
  lang: "id" | "en";
  snapshot: TodaySnapshotPayload | null;
  snapshotLoading: boolean;
  onOpenUpdateModal: () => void;
  onNavigateToInsights: () => void;
  onOpenChat: () => void;
}) {
  // Checklist & tombol "Tandai Selesai" di sini SENGAJA hanya state lokal
  // (per sesi, hilang saat reload) — belum ada tabel checklist tersimpan
  // (itu Fase 2 "Mission Today" di roadmap). Diberi catatan kecil di UI
  // supaya jujur ke pengguna, bukan berpura-pura sudah persisten.
  const [missionDone, setMissionDone] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  function toggleChecklistItem(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
  const pulseHeadline =
    snapshot.pulseLevel === "stable"
      ? t.workspace.todayPulseHeadlineStable
      : snapshot.pulseLevel === "attention"
        ? t.workspace.todayPulseHeadlineAttention
        : snapshot.pulseLevel === "action_required"
          ? t.workspace.todayPulseHeadlineActionRequired
          : t.workspace.todayPulseHeadlinePreparation;

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
        ? lang === "id"
          ? "Hari ini"
          : "Today"
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
  const currentJourneyIndex = isPreparation ? 0 : 1;

  return (
    <div className="space-y-8">
      {/* Hero singkat — status hari ini dalam satu kalimat besar. */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{pulse.emoji}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{pulseLabel}</span>
        </div>
        <h1 className="text-2xl font-black leading-[1.15] tracking-tight text-white sm:text-3xl md:text-4xl">
          {pulseHeadline}
        </h1>
      </div>

      {/* Baris metrik — 5 kartu ringkas berdampingan, semua angka dari
          today_snapshot yang sama, hanya disusun ulang secara visual. Target
          Bulan Ini sengaja ditampilkan sebagai placeholder kosong yang jujur
          (belum ada angka target di Business Engine), bukan dikarang. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayPulseLabel}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xl">{pulse.emoji}</span>
            <span className="text-sm font-bold text-white">{pulseLabel}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsScore}</p>
          <p className="mt-2 text-2xl font-black text-white">
            {snapshot.score ?? "—"}
            <span className="text-xs font-normal text-neutral-500">/100</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsJourney}</p>
          <p className="mt-2 text-2xl font-black text-white">
            {snapshot.journeyDelta !== null ? `${snapshot.journeyDelta > 0 ? "+" : ""}${snapshot.journeyDelta}` : "—"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-neutral-500">
            {isPreparation ? t.workspace.todayStageBadgePreparation : t.workspace.todayStageBadgeRunning}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayMetricTargetLabel}</p>
          <p className="mt-2 text-sm font-bold text-neutral-500">{t.workspace.todayMetricTargetEmpty}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.workspace.todayQuickStatsLastUpdate}</p>
          <p className="mt-2 text-sm font-bold text-white">{lastUpdateText}</p>
        </div>
      </div>

      {/* Dua kolom: Mission Today + Checklist/Perubahan/Prioritas di kiri,
          Insight/Opportunity/Reminder di kanan. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Mission Today — kartu terbesar di halaman, memuat priorities[0]
              dari Rule Engine (bukan konsep baru, cuma disorot lebih besar). */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-black p-6 shadow-[0_0_50px_-20px_rgba(0,0,0,0.7)] sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              🎯 {t.workspace.todayMissionBadge}
            </span>
            <h2 className="relative z-10 mt-4 max-w-lg text-xl font-black leading-snug text-white sm:text-2xl md:text-3xl">
              {priorityLines[0] || t.workspace.todayFocusKeepGoing}
            </h2>
            {snapshot.pulseReasons.length > 0 && (
              <p className="relative z-10 mt-2 max-w-lg text-sm leading-relaxed text-neutral-400">
                {snapshot.pulseReasons.map((r) => reasonText(r)).join(" · ")}
              </p>
            )}
            <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenUpdateModal}
                disabled={missionDone}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black transition-transform duration-200 hover:scale-[1.03] hover:opacity-90 disabled:opacity-40 disabled:hover:scale-100"
              >
                {isPreparation ? t.workspace.updateBusinessButton : t.workspace.todayMissionStartButton}
              </button>
              {!isPreparation && (
                <button
                  onClick={() => setMissionDone((v) => !v)}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-neutral-300 transition-colors duration-200 hover:border-primary/40 hover:text-white"
                >
                  {t.workspace.todayMissionDoneButton}
                </button>
              )}
            </div>
            {missionDone && <p className="relative z-10 mt-3 text-xs text-neutral-500">{t.workspace.todayMissionDoneNote}</p>}
            <span className="pointer-events-none absolute -bottom-6 -right-4 select-none text-[130px] leading-none opacity-[0.07]" aria-hidden="true">
              🐝
            </span>
          </div>

          {/* Checklist + Yang Berubah berdampingan (fase persiapan hanya
              menampilkan Checklist, karena belum ada data perbandingan). */}
          <div className={`grid grid-cols-1 gap-6 ${isPreparation ? "" : "sm:grid-cols-2"}`}>
            <div className="rounded-2xl border border-white/10 bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-200">{t.workspace.todayChecklistTitle}</h3>
                <span className="text-xs text-neutral-500">
                  {fillTemplate(t.workspace.todayChecklistCount, { done: checklistDoneCount, total: checklistKeys.length })}
                </span>
              </div>
              <div className="space-y-0.5">
                {checklistKeys.map((key) => {
                  const done = checkedItems.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleChecklistItem(key)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-white/[0.03]"
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] transition-colors duration-200 ${
                          done ? "border-primary bg-primary text-black" : "border-white/20 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={`text-sm ${done ? "text-neutral-600 line-through" : "text-neutral-400"}`}>
                        {checklistLabel(t, key)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 px-2 text-xs text-neutral-700">{t.workspace.todayChecklistSessionNote}</p>
            </div>

            {!isPreparation && (
              <div className="rounded-2xl border border-white/10 bg-surface p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-200">{t.workspace.todayWhatChangedTitle}</h3>
                  {snapshot.whatChanged && snapshot.whatChanged.length > 0 && (
                    <button
                      onClick={onNavigateToInsights}
                      className="text-xs font-semibold text-primary hover:opacity-70"
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

          {/* Prioritas Minggu Ini — data sama persis dengan priorities[]
              (urutan sudah berarti prioritas dari Rule Engine), hanya
              ditampilkan sebagai kartu berperingkat, bukan lagi daftar
              vertikal bernomor besar. */}
          {!isPreparation && snapshot.priorities.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-neutral-200">{t.workspace.todayPrioritiesWeekTitle}</h3>
              <div className="space-y-3">
                {snapshot.priorities.map((p, i) => {
                  const levelLabel =
                    i === 0 ? t.workspace.todayPriorityHigh : i === 1 ? t.workspace.todayPriorityMedium : t.workspace.todayPriorityLow;
                  const borderColor = i === 0 ? "border-l-red-400" : i === 1 ? "border-l-amber-400" : "border-l-green-400";
                  return (
                    <div key={i} className={`flex items-start gap-4 rounded-xl border-l-4 bg-white/[0.03] p-4 ${borderColor}`}>
                      <span className="text-lg font-black text-neutral-600">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{priorityText(p)}</p>
                        <span className="mt-1 inline-block text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          {levelLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Kolom kanan: Insight, Opportunity, Reminder — 3 konsep yang sudah
            ada (whatChanged/opportunity/topRisk), hanya dipisah jadi 3 kartu
            berbeda mengikuti tata letak mockup. Tidak ada AI baru — "Beemo"
            di sini murni persona/branding untuk hasil Rule Engine. */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">🐝</span>
              <h3 className="text-sm font-bold text-primary">{t.workspace.todayInsightTitle}</h3>
            </div>
            <p className="text-sm leading-relaxed text-neutral-200">{biggestMoverInsight}</p>
            <button
              onClick={onNavigateToInsights}
              className="mt-3 text-xs font-semibold text-primary hover:opacity-70"
            >
              {t.workspace.todayInsightLink}
            </button>
          </div>

          {!isPreparation && (
            <div className="rounded-2xl border border-white/10 bg-surface p-6">
              <h3 className="mb-2 text-sm font-bold text-neutral-200">{t.workspace.todayOpportunityTitle}</h3>
              <p className="text-sm leading-relaxed text-neutral-300">
                {opportunityText(snapshot.opportunity) || t.workspace.opportunityGeneric}
              </p>
            </div>
          )}

          {!isPreparation && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
              <h3 className="mb-2 text-sm font-bold text-amber-300">{t.workspace.todayReminderTitle}</h3>
              <p className="text-sm leading-relaxed text-neutral-200">{riskText(snapshot.topRisk)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Journey stepper — full-width, 8 fase dari roadmap. Business Stage
          Engine v1 baru membedakan preparation/running, jadi hanya node
          pertama yang benar-benar pasti; sisanya ditandai "upcoming" apa
          adanya (lihat komentar currentJourneyIndex di atas) — bukan
          dikarang sudah sampai fase tertentu. */}
      <div className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-8">
        <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-neutral-500">{t.workspace.todayJourneyStepperTitle}</h3>
        <div className="flex flex-wrap gap-y-6 sm:flex-nowrap sm:justify-between">
          {JOURNEY_STAGES.map((label, i) => {
            const state = i < currentJourneyIndex ? "done" : i === currentJourneyIndex ? "current" : "upcoming";
            return (
              <div key={label} className="flex w-1/4 flex-col items-center gap-2 px-1 text-center sm:w-auto sm:flex-1">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    state === "done"
                      ? "border-primary bg-primary text-black"
                      : state === "current"
                        ? "border-primary text-primary"
                        : "border-white/15 text-neutral-600"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </div>
                <span className={`max-w-[84px] text-[11px] font-semibold leading-tight ${state === "upcoming" ? "text-neutral-600" : "text-neutral-200"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-neutral-600">{t.workspace.todayJourneyUpcomingNote}</p>
      </div>

      {/* Tombol Chat Beemo mengambang — mengarahkan ke tab Chat yang sudah
          ada, bukan fitur baru. */}
      <button
        onClick={onOpenChat}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-black shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-105"
      >
        <span aria-hidden="true">🐝</span> {t.workspace.todayChatFloatingLabel}
      </button>
    </div>
  );
}

/** Ikon sidebar — outline SVG sederhana, bukan library ikon baru (tidak
 * ada dependency baru ditambah). Menggantikan emoji supaya sidebar terasa
 * lebih modern/premium sesuai arahan desain, murni visual. */
function MenuIcon({ name }: { name: MenuKey }) {
  const common = "h-[18px] w-[18px] flex-shrink-0";
  const props = {
    className: common,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
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
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "competitor":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m14.5 9.5-2 5-5 2 2-5Z" />
        </svg>
      );
    case "growth":
      return (
        <svg {...props}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 6h6v6" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6a8.4 8.4 0 0 1-.9-3.9A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>
      );
    default:
      return null;
  }
}

function Workspace() {
  const { user, session, loading, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("today");
  const [businesses, setBusinesses] = useState<BusinessProfileRow[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [businessHealth, setBusinessHealth] = useState<{ dimensions: Record<string, number> | null; overall: number | null }>({
    dimensions: null,
    overall: null,
  });
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
  const [todaySnapshot, setTodaySnapshot] = useState<TodaySnapshotPayload | null>(null);
  const [todaySnapshotLoading, setTodaySnapshotLoading] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Array<Record<string, unknown>>>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [businessDataLoading, setBusinessDataLoading] = useState(true);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [showBusinessUpdate, setShowBusinessUpdate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [checkingUpgrade, setCheckingUpgrade] = useState(false);
  const [upgradeOutcome, setUpgradeOutcome] = useState<"expired" | "pending" | "failed" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updateHistory, setUpdateHistory] = useState<Array<Record<string, unknown>>>([]);
  const [showUpdateHistory, setShowUpdateHistory] = useState(false);
  const [updateHistoryLoading, setUpdateHistoryLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const MENU_ITEMS: { key: MenuKey; label: string }[] = [
    { key: "today", label: t.workspace.menuToday },
    { key: "score", label: t.workspace.menuScore },
    { key: "report", label: t.workspace.menuReport },
    { key: "target", label: t.workspace.menuTarget },
    { key: "competitor", label: t.workspace.menuCompetitor },
    { key: "growth", label: t.workspace.menuGrowth },
    { key: "history", label: t.workspace.menuHistory },
    { key: "chat", label: t.workspace.menuChat },
  ];

  // Muat daftar business_profiles + Active Business Context (sekali per sesi user)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadBusinesses() {
      setDataLoading(true);

      const [profilesRes, prefsRes, deletedCountRes] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("id, business_name, industry")
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
  }, [user]);

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
      } else {
        setAnalyses((analysesRes.data as AnalysisRow[]) || []);
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
              body: JSON.stringify({ action: "getTodaySnapshot", businessProfileId: activeBusinessId }),
            }),
          ]);
          const healthJson = await healthResponse.json();
          const progressJson = await progressResponse.json();
          const membershipJson = await membershipResponse.json();
          const healthTrendJson = await healthTrendResponse.json();
          const todayJson = await todayResponse.json();
          if (!cancelled) {
            if (healthResponse.ok) {
              setBusinessHealth({ dimensions: healthJson.dimensions, overall: healthJson.overall });
            }
            if (progressResponse.ok) {
              setProgressData({ journey: progressJson.journey, period: progressJson.period });
            }
            if (membershipResponse.ok) {
              setMembership(membershipJson.membership as Membership);
            } else {
              console.error("Gagal memuat membership:", membershipJson.error);
            }
            if (healthTrendResponse.ok) {
              setHealthTrend({
                journeyByDimension: healthTrendJson.journeyByDimension,
                periodByDimension: healthTrendJson.periodByDimension,
                biggestMoverDimension: healthTrendJson.biggestMoverDimension,
              });
            }
            if (todayResponse.ok) {
              setTodaySnapshot(todayJson.snapshot as TodaySnapshotPayload);
            } else {
              console.error("Gagal memuat Today snapshot:", todayJson.error);
            }
          }
        } catch (err) {
          console.error("getBusinessHealth/getProgress/getMembership/getHealthTrend/getTodaySnapshot error:", err);
        } finally {
          if (!cancelled) setTodaySnapshotLoading(false);
        }
      }

      setBusinessDataLoading(false);
    }

    loadBusinessData();

    return () => {
      cancelled = true;
    };
  }, [activeBusinessId, refreshKey]);

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

  function openUpgradeModal() {
    setUpgradeOutcome(null);
    setShowUpgradeModal(true);
  }

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

  async function handleSwitchBusiness(id: string) {
    setActiveBusinessId(id);
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
      if (response.ok) setUpdateHistory(json.updates || []);
    } catch (err) {
      console.error("listUpdates error:", err);
    }
    setUpdateHistoryLoading(false);
  }

  async function toggleUpdateHistory() {
    const next = !showUpdateHistory;
    setShowUpdateHistory(next);
    if (next) await loadUpdateHistory();
  }

  // Achievement Engine (Tahap 2.4) — murni baca, tidak menghitung apapun di
  // frontend. getAchievements juga men-trigger evaluateAchievements() sekali
  // di server (lihat services/workspace/getAchievements.ts) supaya
  // achievement berbasis waktu murni (member_since_days) tertangkap begitu
  // Growth tab dibuka, bukan cuma saat submit Business Update.
  async function loadAchievements() {
    if (!activeBusinessId || !session?.access_token) return;
    setAchievementsLoading(true);
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
      }
    } catch (err) {
      console.error("getAchievements error:", err);
    }
    setAchievementsLoading(false);
  }

  function handleUpdateSaved(newlyUnlockedFromSave?: Array<Record<string, unknown>>) {
    setShowBusinessUpdate(false);
    // Business Update baru saja memicu Business Health + Progress Engine
    // di server (lihat submitUpdate.ts) — refreshKey memuat ulang health/
    // progress/healthTrend/membership supaya Business Score, Target, dan
    // Growth langsung menampilkan angka terbaru, bukan data basi.
    setRefreshKey((k) => k + 1);
    if (showUpdateHistory || activeMenu === "growth") loadUpdateHistory();
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
        body: JSON.stringify({ action: "getTodaySnapshot", businessProfileId: activeBusinessId, forceRecompute: true }),
      })
        .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
        .then(({ ok, json }) => {
          if (ok) setTodaySnapshot(json.snapshot as TodaySnapshotPayload);
        })
        .catch((err) => console.error("getTodaySnapshot forceRecompute error:", err))
        .finally(() => setTodaySnapshotLoading(false));
    }
  }

  // Growth Timeline butuh riwayat Business Update — muat sekali saat menu
  // Growth pertama kali dibuka (kalau belum pernah dimuat lewat toggle di
  // bawah halaman), bukan di setiap render. Achievements & Next Milestone
  // dimuat ulang SETIAP kali Growth dibuka (bukan cuma sekali) supaya
  // achievement berbasis waktu murni (member_since_days) ikut tertangkap.
  useEffect(() => {
    if (activeMenu === "growth") {
      if (!showUpdateHistory && updateHistory.length === 0 && !updateHistoryLoading) {
        loadUpdateHistory();
      }
      loadAchievements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  function handleBusinessCreated(newBusinessProfileId: string) {
    setActiveBusinessId(newBusinessProfileId);
    setShowAddBusiness(false);
    // Ambil ulang daftar lengkap dari server supaya nama/industry akurat.
    supabase
      .from("business_profiles")
      .select("id, business_name, industry")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setBusinesses(data as BusinessProfileRow[]);
      });
  }

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

  if (!dataLoading && businesses.length === 0) {
    return <NoBusinessYet t={t} />;
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) || null;
  const latestAnalysis = analyses[0] || null;
  const latestPreview = latestAnalysis?.ai_output || null;
  const latestRawInput = latestAnalysis?.raw_input || null;
  const tier = membership?.tier || "free";

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.workspace.eyebrow}</span>
          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
            {fillTemplate(t.workspace.greetingHello, { name: activeBusiness?.business_name || user.email || "" })}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activeBusinessId && (
            <>
              <BusinessSwitcher
                businesses={businesses}
                activeId={activeBusinessId}
                onSwitch={handleSwitchBusiness}
                onAddNew={() => setShowAddBusiness(true)}
                addLabel={t.workspace.addBusinessButton}
              />
              <button
                onClick={() => setShowBusinessUpdate(true)}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black shadow-sm shadow-primary/30 transition-transform duration-200 hover:scale-[1.03] hover:opacity-90"
              >
                {t.workspace.updateBusinessButton}
              </button>
              <button
                onClick={() => {
                  setConfirmingDelete(true);
                  setDeleteError(null);
                }}
                className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:border-red-500/50 hover:text-red-200"
              >
                {t.workspace.deleteBusinessButton}
              </button>
            </>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:border-primary/40 hover:text-white"
          >
            {t.workspace.signOutButton}
          </button>
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
        <AccessStatusCard membership={membership} t={t} lang={lang} />
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

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
        {/* Sidebar — lebih lapang, minim border, ikon outline, indikator
            aktif jelas (bukan lagi kotak bordered kecil-kecil). */}
        <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/5 bg-surface/40 p-3 md:flex-col md:overflow-visible">
          {MENU_ITEMS.map((item) => {
            const isActive = activeMenu === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveMenu(item.key)}
                className={
                  "flex flex-shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 md:flex-shrink " +
                  (isActive
                    ? "bg-primary text-black shadow-md shadow-primary/20"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white")
                }
              >
                <MenuIcon name={item.key} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div>
          {businessDataLoading ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
              <p className="text-neutral-400">{t.workspace.loadingDataLabel}</p>
            </div>
          ) : activeMenu === "today" ? (
            <TodayPanel
              t={t}
              lang={lang}
              snapshot={todaySnapshot}
              snapshotLoading={todaySnapshotLoading}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
              onNavigateToInsights={() => setActiveMenu("score")}
              onOpenChat={() => setActiveMenu("chat")}
            />
          ) : activeMenu === "history" ? (
            <HistoryList analyses={analyses} t={t} lang={lang} />
          ) : activeMenu === "score" ? (
            <BusinessScorePanel preview={latestPreview} health={businessHealth} tier={tier} t={t} lang={lang} />
          ) : activeMenu === "report" ? (
            <ReportPanel preview={latestPreview} t={t} />
          ) : activeMenu === "target" ? (
            <TargetPanel rawInput={latestRawInput} tier={tier} t={t} progress={progressData} />
          ) : activeMenu === "competitor" ? (
            <CompetitorPanel tier={tier} t={t} onUpgradeClick={openUpgradeModal} />
          ) : activeMenu === "growth" ? (
            <GrowthPanel
              tier={tier}
              t={t}
              lang={lang}
              onUpgradeClick={openUpgradeModal}
              onOpenUpdateModal={() => setShowBusinessUpdate(true)}
              progress={progressData}
              healthTrend={healthTrend}
              updates={updateHistory}
              updatesLoading={updateHistoryLoading}
              achievements={achievements}
              achievementsLoading={achievementsLoading}
            />
          ) : activeMenu === "chat" ? (
            activeBusinessId && (
              <ChatBeemoPanel
                businessProfileId={activeBusinessId}
                tier={tier}
                t={t}
                lang={lang}
                onUpgradeClick={openUpgradeModal}
              />
            )
          ) : (
            <ComingSoon
              label={MENU_ITEMS.find((m) => m.key === activeMenu)?.label || ""}
              desc={t.workspace.comingSoonDesc}
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

      {showAddBusiness && (
        <AddBusinessModal onClose={() => setShowAddBusiness(false)} onCreated={handleBusinessCreated} />
      )}

      {showBusinessUpdate && activeBusinessId && (
        <BusinessUpdateModal
          businessProfileId={activeBusinessId}
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
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={handleUpgraded}
        />
      )}
    </section>
  );
}

export default Workspace;
