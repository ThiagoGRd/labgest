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
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity duration-300"
      style={{ opacity: 1 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div 
        className={cn(
          "bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.5)] w-full overflow-hidden border border-black/5 dark:border-white/10 transition-all duration-300",
          sizeClasses[size]
        )}
        style={{ transform: 'scale(1)', opacity: 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">{title}</h2>
            {description && (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-sm hover:shadow-md"
          >
            <X className="h-6 w-6 stroke-[2.5px]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8 max-h-[85vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {children}
        </div>
      </div>
    </div>
  )
}
