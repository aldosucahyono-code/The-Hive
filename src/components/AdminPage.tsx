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

import { useCallback, useEffect, useState } from "react";

type Role = "admin" | "super_admin";
type Tab = "dashboard" | "customers" | "payments" | "messages" | "audit" | "admins";

type Customer = {
  id: string;
  email: string | null;
  createdAt: string;
  role: string;
  businessCount: number;
  latestBusinessName: string | null;
  highestTier: string;
  contactMessageCount: number;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastLocation: string | null;
  lastDevice: string;
};

type Business = {
  id: string;
  business_name: string;
  industry: string | null;
  business_stage: string;
  business_type: string;
  phone_number: string | null;
  is_archived: boolean;
  created_at: string;
  subscriptions: { tier: string; status: string; started_at: string; expires_at: string | null }[];
  payments: { tier: string; status: string; created_at: string }[];
  analyses: { id: string; raw_input: Record<string, unknown>; ai_output: string | null; is_baseline: boolean; created_at: string }[];
  updates: { id: string; content: string | null; pencapaian: string | null; tantangan: string | null; category: string | null; created_at: string }[];
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

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addAdminBusy, setAddAdminBusy] = useState(false);
  const [roleBusyEmail, setRoleBusyEmail] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.adminToken, tab, loadDashboard, loadCustomers, loadMessages, loadAuditLog, loadAdmins]);

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
  };
  const visibleTabs: Tab[] =
    session.role === "super_admin"
      ? ["dashboard", "customers", "payments", "messages", "audit", "admins"]
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
                  {!customersLoading && customers.length === 0 && !accessError && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">
                        Belum ada pelanggan.
                      </td>
                    </tr>
                  )}
                  {customers.map((c) => (
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
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5">
                  <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Estimasi Pemakaian API (perkiraan kasar)</h4>
                  <p className="text-lg font-bold">{formatIdr(detail.usageEstimate.estimatedApiCostIdr)}</p>
                  <p className="text-xs text-neutral-500">
                    {detail.usageEstimate.totalChatMessages} pesan chat &middot; {detail.usageEstimate.totalDecisions} keputusan &middot;{" "}
                    {detail.usageEstimate.totalAnalyses} analisa
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
                    <p className="mb-3 text-xs text-neutral-500">
                      {b.industry || "-"} &middot; {b.business_stage} &middot; {b.business_type} &middot; {b.phone_number || "tanpa nomor HP"}
                    </p>

                    <div className="mb-3">
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Langganan</h4>
                      {b.subscriptions.length === 0 && <p className="text-xs text-neutral-400">Tidak ada.</p>}
                      {b.subscriptions.map((s, i) => (
                        <p key={i} className="text-xs text-neutral-600">
                          {s.tier} &middot; {s.status} &middot; berlaku sampai {formatDate(s.expires_at)}
                        </p>
                      ))}
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
                        <details key={a.id} className="mb-1 text-xs text-neutral-600">
                          <summary className="cursor-pointer">
                            {a.is_baseline ? "Baseline" : "Update"} &middot; {formatDate(a.created_at)}
                          </summary>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-2 text-[11px]">
                            {JSON.stringify(a.raw_input, null, 2)}
                          </pre>
                        </details>
                      ))}
                    </div>

                    <div>
                      <h4 className="mb-1 text-xs font-bold uppercase text-neutral-400">Aktivitas Workspace</h4>
                      {b.updates.length === 0 && <p className="text-xs text-neutral-400">Belum ada update.</p>}
                      {b.updates.map((u) => (
                        <p key={u.id} className="text-xs text-neutral-600">
                          {formatDate(u.created_at)} &middot; {u.category || "update"}: {u.content || u.pencapaian || u.tantangan || "-"}
                        </p>
                      ))}
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
