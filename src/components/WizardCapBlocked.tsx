import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { hardNavigate } from "../utils/navigate";
import PricingCards, { type PlanId } from "./PricingCards";

// Audit Juli 2026 (directive PO: "satu-satunya pintu... hanya lewat chat
// wizzard", plus batas 2/3/5 bisnis per tier di services/business/
// checkBusinessCap.ts) — dipanggil dari ChatWizard SEBELUM pertanyaan
// apapun ditampilkan, HANYA untuk pengunjung yang sudah login. Kalau sudah
// di batas, tawarkan dua jalan keluar: arsipkan salah satu bisnis lama
// (buka slot langsung di sini), atau upgrade salah satu bisnis yang sudah
// ada ke paket lebih tinggi (diarahkan ke Workspace, karena upgrade selalu
// terikat ke SATU business_profile spesifik lewat UpgradeModal — bukan
// sesuatu yang bisa diselesaikan di layar ini).

type CapTier = "free" | "pro" | "platinum";

type BusinessRow = { id: string; business_name: string; industry: string | null };

type WizardCapBlockedProps = {
  onUnblocked: () => void;
};

function WizardCapBlocked({ onUnblocked }: WizardCapBlockedProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [phase, setPhase] = useState<"checking" | "capped">("checking");
  const [highestTier, setHighestTier] = useState<CapTier>("free");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function checkCap() {
    if (!session?.access_token) {
      onUnblocked();
      return;
    }
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getCap" }),
      });
      const json = await res.json();
      if (res.ok && json.allowed === false) {
        setHighestTier((json.highestTier as CapTier) || "free");
        const { data } = await supabase
          .from("business_profiles")
          .select("id, business_name, industry")
          .eq("active", true)
          .order("created_at", { ascending: true });
        setBusinesses((data as BusinessRow[]) || []);
        setPhase("capped");
      } else {
        onUnblocked();
      }
    } catch (err) {
      console.error("WizardCapBlocked getCap error:", err);
      // Gagal cek -> jangan mengunci pengunjung gara-gara masalah jaringan
      // sesaat; pengecekan defense-in-depth tetap ada di server saat submit.
      onUnblocked();
    }
  }

  useEffect(() => {
    checkCap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleArchive(businessProfileId: string) {
    if (!session?.access_token) return;
    setArchivingId(businessProfileId);
    setArchiveError(null);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "archive", businessProfileId }),
      });
      if (!res.ok) {
        const json = await res.json();
        setArchiveError(json.error || t.wizardCapBlocked.archiveError);
        setArchivingId(null);
        return;
      }
      setBusinesses((prev) => prev.filter((b) => b.id !== businessProfileId));
      setArchivingId(null);
      // Slot baru saja terbuka — cek ulang cap dari server (bukan menebak
      // secara lokal) supaya tetap konsisten kalau ada perubahan lain.
      setPhase("checking");
      checkCap();
    } catch (err) {
      console.error("WizardCapBlocked archive error:", err);
      setArchiveError(t.wizardCapBlocked.archiveError);
      setArchivingId(null);
    }
  }

  if (phase === "checking") {
    return (
      <section className="mx-auto max-w-lg px-6 py-20 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-neutral-300">{t.wizardCapBlocked.checkingLabel}</p>
      </section>
    );
  }

  const desc =
    highestTier === "platinum"
      ? t.addBusinessModal.capBlockedDescPlatinum
      : highestTier === "pro"
        ? t.addBusinessModal.capBlockedDescPro
        : t.addBusinessModal.capBlockedDescFree;

  const visiblePlans: PlanId[] = highestTier === "pro" ? ["platinum"] : ["pro", "platinum"];

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="mb-3 text-3xl">🔒</div>
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">{t.addBusinessModal.capBlockedTitle}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">{desc}</p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
        <h2 className="mb-1 text-sm font-bold text-white">{t.wizardCapBlocked.businessListTitle}</h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">{t.wizardCapBlocked.archiveNote}</p>
        {archiveError && <p className="mb-3 text-sm text-red-400">{archiveError}</p>}
        <div className="space-y-2.5">
          {businesses.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{b.business_name}</p>
                {b.industry && <p className="text-xs text-neutral-500">{b.industry}</p>}
              </div>
              <button
                onClick={() => handleArchive(b.id)}
                disabled={archivingId === b.id}
                className="rounded-full border border-red-500/30 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {archivingId === b.id ? t.wizardCapBlocked.archiving : t.wizardCapBlocked.archiveButton}
              </button>
            </div>
          ))}
        </div>
      </div>

      {highestTier !== "platinum" && (
        <div>
          <p className="mb-4 text-center text-xs leading-relaxed text-neutral-500">{t.wizardCapBlocked.upgradeNote}</p>
          <PricingCards
            visiblePlans={visiblePlans}
            onSelect={() => hardNavigate("workspace")}
            loadingPlan={null}
            ctaLabel={{
              pro: t.wizardCapBlocked.goWorkspaceButton,
              platinum: t.wizardCapBlocked.goWorkspaceButton,
              preparing: t.wizardCapBlocked.goWorkspaceButton,
            }}
          />
        </div>
      )}
    </section>
  );
}

export default WizardCapBlocked;
