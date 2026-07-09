import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

interface AuthModalProps {
  onClose: () => void
}

type ModalState = 'idle' | 'sending' | 'sent' | 'error'

export default function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<ModalState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setState('sending')
    const { error } = await signInWithMagicLink(email.trim())

    if (error) {
      setErrorMsg(error)
      setState('error')
    } else {
      setState('sent')
    }
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
