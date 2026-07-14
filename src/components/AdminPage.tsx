// src/components/AdminPage.tsx
//
// Halaman admin -- audit Juli 2026 ("super admin, bisa lihat/edit semua
// database: pelanggan, pesan, chat wizard, workspace, langganan dalam satu
// halaman" + "pisahkan halaman super admin ini dari users, atau hackers").
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

import { useCallback, useEffect, useState } from "react";

type Role = "admin" | "super_admin";

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

const SESSION_KEY = "the_hive_admin_session";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
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

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-neutral-300"}`}
      title={isOnline ? "Online" : "Offline"}
    />
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

  const [tab, setTab] = useState<"customers" | "messages">("customers");
  const [accessError, setAccessError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    setCustomers([]);
    setMessages([]);
    setSelectedId(null);
    setDetail(null);
  }

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

  useEffect(() => {
    if (!session?.adminToken) return;
    if (tab === "customers") loadCustomers();
    if (tab === "messages") loadMessages();
  }, [session?.adminToken, tab, loadCustomers, loadMessages]);

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

  // === Sudah punya sesi admin ===
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Halaman Admin</h1>
          <p className="text-sm text-neutral-500">
            {session.email} &middot; {session.role === "super_admin" ? "Akses penuh (lihat + ubah)" : "Akses lihat saja"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("customers")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "customers" ? "bg-primary text-black" : "bg-neutral-100 text-neutral-600"}`}
          >
            Pelanggan
          </button>
          <button
            onClick={() => setTab("messages")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "messages" ? "bg-primary text-black" : "bg-neutral-100 text-neutral-600"}`}
          >
            Pesan Kontak
          </button>
          <button onClick={handleLogout} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">
            Keluar
          </button>
        </div>
      </div>

      {accessError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{accessError}</div>}

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

      {tab === "messages" && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
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
    </section>
  );
}

export default AdminPage;
