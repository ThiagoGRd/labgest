'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { login } from '@/actions/auth'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError('')

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-7">
            <div className="h-11 w-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-xs">
              <span className="text-white font-bold text-lg tracking-tight">LG</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">LabGest</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Gestão Técnica de Prótese Dentária</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Acessar sistema</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Entre com suas credenciais da equipe do laboratório.</p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/40 dark:border-red-900">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Lembrar de mim</span>
              </label>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-1 bg-slate-900 border-l border-slate-800 p-12 items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(at 20% 20%, rgba(67, 56, 202, 0.55) 0, transparent 55%), radial-gradient(at 80% 80%, rgba(16, 185, 129, 0.25) 0, transparent 50%)',
          }}
        />

        <div className="relative z-10 text-white max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-5">
            Precisão Clínica & Laboratorial
          </span>
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Controle completo da bancada, entregas e Clinicorp em um só painel
          </h2>
          <ul className="space-y-3.5 text-slate-200">
            {[
              'Ordens unificadas por paciente (Superior + Inferior)',
              'Bancada Lab integrada ao andamento do Clinicorp',
              'Recepção, envios externos e portal do dentista',
              'Controle financeiro com baixa e conciliação',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm sm:text-base">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 pt-6 border-t border-slate-800">
            <p className="text-slate-400 text-sm mb-1.5">Acesso exclusivo para clínicas parceiras?</p>
            <a href="/portal" className="inline-flex items-center gap-2 text-indigo-300 text-sm font-semibold hover:text-indigo-200">
              Acessar Portal do Dentista →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
