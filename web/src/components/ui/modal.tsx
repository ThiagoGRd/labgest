'use client'

import { useEffect, useRef, useState } from 'react'
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
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Manage mounting cycle for animations
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Small timeout to ensure DOM is ready for transition
      requestAnimationFrame(() => setIsVisible(true))
      document.body.style.overflow = 'hidden'
    } else {
      setIsVisible(false)
      const timeout = setTimeout(() => {
        setMounted(false)
        document.body.style.overflow = 'unset'
      }, 300) // Match transition duration
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0"
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
          "relative w-full rounded-3xl overflow-hidden glass-panel flex flex-col max-h-[90vh] shadow-2xl transition-all duration-300 ease-out transform",
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md">
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
        <div className="px-6 py-6 overflow-y-auto custom-scrollbar bg-white/40 dark:bg-black/20 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
