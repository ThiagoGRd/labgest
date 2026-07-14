'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  mobileFullscreen?: boolean
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md', mobileFullscreen = false }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflowAnterior }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex transition-all duration-300 ease-in-out",
        mobileFullscreen ? "items-end justify-center p-0 sm:items-center sm:p-6" : "items-center justify-center p-4 sm:p-6",
        "opacity-100"
      )}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div 
        className={cn(
          "relative w-full overflow-hidden glass-panel flex flex-col shadow-2xl transition-all duration-300 ease-out transform",
          mobileFullscreen
            ? "h-[96dvh] max-h-[96dvh] rounded-t-3xl rounded-b-none sm:h-auto sm:max-h-[90vh] sm:rounded-3xl"
            : "max-h-[90vh] rounded-3xl",
          "scale-100 translate-y-0",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground/90">{title}</h2>
            {description && (
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 sm:px-6 sm:py-6 overflow-y-auto custom-scrollbar bg-white/40 dark:bg-black/20 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
