import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  // Audit Juli 2026 ("magic link sering kedaluwarsa duluan karena
  // aplikasi email memindai link itu sebelum pengguna sungguhan klik" --
  // gejala industri umum di semua provider magic-link, bukan bug di kode
  // kita): DIROMBAK TOTAL dari link yang bisa diklik menjadi kode 6 digit
  // yang WAJIB diketik manual. Kode yang diketik manual tidak bisa
  // "dihabiskan" oleh scanner otomatis seperti link.
  sendLoginOtp: (email: string) => Promise<{ error: string | null }>
  verifyOtpCode: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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

  // Audit Juli 2026: signInWithOtp TANPA emailRedirectTo -- tidak ada lagi
  // link yang perlu diklik (lihat template email di Supabase dashboard,
  // sekarang cuma menampilkan {{ .Token }}). Supabase tetap mengirim email
  // yang sama untuk magic-link maupun kode OTP (satu request, dua bentuk
  // representasi token) -- kita hanya memilih untuk TIDAK memakai bentuk
  // link-nya sama sekali di sisi produk.
  const sendLoginOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error?.message ?? null }
  }

  // verifyOtp dengan type: 'email' menerima kode 6 digit ({{ .Token }} di
  // template) yang diketik manual pengguna -- begitu berhasil, supabase-js
  // otomatis set session & memicu onAuthStateChange sendiri (listener di
  // atas yang menangkapnya).
  const verifyOtpCode = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email',
    })
    return { error: error?.message ?? null }
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
        sendLoginOtp,
        verifyOtpCode,
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
