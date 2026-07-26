import { createContext, useContext, useState, useCallback, type PropsWithChildren, type ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

/* ── Types ── */
type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; text: string; type: ToastType }
type Dialog = {
  kind: 'confirm' | 'input'
  title: string
  message?: string
  value?: string
  resolve: (v: any) => void
}

type FeedbackContextValue = {
  toast: (text: string, type?: ToastType) => void
  confirm: (title: string, message?: string) => Promise<boolean>
  input: (title: string, message?: string) => Promise<string | null>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle />,
  error: <AlertCircle />,
  info: <Info />,
}

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const confirm = useCallback((title: string, message?: string) => {
    return new Promise<boolean>(resolve => {
      setDialog({ kind: 'confirm', title, message, resolve })
    })
  }, [])

  const input = useCallback((title: string, message?: string) => {
    return new Promise<string | null>(resolve => {
      setDialog({ kind: 'input', title, message, value: '', resolve })
    })
  }, [])

  const close = useCallback((value: any) => {
    dialog?.resolve(value)
    setDialog(null)
  }, [dialog])

  return (
    <FeedbackContext.Provider value={{ toast, confirm, input }}>
      {children}

      {/* Toast Container */}
      <div className="toasts">
        {toasts.map(t => (
          <div className={`toast ${t.type}`} key={t.id}>
            {TOAST_ICONS[t.type]}
            <span>{t.text}</span>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>
              <X />
            </button>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {dialog && (
        <div className="modal-backdrop" onClick={() => close(dialog.kind === 'input' ? null : false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            {dialog.kind === 'input' && (
              <input
                autoFocus
                value={dialog.value}
                onChange={e => setDialog({ ...dialog, value: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && dialog.value?.trim() && close(dialog.value)}
                placeholder="Type here..."
              />
            )}
            <div className="modal-actions">
              <button
                className="btn-ghost"
                onClick={() => close(dialog.kind === 'input' ? null : false)}
              >
                Cancel
              </button>
              <button
                onClick={() => close(dialog.kind === 'input' ? dialog.value : true)}
                disabled={dialog.kind === 'input' && !dialog.value?.trim()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}
