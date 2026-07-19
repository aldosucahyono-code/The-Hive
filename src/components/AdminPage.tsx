// src/components/AdminPage.tsx
//
// Halaman admin -- audit Juli 2026 ("super admin, bisa lihat/edit semua
// database: pelanggan, pesan, chat wizard, workspace, langganan dalam satu
// halaman" + "pisahkan halaman super admin ini dari users, atau hackers" +
// "halaman lengkap, mudah dibaca dan mudah dioperasikan, ringan, bisa
// diakses didevice mana saja").
// Diakses lewat PATH rahasia (lihat src/adminSecretPath.ts + App.tsx),
// TIDAK ada link publik ke sini sama sekali.
//
// GERBANG 3 LANGKAH, TERPISAH TOTAL dari Supabase Auth/sesi pelanggan
// (lihat migrations/2026-07-15c_admin_security.sql untuk desain lengkap):
//   1. Masukkan email -> kalau terdaftar sebagai admin/super_admin, link
//      verifikasi dikirim ke email itu (10 menit).
//   2. Klik link di email -> halaman ini terbuka lagi dengan ?verify=token
//      di URL -> otomatis lanjut ke langkah 3.
//   3. Masukkan PIN 6 digit -> kalau benar, dapat "adminToken" (sesi admin
//      SENDIRI, bukan token Supabase) yang dipakai lewat header
//      x-admin-token untuk semua panggilan selanjutnya.
//
// adminToken disimpan di sessionStorage (bukan localStorage) -- hilang
// otomatis begitu tab ditutup, mengurangi risiko kalau komputer ini dipakai
// bersama/lupa logout.
//
// 6 tab: Dashboard (ringkasan bisnis), Pelanggan (detail per-orang), Pembayaran
// (transaksi lintas pelanggan), Pesan Kontak, Log Aktivitas Admin dan Kelola
// Admin (2 terakhir khusus super_admin) -- semua pakai tabel/kartu sederhana
// (tanpa library chart/UI berat) supaya halaman tetap ringan & cepat dibuka
// dari perangkat apapun (HP termasuk -- semua grid pakai breakpoint responsif).

import { useCallback, useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { BUSINESS_CATEGORY_KEYS, type BusinessCategoryKey } from "../lib/businessCategories";

type Role = "admin" | "super_admin";
type Tab = "dashboard" | "customers" | "payments" | "messages" | "audit" | "admins" | "costs";

// Audit pra-soft-launch (19 Jul 2026): "tolong kelompokan jenis usaha, mana
// yang F&B, mana yang jasa, retail dll" -- label ID untuk taksonomi 13
// kategori (services/business/businessCategories.ts). Duplikat dari
// src/i18n/translations.ts (workspaceHome.categoryLabels, bagian id) --
// AdminPage tidak pakai sistem i18n/LanguageContext (halaman ini selalu
// Bahasa Indonesia), jadi label disalin langsung di sini alih-alih menarik
// seluruh sistem terjemahan untuk satu halaman.
const CATEGORY_LABELS: Record<BusinessCategoryKey, string> = {
  kuliner: "Kuliner (F&B)",
  retail: "Retail",
  jasa: "Jasa",
  logistik: "Logistik",
  manufaktur: "Manufaktur",
  pertanian_perikanan: "Pertanian & Perikanan",
  pertambangan_energi: "Pertambangan & Energi",
  kesehatan: "Kesehatan",
  pendidikan: "Pendidikan",
  properti: "Properti",
  teknologi: "Teknologi",
  pariwisata: "Pariwisata",
  lainnya: "Lainnya",
};
const UNCATEGORIZED = "__uncategorized__";

type Customer = {
  id: string;
  email: string | null;
  createdAt: string;
  role: string;
  businessCount: number;
  latestBusinessName: string | null;
  latestIndustry: string | null;
  latestCategory: string | null;
  latestBusinessStage: string | null;
  latestBusinessType: string | null;
  highestTier: string;
  contactMessageCount: number;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastLocation: string | null;
  lastDevice: string;
};

type BusinessNote = {
  id: string;
  note: string | null;
  image_data_url: string | null;
  created_by_email: string;
  created_at: string;
};

// Referensi Pelanggan Baru (Juli 2026) — lihat
// services/workspace/leads/generateLeadReferrals.ts. Baca-saja di admin
// (permintaan pemilik produk: "referensi pelanggan pun harus masuk dan
// terkorelasi di halaman super admin").
type LeadReferral = {
  id: string;
  batch_id: string;
  lead_type: "company" | "individual";
  name: string;
  description: string | null;
  address: string | null;
  source_url: string | null;
  generated_at: string;
};

type Business = {
  id: string;
  business_name: string;
  industry: string | null;
  business_category: string | null;
  business_stage: string;
  business_type: string;
  phone_number: string | null;
  is_archived: boolean;
  created_at: string;
  subscriptions: { tier: string; status: string; started_at: string; expires_at: string | null }[];
  payments: { tier: string; status: string; created_at: string }[];
  analyses: { id: string; raw_input: Record<string, unknown>; ai_output: unknown; is_baseline: boolean; created_at: string }[];
  updates: {
    id: string;
    content: string | null;
    pencapaian: string | null;
    tantangan: string | null;
    kondisi_penjualan: string | null;
    omset_value: number | null;
    pelanggan_baru: number | null;
    target_depan: string | null;
    category: string | null;
    severity: string | null;
    created_at: string;
  }[];
  notes: BusinessNote[];
  leadReferrals: LeadReferral[];
};

type WizardDraft = {
  id: string;
  wizard_data: Record<string, unknown>;
  status: string;
  created_at: string;
  promoted_at: string | null;
};

type ContactMessage = {
  id: string;
  name: string | null;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

type CustomerDetail = {
  profile: {
    id: string;
    email: string;
    created_at: string;
    role: string;
    isOnline: boolean;
    lastLocation: string | null;
    lastDevice: string;
  };
  businesses: Business[];
  wizardDrafts: WizardDraft[];
  contactMessages: ContactMessage[];
  usageEstimate: {
    totalChatMessages: number;
    totalDecisions: number;
    totalAnalyses: number;
    totalLeadBatches: number;
    estimatedApiCostIdr: number;
    isEstimate: true;
  };
};

type DashboardSummary = {
  totalCustomers: number;
  onlineNow: number;
  tierCounts: Record<string, number>;
  mrrIdr: number;
  signupTrend: { date: string; count: number }[];
  wizardFunnel: { totalDrafts: number; promoted: number; conversionRate: number };
  payments: { pendingCount: number; pendingAmountIdr: number; failedCount: number; failedAmountIdr: number };
  newContactMessages: number;
};

type CostDashboard = {
  periodDays: number;
  exchangeRate: { rate: number; source: "live_api" | "cache_db" | "static"; fetchedAt: string };
  aiUsage: {
    totalCostUsd: number;
    totalCostIdr: number;
    claudeCostUsd: number;
    claudeCostIdr: number;
    apifyCostUsd: number;
    apifyCostIdr: number;
    anonymousCostUsd: number;
    anonymousCostIdr: number;
    byAction: { action: string; costUsd: number; costIdr: number }[];
    topCustomers: { businessProfileId: string; businessName: string; email: string | null; costUsd: number; costIdr: number }[];
    rowsScanned: number;
    scanLimitReached: boolean;
  };
  vercel:
    | { available: true; totalCostUsd: number; byService: { serviceName: string; costUsd: number }[]; periodStart: string; periodEnd: string; fetchedAt: string }
    | { available: false; reason: string };
  supabase:
    | {
        available: true;
        dbSizeBytes: number;
        planAddons: { addonType: string; variant: string | null }[];
        freeTierLimits: { dbSizeBytes: number; fileStorageBytes: number; egressBytes: number; monthlyActiveUsers: number };
        fetchedAt: string;
      }
    | { available: false; reason: string };
  anthropic:
    | {
        available: true;
        periodCostUsd: number;
        periodStart: string;
        periodEnd: string;
        monthToDateCostUsd: number;
        monthlyBudgetUsd: number | null;
        fetchedAt: string;
      }
    | { available: false; reason: string };
};

type PaymentRow = {
  id: string;
  businessProfileId: string | null;
  businessName: string | null;
  customerEmail: string | null;
  orderId: string;
  tier: string;
  amountIdr: number;
  status: string;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

type AdminRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_seen_at: string | null;
};

const SESSION_KEY = "the_hive_admin_session";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Audit Juli 2026 ("saya ingin tau betul, kira2 relevan tidak pertanyaan
// pelanggan dengan jawaban atau solusi darimu"): raw_input wizard disimpan
// sebagai JSONB bebas bentuk -- helper ini menarik field yang SUDAH DIKENAL
// (lihat api/save-submission.ts untuk daftar field wajib wizard) supaya bisa
// ditampilkan terbaca berdampingan dengan rekomendasi AI, bukan cuma dump
// JSON mentah.
function wizardText(raw: Record<string, unknown> | null | undefined, key: string): string {
  const v = raw?.[key];
  return typeof v === "string" && v.trim() ? v : "-";
}

// Audit pra-soft-launch (19 Jul 2026): "harus detail, termasuk isi chat
// wizard... karena takutnya users komplain minta refund" -- sebelumnya cuma
// 5 dari ~18 field wizard yang ditampilkan (profesi/produkJasa/lokasi/
// tantangan/target), sisanya cuma bisa dilihat lewat JSON mentah yang
// diciutkan (kurang praktis untuk kasus sengketa). Daftar ini mencakup
// SEMUA field isian wizard yang relevan (lihat WizardData di
// ChatWizard.tsx) -- nama/email/jenisAnalisis/honeypot sengaja dilewati
// (nama+email sudah tampil di profil, jenisAnalisis internal, honeypot
// jebakan bot bukan data pengguna).
const WIZARD_FIELD_LABELS: { key: string; label: string }[] = [
  { key: "namaBisnis", label: "Nama Bisnis" },
  { key: "profesi", label: "Profesi/Peran" },
  { key: "noHp", label: "Nomor HP" },
  { key: "jenisBisnis", label: "Jenis Bisnis" },
  { key: "produkJasa", label: "Produk/Jasa Utama" },
  { key: "lokasi", label: "Lokasi" },
  { key: "sejakKapan", label: "Sejak Kapan Berjalan" },
  { key: "rencanaLaunching", label: "Rencana Launching" },
  { key: "omsetBulanan", label: "Omset Bulanan" },
  { key: "targetPelanggan", label: "Target Pelanggan" },
  { key: "bucketQuestion1", label: "Pertanyaan Tambahan 1" },
  { key: "bucketAnswer1", label: "Jawaban Tambahan 1" },
  { key: "bucketQuestion2", label: "Pertanyaan Tambahan 2" },
  { key: "bucketAnswer2", label: "Jawaban Tambahan 2" },
  { key: "tantangan", label: "Tantangan Terbesar" },
  { key: "target", label: "Target 6-12 Bulan" },
  { key: "ceritaVisi", label: "Cerita & Visi" },
];

// Bugfix pra-soft-launch (19 Jul 2026), ditemukan lewat React error #31
// ("Objects are not valid as a React child") yang bikin SELURUH halaman
// admin crash setiap kali admin klik pelanggan yang punya minimal satu
// analisa: `analyses.ai_output` di database TIDAK PERNAH berupa teks biasa
// (lihat services/business/saveAnalysis.ts -- yang disimpan adalah objek
// hasil parse JSON dari Claude, {summary, businessHealthScore, strengths,
// improvements, opportunity, ...}, sama seperti yang dibaca
// getBusinessMemory.ts). Kode sebelumnya salah asumsi ai_output selalu
// string dan merender objeknya mentah-mentah lewat {a.ai_output} -- React
// tidak bisa merender objek langsung sebagai children, jadi crash total
// (bukan cuma satu kartu, seluruh AdminPage ikut unmount karena tidak ada
// error boundary di titik itu). Helper ini menyusun objek itu jadi teks
// yang bisa dibaca, dengan fallback aman untuk bentuk data yang tidak
// terduga (mis. baris lama/rusak).
function formatAiOutput(output: unknown): string {
  if (!output) return "(belum ada output tersimpan)";
  if (typeof output === "string") return output;
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.summary === "string" && o.summary.trim()) parts.push(o.summary.trim());
    if (typeof o.businessHealthScore === "number") parts.push(`Skor Kesehatan Bisnis: ${o.businessHealthScore}`);
    if (typeof o.strengths === "string" && o.strengths.trim()) parts.push(`Kekuatan: ${o.strengths.trim()}`);
    if (typeof o.improvements === "string" && o.improvements.trim()) parts.push(`Area Perbaikan: ${o.improvements.trim()}`);
    if (typeof o.opportunity === "string" && o.opportunity.trim()) parts.push(`Peluang: ${o.opportunity.trim()}`);
    if (parts.length > 0) return parts.join("\n\n");
    // Bentuk objek tidak dikenali sama sekali -- tetap tampilkan sesuatu
    // yang bisa dibaca (JSON) daripada merender objeknya langsung (yang
    // menyebabkan crash ini) atau diam-diam menyembunyikan datanya.
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return "(format output tidak dikenali)";
    }
  }
  return String(output);
}

