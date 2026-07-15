import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

interface AuthModalProps {
  onClose: () => void
  // Prefill email (mis. dari email yang sudah diisi di chat wizard) —
  // mengurangi risiko pelanggan login pakai email BEDA dari yang dipakai
  // saat mengisi wizard, yang sebelumnya menyebabkan bisnisnya "salah
  // nempel" ke akun lain (lihat guard emailMismatch di promoteDraft.ts).
  defaultEmail?: string
  // Audit Juli 2026 (bug nyata: klik magic link tapi tetap "belum Login" /
  // landing page tanpa penjelasan -- lihat App.tsx untuk deteksi lengkap
  // #error=access_denied&error_code=otp_expired dari Supabase). Kalau true,
  // modal ini langsung tampil dengan pesan error jelas + form kirim ulang,
  // bukan form kosong seperti biasa.
  initialError?: boolean
}

type ModalState = 'idle' | 'sending' | 'sent' | 'error'
// Audit Juli 2026 ("verifikasi magic link lintas perangkat" -- lihat
// migrations/2026-07-14_login_relay.sql): status polling relai, dipakai
// SETELAH modalState === 'sent'. 'waiting' = sedang menunggu link diklik
// di perangkat manapun; 'expired'/'timeout' menampilkan pesan berbeda
// tapi keduanya sama-sama menyuruh pengguna klik "Kirim Ulang Link".
// Tidak ada status 'confirmed' di sini -- begitu confirmed, modal ini
// langsung ditutup (onClose) dan halaman pemanggil bereaksi ke `user`
// yang sudah terisi (lihat Navbar.tsx untuk kasus redirect ke Workspace).
type RelayUiState = 'idle' | 'waiting' | 'expired' | 'timeout'

// Supabase signInWithOtp SENGAJA tidak pernah bilang "email ini tidak
// terdaftar/tidak valid" secara eksplisit (mencegah orang lain menebak
// email mana yang punya akun) — jadi dari sisi client TIDAK ADA cara
// memastikan email yang dimasukkan benar-benar akan menerima link.
// Yang BISA kita lakukan (audit Juli 2026, directive PO: "user benar2 bisa
// mendapatkan link untuk masuk"):
// 1. Kasih jalan keluar CEPAT kalau ternyata salah ketik -- "Ganti email"
//    langsung dari layar "sudah dikirim", bukan harus tutup modal dulu.
// 2. Tombol "Kirim ulang" dengan cooldown, untuk email yang telat sampai
//    atau link pertama hilang/terhapus.
// 3. Terjemahkan pesan error Supabase yang paling sering muncul (rate
//    limit) ke Bahasa Indonesia yang jelas, alih-alih teks Inggris teknis
//    mentah.
const RESEND_COOLDOWN_SECONDS = 30

function friendlyAuthError(rawMessage: string, lang: 'id' | 'en'): string {
  const lower = rawMessage.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('security purposes') || lower.includes('after')) {
    return lang === 'id'
      ? 'Kamu baru saja minta link masuk. Tunggu sebentar sebelum minta lagi.'
      : "You just requested a sign-in link. Please wait a bit before requesting another."
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return lang === 'id'
      ? 'Format email ini tidak valid. Periksa lagi penulisannya.'
      : 'This email format is invalid. Please double-check the spelling.'
  }
  // Bugfix (QA Juli 2026): untuk error jenis tertentu (mis. kegagalan kirim
  // email di sisi server / SMTP, biasanya muncul sebagai 5xx dari Supabase),
  // library @supabase/supabase-js sendiri membungkusnya sebagai
  // AuthRetryableFetchError dengan `.message` yang TIDAK berguna -- cuma
  // literal teks "{}" (bukan pesan aslinya "Error sending magic link
  // email" dsb). Ini quirk di library, bukan sesuatu yang bisa kita
  // perbaiki dari sisi pesannya -- jadi alih-alih menampilkan "{}" mentah
  // ke pengguna, kita deteksi pola ini (pesan kosong atau cuma berisi objek
  // JSON kosong/tidak terbaca) dan ganti dengan pesan umum yang jelas.
  if (!rawMessage.trim() || /^\{.*\}$/.test(rawMessage.trim())) {
    return lang === 'id'
      ? 'Gagal mengirim email verifikasi. Coba lagi dalam beberapa saat.'
      : 'Failed to send the verification email. Please try again shortly.'
  }
  return rawMessage
}

