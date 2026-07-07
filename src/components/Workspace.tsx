import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { hardNavigate } from "../utils/navigate";

type MenuKey = "history" | "score" | "report" | "target" | "competitor" | "growth" | "chat";

const MENU_ITEMS: { key: MenuKey; label: string; icon: string }[] = [
  { key: "score", label: "Business Score", icon: "📊" },
  { key: "report", label: "Report", icon: "📄" },
  { key: "target", label: "Target", icon: "🎯" },
  { key: "competitor", label: "Competitor", icon: "🧭" },
  { key: "growth", label: "Growth", icon: "📈" },
  { key: "history", label: "History", icon: "🕘" },
  { key: "chat", label: "Chat Beemo", icon: "💬" },
];

type AnalysisRow = {
  id: string;
  tier: "free" | "pro" | "platinum";
  wizard_data: { namaBisnis?: string; jenisBisnis?: string } | null;
  status: string;
  created_at: string;
};

type AccessGrantRow = {
  id: string;
  tier: "pro" | "platinum";
  expires_at: string;
  is_active: boolean;
};

const TIER_BADGE: Record<string, string> = {
  free: "border-white/20 bg-white/5 text-neutral-300",
  pro: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  platinum: "border-purple-500/40 bg-purple-500/10 text-purple-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysLeft(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

/** Kartu ringkasan status akses paling atas — menjawab pertanyaan
 * "aku sekarang punya akses apa, sampai kapan?" dalam sekali lihat. */
function AccessStatusCard({ grants }: { grants: AccessGrantRow[] }) {
  const now = Date.now();
  const activeGrant = grants
    .filter((g) => g.is_active && new Date(g.expires_at).getTime() > now)
    .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime())[0];

  if (!activeGrant) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Status Akses</p>
        <p className="mt-2 text-lg font-bold text-neutral-200">Paket Gratis</p>
        <p className="mt-1 text-sm text-neutral-400">
          Upgrade ke PRO atau PLATINUM untuk membuka laporan lengkap & konsultasi Chat Beemo.
        </p>
      </div>
    );
  }

  const isPlatinum = activeGrant.tier === "platinum";
  const remaining = daysLeft(activeGrant.expires_at);

  return (
    <div
      className={
        "rounded-2xl border p-5 " +
        (isPlatinum ? "border-purple-500/40 bg-purple-500/10" : "border-blue-500/40 bg-blue-500/10")
      }
    >
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Status Akses</p>
      <p className={"mt-2 text-lg font-bold " + (isPlatinum ? "text-purple-300" : "text-blue-300")}>
        {activeGrant.tier.toUpperCase()} Aktif
      </p>
      <p className="mt-1 text-sm text-neutral-300">
        Sisa <strong>{remaining} hari</strong> lagi (berakhir {formatDate(activeGrant.expires_at)})
      </p>
    </div>
  );
}

function HistoryList({ analyses }: { analyses: AnalysisRow[] }) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-neutral-400">Belum ada riwayat analisis. Mulai analisis pertamamu dari Beranda.</p>
        <button
          onClick={() => hardNavigate("")}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-bold text-black hover:opacity-90"
        >
          Mulai Analisis Baru
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analyses.map((item) => {
        const namaBisnis = item.wizard_data?.namaBisnis || "Tanpa Nama Bisnis";
        const jenisBisnis = item.wizard_data?.jenisBisnis || "";
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface p-4"
          >
            <div>
              <p className="font-semibold text-neutral-100">{namaBisnis}</p>
              {jenisBisnis && <p className="text-xs text-neutral-500">{jenisBisnis}</p>}
              <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
            </div>
            <span
              className={
                "rounded-full border px-3 py-1 text-xs font-bold uppercase " +
                (TIER_BADGE[item.tier] || TIER_BADGE.free)
              }
            >
              {item.tier}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
      <p className="text-lg font-bold text-neutral-200">{label}</p>
      <p className="mt-2 text-sm text-neutral-500">Menu ini sedang kami siapkan, segera hadir di Workspace kamu.</p>
    </div>
  );
}

function Workspace() {
  const { user, loading, signOut } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("history");
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [grants, setGrants] = useState<AccessGrantRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadData() {
      setDataLoading(true);

      const [analysesRes, grantsRes] = await Promise.all([
        supabase
          .from("analyses")
          .select("id, tier, wizard_data, status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("access_grants")
          .select("id, tier, expires_at, is_active"),
      ]);

      if (cancelled) return;

      if (analysesRes.error) {
        console.error("Gagal memuat analyses:", analysesRes.error);
      } else {
        setAnalyses((analysesRes.data as AnalysisRow[]) || []);
      }

      if (grantsRes.error) {
        console.error("Gagal memuat access_grants:", grantsRes.error);
      } else {
        setGrants((grantsRes.data as AccessGrantRow[]) || []);
      }

      setDataLoading(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <section className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-6 py-20 text-center">
        <p className="text-neutral-400">Memuat Workspace kamu...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Kamu belum login</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Aktifkan Workspace dulu lewat tombol di Navbar untuk mengakses halaman ini.
        </p>
        <button
          onClick={() => hardNavigate("")}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black hover:opacity-90"
        >
          Kembali ke Beranda
        </button>
      </section>
    );
  }

  async function handleSignOut() {
    await signOut();
    hardNavigate("");
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Workspace</span>
          <h1 className="mt-1 text-xl font-extrabold">Halo, {user.email}</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:border-primary/40 hover:text-white"
        >
          Keluar dari Workspace
        </button>
      </div>

      <div className="mb-6">
        <AccessStatusCard grants={grants} />
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
          {dataLoading ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
              <p className="text-neutral-400">Memuat data...</p>
            </div>
          ) : activeMenu === "history" ? (
            <HistoryList analyses={analyses} />
          ) : (
            <ComingSoon label={MENU_ITEMS.find((m) => m.key === activeMenu)?.label || ""} />
          )}
        </div>
      </div>
    </section>
  );
}

export default Workspace;
