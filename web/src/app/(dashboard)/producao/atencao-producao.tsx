'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RetornoDashboard } from '@/lib/dashboard-attention'
import type { OrdemProducao } from '@/components/producao/types'

export function AtencaoProducao({ contexto, ordens, retornos, onLimpar, onAbrir, onDefinir, onConfirmar }: {
  contexto: 'retornos' | 'sem-etapa'
  ordens: OrdemProducao[]
  retornos: RetornoDashboard[]
  onLimpar: () => void
  onAbrir: (id: number) => void
  onDefinir: (ordem: OrdemProducao) => void
  onConfirmar: (ordem: OrdemProducao) => void
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const corresponde = (...valores: (string | number)[]) => valores.some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo))
  const ciclos = retornos.filter((ciclo) => corresponde(ciclo.paciente, ciclo.cliente, ciclo.ordemId))
  const semEtapa = ordens.filter((ordem) => corresponde(ordem.paciente, ordem.dentista, ordem.id))
  const total = contexto === 'retornos' ? ciclos.length : semEtapa.length

  return (
    <section aria-label="Seleção do painel" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950">
        <div>
          <h2 className="font-semibold">{contexto === 'retornos' ? 'Retornos respondidos' : 'Etapa a definir'} · {total}</h2>
          <p className="text-sm">{contexto === 'retornos' ? 'Uma entrada por ciclo respondido, incluindo ordens pausadas.' : 'Ordens ativas com etapa não definida, sem ordens pausadas.'}</p>
        </div>
        <Button variant="outline" onClick={onLimpar}>Limpar seleção</Button>
      </div>
      <Input aria-label="Buscar na seleção do painel" placeholder="Buscar paciente, clínica ou OS" value={busca} onChange={(event) => setBusca(event.target.value)} />
      {total === 0 && <p role="status" className="rounded-xl border border-dashed p-6 text-center">Nenhum resultado para esta seleção e busca.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {contexto === 'retornos' ? ciclos.map((ciclo) => {
          const ordem = ordens.find((item) => item.id === ciclo.ordemId)
          const podeConfirmar = ordem && ordem.cicloAtivoId === ciclo.id && ordem.status !== 'Pausado'
          return (
            <article key={ciclo.id} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <button className="font-semibold underline" onClick={() => onAbrir(ciclo.ordemId)}>{ciclo.paciente} · OS #{ciclo.ordemId}</button>
              <p>{ciclo.cliente} · Ciclo #{ciclo.numeroCiclo} · {ciclo.decisao || 'Resposta registrada'}</p>
              <p className="text-sm">{ciclo.status}</p>
              {podeConfirmar ? <Button variant="outline" onClick={() => onConfirmar(ordem)}>Confirmar retorno</Button> : <p className="text-sm">Abra a ordem para revisar {ciclo.status === 'Pausado' ? 'a pausa antes de prosseguir' : 'este ciclo anterior'}.</p>}
            </article>
          )
        }) : semEtapa.map((ordem) => (
          <article key={ordem.id} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <button className="font-semibold underline" onClick={() => onAbrir(ordem.id)}>{ordem.paciente} · OS #{ordem.id}</button>
            <p>{ordem.dentista} · {ordem.servico}</p>
            <Button variant="outline" onClick={() => onDefinir(ordem)}>Definir tipo e etapa</Button>
          </article>
        ))}
      </div>
    </section>
  )
}
