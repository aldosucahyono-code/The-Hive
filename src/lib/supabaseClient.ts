import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Bugfix (QA Juli 2026): diganti dari 'pkce' -> 'implicit'.
    // PKCE mengharuskan magic link ditukar jadi sesi di PERANGKAT YANG SAMA
    // dengan yang dipakai minta link (code verifier-nya cuma tersimpan di
    // local storage perangkat asal, tidak ikut terkirim ke email) --
    // sengaja diganti supaya link BOLEH diverifikasi dari perangkat manapun
    // (mis. minta di Laptop, klik di HP), dengan perangkat yang sedang
    // menunggu yang otomatis masuk Workspace lewat relai polling (lihat
    // migrations/2026-07-14_login_relay.sql, AuthContext.tsx, App.tsx).
    // Implicit flow taruh token langsung di hash URL (bukan kode yang
    // butuh verifier tersimpan), jadi perangkat manapun yang membuka link
    // bisa langsung memakainya.
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
