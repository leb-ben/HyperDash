"use client"

import { useState, useCallback } from "react"
import type { Toast, ToastType } from "@/types"

interface UseToastReturn {
  toasts: Toast[]
  addToast: (type: ToastType, title: string, message: string, duration?: number) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  success: (title: string, message: string) => string
  error: (title: string, message: string) => string
  warning: (title: string, message: string) => string
  info: (title: string, message: string) => string
}

const DEFAULT_DURATION = 5000 // 5 seconds

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([])

  const generateId = (): string => {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (type: ToastType, title: string, message: string, duration: number = DEFAULT_DURATION): string => {
      const id = generateId()
      const newToast: Toast = { id, type, title, message, duration }

      setToasts((prev) => [...prev, newToast])

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id))
        }, duration)
      }

      return id
    },
    []
  )

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const success = useCallback(
    (title: string, message: string): string => {
      return addToast("success", title, message)
    },
    [addToast]
  )

  const error = useCallback(
    (title: string, message: string): string => {
      return addToast("error", title, message, 8000) // Errors stay longer
    },
    [addToast]
  )

  const warning = useCallback(
    (title: string, message: string): string => {
      return addToast("warning", title, message, 6000)
    },
    [addToast]
  )

  const info = useCallback(
    (title: string, message: string): string => {
      return addToast("info", title, message)
    },
    [addToast]
  )

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  }
}