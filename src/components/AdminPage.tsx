// src/components/AdminPage.tsx
//
// Halaman #admin -- audit Juli 2026 ("super admin, bisa lihat/edit semua
// database: pelanggan, pesan, chat wizard, workspace, langganan dalam satu
// halaman"). SENGAJA disembunyikan, tidak ada link publik ke sini sama
// sekali (sama seperti pola #ulasan-internal) -- diakses langsung lewat URL
// oleh pemilik produk (dan admin lain yang ditambahkan lewat kolom
// profiles.role, lihat migrations/2026-07-15b_admin_roles.sql).
//
// Otorisasi SEBENARNYA ada di backend (services/admin/requireAdminRole.ts)
// -- halaman ini cuma UI, kalau akun bukan admin/super_admin, semua
// pemanggilan action "admin*" di /api/workspace akan ditolak 403 dan
// ditampilkan sebagai pesan "akses ditolak" di sini.
//
// Dua level akses (role dikembalikan oleh backend di setiap response):
//   'admin'       -> lihat semua data, tidak ada tombol ubah apapun.
//   'super_admin' -> lihat + bisa ubah status pesan kontak.
//
// Tidak login sama sekali -> Navbar (yang membungkus halaman ini, lihat
// App.tsx) sudah punya tombol Login + AuthModal sendiri, jadi di sini cukup
// tampilkan pesan untuk login lewat situ.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

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
  profile: { id: string; email: string; created_at: string; role: string };
  businesses: Business[];
  wizardDrafts: WizardDraft[];
  contactMessages: ContactMessage[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function tierBadgeClass(tier: string): string {
  if (tier === "platinum") return "bg-neutral-900 text-white";
  if (tier === "pro") return "bg-primary text-black";
  return "bg-neutral-200 text-neutral-700";
}

function AdminPage() {
  const { session, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"customers" | "messages">("customers");
  const [role, setRole] = useState<Role | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const callAdmin = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (!session?.access_token) throw new Error("Belum login.");
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data.");
      return json;
    },
    [session?.access_token]
  );

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setAccessError(null);
    try {
      const json = await callAdmin("adminListCustomers");
      setRole(json.role);
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
      setRole(json.role);
      setMessages(json.messages);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setMessagesLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (tab === "customers") loadCustomers();
    if (tab === "messages") loadMessages();
  }, [session?.access_token, tab, loadCustomers, loadMessages]);

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

  if (authLoading) {
    return <section className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-neutral-500">Memuat...</section>;
  }

  if (!session) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-bold">Halaman Admin</h1>
        <p className="mt-3 text-sm text-neutral-600">Silakan login dulu lewat tombol "Login" di pojok kanan atas, lalu buka halaman ini lagi.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Halaman Admin</h1>
          <p className="text-sm text-neutral-500">
            {role === "super_admin" ? "Akses penuh (lihat + ubah)." : role === "admin" ? "Akses lihat saja." : "Memeriksa akses..."}
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
        </div>
      </div>

      {accessError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{accessError}</div>
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
                    <th className="px-4 py-3">Bisnis</th>
                  </tr>
                </thead>
                <tbody>
                  {customersLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">Memuat...</td>
                    </tr>
                  )}
                  {!customersLoading && customers.length === 0 && !accessError && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">Belum ada pelanggan.</td>
                    </tr>
                  )}
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className={`cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 ${selectedId === c.id ? "bg-neutral-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.email}</div>
                        <div className="text-xs text-neutral-400">{formatDate(c.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${tierBadgeClass(c.highestTier)}`}>{c.highestTier}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.businessCount}
                        {c.latestBusinessName ? <span className="text-neutral-400"> &middot; {c.latestBusinessName}</span> : null}
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
                  <h2 className="font-bold">{detail.profile.email}</h2>
                  <p className="text-xs text-neutral-400">Daftar: {formatDate(detail.profile.created_at)} &middot; role: {detail.profile.role}</p>
                </div>

                {detail.businesses.length === 0 && (
                  <p className="text-sm text-neutral-400">Belum membuat bisnis apapun.</p>
                )}

                {detail.businesses.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-neutral-200 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold">{b.business_name}{b.is_archived ? " (diarsipkan)" : ""}</h3>
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
                        <p className="font-medium text-neutral-800">{m.name || "(tanpa nama)"} &middot; {formatDate(m.created_at)} &middot; {m.status}</p>
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
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">Memuat...</td>
                </tr>
              )}
              {!messagesLoading && messages.length === 0 && !accessError && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-400">Belum ada pesan.</td>
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
                    {role === "super_admin" ? (
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
