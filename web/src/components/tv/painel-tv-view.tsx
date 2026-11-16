'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  Play,
  Plus,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Tv,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  atualizarStatusBlocoTv,
  excluirBlocoTv,
  moverOuReagendarBlocoTv,
  type PainelTvSnapshot,
} from '@/actions/agenda-tv'
import {
  agoraMaceioInfo,
  resumirBancadaProtetico,
  type BlocoTimelineTv,
  type ProteticoId,
  type ResumoBancadaProtetico,
} from '@/lib/agenda-tv'
import { AgendarBancadaModal } from '@/components/lab-interno/agendar-bancada-modal'
import { MotorAgendaIaModal } from '@/components/lab-interno/motor-agenda-ia-modal'
import { somarDias } from '@/lib/labs-externos-utils'

interface PainelTvViewProps {
  inicial: PainelTvSnapshot
  proteticoInicial?: ProteticoId | null
  kioskInicial?: boolean
  temaInicial?: 'dark' | 'light'
}

function tocarAlertaSuave() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch {
    // Navegador pode bloquear áudio antes de interação do usuário
  }
}

export function PainelTvView({
  inicial,
  proteticoInicial = null,
  kioskInicial = false,
  temaInicial = 'dark',
}: PainelTvViewProps) {
  const [snapshot, setSnapshot] = useState<PainelTvSnapshot>(inicial)
  const [modoVisao, setModoVisao] = useState<'dual' | ProteticoId>(proteticoInicial ?? 'dual')
  const [temaTv, setTemaTv] = useState<'dark' | 'light'>(temaInicial)
  const [somAtivo, setSomAtivo] = useState<boolean>(false)
  const [kiosk, setKiosk] = useState<boolean>(kioskInicial)
  const [telaCheia, setTelaCheia] = useState<boolean>(false)
  const [agoraInfo, setAgoraInfo] = useState(() => agoraMaceioInfo())
  const [reconectando, setReconectando] = useState<boolean>(false)
  const [modalAgendarAberto, setModalAgendarAberto] = useState<boolean>(false)
  const [modalMotorIaAberto, setModalMotorIaAberto] = useState<boolean>(false)
  const [proteticoModal, setProteticoModal] = useState<ProteticoId>(proteticoInicial ?? 'otavio')
  const [isPending, startTransition] = useTransition()
  const maquinasAlertadasRef = useRef<Set<number>>(new Set())

  const buscarAtualizacao = useCallback(async (dataAlvo: string) => {
    try {
      const res = await fetch(`/api/tv/agenda?data=${encodeURIComponent(dataAlvo)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setReconectando(true)
        return
      }
      const dados = (await res.json()) as PainelTvSnapshot
      setSnapshot(dados)
      setReconectando(false)
    } catch {
      setReconectando(true)
    }
  }, [])

  // Relógio em tempo real (1s) no fuso de Maceió
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgoraInfo(agoraMaceioInfo())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Polling silencioso de segurança a cada 20s
  useEffect(() => {
    const timer = window.setInterval(() => {
      void buscarAtualizacao(snapshot.dataReferencia)
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [buscarAtualizacao, snapshot.dataReferencia])

  // Supabase Realtime para atualização instantânea ao agendar ou mover OS na Bancada Lab
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('tv-bancada-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, () => {
        void buscarAtualizacao(snapshot.dataReferencia)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordens' }, () => {
        void buscarAtualizacao(snapshot.dataReferencia)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [buscarAtualizacao, snapshot.dataReferencia])

  // Monitora tela cheia
  useEffect(() => {
    const onFs = () => setTelaCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const resumoOtavio = useMemo(
    () =>
      resumirBancadaProtetico({
        protetico: 'otavio',
        blocos: snapshot.blocos,
        ordensNoLab: snapshot.ordensNoLab,
        dataReferencia: snapshot.dataReferencia,
        dataHoje: agoraInfo.dataIso,
        horaMinAtual: agoraInfo.horaMin,
      }),
    [snapshot, agoraInfo.dataIso, agoraInfo.horaMin],
  )

  const resumoNapoleao = useMemo(
    () =>
      resumirBancadaProtetico({
        protetico: 'napoleao',
        blocos: snapshot.blocos,
        ordensNoLab: snapshot.ordensNoLab,
        dataReferencia: snapshot.dataReferencia,
        dataHoje: agoraInfo.dataIso,
        horaMinAtual: agoraInfo.horaMin,
      }),
    [snapshot, agoraInfo.dataIso, agoraInfo.horaMin],
  )

  const todasMaquinas = useMemo(
    () => [...resumoOtavio.emMaquina, ...resumoNapoleao.emMaquina].sort((a, b) => a.fimMin - b.fimMin),
    [resumoOtavio.emMaquina, resumoNapoleao.emMaquina],
  )

  // Chime suave quando uma máquina/panela atinge o horário de retirada
  useEffect(() => {
    if (!somAtivo) return
    for (const m of todasMaquinas) {
      if (m.prontoParaRetirar && !maquinasAlertadasRef.current.has(m.id)) {
        maquinasAlertadasRef.current.add(m.id)
        tocarAlertaSuave()
      }
    }
  }, [todasMaquinas, somAtivo])

  async function alternarTelaCheia() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      toast.info('Pressione F11 no navegador da TV para entrar em tela cheia.')
    }
  }

  function acaoStatus(blocoId: number, status: 'agendado' | 'em_andamento' | 'concluido') {
    startTransition(async () => {
      const res = await atualizarStatusBlocoTv(blocoId, status)
      if (res.success) {
        if (status === 'concluido') {
          const rec = res.recalibracao
          const durTxt = res.duracaoRealMin ? ` em ${res.duracaoRealMin}m` : ''
          if (rec && rec.blocosAjustados > 0) {
            toast.success(
              rec.direcao === 'diminuiu'
                ? `Concluído${durTxt}! ${rec.blocosAjustados} bloco(s) seguinte(s) antecipado(s).`
                : `Concluído${durTxt} (+${rec.deltaMin}m). ${rec.blocosAjustados} bloco(s) empurrado(s) automaticamente.`,
            )
          } else if (res.duracaoRealMin && res.duracaoPlanejadaMin) {
            const diff = res.duracaoRealMin - res.duracaoPlanejadaMin
            if (Math.abs(diff) >= 5) {
              toast.success(
                diff < 0
                  ? `Concluído${durTxt} (${Math.abs(diff)}m mais rápido — perfil atualizado!).`
                  : `Concluído${durTxt} (+${diff}m além do previsto — perfil atualizado!).`,
              )
            }
          }
        }
        await buscarAtualizacao(snapshot.dataReferencia)
      } else {
        toast.error(res.error || 'Erro ao atualizar bloco.')
      }
    })
  }

  function acaoEstender15(blocoId: number) {
    startTransition(async () => {
      const res = await moverOuReagendarBlocoTv(blocoId, { estenderMinutos: 15 })
      if (res.success) {
        const ajustados = res.recalibracao?.blocosAjustados ?? 0
        toast.success(
          ajustados > 0
            ? `Prazo estendido em +15 min e ${ajustados} bloco(s) seguinte(s) ajustado(s).`
            : 'Prazo estendido em +15 min.',
        )
        await buscarAtualizacao(snapshot.dataReferencia)
      } else {
        toast.error(res.error || 'Não foi possível estender o horário.')
      }
    })
  }

  function acaoTrocarProtetico(bloco: BlocoTimelineTv) {
    const destino: ProteticoId = bloco.protetico === 'otavio' ? 'napoleao' : 'otavio'
    startTransition(async () => {
      const res = await moverOuReagendarBlocoTv(bloco.id, { protetico: destino })
      if (res.success) {
        toast.success(`Movido para ${destino === 'otavio' ? 'Tavá' : 'Napoleão'}.`)
        await buscarAtualizacao(snapshot.dataReferencia)
      } else {
        toast.error(res.error || 'Não foi possível transferir o bloco.')
      }
    })
  }

  function acaoExcluir(blocoId: number) {
    startTransition(async () => {
      const res = await excluirBlocoTv(blocoId)
      if (res.success) {
        await buscarAtualizacao(snapshot.dataReferencia)
      } else {
        toast.error(res.error || 'Erro ao remover bloco.')
      }
    })
  }

  const escuro = temaTv === 'dark'
  const clsRoot = escuro ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
  const clsCard = escuro ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
  const clsSubCard = escuro ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
  const clsMuted = escuro ? 'text-slate-400' : 'text-slate-500'

  const paineisVisiveis: ResumoBancadaProtetico[] =
    modoVisao === 'dual'
      ? [resumoOtavio, resumoNapoleao]
      : modoVisao === 'otavio'
        ? [resumoOtavio]
        : [resumoNapoleao]

  const totalConcluidos = resumoOtavio.indicadores.concluidos + resumoNapoleao.indicadores.concluidos
  const totalPlanejados = resumoOtavio.indicadores.totalBancada + resumoNapoleao.indicadores.totalBancada
  const dataAmanha = somarDias(agoraInfo.dataIso, 1)
  const perfisTempo = snapshot.perfisTempo ?? []

  return (
    <div className={`min-h-screen flex flex-col justify-between gap-4 p-4 sm:p-6 transition-colors ${clsRoot}`}>
      <AgendarBancadaModal
        key={`${proteticoModal}-${snapshot.dataReferencia}-${modalAgendarAberto}`}
        isOpen={modalAgendarAberto}
        onClose={() => setModalAgendarAberto(false)}
        onSuccess={() => void buscarAtualizacao(snapshot.dataReferencia)}
        ordensDisponiveis={snapshot.ordensNoLab}
        proteticoInicial={proteticoModal}
        dataInicial={snapshot.dataReferencia}
      />

      {modalMotorIaAberto && (
        <MotorAgendaIaModal
          isOpen
          onClose={() => setModalMotorIaAberto(false)}
          onApplied={() => void buscarAtualizacao(snapshot.dataReferencia)}
          dataInicial={snapshot.dataReferencia}
        />
      )}

      {/* Cabeçalho TV */}
      <header className={`rounded-2xl border p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 ${clsCard}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-lg tracking-tighter">LG</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                reconectando
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-500'
              }`}>
                <span className={`h-2 w-2 rounded-full ${reconectando ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
                {reconectando ? 'Reconectando...' : 'AO VIVO'}
              </span>
              <span className={`text-xs font-semibold uppercase tracking-widest ${clsMuted}`}>
                {snapshot.dataReferencia === agoraInfo.dataIso
                  ? 'Agenda de Hoje'
                  : snapshot.dataReferencia === dataAmanha
                    ? 'Prévia de Amanhã'
                    : snapshot.dataReferencia}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate mt-0.5">
              {modoVisao === 'dual'
                ? 'Painel de Bancada — Tavá & Napoleão'
                : modoVisao === 'otavio'
                  ? 'TV Bancada 1 — TAVÁ'
                  : 'TV Bancada 2 — NAPOLEÃO'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* KPI discreto do turno */}
          <div className={`rounded-xl border px-4 py-2 ${clsSubCard}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${clsMuted}`}>Etapas Hoje</p>
            <p className="text-lg sm:text-xl font-black tabular-nums">
              {totalConcluidos} / {totalPlanejados}
            </p>
          </div>

          {/* Controles (compactos, ocultos no modo ?kiosk=1) */}
          {!kiosk && (
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex rounded-xl border p-1 ${clsSubCard}`}>
                {[
                  { id: 'dual', label: 'Dual' },
                  { id: 'otavio', label: 'Tavá' },
                  { id: 'napoleao', label: 'Napoleão' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModoVisao(opt.id as 'dual' | ProteticoId)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      modoVisao === opt.id
                        ? 'bg-indigo-600 text-white'
                        : `${clsMuted} hover:text-indigo-500`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className={`inline-flex rounded-xl border p-1 ${clsSubCard}`}>
                {[
                  { data: agoraInfo.dataIso, label: 'Hoje' },
                  { data: dataAmanha, label: 'Amanhã' },
                ].map((d) => (
                  <button
                    key={d.data}
                    type="button"
                    onClick={() => void buscarAtualizacao(d.data)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                      snapshot.dataReferencia === d.data
                        ? 'bg-emerald-600 text-white'
                        : `${clsMuted} hover:text-emerald-500`
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setModalMotorIaAberto(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Brain className="h-4 w-4" /> Auto-Agendar IA
              </button>

              <button
                type="button"
                onClick={() => {
                  setProteticoModal(modoVisao === 'napoleao' ? 'napoleao' : 'otavio')
                  setModalAgendarAberto(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" /> Agendar na TV
              </button>

              <button
                type="button"
                onClick={() => setSomAtivo((s) => !s)}
                title={somAtivo ? 'Desativar alerta sonoro de panela/forno' : 'Ativar alerta sonoro suave'}
                className={`rounded-xl border p-2 ${clsSubCard}`}
              >
                {somAtivo ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className={`h-4 w-4 ${clsMuted}`} />}
              </button>

              <button
                type="button"
                onClick={() => setTemaTv((t) => (t === 'dark' ? 'light' : 'dark'))}
                title="Alternar tema TV Escuro / Claro"
                className={`rounded-xl border p-2 ${clsSubCard}`}
              >
                {escuro ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
              </button>

              <button
                type="button"
                onClick={alternarTelaCheia}
                title="Tela cheia"
                className={`rounded-xl border p-2 ${clsSubCard}`}
              >
                {telaCheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setKiosk(true)}
                title="Modo parede (ocultar botões)"
                className={`rounded-xl border px-2.5 py-2 text-xs font-bold ${clsSubCard}`}
              >
                <Tv className="h-4 w-4" />
              </button>

              <Link
                href="/lab-interno"
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${clsSubCard}`}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Bancada Lab
              </Link>
            </div>
          )}

          {kiosk && (
            <button
              type="button"
              onClick={() => setKiosk(false)}
              title="Mostrar controles"
              className={`rounded-xl border px-3 py-2 text-xs font-bold opacity-50 hover:opacity-100 ${clsSubCard}`}
            >
              Controles
            </button>
          )}

          {/* Relógio Grande */}
          <div className="text-right pl-2">
            <p className="text-3xl sm:text-5xl font-black tabular-nums leading-none tracking-tight">
              {agoraInfo.horaStr}
            </p>
            <p className={`text-xs font-semibold mt-1 ${clsMuted}`}>
              {agoraInfo.diaSemanaLabel} · {snapshot.dataReferencia.split('-').reverse().join('/')}
            </p>
          </div>
        </div>
      </header>

      {!kiosk && snapshot.briefingIa && (
        <div className={`rounded-2xl border px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm ${clsCard}`}>
          <Brain className="h-4 w-4 shrink-0 text-indigo-400" />
          <p className={clsMuted}>
            <strong className={escuro ? 'text-slate-100' : 'text-slate-900'}>Motor IA:</strong> {snapshot.briefingIa}
          </p>
        </div>
      )}

      {/* Grid Principal das Bancadas */}
      <main className={`flex-1 grid gap-5 ${modoVisao === 'dual' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
        {paineisVisiveis.map((painel) => {
          const single = modoVisao !== 'dual'
          const atual = painel.blocoAtual
          const sugerido = painel.sugeridoDaFila
          const perfisDoProtetico = perfisTempo.filter(
            (p) => p.protetico === painel.protetico.id && p.tendencia !== 'estavel',
          )
          const corBadge =
            painel.protetico.cor === 'indigo'
              ? 'bg-indigo-600 text-white'
              : 'bg-emerald-600 text-white'

          return (
            <section
              key={painel.protetico.id}
              className={`rounded-3xl border p-5 sm:p-6 flex flex-col gap-5 ${clsCard}`}
            >
              {/* Título do Protético */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500/20 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl ${corBadge}`}>
                    {painel.protetico.nome[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                      {painel.protetico.nome}
                    </h2>
                    <p className={`text-xs sm:text-sm font-medium mt-1 ${clsMuted}`}>
                      {painel.protetico.especialidade}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {perfisDoProtetico.slice(0, 2).map((perfil) => (
                    <span
                      key={perfil.categoria}
                      title={`Tempo médio real recalculado em ${perfil.amostras} execução(ões)`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        perfil.tendencia === 'diminuiu'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {perfil.tendencia === 'diminuiu' ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" />
                      )}
                      {perfil.categoriaLabel.split(' ')[0]}: {perfil.duracaoSugeridaMin}m ({perfil.desvioMin > 0 ? `+${perfil.desvioMin}` : perfil.desvioMin}m)
                    </span>
                  ))}
                  {painel.indicadores.atrasadosNoDia > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      <Flame className="h-3.5 w-3.5" /> {painel.indicadores.atrasadosNoDia} atraso(s)
                    </span>
                  )}
                  <span className={`rounded-full border px-3.5 py-1.5 text-sm font-black tabular-nums ${clsSubCard}`}>
                    {painel.indicadores.concluidos} / {painel.indicadores.totalBancada} feitos
                  </span>
                </div>
              </div>

              {/* HERO: Trabalho Em Bancada Agora */}
              {atual ? (
                <div
                  className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${clsSubCard} border-l-8 ${
                    atual.estadoTemporal === 'excedido' || atual.riscoClinicorp || atual.prioridadeOrdem === 'Urgente'
                      ? 'border-l-red-500'
                      : atual.status === 'em_andamento'
                        ? 'border-l-indigo-500'
                        : 'border-l-emerald-500'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-white ${
                        atual.estadoTemporal === 'excedido'
                          ? 'bg-red-600'
                          : atual.status === 'em_andamento'
                            ? 'bg-indigo-600'
                            : 'bg-emerald-600'
                      }`}>
                        {atual.status === 'em_andamento' ? 'EM BANCADA AGORA' : 'PRÓXIMO DO HORÁRIO'}
                      </span>
                      {atual.ordemId && (
                        <span className={`font-mono text-base font-bold ${clsMuted}`}>#{atual.ordemId}</span>
                      )}
                      {atual.diasVencidosTotal > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                          <Flame className="h-3.5 w-3.5" /> Vencida {atual.diasVencidosTotal}d
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-xl sm:text-2xl font-black tabular-nums">
                      {atual.horaInicio} – {atual.horaFim}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className={`${single ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'} font-black tracking-tight leading-tight`}>
                      {atual.paciente}
                    </h3>
                    {atual.corDentes && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3.5 py-1.5 text-base sm:text-lg font-black text-amber-500 ring-1 ring-amber-500/30">
                        <Palette className="h-4 w-4" /> Cor {atual.corDentes}
                      </span>
                    )}
                  </div>

                  <p className={`${single ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} font-bold text-indigo-400`}>
                    {atual.etapaNome}
                  </p>

                  <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-sm sm:text-base font-semibold ${clsMuted}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <Wrench className="h-4 w-4" />
                      {atual.servico}
                      {atual.arcada ? ` · ${atual.arcada}` : ''}
                    </span>
                    {atual.dentista && (
                      <span className="inline-flex items-center gap-1.5">
                        <Stethoscope className="h-4 w-4" /> {atual.dentista}
                      </span>
                    )}
                    {atual.clinicorpConsultaLabel && (
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-sm font-bold ${
                        atual.riscoClinicorp
                          ? 'bg-red-600 text-white'
                          : 'bg-sky-500/15 text-sky-400'
                      }`}>
                        <CalendarClock className="h-4 w-4" />
                        Clinicorp: {atual.clinicorpConsultaLabel}
                      </span>
                    )}
                  </div>

                  {(atual.cicloObs || atual.observacao) && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{atual.cicloObs ? `Obs. dentista: ${atual.cicloObs}` : atual.observacao}</span>
                    </div>
                  )}

                  {/* Barra de progresso temporal */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold tabular-nums">
                      <span className={clsMuted}>Progresso do bloco ({atual.duracaoMin} min)</span>
                      <span className={atual.excedidoMin > 0 ? 'text-red-500' : clsMuted}>
                        {atual.excedidoMin > 0
                          ? `Excedido +${atual.excedidoMin} min`
                          : `${atual.progressoPct}% do horário`}
                      </span>
                    </div>
                    <div className={`h-4 rounded-full overflow-hidden ${escuro ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          atual.excedidoMin > 0
                            ? 'bg-red-500'
                            : atual.progressoPct >= 75
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                        }`}
                        style={{ width: `${atual.progressoPct}%` }}
                      />
                    </div>
                  </div>

                  {!kiosk && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {atual.status !== 'em_andamento' && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => acaoStatus(atual.id, 'em_andamento')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" /> Iniciar agora
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acaoStatus(atual.id, 'concluido')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Concluir bloco
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acaoEstender15(atual.id)}
                        title="Estender prazo em +15 min e empurrar próximos blocos automaticamente"
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${clsCard}`}
                      >
                        <Clock className="h-3.5 w-3.5" /> Estender +15m
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acaoTrocarProtetico(atual)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-bold ${clsCard}`}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" /> Passar p/ {painel.protetico.id === 'otavio' ? 'Napoleão' : 'Tavá'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`rounded-2xl border p-5 space-y-3 ${clsSubCard}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      {painel.timeline.length > 0 ? 'AGENDA CONCLUÍDA' : 'SUGESTÃO AUTOMÁTICA DA FILA'}
                    </span>
                    {!kiosk && (
                      <button
                        type="button"
                        onClick={() => {
                          setProteticoModal(painel.protetico.id)
                          setModalAgendarAberto(true)
                        }}
                        className="text-xs font-bold text-indigo-400 hover:underline"
                      >
                        + Programar horário
                      </button>
                    )}
                  </div>
                  {sugerido ? (
                    <div>
                      <p className="text-2xl sm:text-3xl font-black">
                        {sugerido.paciente} <span className={`font-mono text-base ${clsMuted}`}>#{sugerido.id}</span>
                      </p>
                      <p className="text-lg font-bold text-indigo-400 mt-1">
                        {sugerido.subetapa || sugerido.servico}
                        {sugerido.cor ? ` · Cor ${sugerido.cor}` : ''}
                      </p>
                      <p className={`text-sm mt-1 ${clsMuted}`}>
                        {sugerido.dentista} · Pronta na fila para puxar na bancada
                      </p>
                    </div>
                  ) : (
                    <p className={`text-base font-semibold ${clsMuted}`}>
                      Nenhum trabalho pendente programado para esta bancada neste dia.
                    </p>
                  )}
                </div>
              )}

              {/* Agenda Cronológica do Dia */}
              <div className="space-y-2.5 flex-1">
                <div className={`flex items-center justify-between text-xs font-bold uppercase tracking-wider ${clsMuted}`}>
                  <span>Agenda Cronológica ({painel.timeline.length} blocos)</span>
                  <span>Carga planejada: {Math.round(painel.indicadores.minutosPlanejados / 60 * 10) / 10}h</span>
                </div>

                {painel.timeline.length === 0 ? (
                  <div className={`rounded-xl border border-dashed p-4 text-center text-sm ${clsSubCard} ${clsMuted}`}>
                    Programe horários clicando em <strong>Auto-Agendar IA</strong> acima ou em <strong>Agendar na TV</strong> na Bancada Lab.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {painel.timeline.map((bloco) => {
                      const feito = bloco.status === 'concluido'
                      const isFoco = atual?.id === bloco.id
                      return (
                        <div
                          key={bloco.id}
                          className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-opacity ${
                            isFoco
                              ? `${clsSubCard} border-indigo-500 ring-1 ring-indigo-500/40`
                              : clsSubCard
                          } ${feito ? 'opacity-45' : ''}`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className={`shrink-0 font-mono text-base sm:text-lg font-black tabular-nums ${feito ? 'line-through' : ''}`}>
                              {bloco.horaInicio}–{bloco.horaFim}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-base sm:text-lg font-bold truncate ${feito ? 'line-through' : ''}`}>
                                {bloco.etapaNome}{' '}
                                <span className={`font-semibold ${clsMuted}`}>· {bloco.paciente}</span>
                              </p>
                              <p className={`text-xs sm:text-sm truncate ${clsMuted}`}>
                                {bloco.ordemId ? `#${bloco.ordemId} · ` : ''}
                                {bloco.servico}
                                {bloco.corDentes ? ` · Cor ${bloco.corDentes}` : ''}
                                {bloco.clinicorpConsultaLabel ? ` · Clinicorp ${bloco.clinicorpConsultaLabel}` : ''}
                                {bloco.duracaoRealMin ? ` · Real ${bloco.duracaoRealMin}m` : ''}
                              </p>
                              {(bloco.ajusteTempoNota || (!kiosk && bloco.motivoIa)) && (
                                <p className="text-[11px] font-semibold text-amber-400 truncate mt-0.5">
                                  {bloco.ajusteTempoNota || bloco.motivoIa}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                              feito
                                ? 'bg-emerald-500/15 text-emerald-500'
                                : bloco.estadoTemporal === 'excedido' || bloco.estadoTemporal === 'passado_pendente'
                                  ? 'bg-red-600 text-white'
                                  : isFoco
                                    ? 'bg-indigo-600 text-white'
                                    : bloco.estadoTemporal === 'proximo'
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : `${clsCard} ${clsMuted}`
                            }`}>
                              {feito
                                ? 'Feito'
                                : bloco.estadoTemporal === 'excedido'
                                  ? `+${bloco.excedidoMin}m`
                                  : bloco.estadoTemporal === 'passado_pendente'
                                    ? 'Atrasado'
                                    : isFoco
                                      ? 'AGORA'
                                      : bloco.estadoTemporal === 'proximo'
                                        ? 'Próximo'
                                        : 'Fila'}
                            </span>

                            {!kiosk && !feito && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => acaoStatus(bloco.id, 'concluido')}
                                title="Marcar como concluído"
                                className="rounded-lg bg-emerald-600/20 p-1.5 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            {!kiosk && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => acaoExcluir(bloco.id)}
                                title="Remover da agenda"
                                className={`rounded-lg p-1.5 hover:bg-red-500/20 hover:text-red-400 ${clsMuted}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Próximos da Fila Sem Horário */}
              {painel.backlog.length > 0 && (
                <div className="border-t border-slate-500/20 pt-3 space-y-2">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${clsMuted}`}>
                    Backlog Priorizado (Encaixar em janelas livres / Panela)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {painel.backlog.slice(0, 2).map((o) => (
                      <div key={o.id} className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${clsSubCard}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">
                            {o.paciente} <span className={`font-mono text-xs ${clsMuted}`}>#{o.id}</span>
                          </p>
                          <p className={`text-xs truncate ${clsMuted}`}>
                            {o.subetapa || o.servico} {o.cor ? `· ${o.cor}` : ''}
                          </p>
                        </div>
                        {o.prioridade === 'Urgente' && (
                          <span className="shrink-0 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                            URGENTE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </main>

      {/* Faixa Inferior: Máquinas / Acrilização / Panela (Tempo Passivo) */}
      <footer className={`rounded-2xl border p-4 ${clsCard}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider">
              Acrilização / Panela / Forno em Ciclo Passivo (Não trava a bancada)
            </h2>
          </div>
          <span className={`text-xs font-medium ${clsMuted}`}>
            Sincronização automática a cada 20s · Realtime ativo
          </span>
        </div>

        {todasMaquinas.length === 0 ? (
          <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${clsSubCard}`}>
            <span className={`text-sm font-semibold ${clsMuted}`}>
              Panela Térmica e Forno livres no momento — divida a acrilização ao agendar para liberar a bancada durante a polimerização.
            </span>
            <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-500">
              EQUIPAMENTOS LIVRES
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {todasMaquinas.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${clsSubCard} ${
                  m.prontoParaRetirar ? 'border-emerald-500 ring-1 ring-emerald-500/40' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {m.equipamento || 'Panela / Máquina'} · {m.protetico === 'otavio' ? 'Tavá' : 'Napoleão'}
                  </p>
                  <p className="text-base font-bold truncate">
                    {m.paciente} {m.ordemId ? `#${m.ordemId}` : ''}
                  </p>
                  <p className={`text-xs truncate ${clsMuted}`}>
                    {m.etapaNome} ({m.horaInicio}–{m.horaFim})
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-lg px-3 py-1.5 text-sm font-black tabular-nums ${
                    m.prontoParaRetirar
                      ? 'bg-emerald-600 text-white animate-pulse'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {m.prontoParaRetirar ? 'PRONTO!' : `${m.restanteMin}m`}
                  </span>
                  {!kiosk && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => acaoStatus(m.id, 'concluido')}
                      title="Retirar da máquina"
                      className="rounded-lg bg-emerald-600/20 p-2 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </footer>
    </div>
  )
}
