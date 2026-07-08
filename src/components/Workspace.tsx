import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { hardNavigate } from "../utils/navigate";
import AddBusinessModal from "./AddBusinessModal";
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
  raw_input: { namaBisnis?: string; jenisBisnis?: string } | null;
  is_baseline: boolean;
  created_at: string;
};

type SubscriptionRow = {
  tier: "free" | "pro" | "platinum";
  status: "active" | "expired" | "cancelled";
  expires_at: string | null;
};

function formatDate(iso: string, lang: "id" | "en") {
  return new Date(iso).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysLeft(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
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
  subscription,
  t,
  lang,
}: {
  subscription: SubscriptionRow | null;
  t: Translations;
  lang: "id" | "en";
}) {
  if (!subscription || subscription.tier === "free" || !subscription.expires_at) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{t.workspace.accessFreeLabel}</p>
        <p className="mt-2 text-lg font-bold text-neutral-200">{t.workspace.accessFreeTitle}</p>
        <p className="mt-1 text-sm text-neutral-400">{t.workspace.accessFreeDesc}</p>
      </div>
    );
  }

  const isPlatinum = subscription.tier === "platinum";
  const remaining = daysLeft(subscription.expires_at);

  return (
    <div
      className={
        "rounded-2xl border p-5 " +
        (isPlatinum ? "border-purple-500/40 bg-purple-500/10" : "border-blue-500/40 bg-blue-500/10")
      }
    >
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t.workspace.accessActiveLabel}</p>
      <p className={"mt-2 text-lg font-bold " + (isPlatinum ? "text-purple-300" : "text-blue-300")}>
        {fillTemplate(t.workspace.accessActiveTitle, { tier: subscription.tier.toUpperCase() })}
      </p>
      <p className="mt-1 text-sm text-neutral-300">
        {fillTemplate(t.workspace.accessActiveRemaining, {
          days: remaining,
          date: formatDate(subscription.expires_at, lang),
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

function Workspace() {
  const { user, session, loading, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("history");
  const [businesses, setBusinesses] = useState<BusinessProfileRow[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [businessDataLoading, setBusinessDataLoading] = useState(true);
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);
  const [deletedBusinesses, setDeletedBusinesses] = useState<BusinessProfileRow[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
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

      const [analysesRes, subscriptionRes] = await Promise.all([
        supabase
          .from("analyses")
          .select("id, raw_input, is_baseline, created_at")
          .eq("business_profile_id", activeBusinessId)
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("tier, status, expires_at")
          .eq("business_profile_id", activeBusinessId)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (analysesRes.error) {
        console.error("Gagal memuat analyses:", analysesRes.error);
      } else {
        setAnalyses((analysesRes.data as AnalysisRow[]) || []);
      }

      if (subscriptionRes.error) {
        console.error("Gagal memuat subscriptions:", subscriptionRes.error);
      } else {
        setSubscription((subscriptionRes.data as SubscriptionRow | null) || null);
      }

      setBusinessDataLoading(false);
    }

    loadBusinessData();

    return () => {
      cancelled = true;
    };
  }, [activeBusinessId]);

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
      const response = await fetch("/api/deactivate-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ businessProfileId: activeBusinessId }),
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

    try {
      const response = await fetch("/api/restore-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ businessProfileId }),
      });

      if (!response.ok) {
        const json = await response.json();
        console.error("restore-business error:", json.error);
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
      setRestoringId(null);
    }
  }

  async function handlePermanentDelete(businessProfileId: string) {
    if (!session?.access_token) return;
    setPermanentDeleting(true);
    setPermanentDeleteError(null);

    try {
      const response = await fetch("/api/permanently-delete-business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ businessProfileId }),
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
        <AccessStatusCard subscription={subscription} t={t} lang={lang} />
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
          ) : (
            <ComingSoon
              label={MENU_ITEMS.find((m) => m.key === activeMenu)?.label || ""}
              desc={t.workspace.comingSoonDesc}
            />
          )}
        </div>
      </div>

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
    </section>
  );
}

export default Workspace;
