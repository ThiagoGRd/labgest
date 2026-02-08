'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className={cn(
        "bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full animate-slide-in overflow-hidden",
        sizeClasses[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">{title}</h2>
            {description && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[80vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  )
}
