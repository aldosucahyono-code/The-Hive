import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

export type RelayStatus = 'confirmed' | 'expired' | 'timeout'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithMagicLink: (email: string) => Promise<{ error: string | null; rid: string | null }>
  waitForCrossDeviceLogin: (rid: string) => Promise<RelayStatus>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Audit Juli 2026 ("verifikasi magic link lintas perangkat" -- lihat
// migrations/2026-07-14_login_relay.sql untuk alur lengkap): interval
// polling + batas waktu tunggu Device A (perangkat yang MENUNGGU, BUKAN
// yang mengklik link di email) sebelum menyerah dan menyuruh pengguna
// minta link baru. Sengaja berhenti sedikit LEBIH AWAL dari expires_at
// 10 menit di migration, supaya tidak race dengan server yang baru saja
// menghapus baris login_relay karena dianggap kedaluwarsa.
const RELAY_POLL_INTERVAL_MS = 3000
const RELAY_MAX_WAIT_MS = 9 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signInWithMagicLink = async (email: string) => {
    // Audit Juli 2026 ("verifikasi lintas perangkat"): sebelum kirim
    // magic link, minta "rid" (id baris login_relay) dulu ke backend --
    // rid ini disisipkan di QUERY STRING redirect (BUKAN hash), supaya
    // tidak bentrok dengan token implicit flow yang ditempel Supabase
    // sendiri di hash URL begitu link diklik (lihat App.tsx untuk sisi
    // penerimanya/Device B, dan migrations/2026-07-14_login_relay.sql
    // untuk alur lengkap + pertimbangan keamanan).
    //
    // Kalau permintaan rid gagal (mis. backend/tabel login_relay
    // bermasalah), tetap lanjut kirim magic link TANPA rid -- pengguna
    // masih bisa login normal asal buka linknya di perangkat yang sama,
    // cuma fitur "otomatis masuk dari perangkat lain" yang tidak aktif
    // untuk permintaan ini (fail open, bukan blokir login sama sekali).
    let rid: string | null = null
    try {
      const ridResponse = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createLoginRelay', email }),
      })
      const ridJson = await ridResponse.json()
      if (ridResponse.ok && ridJson.rid) rid = ridJson.rid
    } catch (err) {
      console.error('createLoginRelay error:', err)
    }

    // Arahkan langsung ke #workspace (bukan cuma origin) supaya kalau link
    // ini SENDIRI yang diklik (bukan lewat relai perangkat lain), pelanggan
    // langsung masuk Workspace pribadinya -- tidak perlu klik tombol
    // "Workspace" manual di halaman utama. App.tsx tetap membersihkan/
    // menormalkan URL ini lewat window.location.reload() setelah sesi
        // berhasil ditukar.
    const redirectTarget = rid
      ? `${window.location.origin}/?rid=${rid}#workspace`
      : `${window.location.origin}/#workspace`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTarget,
      },
    })
    return { error: error?.message ?? null, rid }
  }

  // Dipanggil AuthModal.tsx setelah magic link terkirim (kalau rid berhasil
  // dibuat) -- polling ke checkLoginRelay sampai salah satu dari 3 hal
  // terjadi: (1) confirmed -- Device B (perangkat manapun yang mengklik
  // link) sudah menitipkan token, langsung dipakai lewat setSession() di
  // SINI juga (Device A), (2) expired -- baris login_relay sudah lewat
  // expires_at atau memang tidak ditemukan lagi, (3) timeout -- sudah
  // menunggu RELAY_MAX_WAIT_MS tanpa kabar, menyerah di sisi client
  // (baris di server tetap akan dianggap kedaluwarsa sendiri nanti).
  const waitForCrossDeviceLogin = async (rid: string): Promise<RelayStatus> => {
    const deadline = Date.now() + RELAY_MAX_WAIT_MS

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, RELAY_POLL_INTERVAL_MS))

      try {
        const response = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkLoginRelay', rid }),
        })
        const json = await response.json()

        if (json.status === 'confirmed' && json.accessToken && json.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: json.accessToken,
            refresh_token: json.refreshToken,
          })
          if (error) {
            console.error('waitForCrossDeviceLogin setSession error:', error)
            return 'expired'
          }
          return 'confirmed'
        }
        if (json.status === 'expired') {
          return 'expired'
        }
        // status === "pending" -> lanjut polling putaran berikutnya.
      } catch (err) {
        console.error('checkLoginRelay poll error:', err)
        // Gangguan jaringan sesaat -- coba lagi di putaran berikutnya,
        // jangan langsung menyerah karena satu request gagal.
      }
    }

    return 'timeout'
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithMagicLink,
        waitForCrossDeviceLogin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