function tierBadgeClass(tier: string): string {
  if (tier === "platinum") return "bg-neutral-900 text-white";
  if (tier === "pro") return "bg-primary text-black";
  return "bg-neutral-200 text-neutral-700";
}

function paymentStatusClass(status: string): string {
  if (status === "settlement") return "bg-green-100 text-green-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "failed" || status === "expired") return "bg-red-100 text-red-700";
  return "bg-neutral-100 text-neutral-600";
}

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-neutral-300"}`}
      title={isOnline ? "Online" : "Offline"}
    />
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="text-xs font-bold uppercase text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

type AdminSession = { adminToken: string; role: Role; email: string };

function loadStoredSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(() => loadStoredSession());
  const [gateStep, setGateStep] = useState<"email" | "sent" | "pin">("email");
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [accessError, setAccessError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState<"all" | "idea" | "running">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [costDashboard, setCostDashboard] = useState<CostDashboard | null>(null);
  const [costDashboardLoading, setCostDashboardLoading] = useState(false);

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addAdminBusy, setAddAdminBusy] = useState(false);
  const [roleBusyEmail, setRoleBusyEmail] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteImages, setNoteImages] = useState<Record<string, string | null>>({});
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);

  // Audit pra-soft-launch (19 Jul 2026): "saya bisa menghapus/edit usaha/
  // jenis users dari pelanggan" -- state untuk edit inline data bisnis,
  // arsipkan/pulihkan, hapus permanen (dengan konfirmasi ketik nama), ubah
  // tier langganan manual, dan ubah role akun langsung dari tab Pelanggan.
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    businessName: string;
    industry: string;
    businessCategory: string;
    businessStage: string;
    phoneNumber: string;
  } | null>(null);
  const [businessBusyId, setBusinessBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [tierBusyId, setTierBusyId] = useState<string | null>(null);
  const [customerRoleBusy, setCustomerRoleBusy] = useState(false);
  const [classifyBusyId, setClassifyBusyId] = useState<string | null>(null);
  const [bulkClassifyBusy, setBulkClassifyBusy] = useState(false);
  const [bulkClassifyResult, setBulkClassifyResult] = useState<string | null>(null);

  // Langkah 2 (klik link di email): kalau URL punya ?verify=token, verifikasi
  // otomatis lalu lanjut ke langkah PIN -- sekali saja saat mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify");
    if (!verifyToken) return;

    // Bersihkan ?verify=... dari URL supaya refresh/bookmark tidak memicu
    // ulang verifikasi token yang sama (token sekali pakai untuk langkah
    // ini juga).
    window.history.replaceState({}, "", window.location.pathname);

    (async () => {
      setGateBusy(true);
      setGateError(null);
      try {
        const res = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "adminVerifyEmailToken", token: verifyToken }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Link tidak valid.");
        setPendingToken(verifyToken);
        setGateStep("pin");
      } catch (err) {
        setGateError(err instanceof Error ? err.message : "Link tidak valid atau sudah kedaluwarsa.");
      } finally {
        setGateBusy(false);
      }
    })();
  }, []);

  const callAdmin = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (!session?.adminToken) throw new Error("Sesi admin tidak ada.");
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": session.adminToken },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          // Sesi habis/dicabut -- keluar paksa ke gerbang login lagi.
          sessionStorage.removeItem(SESSION_KEY);
          setSession(null);
          setGateStep("email");
        }
        throw new Error(json.error || "Gagal memuat data.");
      }
      return json;
    },
    [session?.adminToken]
  );

  async function submitEmail() {
    setGateBusy(true);
    setGateError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminRequestChallenge", email: emailInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim link verifikasi.");
      setGateStep("sent");
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Gagal mengirim link verifikasi.");
    } finally {
      setGateBusy(false);
    }
  }

  async function submitPin() {
    if (!pendingToken) {
      setGateError("Buka lagi link verifikasi dari email kamu.");
      return;
    }
    setGateBusy(true);
    setGateError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adminVerifyPin", token: pendingToken, pin: pinInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "PIN salah.");
      const newSession: AdminSession = { adminToken: json.adminToken, role: json.role, email: json.email };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "PIN salah.");
    } finally {
      setGateBusy(false);
    }
  }

  async function handleLogout() {
    try {
      if (session?.adminToken) {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": session.adminToken },
          body: JSON.stringify({ action: "adminLogout" }),
        });
      }
    } catch {
      // Tidak masalah kalau gagal -- tetap hapus sesi lokal di bawah.
    }
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setGateStep("email");
    setDashboard(null);
    setCustomers([]);
    setPayments([]);
    setMessages([]);
    setAuditLogs([]);
    setAdmins([]);
    setSelectedId(null);
    setDetail(null);
  }

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminGetDashboardSummary");
      setDashboard(json);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setDashboardLoading(false);
    }
  }, [callAdmin]);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminListCustomers");
      setCustomers(json.customers);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setCustomersLoading(false);
    }
  }, [callAdmin]);

  const loadPayments = useCallback(
    async (status: string) => {
      setPaymentsLoading(true);
      setAccessError(null);
      try {
        const json = await callAdmin("adminListPayments", { status });
        setPayments(json.payments);
      } catch (err) {
        setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
      } finally {
        setPaymentsLoading(false);
      }
    },
    [callAdmin]
  );

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminListContactMessages");
      setMessages(json.messages);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setMessagesLoading(false);
    }
  }, [callAdmin]);

  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminListAuditLog");
      setAuditLogs(json.logs);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setAuditLoading(false);
    }
  }, [callAdmin]);

  const loadCostDashboard = useCallback(async () => {
    setCostDashboardLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminGetCostDashboard");
      setCostDashboard(json);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setCostDashboardLoading(false);
    }
  }, [callAdmin]);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminListAdmins");
      setAdmins(json.admins);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setAdminsLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => {
    if (!session?.adminToken) return;
    if (tab === "dashboard") loadDashboard();
    if (tab === "customers") loadCustomers();
    if (tab === "payments") loadPayments(paymentStatusFilter);
    if (tab === "messages") loadMessages();
    if (tab === "audit") loadAuditLog();
    if (tab === "admins") loadAdmins();
    if (tab === "costs") loadCostDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.adminToken, tab, loadDashboard, loadCustomers, loadMessages, loadAuditLog, loadAdmins, loadCostDashboard]);

  // Audit Juli 2026 ("bisa dikelompokan dari masing2 jenis usaha... usaha
  // baru/eksisting, rumah makan, coffee shop dll"), diperbarui audit
  // pra-soft-launch ("tolong kelompokan jenis usaha, mana yang F&B, mana
  // yang jasa, retail dll"): filter sebelumnya per baris `industry` teks
  // bebas (satu opsi dropdown per kalimat unik, tidak bisa dikelompokkan).
  // Sekarang dikelompokkan per business_category (taksonomi 13-kategori,
  // sama dengan Platinum Workspace) -- hanya menampilkan kategori yang
  // benar-benar dipakai pelanggan, plus satu opsi "Belum dikategorikan"
  // untuk bisnis yang dibuat sebelum klasifikasi AI ini ada / belum sempat
  // diklasifikasi. Filter tetap di client (daftar sudah dimuat penuh, maks
  // 500 baris) supaya ganti filter terasa instan.
  const categoryOptions = useMemo(() => {
    const present = new Set<string>();
    let hasUncategorized = false;
    for (const c of customers) {
      if (c.latestCategory) present.add(c.latestCategory);
      else if (c.businessCount > 0) hasUncategorized = true;
    }
    const options: { value: string; label: string }[] = BUSINESS_CATEGORY_KEYS.filter((k) => present.has(k)).map((k) => ({
      value: k,
      label: CATEGORY_LABELS[k],
    }));
    if (hasUncategorized) options.push({ value: UNCATEGORIZED, label: "Belum dikategorikan" });
    return options;
  }, [customers]);

  const uncategorizedCount = useMemo(
    () => customers.filter((c) => !c.latestCategory && c.businessCount > 0).length,
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (stageFilter !== "all" && c.latestBusinessStage !== stageFilter) return false;
      if (categoryFilter !== "all") {
        if (categoryFilter === UNCATEGORIZED) {
          if (c.latestCategory || c.businessCount === 0) return false;
        } else if (c.latestCategory !== categoryFilter) {
          return false;
        }
      }
      return true;
    });
  }, [customers, stageFilter, categoryFilter]);

  async function openCustomer(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const json = await callAdmin("adminGetCustomerDetail", { customerId: id });
      setDetail(json);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat detail pelanggan.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateMessageStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await callAdmin("adminUpdateContactMessageStatus", { id, status });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal mengubah status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function addAdmin() {
    if (!newAdminEmail.trim()) return;
    setAddAdminBusy(true);
    setAccessError(null);
    try {
      await callAdmin("adminSetRole", { email: newAdminEmail.trim(), role: "admin" });
      setNewAdminEmail("");
      await loadAdmins();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menambahkan admin.");
    } finally {
      setAddAdminBusy(false);
    }
  }

  async function revokeAdmin(email: string) {
    setRoleBusyEmail(email);
    setAccessError(null);
    try {
      await callAdmin("adminSetRole", { email, role: "user" });
      await loadAdmins();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal mencabut akses admin.");
    } finally {
      setRoleBusyEmail(null);
    }
  }

  // Audit Juli 2026 ("saya bisa screenshot pelanggan, lalu paste disini agar
  // kita bisa menyelesaikannya secara manual"): tangkap gambar dari
  // clipboard saat admin paste (Ctrl+V) di kotak catatan, ubah jadi data URI
  // base64 -- tidak perlu upload file terpisah.
  function handleNotePaste(e: ClipboardEvent<HTMLTextAreaElement>, businessId: string) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setNoteImages((prev) => ({ ...prev, [businessId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  }

  async function submitNote(businessId: string) {
    const text = (noteDrafts[businessId] || "").trim();
    const image = noteImages[businessId] || "";
    if (!text && !image) return;
    setNoteBusyId(businessId);
    setAccessError(null);
    try {
      const json = await callAdmin("adminAddBusinessNote", { businessProfileId: businessId, note: text, imageDataUrl: image });
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          businesses: prev.businesses.map((b) => (b.id === businessId ? { ...b, notes: [json.note, ...b.notes] } : b)),
        };
      });
      setNoteDrafts((prev) => ({ ...prev, [businessId]: "" }));
      setNoteImages((prev) => ({ ...prev, [businessId]: null }));
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menyimpan catatan.");
    } finally {
      setNoteBusyId(null);
    }
  }

  function startEditBusiness(b: Business) {
    setEditingBusinessId(b.id);
    setEditDraft({
      businessName: b.business_name,
      industry: b.industry || "",
      businessCategory: b.business_category || "",
      businessStage: b.business_stage,
      phoneNumber: b.phone_number || "",
    });
  }

  async function saveEditBusiness(businessId: string) {
    if (!editDraft) return;
    setBusinessBusyId(businessId);
    setAccessError(null);
    try {
      const json = await callAdmin("adminUpdateBusiness", {
        businessProfileId: businessId,
        businessName: editDraft.businessName,
        industry: editDraft.industry,
        businessCategory: editDraft.businessCategory || null,
        businessStage: editDraft.businessStage,
        phoneNumber: editDraft.phoneNumber,
      });
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          businesses: prev.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  business_name: json.business.business_name,
                  industry: json.business.industry,
                  business_category: json.business.business_category,
                  business_stage: json.business.business_stage,
                  phone_number: json.business.phone_number,
                }
              : b
          ),
        };
      });
      // Daftar pelanggan di kiri juga menampilkan nama/kategori bisnis
      // terbaru -- refresh biar tidak nyangkut versi lama sampai reload.
      // Cuma relevan kalau bisnis yang diedit ini bisnis TERBARU pelanggan
      // itu (listCustomers.ts hanya menyimpan info bisnis terbaru per
      // pelanggan) -- kalau bukan, biarkan saja, tidak ada yang perlu
      // diperbarui di daftar kiri.
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                latestBusinessName: json.business.business_name,
                latestCategory: json.business.business_category,
                latestIndustry: json.business.industry,
              }
            : c
        )
      );
      setEditingBusinessId(null);
      setEditDraft(null);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menyimpan perubahan bisnis.");
    } finally {
      setBusinessBusyId(null);
    }
  }

  async function toggleArchiveBusiness(b: Business) {
    setBusinessBusyId(b.id);
    setAccessError(null);
    try {
      const nextArchived = !b.is_archived;
      await callAdmin("adminSetBusinessArchived", { businessProfileId: b.id, archived: nextArchived });
      setDetail((prev) => {
        if (!prev) return prev;
        return { ...prev, businesses: prev.businesses.map((x) => (x.id === b.id ? { ...x, is_archived: nextArchived } : x)) };
      });
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal mengubah status arsip.");
    } finally {
      setBusinessBusyId(null);
    }
  }

  async function confirmDeleteBusiness(businessId: string) {
    setBusinessBusyId(businessId);
    setAccessError(null);
    try {
      await callAdmin("adminDeleteBusinessPermanently", { businessProfileId: businessId, confirmBusinessName: deleteConfirmText });
      setDetail((prev) => (prev ? { ...prev, businesses: prev.businesses.filter((b) => b.id !== businessId) } : prev));
      setCustomers((prev) => prev.map((c) => (c.id === selectedId ? { ...c, businessCount: Math.max(0, c.businessCount - 1) } : c)));
      setDeleteConfirmId(null);
      setDeleteConfirmText("");
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menghapus bisnis.");
    } finally {
      setBusinessBusyId(null);
    }
  }

  async function setBusinessTier(businessId: string, tier: string) {
    setTierBusyId(businessId);
    setAccessError(null);
    try {
      await callAdmin("adminSetSubscriptionTier", { businessProfileId: businessId, tier });
      // Refresh detail penuh -- lebih sederhana & pasti akurat daripada
      // menghitung ulang status expired/active baris subscriptions secara
      // manual di client (logika itu sudah ada di getActiveMembership.ts,
      // jangan diduplikasi di sini).
      if (selectedId) await openCustomer(selectedId);
      await loadCustomers();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal mengubah tier langganan.");
    } finally {
      setTierBusyId(null);
    }
  }

  // Audit pra-soft-launch (19 Jul 2026): "semua bisnis pasti ada
  // kategorinya... gunakan ai untuk memetakan" -- klasifikasi per bisnis
  // (tombol di kartu bisnis) dan klasifikasi massal (tombol di atas daftar
  // Pelanggan) untuk bisnis yang belum pernah diklasifikasi karena
  // pemiliknya belum sempat buka Workspace Home sendiri.
  async function classifyBusiness(businessId: string, force: boolean) {
    setClassifyBusyId(businessId);
    setAccessError(null);
    try {
      const json = await callAdmin("adminClassifyBusinessCategory", { businessProfileId: businessId, force });
      setDetail((prev) => {
        if (!prev) return prev;
        return { ...prev, businesses: prev.businesses.map((b) => (b.id === businessId ? { ...b, business_category: json.category } : b)) };
      });
      if (selectedId) await loadCustomers();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menjalankan klasifikasi AI.");
    } finally {
      setClassifyBusyId(null);
    }
  }

  async function classifyAllUncategorized() {
    setBulkClassifyBusy(true);
    setBulkClassifyResult(null);
    setAccessError(null);
    try {
      const json = await callAdmin("adminClassifyAllUncategorized");
      await loadCustomers();
      if (selectedId) await openCustomer(selectedId);
      const failedNote = json.failed > 0 ? `, ${json.failed} gagal` : "";
      const remainingNote = json.remaining > 0 ? ` Sisa ${json.remaining} lagi -- klik tombol ini lagi untuk lanjut.` : " Semua sudah dikategorikan.";
      setBulkClassifyResult(`${json.classified} bisnis berhasil diklasifikasi${failedNote}.${remainingNote}`);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal menjalankan klasifikasi massal.");
    } finally {
      setBulkClassifyBusy(false);
    }
  }

  async function setCustomerRole(email: string, role: "admin" | "user") {
    setCustomerRoleBusy(true);
    setAccessError(null);
    try {
      await callAdmin("adminSetRole", { email, role });
      setDetail((prev) => (prev ? { ...prev, profile: { ...prev.profile, role } } : prev));
      setCustomers((prev) => prev.map((c) => (c.email === email ? { ...c, role } : c)));
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal mengubah role akun.");
    } finally {
      setCustomerRoleBusy(false);
    }
  }

  // === Gerbang login (belum ada sesi admin) ===
  if (!session) {
    return (
      <section className="mx-auto max-w-sm px-6 py-24">
        <h1 className="mb-1 text-xl font-bold">Akses Admin</h1>
        <p className="mb-6 text-sm text-neutral-500">Akses dibatasi. Verifikasi diperlukan.</p>

        {gateError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{gateError}</div>}

        {gateStep === "email" && (
          <div className="space-y-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email admin"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={submitEmail}
              disabled={gateBusy || !emailInput.trim()}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {gateBusy ? "Mengirim..." : "Kirim Link Verifikasi"}
            </button>
          </div>
        )}

        {gateStep === "sent" && (
          <p className="text-sm text-neutral-600">
            Kalau email ini terdaftar sebagai admin, link verifikasi sudah dikirim. Cek inbox (dan folder spam), lalu klik link
            itu -- halaman ini akan terbuka lagi untuk langkah berikutnya.
          </p>
        )}

        {gateStep === "pin" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">Email terverifikasi. Masukkan PIN 6 digit.</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="******"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-primary"
            />
            <button
              onClick={submitPin}
              disabled={gateBusy || pinInput.length !== 6}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {gateBusy ? "Memeriksa..." : "Masuk"}
            </button>
          </div>
        )}
      </section>
    );
  }

  const TAB_LABELS: Record<Tab, string> = {
    dashboard: "Dashboard",
    customers: "Pelanggan",
    payments: "Pembayaran",
    messages: "Pesan Kontak",
    audit: "Log Aktivitas",
    admins: "Kelola Admin",
    costs: "Biaya & Kuota",
  };
  const visibleTabs: Tab[] =
    session.role === "super_admin"
      ? ["dashboard", "customers", "payments", "messages", "costs", "audit", "admins"]
      : ["dashboard", "customers", "payments", "messages"];

  // === Sudah punya sesi admin ===
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Halaman Admin</h1>
          <p className="text-sm text-neutral-500">
            {session.email} &middot; {session.role === "super_admin" ? "Akses penuh (lihat + ubah)" : "Akses lihat saja"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${tab === t ? "bg-primary text-black" : "bg-neutral-100 text-neutral-600"}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
          <button onClick={handleLogout} className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600 sm:text-sm">
            Keluar
          </button>
        </div>
      </div>

      {accessError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{accessError}</div>}

      {tab === "dashboard" && (
        <div className="space-y-6">
          {dashboardLoading && <p className="text-sm text-neutral-400">Memuat ringkasan...</p>}
          {!dashboardLoading && dashboard && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard label="Total Pelanggan" value={String(dashboard.totalCustomers)} sub={`${dashboard.onlineNow} online sekarang`} />
                <StatCard label="MRR Estimasi" value={formatIdr(dashboard.mrrIdr)} sub="dari langganan aktif" />
                <StatCard
                  label="Pro / Platinum"
                  value={`${dashboard.tierCounts.pro || 0} / ${dashboard.tierCounts.platinum || 0}`}
                  sub={`${dashboard.tierCounts.free || 0} masih gratis`}
                />
                <StatCard
                  label="Konversi Wizard"
                  value={`${dashboard.wizardFunnel.conversionRate}%`}
                  sub={`${dashboard.wizardFunnel.promoted} / ${dashboard.wizardFunnel.totalDrafts} jadi akun`}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-3 text-xs font-bold uppercase text-neutral-400">Pendaftaran 14 Hari Terakhir</h4>
                  <div className="flex h-24 items-end gap-1">
                    {dashboard.signupTrend.map((d) => {
                      const max = Math.max(1, ...dashboard.signupTrend.map((x) => x.count));
                      const heightPct = Math.max(4, Math.round((d.count / max) * 100));
                      return (
                        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatShortDate(d.date)}: ${d.count}`}>
                          <div className="w-full rounded-t bg-primary" style={{ height: `${heightPct}%` }} />
                          <span className="text-[9px] text-neutral-400">{formatShortDate(d.date).slice(0, 2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-3 text-xs font-bold uppercase text-neutral-400">Antrian Pembayaran</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-700">Pending</span>
                      <span className="font-semibold">
                        {dashboard.payments.pendingCount} &middot; {formatIdr(dashboard.payments.pendingAmountIdr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-red-700">Gagal</span>
                      <span className="font-semibold">
                        {dashboard.payments.failedCount} &middot; {formatIdr(dashboard.payments.failedAmountIdr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Pesan kontak baru</span>
                      <span className="font-semibold">{dashboard.newContactMessages}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab("payments")}
                    className="mt-4 w-full rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600"
                  >
                    Lihat semua transaksi
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "customers" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as "all" | "idea" | "running")}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              >
                <option value="all">Semua tahap</option>
                <option value="idea">Usaha Baru</option>
                <option value="running">Usaha Berjalan</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              >
                <option value="all">Semua kategori usaha</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {(stageFilter !== "all" || categoryFilter !== "all") && (
                <span className="self-center text-xs text-neutral-400">{filteredCustomers.length} dari {customers.length} pelanggan</span>
              )}
            </div>

            {session.role === "super_admin" && uncategorizedCount > 0 && (
              <div className="mb-3 rounded-xl border border-dashed border-neutral-300 p-2.5">
                <button
                  onClick={classifyAllUncategorized}
                  disabled={bulkClassifyBusy}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {bulkClassifyBusy ? "Mengklasifikasi..." : `Klasifikasikan Semua yang Belum Dikategorikan (${uncategorizedCount})`}
                </button>
                {bulkClassifyResult && <p className="mt-1.5 text-xs text-neutral-500">{bulkClassifyResult}</p>}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Lokasi / Perangkat</th>
                  </tr>
                </thead>
                <tbody>
                  {customersLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                        Memuat...
                      </td>
                    </tr>
                  )}
                  {!customersLoading && filteredCustomers.length === 0 && !accessError && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                        Tidak ada pelanggan yang cocok dengan filter ini.
                      </td>
                    </tr>
                  )}
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 ${selectedId === c.id ? "bg-neutral-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium">
                          <OnlineDot isOnline={c.isOnline} />
                          {c.email}
                        </div>
                        <div className="text-xs text-neutral-400">Daftar {formatDate(c.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${tierBadgeClass(c.highestTier)}`}>{c.highestTier}</span>
                        <div className="mt-1 text-xs text-neutral-400">
                          {c.businessCount} bisnis{c.latestBusinessName ? ` · ${c.latestBusinessName}` : ""}
                        </div>
                        {c.latestCategory && (
                          <div className="mt-0.5 text-xs font-semibold text-neutral-600">
                            {CATEGORY_LABELS[c.latestCategory as BusinessCategoryKey] || c.latestCategory}
                          </div>
                        )}
                        {c.latestIndustry && <div className="mt-0.5 text-xs text-neutral-400">{c.latestIndustry}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        <div>{c.lastLocation || "Lokasi tidak diketahui"}</div>
                        <div className="text-neutral-400">{c.lastDevice}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-3">
            {!selectedId && (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-sm text-neutral-400">
                Klik salah satu pelanggan di kiri untuk lihat detail.
              </div>
            )}

            {selectedId && detailLoading && (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-neutral-200 text-sm text-neutral-400">
                Memuat detail...
              </div>
            )}

            {selectedId && !detailLoading && detail && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-2">
                    <OnlineDot isOnline={detail.profile.isOnline} />
                    <h2 className="font-bold">{detail.profile.email}</h2>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">
                    Daftar {formatDate(detail.profile.created_at)} &middot; role: {detail.profile.role}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {detail.profile.lastLocation || "Lokasi tidak diketahui"} &middot; {detail.profile.lastDevice}
                  </p>
                  {/* Audit pra-soft-launch (19 Jul 2026): ubah role langsung
                      dari tab Pelanggan (sebelumnya cuma bisa lewat tab
                      "Kelola Admin"). Dibatasi admin/user (bukan
                      super_admin) -- pola sama seperti adminSetRole.ts:
                      level akses tertinggi tidak boleh diberikan/dicabut
                      hanya dengan satu klik. */}
                  {session.role === "super_admin" &&
                    (detail.profile.role === "admin" || detail.profile.role === "user") && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-neutral-400">Role:</span>
                        <select
                          value={detail.profile.role}
                          disabled={customerRoleBusy}
                          onChange={(e) => setCustomerRole(detail.profile.email, e.target.value as "admin" | "user")}
                          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin (lihat saja)</option>
                        </select>
                      </div>
                    )}
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Estimasi Pemakaian API (perkiraan kasar)</h4>
                  <p className="text-lg font-bold">{formatIdr(detail.usageEstimate.estimatedApiCostIdr)}</p>
                  <p className="text-xs text-neutral-500">
                    {detail.usageEstimate.totalChatMessages} pesan chat &middot; {detail.usageEstimate.totalDecisions} keputusan &middot;{" "}
                    {detail.usageEstimate.totalAnalyses} analisa &middot; {detail.usageEstimate.totalLeadBatches} pencarian referensi pelanggan
                  </p>
                </div>

                {detail.businesses.length === 0 && <p className="text-sm text-neutral-400">Belum membuat bisnis apapun.</p>}

                {detail.businesses.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-neutral-200 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold">
                        {b.business_name}
                        {b.is_archived ? " (diarsipkan)" : ""}
                      </h3>
                      <span className="text-xs text-neutral-400">{formatDate(b.created_at)}</span>
                    </div>

                    {editingBusinessId !== b.id && (
                      <p className="mb-3 text-xs text-neutral-500">
                        {b.business_category ? (
                          <span className="mr-1 rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                            {CATEGORY_LABELS[b.business_category as BusinessCategoryKey] || b.business_category}
                          </span>
                        ) : (
                          <span className="mr-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-400">Belum dikategorikan</span>
                        )}
                        {b.industry || "-"} &middot; {b.business_stage} &middot; {b.business_type} &middot; {b.phone_number || "tanpa nomor HP"}
                      </p>
                    )}

                    {/* Audit pra-soft-launch (19 Jul 2026): "saya bisa
                        menghapus/edit usaha/jenis users dari pelanggan" --
                        edit inline, arsipkan/pulihkan (reversible), dan
                        hapus permanen (TIDAK reversible, butuh ketik ulang
                        nama bisnis). Semua super_admin saja, sama seperti
                        catatan admin. */}
                    {session.role === "super_admin" && editingBusinessId === b.id && editDraft && (
                      <div className="mb-3 space-y-2 rounded-xl border border-dashed border-neutral-300 p-3">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Nama Bisnis</label>
                          <input
                            value={editDraft.businessName}
                            onChange={(e) => setEditDraft({ ...editDraft, businessName: e.target.value })}
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Kategori Usaha</label>
                            <select
                              value={editDraft.businessCategory}
                              onChange={(e) => setEditDraft({ ...editDraft, businessCategory: e.target.value })}
                              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                            >
                              <option value="">Belum dikategorikan</option>
                              {BUSINESS_CATEGORY_KEYS.map((k) => (
                                <option key={k} value={k}>
                                  {CATEGORY_LABELS[k]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Tahap Usaha</label>
                            <select
                              value={editDraft.businessStage}
                              onChange={(e) => setEditDraft({ ...editDraft, businessStage: e.target.value })}
                              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                            >
                              <option value="idea">idea (usaha baru)</option>
                              <option value="starting">starting</option>
                              <option value="running">running (usaha berjalan)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Bidang Usaha (teks bebas)</label>
                          <input
                            value={editDraft.industry}
                            onChange={(e) => setEditDraft({ ...editDraft, industry: e.target.value })}
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Nomor HP</label>
                          <input
                            value={editDraft.phoneNumber}
                            onChange={(e) => setEditDraft({ ...editDraft, phoneNumber: e.target.value })}
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEditBusiness(b.id)}
                            disabled={businessBusyId === b.id}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
                          >
                            {businessBusyId === b.id ? "Menyimpan..." : "Simpan"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingBusinessId(null);
                              setEditDraft(null);
                            }}
                            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {session.role === "super_admin" && editingBusinessId !== b.id && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => startEditBusiness(b)}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleArchiveBusiness(b)}
                          disabled={businessBusyId === b.id}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 disabled:opacity-50"
                        >
                          {businessBusyId === b.id ? "..." : b.is_archived ? "Pulihkan" : "Arsipkan"}
                        </button>
                        <button
                          onClick={() => classifyBusiness(b.id, !!b.business_category)}
                          disabled={classifyBusyId === b.id}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600 disabled:opacity-50"
                        >
                          {classifyBusyId === b.id ? "Mengklasifikasi..." : b.business_category ? "Klasifikasi Ulang (AI)" : "Klasifikasikan (AI)"}
                        </button>
                        {deleteConfirmId !== b.id ? (
                          <button
                            onClick={() => {
                              setDeleteConfirmId(b.id);
                              setDeleteConfirmText("");
                            }}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                          >
                            Hapus Permanen
                          </button>
                        ) : (
                          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-2.5">
                            <p className="mb-1.5 text-xs font-semibold text-red-700">
                              Tidak bisa dibatalkan. Ketik persis "{b.business_name}" untuk konfirmasi:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <input
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder={b.business_name}
                                className="min-w-0 flex-1 rounded-lg border border-red-300 bg-white px-2 py-1.5 text-xs outline-none"
                              />
                              <button
                                onClick={() => confirmDeleteBusiness(b.id)}
                                disabled={businessBusyId === b.id || deleteConfirmText !== b.business_name}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                              >
                                {businessBusyId === b.id ? "Menghapus..." : "Hapus Permanen"}
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmId(null);
                                  setDeleteConfirmText("");
                                }}
                                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Langganan</h4>
                      {b.subscriptions.length === 0 && <p className="text-xs text-neutral-400">Tidak ada.</p>}
                      {b.subscriptions.map((s, i) => (
                        <p key={i} className="text-xs text-neutral-600">
                          {s.tier} &middot; {s.status} &middot; berlaku sampai {formatDate(s.expires_at)}
                        </p>
                      ))}
                      {session.role === "super_admin" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase text-neutral-400">Ubah tier manual:</span>
                          {["free", "pro", "platinum"].map((t) => (
                            <button
                              key={t}
                              onClick={() => setBusinessTier(b.id, t)}
                              disabled={tierBusyId === b.id}
                              className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 disabled:opacity-50"
                            >
                              {tierBusyId === b.id ? "..." : t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Pembayaran</h4>
                      {b.payments.length === 0 && <p className="text-xs text-neutral-400">Tidak ada.</p>}
                      {b.payments.map((p, i) => (
                        <p key={i} className="text-xs text-neutral-600">
                          {p.tier} &middot; {p.status} &middot; {formatDate(p.created_at)}
                        </p>
                      ))}
                    </div>

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Hasil Wizard / Analisa</h4>
                      {b.analyses.length === 0 && <p className="text-xs text-neutral-400">Tidak ada.</p>}
                      {b.analyses.map((a) => (
                        <div key={a.id} className="mb-3 rounded-xl border border-neutral-100 p-3 last:mb-0">
                          <p className="mb-2 text-xs font-semibold text-neutral-500">
                            {a.is_baseline ? "Baseline" : "Update"} &middot; {formatDate(a.created_at)}
                          </p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-neutral-50 p-3">
                              <p className="mb-1.5 text-[10px] font-bold uppercase text-neutral-400">Isi Chat Wizard Lengkap</p>
                              {WIZARD_FIELD_LABELS.map(({ key, label }) => (
                                <p key={key} className="mb-1 text-xs text-neutral-700 last:mb-0">
                                  <span className="font-semibold">{label}:</span> {wizardText(a.raw_input, key)}
                                </p>
                              ))}
                            </div>
                            <div className="rounded-lg bg-amber-50 p-3">
                              <p className="mb-1 text-[10px] font-bold uppercase text-amber-700">Rekomendasi Beemo (AI)</p>
                              <p className="whitespace-pre-wrap text-xs text-neutral-700">{formatAiOutput(a.ai_output)}</p>
                            </div>
                          </div>
                          <details className="mt-2 text-xs text-neutral-500">
                            <summary className="cursor-pointer">Data mentah wizard (JSON lengkap)</summary>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-2 text-[11px]">
                              {JSON.stringify(a.raw_input, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ))}
                    </div>

                    <div>
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">
                        Aktivitas Workspace {b.updates.length > 0 && `(${b.updates.length})`}
                      </h4>
                      {b.updates.length === 0 && <p className="text-xs text-neutral-400">Belum ada update.</p>}
                      {/* Bugfix pra-soft-launch (19 Jul 2026): "harus detail...
                          karena takutnya users komplain minta refund" --
                          sebelumnya cuma menampilkan SATU field pertama yang
                          tidak kosong (content ATAU pencapaian ATAU
                          tantangan), field lain di baris yang sama (kondisi
                          penjualan, omset, pelanggan baru, target ke depan,
                          severity) diam-diam hilang dari tampilan padahal
                          sudah diambil dari database -- sekarang semua field
                          yang terisi ditampilkan. */}
                      {b.updates.map((u) => (
                        <div key={u.id} className="mb-2 rounded-lg bg-neutral-50 p-2.5 text-xs text-neutral-600 last:mb-0">
                          <p className="mb-1 text-[10px] font-semibold text-neutral-400">
                            {formatDate(u.created_at)} &middot; {u.category || "update"}
                            {u.severity && ` · severity: ${u.severity}`}
                          </p>
                          {u.content && <p className="mb-0.5">{u.content}</p>}
                          {u.pencapaian && (
                            <p className="mb-0.5">
                              <span className="font-semibold">Pencapaian:</span> {u.pencapaian}
                            </p>
                          )}
                          {u.tantangan && (
                            <p className="mb-0.5">
                              <span className="font-semibold">Tantangan:</span> {u.tantangan}
                            </p>
                          )}
                          {u.kondisi_penjualan && (
                            <p className="mb-0.5">
                              <span className="font-semibold">Kondisi Penjualan:</span> {u.kondisi_penjualan}
                            </p>
                          )}
                          {u.omset_value !== null && (
                            <p className="mb-0.5">
                              <span className="font-semibold">Omset:</span> {formatIdr(u.omset_value)}
                            </p>
                          )}
                          {u.pelanggan_baru !== null && (
                            <p className="mb-0.5">
                              <span className="font-semibold">Pelanggan Baru:</span> {u.pelanggan_baru}
                            </p>
                          )}
                          {u.target_depan && (
                            <p>
                              <span className="font-semibold">Target ke Depan:</span> {u.target_depan}
                            </p>
                          )}
                          {!u.content &&
                            !u.pencapaian &&
                            !u.tantangan &&
                            !u.kondisi_penjualan &&
                            u.omset_value === null &&
                            u.pelanggan_baru === null &&
                            !u.target_depan && <p className="text-neutral-400">(tidak ada detail tersimpan)</p>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">
                        Referensi Pelanggan Baru {b.leadReferrals.length > 0 && `(${b.leadReferrals.length})`}
                      </h4>
                      {b.leadReferrals.length === 0 && <p className="text-xs text-neutral-400">Belum pernah mencari referensi.</p>}
                      {b.leadReferrals.length > 0 &&
                        (() => {
                          const batchCount = new Set(b.leadReferrals.map((l) => l.batch_id)).size;
                          return (
                            <p className="mb-2 text-[10px] text-neutral-400">
                              {batchCount} kali pencarian &middot; {b.leadReferrals.length} total lead ditemukan
                            </p>
                          );
                        })()}
                      {b.leadReferrals.map((l) => (
                        <div key={l.id} className="mb-2 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
                          <p className="mb-1 text-[10px] text-neutral-400">
                            {l.lead_type === "company" ? "Perusahaan" : "Segmen Perorangan"} &middot; {formatDate(l.generated_at)}
                          </p>
                          <p className="font-semibold text-neutral-800">{l.name}</p>
                          {l.description && <p className="mt-0.5">{l.description}</p>}
                          {l.address && <p className="mt-0.5 text-neutral-500">📍 {l.address}</p>}
                          {l.source_url && (
                            <a href={l.source_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-primary underline">
                              {l.source_url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Catatan Admin</h4>
                      {b.notes.length === 0 && <p className="text-xs text-neutral-400">Belum ada catatan.</p>}
                      {b.notes.map((n) => (
                        <div key={n.id} className="mb-2 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
                          <p className="mb-1 text-[10px] text-neutral-400">
                            {n.created_by_email} &middot; {formatDate(n.created_at)}
                          </p>
                          {n.note && <p className="whitespace-pre-wrap">{n.note}</p>}
                          {n.image_data_url && (
                            <img src={n.image_data_url} alt="Screenshot catatan" className="mt-1 max-h-48 rounded-lg border border-neutral-200" />
                          )}
                        </div>
                      ))}
                      {session.role === "super_admin" && (
                        <div className="mt-2 rounded-lg border border-dashed border-neutral-200 p-2">
                          <textarea
                            value={noteDrafts[b.id] || ""}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            onPaste={(e) => handleNotePaste(e, b.id)}
                            placeholder="Tulis catatan, atau tempel (Ctrl+V) screenshot percakapan pelanggan di sini..."
                            rows={2}
                            className="w-full resize-none rounded-lg border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-primary"
                          />
                          {noteImages[b.id] && (
                            <div className="mt-2 flex items-center gap-2">
                              <img src={noteImages[b.id]!} alt="Preview screenshot" className="max-h-24 rounded-lg border border-neutral-200" />
                              <button
                                onClick={() => setNoteImages((prev) => ({ ...prev, [b.id]: null }))}
                                className="text-xs text-red-600"
                              >
                                Hapus gambar
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => submitNote(b.id)}
                            disabled={noteBusyId === b.id || (!noteDrafts[b.id]?.trim() && !noteImages[b.id])}
                            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
                          >
                            {noteBusyId === b.id ? "Menyimpan..." : "Simpan Catatan"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {detail.wizardDrafts.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 p-5">
                    <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Draft Wizard (belum/tidak login)</h4>
                    {detail.wizardDrafts.map((d) => (
                      <p key={d.id} className="text-xs text-neutral-600">
                        {formatDate(d.created_at)} &middot; status: {d.status}
                      </p>
                    ))}
                  </div>
                )}

                {detail.contactMessages.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 p-5">
                    <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Pesan Kontak</h4>
                    {detail.contactMessages.map((m) => (
                      <div key={m.id} className="mb-2 border-b border-neutral-100 pb-2 text-xs text-neutral-600 last:border-0">
                        <p className="font-medium text-neutral-800">
                          {m.name || "(tanpa nama)"} &middot; {formatDate(m.created_at)} &middot; {m.status}
                        </p>
                        <p>{m.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "settlement", "failed", "expired"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPaymentStatusFilter(s);
                  loadPayments(s);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${paymentStatusFilter === s ? "bg-primary text-black" : "bg-neutral-100 text-neutral-600"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Jumlah</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                      Memuat...
                    </td>
                  </tr>
                )}
                {!paymentsLoading && payments.length === 0 && !accessError && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                      Tidak ada transaksi.
                    </td>
                  </tr>
                )}
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.customerEmail || "-"}</div>
                      <div className="text-xs text-neutral-400">{p.businessName || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{p.orderId}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${tierBadgeClass(p.tier)}`}>{p.tier}</span>
                    </td>
                    <td className="px-4 py-3">{formatIdr(p.amountIdr)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentStatusClass(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "messages" && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Dari</th>
                <th className="px-4 py-3">Pesan</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {messagesLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                    Memuat...
                  </td>
                </tr>
              )}
              {!messagesLoading && messages.length === 0 && !accessError && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                    Belum ada pesan.
                  </td>
                </tr>
              )}
              {messages.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name || "(tanpa nama)"}</div>
                    <div className="text-xs text-neutral-400">{m.email}</div>
                    <div className="text-xs text-neutral-400">{formatDate(m.created_at)}</div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-neutral-700">{m.message}</td>
                  <td className="px-4 py-3">
                    {session.role === "super_admin" ? (
                      <select
                        value={m.status}
                        disabled={updatingId === m.id}
                        onChange={(e) => updateMessageStatus(m.id, e.target.value)}
                        className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                      >
                        <option value="new">new</option>
                        <option value="read">read</option>
                        <option value="resolved">resolved</option>
                      </select>
                    ) : (
                      <span className="text-xs text-neutral-500">{m.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && session.role === "super_admin" && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Siapa</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Target / Detail</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    Memuat...
                  </td>
                </tr>
              )}
              {!auditLoading && auditLogs.length === 0 && !accessError && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    Belum ada aktivitas tercatat.
                  </td>
                </tr>
              )}
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.actor_email}</div>
                    <div className="text-xs text-neutral-400">{log.actor_role}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-neutral-700">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {log.target && <div>{log.target}</div>}
                    {log.detail && <div className="text-neutral-400">{JSON.stringify(log.detail)}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">{log.ip || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "costs" && session.role === "super_admin" && (
        <div className="space-y-6">
          {costDashboardLoading && <p className="text-sm text-neutral-400">Memuat data biaya...</p>}
          {!costDashboardLoading && costDashboard && (
            <>
              <div className="rounded-2xl border border-neutral-200 p-4 text-xs text-neutral-500">
                Kurs saat ini: <span className="font-semibold text-neutral-700">Rp{Math.round(costDashboard.exchangeRate.rate).toLocaleString("id-ID")} / USD</span>{" "}
                ({costDashboard.exchangeRate.source === "live_api" ? "live" : costDashboard.exchangeRate.source === "cache_db" ? "cache" : "fallback statis"},
                per {formatDate(costDashboard.exchangeRate.fetchedAt)}) &middot; Periode {costDashboard.periodDays} hari terakhir
                {costDashboard.aiUsage.scanLimitReached && " (data dipotong pada batas baris scan, biaya sebenarnya bisa lebih tinggi)"}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard
                  label="Total Biaya AI"
                  value={formatIdr(costDashboard.aiUsage.totalCostIdr)}
                  sub={`${formatUsd(costDashboard.aiUsage.totalCostUsd)} (Claude + Apify)`}
                />
                <StatCard label="Claude" value={formatIdr(costDashboard.aiUsage.claudeCostIdr)} sub={formatUsd(costDashboard.aiUsage.claudeCostUsd)} />
                <StatCard label="Apify" value={formatIdr(costDashboard.aiUsage.apifyCostIdr)} sub={formatUsd(costDashboard.aiUsage.apifyCostUsd)} />
                <StatCard
                  label="Pra-akun (anonim)"
                  value={formatIdr(costDashboard.aiUsage.anonymousCostIdr)}
                  sub="preview + wizard sebelum akun dibuat"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-3 text-xs font-bold uppercase text-neutral-400">Biaya per Aksi</h4>
                  <div className="space-y-2 text-sm">
                    {costDashboard.aiUsage.byAction.length === 0 && <p className="text-neutral-400">Belum ada data pada periode ini.</p>}
                    {costDashboard.aiUsage.byAction.map((a) => (
                      <div key={a.action} className="flex items-center justify-between">
                        <span className="text-neutral-600">{a.action}</span>
                        <span className="font-semibold">
                          {formatIdr(a.costIdr)} <span className="text-xs text-neutral-400">({formatUsd(a.costUsd)})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-3 text-xs font-bold uppercase text-neutral-400">Hosting & Infrastruktur</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="mb-1 font-semibold text-neutral-700">Vercel</p>
                      {costDashboard.vercel.available ? (
                        <>
                          <p className="text-neutral-600">
                            Total: {formatUsd(costDashboard.vercel.totalCostUsd)} ({formatIdr(Math.round(costDashboard.vercel.totalCostUsd * costDashboard.exchangeRate.rate))})
                          </p>
                          {costDashboard.vercel.byService.slice(0, 5).map((s) => (
                            <p key={s.serviceName} className="text-xs text-neutral-400">
                              {s.serviceName}: {formatUsd(s.costUsd)}
                            </p>
                          ))}
                        </>
                      ) : (
                        <p className="text-xs text-amber-700">{costDashboard.vercel.reason}</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-neutral-700">Supabase</p>
                      {costDashboard.supabase.available ? (
                        <>
                          <p className="text-neutral-600">
                            Ukuran database: {formatBytes(costDashboard.supabase.dbSizeBytes)} / {formatBytes(costDashboard.supabase.freeTierLimits.dbSizeBytes)}{" "}
                            ({Math.round((costDashboard.supabase.dbSizeBytes / costDashboard.supabase.freeTierLimits.dbSizeBytes) * 1000) / 10}% kuota Free)
                          </p>
                          {costDashboard.supabase.planAddons.length > 0 && (
                            <p className="text-xs text-neutral-400">
                              Addon aktif: {costDashboard.supabase.planAddons.map((a) => `${a.addonType}${a.variant ? ` (${a.variant})` : ""}`).join(", ")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-amber-700">{costDashboard.supabase.reason}</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-neutral-700">Akun Anthropic (Claude)</p>
                      {costDashboard.anthropic.available ? (
                        (() => {
                          const a = costDashboard.anthropic as Extract<CostDashboard["anthropic"], { available: true }>;
                          const pct = a.monthlyBudgetUsd ? (a.monthToDateCostUsd / a.monthlyBudgetUsd) * 100 : null;
                          const warnColor = pct === null ? "text-neutral-600" : pct >= 95 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-neutral-600";
                          return (
                            <>
                              <p className={`font-semibold ${warnColor}`}>
                                Bulan ini: {formatUsd(a.monthToDateCostUsd)}
                                {pct !== null && ` / ${formatUsd(a.monthlyBudgetUsd!)} (${Math.round(pct)}%)`}
                              </p>
                              {pct !== null && pct >= 80 && (
                                <p className="text-xs font-semibold text-amber-700">
                                  {pct >= 95 ? "Hampir habis -- segera top up." : "Mendekati batas bulanan."}
                                </p>
                              )}
                              {pct === null && (
                                <p className="text-xs text-neutral-400">
                                  Set ANTHROPIC_MONTHLY_BUDGET_USD untuk lihat persentase dari batas bulanan.
                                </p>
                              )}
                              <p className="text-xs text-neutral-400">
                                {costDashboard.periodDays} hari terakhir: {formatUsd(a.periodCostUsd)} (data resmi dari Anthropic Cost Report API)
                              </p>
                            </>
                          );
                        })()
                      ) : (
                        <p className="text-xs text-amber-700">{costDashboard.anthropic.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Bisnis</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Biaya (Rp)</th>
                      <th className="px-4 py-3">Biaya (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costDashboard.aiUsage.topCustomers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                          Belum ada pemakaian AI tercatat pada periode ini.
                        </td>
                      </tr>
                    )}
                    {costDashboard.aiUsage.topCustomers.map((c) => (
                      <tr key={c.businessProfileId} className="border-t border-neutral-100">
                        <td className="px-4 py-3 font-medium">{c.businessName}</td>
                        <td className="px-4 py-3 text-neutral-500">{c.email || "-"}</td>
                        <td className="px-4 py-3 font-semibold">{formatIdr(c.costIdr)}</td>
                        <td className="px-4 py-3 text-xs text-neutral-400">{formatUsd(c.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "admins" && session.role === "super_admin" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 p-5">
            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Tambah Admin (Lihat Saja)</h4>
            <p className="mb-3 text-xs text-neutral-500">
              Akun harus sudah pernah daftar di THE HIVE. Admin baru hanya bisa melihat data, tidak bisa mengubah apapun.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Email akun pelanggan yang mau dijadikan admin"
                className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={addAdmin}
                disabled={addAdminBusy || !newAdminEmail.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                {addAdminBusy ? "Menambahkan..." : "Tambah"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Terakhir Aktif</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {adminsLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      Memuat...
                    </td>
                  </tr>
                )}
                {!adminsLoading && admins.length === 0 && !accessError && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      Belum ada admin.
                    </td>
                  </tr>
                )}
                {admins.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-medium">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${a.role === "super_admin" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-700"}`}>
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{a.last_seen_at ? formatDate(a.last_seen_at) : "Belum pernah"}</td>
                    <td className="px-4 py-3">
                      {a.role === "admin" ? (
                        <button
                          onClick={() => revokeAdmin(a.email)}
                          disabled={roleBusyEmail === a.email}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                        >
                          {roleBusyEmail === a.email ? "..." : "Cabut Akses"}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">Kelola lewat database</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminPage;
