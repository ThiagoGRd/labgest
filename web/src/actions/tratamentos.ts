'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { TIPOS_CONTROLADOS, limiteValido, normalizarNome, type LimiteTratamento, type TipoProteseId } from '@labgest/shared'
import { requireAdmin } from '@/lib/auth-utils'
import { atualizarAlertas, sincronizarClinicorp } from '@/lib/controle-tratamentos'

type Resultado = { success: true; mensagem?: string } | { success: false; error: string }

async function comoGestor<T>(acao: (usuario: Awaited<ReturnType<typeof requireAdmin>>) => Promise<T>): Promise<T | { success: false; error: string }> {
  let usuario
  try {
    usuario = await requireAdmin()
  } catch {
    return { success: false, error: 'Acesso restrito ao gestor.' }
  }
  return acao(usuario)
}

export async function sincronizarAgora(): Promise<Resultado> {
  return comoGestor(async () => {
    const resultado = await sincronizarClinicorp('manual')
    revalidatePath('/tratamentos')
    if (!resultado.sucesso) return { success: false, error: resultado.erro || 'Não foi possível sincronizar com o Clinicorp.' }
    const alertas = resultado.alertasNovos ? ` ${resultado.alertasNovos} novo(s) alerta(s).` : ''
    return { success: true, mensagem: `${resultado.consultas} consulta(s) atualizada(s).${alertas}` }
  })
}

export async function darCienciaAlertas(ordemId: number, nota?: string): Promise<Resultado> {
  return comoGestor(async (usuario) => {
    if (!Number.isInteger(ordemId)) return { success: false, error: 'Ordem inválida.' }
    await prisma.alertaTratamento.updateMany({
      where: { ordemId, resolvidoEm: null, cienteEm: null },
      data: { cienteEm: new Date(), cientePor: usuario.nome || usuario.email, cienteNota: nota?.trim().slice(0, 1000) || null },
    })
    revalidatePath('/tratamentos')
    return { success: true }
  })
}

export async function salvarLimite(tipo: string, limite: LimiteTratamento): Promise<Resultado> {
  return comoGestor(async (usuario) => {
    if (!(TIPOS_CONTROLADOS as readonly string[]).includes(tipo)) return { success: false, error: 'Tipo de prótese inválido.' }
    const dados = {
      consultasAtencao: Number(limite.consultasAtencao),
      consultasMax: Number(limite.consultasMax),
      diasAtencao: Number(limite.diasAtencao),
      diasMax: Number(limite.diasMax),
    }
    if (!limiteValido(dados)) return { success: false, error: 'Use números inteiros positivos, com "atenção" menor ou igual ao máximo.' }
    const auditoria = { atualizadoPor: usuario.email, atualizadoEm: new Date() }
    await prisma.limiteTratamento.upsert({
      where: { tipoWorkflow: tipo as TipoProteseId },
      create: { tipoWorkflow: tipo, ...dados, ...auditoria },
      update: { ...dados, ...auditoria },
    })
    await atualizarAlertas()
    revalidatePath('/tratamentos')
    return { success: true }
  })
}

/** Marca se uma consulta conta para a prótese (true/false) ou volta à regra da categoria (null). */
export async function definirContagemConsulta(clinicorpId: string, conta: boolean | null): Promise<Resultado> {
  return comoGestor(async () => {
    const alteradas = await prisma.clinicorpConsulta.updateMany({ where: { clinicorpId }, data: { contaManual: conta } })
    if (alteradas.count === 0) return { success: false, error: 'Consulta não encontrada.' }
    await atualizarAlertas()
    revalidatePath('/tratamentos')
    return { success: true }
  })
}

/** Informa como o paciente está cadastrado no Clinicorp quando o nome difere do da ordem. */
export async function vincularPaciente(ordemId: number, nomeNoClinicorp: string): Promise<Resultado> {
  return comoGestor(async (usuario) => {
    if (!Number.isInteger(ordemId)) return { success: false, error: 'Ordem inválida.' }
    const nome = nomeNoClinicorp.trim().slice(0, 255)
    if (!nome) {
      await prisma.tratamentoVinculo.deleteMany({ where: { ordemId } })
      revalidatePath('/tratamentos')
      return { success: true, mensagem: 'Vínculo removido. Sincronize para atualizar as consultas.' }
    }
    const chave = normalizarNome(nome)
    if (chave.split(' ').length < 2) return { success: false, error: 'Informe o nome completo, como está no Clinicorp.' }
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId }, select: { id: true } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
    await prisma.tratamentoVinculo.upsert({
      where: { ordemId },
      create: { ordemId, pacienteChave: chave, pacienteNome: nome, criadoPor: usuario.email },
      update: { pacienteChave: chave, pacienteNome: nome, criadoPor: usuario.email, criadoEm: new Date() },
    })
    revalidatePath('/tratamentos')
    return { success: true, mensagem: 'Paciente vinculado. Sincronize para buscar as consultas.' }
  })
}
