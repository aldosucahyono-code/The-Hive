import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { BUSINESS_CATEGORY_KEYS, BUSINESS_CATEGORY_ICON, type BusinessCategoryKey } from "../lib/businessCategories";

// The Hive Platinum Workspace — Fase 1 (diskusi desain Claude+GPT). Badge
// kategori bisnis otomatis + jalur koreksi manual ("Ubah kategori"),
// dirender di atas TodayPanel. Mandiri (fetch sendiri lewat action
// getBusinessCategory di api/workspace.ts, get-or-classify) supaya
// Workspace.tsx tidak perlu tahu detail pemanggilan AI-nya — hanya
// melaporkan hasil ke parent lewat onCategoryChange untuk keputusan render
// lain (mis. kartu paket kerja yang hanya relevan untuk kategori tertentu).

type BusinessCategoryBadgeProps = {
  businessProfileId: string;
  onCategoryChange?: (category: BusinessCategoryKey | null) => void;
};

function BusinessCategoryBadge({ businessProfileId, onCategoryChange }: BusinessCategoryBadgeProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [category, setCategory] = useState<BusinessCategoryKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessProfileId || !session?.access_token) return;
    let cancelled = false;

    async function loadCategory() {
      setLoading(true);
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
          body: JSON.stringify({ action: "getBusinessCategory", businessProfileId }),
        });
        const json = await response.json();
        if (cancelled) return;
        if (response.ok && json.category) {
          setCategory(json.category);
          onCategoryChange?.(json.category);
        }
      } catch (err) {
        console.error("BusinessCategoryBadge load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCategory();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfileId, session?.access_token]);

  async function handleChangeCategory(newCategory: BusinessCategoryKey) {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "setBusinessCategory", businessProfileId, category: newCategory }),
      });
      if (response.ok) {
        setCategory(newCategory);
        onCategoryChange?.(newCategory);
        setEditing(false);
      }
    } catch (err) {
      console.error("BusinessCategoryBadge save error:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-neutral-500">{t.workspaceHome.categoryLoading}</p>;
  }
  if (!category) return null;

  return (
    <div className="text-right">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
        <span aria-hidden="true">{BUSINESS_CATEGORY_ICON[category]}</span>
        {t.workspaceHome.categoryLabels[category]}
      </span>

      {editing ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5 rounded-xl border border-white/10 bg-black/40 p-2">
          {BUSINESS_CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              disabled={saving}
              onClick={() => handleChangeCategory(key)}
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition " +
                (key === category ? "bg-primary text-black" : "bg-white/5 text-neutral-300 hover:bg-white/10")
              }
            >
              {BUSINESS_CATEGORY_ICON[key]} {t.workspaceHome.categoryLabels[key]}
            </button>
          ))}
          <button onClick={() => setEditing(false)} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-300">
            {t.workspaceHome.changeCategoryCancel}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-neutral-500">
          <button onClick={() => setEditing(true)} className="hover:text-neutral-300">
            {t.workspaceHome.changeCategoryPrompt}
          </button>
        </p>
      )}
    </div>
  );
}

export default BusinessCategoryBadge;
