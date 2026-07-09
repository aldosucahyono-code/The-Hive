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

type MenuKey = "history" | "score" | "report" | "target" | "competitor" | "growth" | "chat";

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

/** Growth — sama pola dengan Competitor. */
function GrowthPanel({ tier, t, onUpgradeClick }: { tier: Tier; t: Translations; onUpgradeClick: () => void }) {
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
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
      <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-300">
        {t.workspace.growthProPlatinumMessage}
      </p>
    </div>
  );
}

function Workspace() {
  const { user, session, loading, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("history");
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

  const MENU_ITEMS: { key: MenuKey; label: string; icon: string }[] = [
    { key: "score", label: t.workspace.menuScore, icon: "📊" },
    { key: "report", label: t.workspace.menuReport, icon: "📄" },
    { key: "target", label: t.workspace.menuTarget, icon: "🎯" },
    { key: "competitor", label: t.workspace.menuCompetitor, icon: "🧭" },
    { key: "growth", label: t.workspace.menuGrowth, icon: "📈" },
    { key: "history", label: t.workspace.menuHistory, icon: "🕘" },
    { key: "chat", label: t.workspace.menuChat, icon: "💬" },
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
        try {
          // Membership TIDAK dibaca langsung dari tabel subscriptions di
          // sini lagi — selalu lewat action "getMembership", supaya
          // pengecekan expires_at konsisten dengan services/beemo/chat.ts
          // (satu sumber kebenaran: services/membership/getActiveMembership.ts).
          const [healthResponse, progressResponse, membershipResponse] = await Promise.all([
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
          ]);
          const healthJson = await healthResponse.json();
          const progressJson = await progressResponse.json();
          const membershipJson = await membershipResponse.json();
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
          }
        } catch (err) {
          console.error("getBusinessHealth/getProgress/getMembership error:", err);
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

  async function toggleUpdateHistory() {
    const next = !showUpdateHistory;
    setShowUpdateHistory(next);
    if (next && activeBusinessId && session?.access_token) {
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
  }

  function handleUpdateSaved() {
    setShowBusinessUpdate(false);
    if (showUpdateHistory) {
      setShowUpdateHistory(false);
      toggleUpdateHistory();
    }
  }

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
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.workspace.eyebrow}</span>
          <h1 className="mt-1 text-xl font-extrabold">
            {fillTemplate(t.workspace.greetingHello, { name: activeBusiness?.business_name || user.email || "" })}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                className="rounded-full bg-primary/90 px-4 py-2 text-xs font-bold text-black hover:opacity-90"
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {MENU_ITEMS.map((item) => {
            const isActive = activeMenu === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveMenu(item.key)}
                className={
                  "flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors md:flex-shrink " +
                  (isActive
                    ? "bg-primary text-black"
                    : "border border-white/10 bg-surface text-neutral-300 hover:border-primary/30 hover:text-white")
                }
              >
                <span>{item.icon}</span>
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
            <GrowthPanel tier={tier} t={t} onUpgradeClick={openUpgradeModal} />
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
