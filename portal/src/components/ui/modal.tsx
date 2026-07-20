'use client'

import * as Dialog from '@radix-ui/react-dialog'
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
  dismissible?: boolean
  tone?: 'default' | 'dark'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  mobileFullscreen = false,
  dismissible = true,
  tone = 'default',
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open && dismissible) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content
          onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault() }}
          onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault() }}
          className={cn(
            'fixed z-[9999] flex w-full flex-col overflow-hidden glass-panel shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            mobileFullscreen
              ? 'inset-x-0 bottom-0 h-[96dvh] max-h-[96dvh] rounded-t-3xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[90vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl'
              : 'left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl',
            mobileFullscreen ? 'sm:w-[calc(100%-3rem)]' : 'w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)]',
            sizeClasses[size]
          )}
        >
          <div className={cn('flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5', tone === 'dark' ? 'bg-zinc-950' : 'bg-white/50 dark:bg-black/20')}>
            <div className="min-w-0 space-y-1 pr-3">
              <Dialog.Title className={cn('truncate text-xl font-bold tracking-tight', tone === 'dark' ? 'text-white' : 'text-foreground/90')}>{title}</Dialog.Title>
              {description && (
                <Dialog.Description className={cn('text-xs font-medium uppercase tracking-wider', tone === 'dark' ? 'text-zinc-400' : 'text-muted-foreground/80')}>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild disabled={!dismissible}>
              <button
                type="button"
                disabled={!dismissible}
                aria-label="Fechar"
                className={cn('rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40', tone === 'dark' ? 'text-zinc-400 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10')}
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className={cn('custom-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6', tone === 'dark' ? 'bg-zinc-950' : 'bg-white/40 dark:bg-black/20')}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
