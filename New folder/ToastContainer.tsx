"use client"

import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import type { Toast, ToastType } from "@/types"

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/50",
    icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/50",
    icon: <AlertCircle className="h-5 w-5 text-red-400" />,
  },
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/50",
    icon: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  },
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/50",
    icon: <Info className="h-5 w-5 text-blue-400" />,
  },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const styles = toastStyles[toast.type]

  const handleRemove = () => {
    setIsExiting(true)
    setTimeout(onRemove, 200) // Wait for animation
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${styles.bg} ${styles.border}
        ${isExiting ? "animate-slide-out-right" : "animate-slide-in-right"}
        transition-all duration-200
      `}
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        <p className="text-sm text-muted-foreground mt-1">{toast.message}</p>
      </div>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  )
}