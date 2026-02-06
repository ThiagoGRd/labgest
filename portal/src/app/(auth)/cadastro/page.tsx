'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { cadastro } from '@/actions/auth'

export default function CadastroPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    setError('')

    const result = await cadastro(formData)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">LG</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Criar Conta</h1>
          <p className="text-slate-500">Cadastre-se no Portal do Dentista</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Completo *</label>
            <Input name="nome" placeholder="Dr. João Silva" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
            <Input name="email" type="email" placeholder="seu@email.com" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">CRO *</label>
              <Input name="cro" placeholder="12345" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone *</label>
              <Input name="telefone" placeholder="(11) 99999-9999" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha *</label>
            <div className="relative">
              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                className="pr-10"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Mínimo de 6 caracteres</p>
          </div>

          <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Criando conta...</>
            ) : (
              'Cadastrar'
            )}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Já tem uma conta? <Link href="/login" className="text-emerald-600 hover:underline font-medium">Fazer Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
