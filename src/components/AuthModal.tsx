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
}

type ModalState = 'idle' | 'sending' | 'sent' | 'error'

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
  return rawMessage
}

export default function AuthModal({ onClose, defaultEmail }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth()
  const { t, lang } = useLanguage()
  const [email, setEmail] = useState(defaultEmail || '')
  const [state, setState] = useState<ModalState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const cooldownIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
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
    const { error } = await signInWithMagicLink(targetEmail.trim())

    if (error) {
      setErrorMsg(friendlyAuthError(error, lang))
      setState('error')
    } else {
      setState('sent')
      startCooldown()
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
  }

  function handleResend() {
    if (cooldown > 0 || state === 'sending') return
    sendLink(email)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-8 backdrop-blur-md">
        <button
          onClick={onClose}
          aria-label={t.authModal.closeLabel}
          className="absolute right-4 top-4 text-neutral-400 hover:text-white"
        >
          ✕
        </button>

        {state === 'sent' ? (
          <div className="text-center">
            <h2 className="mb-3 text-xl font-extrabold text-white">{t.authModal.sentTitle}</h2>
            <p className="leading-relaxed text-neutral-300">
              {t.authModal.sentDescPrefix}
              <strong className="text-primary">{email}</strong>
              {t.authModal.sentDescSuffix}
            </p>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">{t.authModal.sentHelpNote}</p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || state === ('sending' as ModalState)}
                className="text-sm font-semibold text-primary hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cooldown > 0 ? `${t.authModal.resendButton} (${cooldown}s)` : t.authModal.resendButton}
              </button>
              <button onClick={handleChangeEmail} className="text-xs text-neutral-500 underline hover:text-neutral-300">
                {t.authModal.changeEmailButton}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-extrabold text-white">{t.authModal.title}</h2>
            <p className="mb-6 text-sm text-neutral-400">
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
                className="mb-4 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-primary/50 focus:outline-none"
              />

              {state === 'error' && (
                <p className="mb-4 text-sm text-red-400">{errorMsg}</p>
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
