import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

// The Hive Platinum Workspace — Fase 1, "lapisan eksekusi" (diskusi desain
// Claude+GPT 18-19 Jul 2026). Kartu "paket kerja" pertama: satu tujuan
// bisnis ("Perkuat kehadiran bisnis di Google") membuka satu paket berisi
// beberapa materi siap pakai sekaligus (deskripsi + foto + checklist) --
// BUKAN item-item terpisah per jenis output. Lihat
// services/business/goalPackages/generateGooglePresencePackage.ts untuk
// alasan lengkap kenapa dibatasi ke kategori kuliner dulu.
//
// Hanya dirender oleh pemanggil (Workspace.tsx) kalau kategori bisnis aktif
// termasuk GOAL_ALLOWED_CATEGORIES -- komponen ini sendiri tidak mengecek
// kategori, murni tampilan + pemanggilan action.

type PackageContent = {
  description: string;
  photos: Array<{ title: string; angle: string }>;
  checklist: string[];
};

function GooglePresenceGoalCard({ businessProfileId }: { businessProfileId: string }) {
  const { t, lang } = useLanguage();
  const { session } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<PackageContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleOpen() {
    if (content) {
      setExpanded(true);
      return;
    }
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "getGooglePresencePackage", businessProfileId, lang }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || t.workspaceHome.packageError);
        setLoading(false);
        return;
      }
      setContent({ description: json.description, photos: json.photos, checklist: json.checklist });
      setExpanded(true);
    } catch (err) {
      console.error("GooglePresenceGoalCard error:", err);
      setError(t.workspaceHome.packageError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy gagal:", err);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">1</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white sm:text-base">{t.workspaceHome.googlePresenceTitle}</p>
          <p className="mt-1 text-xs text-neutral-400 sm:text-sm">{t.workspaceHome.googlePresenceDesc}</p>
        </div>
      </div>

      {!expanded && (
        <>
          <div className="ml-10 mt-3 flex flex-col gap-1.5 text-xs text-neutral-400">
            <span>📝 {t.workspaceHome.googlePresenceItemDescription}</span>
            <span>📷 {t.workspaceHome.googlePresenceItemPhotos}</span>
            <span>✅ {t.workspaceHome.googlePresenceItemChecklist}</span>
          </div>

          {error && <p className="ml-10 mt-3 text-xs text-red-400">{error}</p>}

          <button
            onClick={handleOpen}
            disabled={loading}
            className="ml-10 mt-3.5 w-[calc(100%-2.5rem)] rounded-xl bg-primary py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.workspaceHome.generatingPackage : t.workspaceHome.openPackageButton}
          </button>
        </>
      )}

      {expanded && content && (
        <div className="ml-10 mt-3 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t.workspaceHome.descriptionSectionTitle}</p>
              <button onClick={handleCopy} className="text-xs font-semibold text-primary hover:opacity-80">
                {copied ? t.workspaceHome.copiedLabel : t.workspaceHome.copyButton}
              </button>
            </div>
            <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-neutral-200">{content.description}</p>
            <p className="mt-1 text-right text-[11px] text-neutral-500">
              {content.description.length} {t.workspaceHome.characterCountSuffix}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">{t.workspaceHome.photosSectionTitle}</p>
            <ul className="space-y-1.5">
              {content.photos.map((photo, i) => (
                <li key={i} className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-neutral-300">
                  <span className="font-semibold text-neutral-100">
                    {i + 1}. {photo.title}
                  </span>
                  <span className="block text-neutral-400">{photo.angle}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">{t.workspaceHome.checklistSectionTitle}</p>
            <ul className="space-y-1">
              {content.checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                  <span className="mt-0.5 text-primary">☐</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <button onClick={() => setExpanded(false)} className="text-xs font-semibold text-neutral-500 hover:text-neutral-300">
            {t.workspaceHome.collapseButton}
          </button>
        </div>
      )}
    </div>
  );
}

export default GooglePresenceGoalCard;
