import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'

interface ErrorNotificationProps {
  message: string
  onClose: () => void
  duration?: number
}

export function ErrorNotification({ message, onClose, duration = 5000 }: ErrorNotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  return (
    <div className="fixed top-4 right-4 bg-red-900/90 border border-red-500/30 rounded-lg p-4 shadow-lg z-50 max-w-md">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-200">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-red-400 hover:text-red-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

interface ToastNotificationProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export function ToastNotification({ message, type, onClose, duration = 3000 }: ToastNotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const colors = {
    success: 'bg-green-900/90 border-green-500/30 text-green-200',
    error: 'bg-red-900/90 border-red-500/30 text-red-200',
    info: 'bg-blue-900/90 border-blue-500/30 text-blue-200'
  }

  return (
    <div className={`fixed bottom-4 right-4 ${colors[type]} border rounded-lg p-4 shadow-lg z-50 max-w-md`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
