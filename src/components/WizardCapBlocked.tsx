import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { hardNavigate } from "../utils/navigate";
import PricingCards, { type PlanId } from "./PricingCards";

// Audit Juli 2026 (directive PO: "satu-satunya pintu... hanya lewat chat
// wizzard", plus batas 2/3/5 bisnis per tier di services/business/
// checkBusinessCap.ts) — dipanggil dari ChatWizard SEBELUM pertanyaan
// apapun ditampilkan (untuk pengunjung yang sudah login), DAN dari
// Workspace.tsx sebagai gate wajib begitu user login tapi akunnya
// kelebihan slot (mis. langganan Pro-nya kedaluwarsa, count masih 3 tapi
// cap balik ke 2 — directive PO: "user ketika login lagi, sebelum alamat
// workspace, wajib diberi keterangan untuk hapus salah satu bisninsya, atau
// upgrade"). Kalau sudah di batas, tawarkan dua jalan keluar: hapus PERMANEN
// salah satu bisnis lama (langsung dari database, bukan cuma arsip — sesuai
// directive PO, berlaku untuk semua tier termasuk Platinum), atau upgrade
// salah satu bisnis yang sudah ada ke paket lebih tinggi (diarahkan ke
// Workspace, karena upgrade selalu terikat ke SATU business_profile
// spesifik lewat UpgradeModal — bukan sesuatu yang bisa diselesaikan di
// layar ini).
//
// Penghapusan permanen di sini SENGAJA tetap lewat DUA panggilan API
// (archive lalu delete), bukan melonggarkan guard "tidak boleh hard-delete
// bisnis yang masih aktif" di services/business/delete.ts — guard itu
// tetap berlaku sebagai pengaman umum (mis. kalau ada bug di tempat lain
// yang memanggil delete langsung), cuma di alur INI kedua langkah itu
// digabung jadi satu tombol supaya user tidak perlu bolak-balik.

type CapTier = "free" | "pro" | "platinum";

type BusinessRow = { id: string; businessName: string; industry: string | null; tier: CapTier };

type WizardCapBlockedProps = {
  onUnblocked: () => void;
  // "adding" (default) = dipicu dari Chat Wizard saat mau menambah bisnis.
  // "overLimit" = dipicu dari Workspace.tsx saat user login tapi akunnya
  // SUDAH kelebihan slot (mis. langganan kedaluwarsa) — teksnya lebih
  // menekankan "kamu sudah melebihi batas", bukan "tidak bisa menambah lagi".
  variant?: "adding" | "overLimit";
};

const TIER_BADGE: Record<CapTier, { label: string; className: string }> = {
  free: { label: "GRATIS", className: "border-white/15 text-neutral-400" },
  pro: { label: "PRO", className: "border-amber-500/40 text-amber-300" },
  platinum: { label: "PLATINUM", className: "border-purple-500/40 text-purple-300" },
};

function WizardCapBlocked({ onUnblocked, variant = "adding" }: WizardCapBlockedProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [phase, setPhase] = useState<"checking" | "capped">("checking");
  const [highestTier, setHighestTier] = useState<CapTier>("free");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      // "adding" (dipicu dari Chat Wizard, mau bikin SATU LAGI bisnis) pakai
      // json.allowed ("count >= cap", tidak boleh nambah lagi walau pas di
      // batas). "overLimit" (dipicu dari Workspace.tsx begitu login) pakai
      // syarat lebih ketat count > cap — pas DI batas itu sah-sah saja untuk
      // sekadar membuka Workspace, cuma tidak boleh nambah baru lagi.
      const isBlocked =
        variant === "overLimit"
          ? typeof json.count === "number" && typeof json.cap === "number" && json.count > json.cap
          : json.allowed === false;
      if (res.ok && isBlocked) {
        setHighestTier((json.highestTier as CapTier) || "free");
        const rows = Array.isArray(json.businesses) ? json.businesses : [];
        setBusinesses(
          rows.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            businessName: b.businessName as string,
            industry: (b.industry as string | null) || null,
            tier: (b.tier as CapTier) || "free",
          }))
        );
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

  async function handlePermanentDelete(businessProfileId: string) {
    if (!session?.access_token) return;
    setDeletingId(businessProfileId);
    setDeleteError(null);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
    try {
      // Langkah 1: nonaktifkan dulu (guard di services/business/delete.ts
      // menolak hard-delete bisnis yang masih aktif) — lalu langkah 2: hapus
      // permanen sungguhan. Kalau langkah 2 gagal, bisnis tetap sudah
      // ter-nonaktifkan (slot tetap terbuka), jadi tidak fatal — user bisa
      // selesaikan penghapusan permanennya nanti lewat Pengaturan.
      const archiveRes = await fetch("/api/business", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "archive", businessProfileId }),
      });
      if (!archiveRes.ok) {
        const json = await archiveRes.json();
        setDeleteError(json.error || t.wizardCapBlocked.deleteError);
        setDeletingId(null);
        return;
      }

      const deleteRes = await fetch("/api/business", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete", businessProfileId }),
      });
      if (!deleteRes.ok) {
        const json = await deleteRes.json();
        setDeleteError(json.error || t.wizardCapBlocked.deletePartialError);
        setDeletingId(null);
        return;
      }

      setBusinesses((prev) => prev.filter((b) => b.id !== businessProfileId));
      setConfirmingDeleteId(null);
      setDeletingId(null);
      // Slot baru saja terbuka — cek ulang cap dari server (bukan menebak
      // secara lokal) supaya tetap konsisten kalau ada perubahan lain.
      setPhase("checking");
      checkCap();
    } catch (err) {
      console.error("WizardCapBlocked delete error:", err);
      setDeleteError(t.wizardCapBlocked.deleteError);
      setDeletingId(null);
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
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">
          {variant === "overLimit" ? t.wizardCapBlocked.overLimitTitle : t.addBusinessModal.capBlockedTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          {variant === "overLimit" ? t.wizardCapBlocked.overLimitDesc : desc}
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
        <h2 className="mb-1 text-sm font-bold text-white">{t.wizardCapBlocked.businessListTitle}</h2>
        <p className="mb-4 text-xs leading-relaxed text-red-300">{t.wizardCapBlocked.deleteWarning}</p>
        {deleteError && <p className="mb-3 text-sm text-red-400">{deleteError}</p>}
        <div className="space-y-2.5">
          {businesses.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{b.businessName}</p>
                    {b.industry && <p className="text-xs text-neutral-500">{b.industry}</p>}
                  </div>
                  <span className={"rounded-full border px-2 py-0.5 text-[10px] font-bold " + TIER_BADGE[b.tier].className}>
                    {TIER_BADGE[b.tier].label}
                  </span>
                </div>
                {confirmingDeleteId !== b.id && (
                  <button
                    onClick={() => setConfirmingDeleteId(b.id)}
                    className="rounded-full border border-red-500/30 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    {t.wizardCapBlocked.deleteButton}
                  </button>
                )}
              </div>
              {confirmingDeleteId === b.id && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs leading-relaxed text-neutral-200">
                    {t.wizardCapBlocked.deleteConfirmMessage.replace("{name}", b.businessName)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePermanentDelete(b.id)}
                      disabled={deletingId === b.id}
                      className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === b.id ? t.wizardCapBlocked.deleting : t.wizardCapBlocked.deleteConfirmYes}
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deletingId === b.id}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white"
                    >
                      {t.wizardCapBlocked.deleteConfirmCancel}
                    </button>
                  </div>
                </div>
              )}
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
