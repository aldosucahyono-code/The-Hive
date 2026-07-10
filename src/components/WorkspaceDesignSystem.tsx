import type { ReactNode } from "react";

// =====================================================================
// WORKSPACE DESIGN SYSTEM — primitives bersama untuk SELURUH Workspace,
// bukan cuma satu halaman/satu file. Today (di Workspace.tsx) adalah
// referensi tokennya (radius 24/20/16/full, border white/10, warna
// semantik primary/hijau/amber/merah, focus-visible ring, motion-reduce).
// Dipakai oleh SELURUH halaman Workspace (Business Score, Report, Target,
// Competitor, Journey, History, Settings — semua di Workspace.tsx) DAN
// modul yang sengaja dipisah jadi file sendiri (Chat Beemo, dan modul
// besar berikutnya seperti AI Engine/Customer Support), supaya Design
// System bisa dipakai lintas file tanpa Workspace.tsx jadi pusat semua
// komponen. Sengaja dibuat SEDIKIT komponen generik (dengan props/
// variant) daripada banyak komponen spesifik-halaman.
//
// Prinsip performa (berlaku untuk semua primitive di file ini):
// tanpa blur/backdrop-filter, tanpa shadow bertumpuk (border tipis dulu),
// transform+opacity saja untuk animasi (bukan animasi layout), dan semua
// tombol baru sengaja TIDAK pakai hover:scale (instant > animasi) kecuali
// yang sudah ada di Today (frozen, tidak diutak-atik lagi).
// =====================================================================

export type CardVariant = "hero" | "default" | "compact";
export type CardTone = "neutral" | "primary" | "success" | "warning" | "danger";

export const CARD_TONE_CLASSES: Record<CardTone, string> = {
  neutral: "border-white/10 bg-surface",
  primary: "border-primary/20 bg-primary/5",
  success: "border-green-500/20 bg-green-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  danger: "border-red-500/20 bg-red-500/5",
};

/** WorkspaceCard — SATU kartu generik untuk seluruh Workspace, bukan
 * kartu-per-halaman (BusinessScoreCard, ReportCard, dst). `variant`
 * mengatur radius+padding (hero = 24px, sepadan Mission Today; default =
 * 20px, sepadan kartu standar Today; compact = kartu kecil bersarang
 * seperti tile metrik/dimensi). `tone` mengatur warna aksen border/bg. */
export function WorkspaceCard({
  variant = "default",
  tone = "neutral",
  className = "",
  children,
}: {
  variant?: CardVariant;
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}) {
  const radius = variant === "hero" ? "rounded-3xl" : variant === "compact" ? "rounded-xl" : "rounded-[20px]";
  const padding = variant === "hero" ? "p-8 sm:p-10" : variant === "compact" ? "p-4" : "p-6";
  return <div className={`border ${radius} ${padding} ${CARD_TONE_CLASSES[tone]} ${className}`}>{children}</div>;
}

/** SectionHeader — identitas tiap halaman/modul Workspace (judul + kalimat
 * singkat yang menjelaskan fungsi halaman). Dipasang sekali di atas
 * konten tiap halaman, dipakai ulang, bukan ditulis manual per halaman. */
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-neutral-400">{description}</p>}
    </div>
  );
}

/** WorkspaceSection — pembungkus ritme vertikal (jarak antar section)
 * yang konsisten. Dipasang sekali per halaman membungkus SectionHeader +
 * seluruh konten di bawahnya, supaya spacing antar bagian tidak ditulis
 * manual berbeda-beda di tiap halaman. */
