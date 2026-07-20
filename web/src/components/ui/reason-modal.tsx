'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface ReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  title: string
  description: string
  label?: string
  placeholder?: string
  confirmLabel?: string
  loading?: boolean
}

export function ReasonModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  label = 'Motivo',
  placeholder,
  confirmLabel = 'Confirmar',
  loading = false,
}: ReasonModalProps) {
  const [reason, setReason] = useState('')
  const fieldId = useId()

  const handleClose = () => {
    if (loading) return
    setReason('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} description={description} size="sm" dismissible={!loading}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (reason.trim()) onConfirm(reason.trim())
        }}
      >
        <div>
          <label htmlFor={fieldId} className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {label} <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={fieldId}
            autoFocus
            required
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="rounded-xl">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !reason.trim()} className="rounded-xl">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Salvando...' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
