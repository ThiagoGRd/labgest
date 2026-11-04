'use client'

import { logout } from '@/actions/auth'

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">Não foi possível exibir seus dados</h1>
      <p role="alert" className="my-4">Seus pedidos e valores estão indisponíveis. Confirme seu email e solicite ao laboratório a revisão do cadastro caso o problema continue. Esta mensagem não indica ausência de pedidos ou de valores a pagar.</p>
      <div className="flex justify-center gap-4">
        <button onClick={reset} className="rounded border px-4 py-2">Tentar novamente</button>
        <button onClick={() => logout()} className="rounded border px-4 py-2">Sair e fazer login</button>
      </div>
    </main>
  )
}
