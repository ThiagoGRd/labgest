import { Sidebar } from '@/components/layout/sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // TODO: Pegar usuário do contexto de autenticação
  const user = {
    nome: 'Thiago Cruz',
    email: 'thiago@labgest.com',
    tipo: 'Administrador',
  }

  return (
    <div className="min-h-screen mesh-bg relative overflow-hidden">
      <Sidebar user={user} />
      <main className="ml-64 transition-all duration-300 min-h-screen flex flex-col">
        <div className="flex-1 animate-in p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
