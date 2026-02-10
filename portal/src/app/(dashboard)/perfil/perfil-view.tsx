'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProfile } from '@/actions/profile'
import { User, Phone, MapPin, BadgeCheck, Loader2, Save } from 'lucide-react'

interface PerfilViewProps {
  user: any
  profile: {
    nome: string
    email: string | null
    telefone: string
    cro: string
    endereco: string | null
  } | null
}

export function PerfilView({ user, profile }: PerfilViewProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    nome: profile?.nome || '',
    email: profile?.email || '',
    telefone: profile?.telefone || '',
    cro: profile?.cro || '',
    endereco: profile?.endereco || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await updateProfile({
        nome: formData.nome,
        telefone: formData.telefone,
        cro: formData.cro,
        endereco: formData.endereco,
      })

      if (result.success) {
        setSuccess('Perfil atualizado com sucesso!')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.error || 'Erro ao atualizar')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie suas informações pessoais</p>
        </div>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-white">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-600 dark:text-emerald-400">
                  {success}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      className="pl-9 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <Input
                    value={formData.email}
                    disabled
                    className="bg-slate-100 dark:bg-zinc-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-zinc-700"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">O email não pode ser alterado.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Telefone / WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        value={formData.telefone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                        className="pl-9 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CRO
                    </label>
                    <div className="relative">
                      <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        value={formData.cro}
                        onChange={(e) => setFormData(prev => ({ ...prev, cro: e.target.value }))}
                        className="pl-9 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Endereço Completo
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <textarea
                      value={formData.endereco}
                      onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                      className="w-full pl-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
                      placeholder="Rua, Número, Bairro, Cidade - Estado"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  )

}