export default function AuthModal({ onClose, defaultEmail, initialError }: AuthModalProps) {
  const { signInWithMagicLink, verifyOtpCode, waitForCrossDeviceLogin } = useAuth()
  const { t, lang } = useLanguage()
  const [email, setEmail] = useState(defaultEmail || '')
  const [state, setState] = useState<ModalState>(initialError ? 'error' : 'idle')
  const [errorMsg, setErrorMsg] = useState(initialError ? t.authModal.expiredLinkError : '')
  const [cooldown, setCooldown] = useState(0)
  const [relayState, setRelayState] = useState<RelayUiState>('idle')
  const cooldownIntervalRef = useRef<number | null>(null)
  // Audit Juli 2026 ("magic link sering kedaluwarsa duluan karena di-scan
  // aplikasi email"): jalur cadangan kode 6 digit -- lihat verifyOtpCode di
  // AuthContext.tsx untuk alasan lengkap kenapa ini kebal dari masalah yang
  // sama dengan link-nya.
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [codeErrorMsg, setCodeErrorMsg] = useState('')
  // Ditutup lewat tombol X / klik di luar modal SEBELUM relai selesai
  // (mis. pengguna berubah pikiran) -- polling waitForCrossDeviceLogin
  // tetap jalan di background (fetch tidak bisa "dibatalkan" dengan
  // bersih tanpa AbortController tambahan), tapi flag ini mencegah
  // setState dipanggil ke komponen yang sudah tidak dirender lagi.
  const unmountedRef = useRef(false)

  useEffect(() => {
    return () => {
      unmountedRef.current = true
      if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current)
    }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current)
    cooldownIntervalRef.current = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function sendLink(targetEmail: string) {
    setState('sending')
    setRelayState('idle')
    const { error, rid } = await signInWithMagicLink(targetEmail.trim())

    if (error) {
      setErrorMsg(friendlyAuthError(error, lang))
      setState('error')
      return
    }

    setState('sent')
    startCooldown()

    // Audit Juli 2026 ("verifikasi lintas perangkat"): kalau rid berhasil
    // dibuat, mulai menunggu di background -- begitu link diklik di
    // PERANGKAT MANAPUN (bukan cuma perangkat ini), sesi otomatis aktif
    // di sini juga tanpa pengguna perlu klik apapun lagi di layar ini.
    // Tanpa rid (gagal dibuat, lihat catatan di AuthContext.tsx), diam
    // saja -- pengguna tetap bisa login normal asal buka link itu sendiri
    // di perangkat yang sama.
    if (rid) {
      setRelayState('waiting')
      const status = await waitForCrossDeviceLogin(rid)
      if (unmountedRef.current) return
      if (status === 'confirmed') {
        onClose()
      } else {
        setRelayState(status)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    await sendLink(email)
  }

  function handleChangeEmail() {
    // Kembali ke form, email tetap terisi supaya tinggal dikoreksi
    // (bukan diketik ulang dari nol) — tapi sekarang bisa diedit lagi.
    setState('idle')
    setErrorMsg('')
    setRelayState('idle')
  }

  function handleResend() {
    if (cooldown > 0 || state === 'sending') return
    setCode('')
    setCodeState('idle')
    setCodeErrorMsg('')
    sendLink(email)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || codeState === 'verifying') return
    setCodeState('verifying')
    setCodeErrorMsg('')
    const { error } = await verifyOtpCode(email, code)
    if (unmountedRef.current) return
    if (error) {
      setCodeErrorMsg(t.authModal.codeInvalidError)
      setCodeState('error')
      return
    }
    // Sukses -- session sudah aktif lewat onAuthStateChange (lihat
    // AuthContext.tsx), Navbar.tsx punya efek terpisah yang menutup modal
    // ini & redirect ke Workspace begitu `user` terisi. onClose() di sini
    // cuma jaga-jaga kalau modal ini dipanggil dari tempat lain tanpa efek
    // itu.
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl">
        <button
          onClick={onClose}
          aria-label={t.authModal.closeLabel}
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900"
        >
          ✕
        </button>

        {state === 'sent' ? (
          <div className="text-center">
            <h2 className="mb-3 text-xl font-extrabold text-neutral-900">{t.authModal.sentTitle}</h2>
            <p className="leading-relaxed text-neutral-600">
              {t.authModal.sentDescPrefix}
              <strong className="text-primary">{email}</strong>
              {t.authModal.sentDescSuffix}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">{t.authModal.sentHelpNote}</p>

            {relayState === 'waiting' && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-neutral-700">
                <span className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t.authModal.crossDeviceWaitingLabel}
              </div>
            )}
            {(relayState === 'expired' || relayState === 'timeout') && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800">
                {t.authModal.crossDeviceExpiredLabel}
              </p>
            )}

            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || state === ('sending' as ModalState)}
                className="text-sm font-semibold text-primary hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cooldown > 0 ? `${t.authModal.resendButton} (${cooldown}s)` : t.authModal.resendButton}
              </button>
              <button onClick={handleChangeEmail} className="text-xs text-neutral-500 underline hover:text-neutral-700">
                {t.authModal.changeEmailButton}
              </button>
            </div>

            {/* Audit Juli 2026: jalur cadangan kode 6 digit -- lihat
                verifyOtpCode di AuthContext.tsx. Selalu tampil di layar
                "sent", bukan cuma setelah link gagal, supaya pengguna yang
                sudah pernah kena masalah ini tidak perlu menunggu gagal
                dulu. */}
            <div className="mt-6 border-t border-neutral-200 pt-5 text-left">
              <p className="mb-3 text-center text-xs text-neutral-500">{t.authModal.codeHelpNote}</p>
              <form onSubmit={handleVerifyCode} className="flex flex-col items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/[^0-9]/g, ''))
                    if (codeState === 'error') setCodeState('idle')
                  }}
                  placeholder={t.authModal.codeInputPlaceholder}
                  disabled={codeState === 'verifying'}
                  className="w-40 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-primary/50 focus:outline-none"
                />
                {codeState === 'error' && (
                  <p className="text-center text-xs text-red-600">{codeErrorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={!code.trim() || codeState === 'verifying'}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-800 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {codeState === 'verifying' ? t.authModal.codeVerifyingButton : t.authModal.codeSubmitButton}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-extrabold text-neutral-900">{t.authModal.title}</h2>
            <p className="mb-6 text-sm text-neutral-500">
              {t.authModal.subtitle}
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.authModal.emailPlaceholder}
                required
                disabled={state === 'sending'}
                className="mb-4 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-neutral-900 placeholder:text-neutral-500 focus:border-primary/50 focus:outline-none"
              />

              {state === 'error' && (
                <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={state === 'sending'}
                className="w-full rounded-lg bg-primary px-4 py-3 font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === 'sending' ? t.authModal.sendingButton : t.authModal.sendButton}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