export function WorkspaceSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-6 ${className}`}>{children}</div>;
}

/** RetryButton — tombol retry generik, dipakai ErrorCard (dan bisa berdiri
 * sendiri kalau perlu). Sengaja instant (tanpa hover:scale) sesuai prinsip
 * performa baru: pilih instant daripada animasi kalau harus memilih. */
export function RetryButton({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black transition-colors duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {label}
    </button>
  );
}

/** ErrorCard — state error generik per-section (BUKAN reload seluruh
 * halaman). Setiap halaman/modul yang fetch datanya sendiri-sendiri
 * (Business Score, Report, Target, Chat Beemo, dst) memakai kartu ini +
 * retry yang cuma memuat ulang data section itu saja, pola yang sama
 * dengan yang sudah dipakai di Today. */
export function ErrorCard({
  title,
  description,
  retryLabel,
  onRetry,
}: {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <WorkspaceCard tone="danger" className="flex flex-col items-center text-center">
      <div className="mb-1 text-2xl" aria-hidden="true">⚠️</div>
      <p className="text-base font-bold text-neutral-100">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">{description}</p>
      <RetryButton label={retryLabel} onRetry={onRetry} />
    </WorkspaceCard>
  );
}

/** SkeletonCard — pulse ringan (Tailwind `animate-pulse` bawaan, BUKAN
 * shimmer/gradient bergerak) menggantikan teks "Memuat..." polos yang
 * dipakai bersama oleh semua halaman non-Today. `motion-reduce:animate-none`
 * supaya pengguna reduced-motion melihat blok statis, bukan berkedip. */
export function SkeletonCard({ variant = "default", className = "" }: { variant?: CardVariant; className?: string }) {
  const radius = variant === "hero" ? "rounded-3xl" : variant === "compact" ? "rounded-xl" : "rounded-[20px]";
  const height = variant === "hero" ? "h-40" : variant === "compact" ? "h-16" : "h-24";
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none border border-white/10 bg-surface/60 ${radius} ${height} ${className}`}
    />
  );
}

/** UpgradeLockCard — pola upsell Free-tier yang dipakai ulang di
 * Competitor, Growth, Business Score, DAN Chat Beemo, supaya Free tier
 * selalu tahu kenapa sebuah bagian tersembunyi + selalu dapat CTA upgrade
 * yang jelas — bukan cuma bagian yang hilang diam-diam. */
export function UpgradeLockCard({
  description,
  buttonLabel,
  onUpgradeClick,
}: {
  description: string;
  buttonLabel: string;
  onUpgradeClick: () => void;
}) {
  return (
    <WorkspaceCard className="text-center">
      <div className="mb-3 text-2xl" aria-hidden="true">🔒</div>
      <p className="mx-auto max-w-sm text-sm text-neutral-400">{description}</p>
      <RetryButton label={buttonLabel} onRetry={onUpgradeClick} />
    </WorkspaceCard>
  );
}

/** EmptyState — generalisasi dari ComingSoon lama: satu komponen untuk
 * SEMUA kondisi "belum ada data/fitur" di Workspace (Coming Soon penuh
 * halaman seperti Business Updates/Decision Journal, MAUPUN "belum ada
 * analisis" di tengah halaman Business Score, Target, dst, ATAU "belum
 * ada percakapan" di Chat Beemo). `variant` "hero" = perlakuan penuh
 * (dipakai Coming Soon, radius 24px, ikon besar), "default" = kartu biasa
 * di tengah halaman (radius 20px). CTA opsional — kalau ada aksi nyata
 * (mis. "Mulai Analisis"), kalau tidak ada cukup `note` seperti
 * sebelumnya. */
export function EmptyState({
  variant = "hero",
  icon = "🐝",
  badge,
  title,
  description,
  note,
  ctaLabel,
  onCtaClick,
}: {
  variant?: "hero" | "default";
  icon?: string;
  badge?: string;
  title: string;
  description: string;
  note?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}) {
  const isHero = variant === "hero";
  return (
    <WorkspaceCard variant={isHero ? "hero" : "default"} className="text-center">
      <div
        aria-hidden="true"
        className={`mx-auto flex items-center justify-center rounded-2xl bg-primary/10 ${
          isHero ? "h-16 w-16 text-3xl" : "h-12 w-12 text-2xl"
        }`}
      >
        {icon}
      </div>
      {badge && (
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          {badge}
        </span>
      )}
      <p className={`mt-4 font-black text-white ${isHero ? "text-2xl" : "text-lg"}`}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-400">{description}</p>
      {note && <p className="mt-4 text-xs font-semibold text-neutral-600">{note}</p>}
      {ctaLabel && onCtaClick && <RetryButton label={ctaLabel} onRetry={onCtaClick} />}
    </WorkspaceCard>
  );
}
