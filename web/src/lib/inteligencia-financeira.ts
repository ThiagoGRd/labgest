export interface MaterialVinculado {
  id: number
  nome?: string
  quantidade: number
}

export interface ItemEstoqueResumo {
  id: number
  nome: string
  categoria: string
  quantidade: number
  quantidadeMinima: number
  unidade: string
  precoUnitario: number
  fornecedor?: string | null
  dataValidade?: string | null
}

export interface AnaliseReajusteServico {
  servicoId: number
  servicoNome: string
  categoria: string
  precoAtual: number
  custoCadastrado: number
  custoInsumosAoVivo: number
  custoRetrabalhoMedio: number
  custoTotalReal: number
  margemBrutaPercentual: number
  margemRealPercentual: number
  taxaRetrabalhoPercentual: number
  totalOrdensAnalisadas: number
  precoSugerido: number
  reajusteSugeridoPercentual: number
  statusMargem: 'saudavel' | 'atencao' | 'defasado'
  recomendacao: string
}

export interface RentabilidadeCliente {
  clienteNome: string
  totalOrdens: number
  totalAjustesRetorno: number
  taxaRetrabalhoPercentual: number
  receitaBruta: number
  custoInsumosEstimado: number
  custoRetrabalhoEstimado: number
  valorVencidoAberto: number
  lucroLiquidoReal: number
  margemRealPercentual: number
  classificacao: 'estrela' | 'atencao_retrabalho' | 'risco_inadimplencia' | 'regular'
  insightGestor: string
}

export interface AlertaInsumoFinanceiro {
  estoqueId: number
  nome: string
  categoria: string
  quantidadeAtual: number
  quantidadeMinima: number
  unidade: string
  precoUnitario: number
  quantidadeSugeridaCompra: number
  custoReposicaoEstimado: number
  motivo: 'estoque_baixo' | 'vencimento_proximo'
}

export const MARGEM_ALVO_PADRAO = 0.65 // 65% de margem bruta alvo para laboratório de prótese

export function calcularCustoMedioPonderado(
  saldoAnterior: number,
  precoAnterior: number,
  quantidadeEntrada: number,
  precoEntrada: number,
): number {
  const qtdAnt = Math.max(0, Number(saldoAnterior) || 0)
  const prcAnt = Math.max(0, Number(precoAnterior) || 0)
  const qtdNova = Math.max(0, Number(quantidadeEntrada) || 0)
  const prcNovo = Math.max(0, Number(precoEntrada) || 0)

  if (qtdNova <= 0) return Number(prcAnt.toFixed(2))
  if (qtdAnt <= 0 || prcAnt <= 0) return Number(prcNovo.toFixed(2))

  const custoTotal = qtdAnt * prcAnt + qtdNova * prcNovo
  const novoSaldo = qtdAnt + qtdNova
  return Number((custoTotal / novoSaldo).toFixed(2))
}

function arredondarPrecoComercial(valor: number): number {
  if (valor <= 0) return 0
  return Math.ceil(valor / 5) * 5
}

export function avaliarReajusteServico(params: {
  servicoId: number
  servicoNome: string
  categoria?: string
  precoAtual: number
  custoCadastrado: number
  materiaisVinculados: MaterialVinculado[]
  precosEstoquePorId: Map<number, number>
  totalOrdens: number
  ordensComRetrabalho: number
  margemAlvo?: number
}): AnaliseReajusteServico {
  const margemAlvo = params.margemAlvo ?? MARGEM_ALVO_PADRAO
  const precoAtual = Math.max(0, Number(params.precoAtual) || 0)
  const custoCadastrado = Math.max(0, Number(params.custoCadastrado) || 0)

  let custoInsumosAoVivo = 0
  if (params.materiaisVinculados.length > 0) {
    for (const mat of params.materiaisVinculados) {
      const precoInsumo = params.precosEstoquePorId.get(mat.id) ?? 0
      custoInsumosAoVivo += precoInsumo * mat.quantidade
    }
  } else {
    custoInsumosAoVivo = custoCadastrado
  }

  // Se o custo ao vivo for 0 mas havia custo cadastrado, preserva o maior para segurança gerencial
  const custoBaseInsumos = Math.max(custoInsumosAoVivo, custoCadastrado)
  // Estimativa conservadora de 18% do preço como custo de insumo mínimo quando ficha técnica ainda não foi preenchida
  const custoEfetivoInsumo = custoBaseInsumos > 0 ? custoBaseInsumos : Number((precoAtual * 0.18).toFixed(2))

  const totalOrdens = Math.max(0, params.totalOrdens)
  const ordensComRetrabalho = Math.max(0, Math.min(totalOrdens, params.ordensComRetrabalho))
  const taxaRetrabalho = totalOrdens > 0 ? ordensComRetrabalho / totalOrdens : 0

  // Cada retrabalho/repetição consome ~40% de insumo adicional + hora de bancada
  const custoRetrabalhoMedio = Number((custoEfetivoInsumo * taxaRetrabalho * 0.45).toFixed(2))
  const custoTotalReal = Number((custoEfetivoInsumo + custoRetrabalhoMedio).toFixed(2))

  const margemBrutaPercentual = precoAtual > 0
    ? Math.round(((precoAtual - custoEfetivoInsumo) / precoAtual) * 100)
    : 0
  const margemRealPercentual = precoAtual > 0
    ? Math.round(((precoAtual - custoTotalReal) / precoAtual) * 100)
    : 0

  const divisorAlvo = Math.max(0.15, 1 - margemAlvo)
  const precoMinimoAlvo = custoTotalReal / divisorAlvo
  const precoSugerido = precoMinimoAlvo > precoAtual
    ? arredondarPrecoComercial(precoMinimoAlvo)
    : precoAtual

  const reajusteSugeridoPercentual = precoAtual > 0 && precoSugerido > precoAtual
    ? Math.round(((precoSugerido - precoAtual) / precoAtual) * 100)
    : 0

  let statusMargem: AnaliseReajusteServico['statusMargem'] = 'saudavel'
  if (margemRealPercentual < 50 || reajusteSugeridoPercentual >= 12) {
    statusMargem = 'defasado'
  } else if (margemRealPercentual < 62 || reajusteSugeridoPercentual >= 5) {
    statusMargem = 'atencao'
  }

  let recomendacao = 'Margem saudável para a tabela atual.'
  if (statusMargem === 'defasado') {
    recomendacao = `Reajustar para R$ ${precoSugerido.toFixed(0)} (+${reajusteSugeridoPercentual}%) — custo de insumos/retrabalho corroeu a margem.`
  } else if (statusMargem === 'atencao') {
    recomendacao = `Monitorar insumo: preço ideal sugerido R$ ${precoSugerido.toFixed(0)} (+${reajusteSugeridoPercentual}%).`
  }

  return {
    servicoId: params.servicoId,
    servicoNome: params.servicoNome,
    categoria: params.categoria || 'Geral',
    precoAtual,
    custoCadastrado,
    custoInsumosAoVivo: Number(custoEfetivoInsumo.toFixed(2)),
    custoRetrabalhoMedio,
    custoTotalReal,
    margemBrutaPercentual,
    margemRealPercentual,
    taxaRetrabalhoPercentual: Math.round(taxaRetrabalho * 100),
    totalOrdensAnalisadas: totalOrdens,
    precoSugerido,
    reajusteSugeridoPercentual,
    statusMargem,
    recomendacao,
  }
}

export function calcularRentabilidadePorCliente(params: {
  ordens: Array<{
    clienteNome: string
    valor: number
    custoInsumoEstimado: number
    ajustesRetorno: number
  }>
  inadimplenciaPorCliente: Map<string, number>
}): RentabilidadeCliente[] {
  const agrupado = new Map<
    string,
    {
      totalOrdens: number
      totalAjustesRetorno: number
      receitaBruta: number
      custoInsumosEstimado: number
      custoRetrabalhoEstimado: number
    }
  >()

  for (const ord of params.ordens) {
    const nome = (ord.clienteNome || 'Cliente não informado').trim()
    const atual = agrupado.get(nome) ?? {
      totalOrdens: 0,
      totalAjustesRetorno: 0,
      receitaBruta: 0,
      custoInsumosEstimado: 0,
      custoRetrabalhoEstimado: 0,
    }
    const custoBase = ord.custoInsumoEstimado > 0 ? ord.custoInsumoEstimado : ord.valor * 0.2
    const ajustes = Math.max(0, ord.ajustesRetorno || 0)
    const custoRetrab = ajustes * (custoBase * 0.45 + 35) // Custo de insumo extra + hora técnica de bancada

    atual.totalOrdens += 1
    atual.totalAjustesRetorno += ajustes
    atual.receitaBruta += Math.max(0, ord.valor)
    atual.custoInsumosEstimado += custoBase
    atual.custoRetrabalhoEstimado += custoRetrab
    agrupado.set(nome, atual)
  }

  const resultado: RentabilidadeCliente[] = []
  for (const [clienteNome, dados] of agrupado.entries()) {
    const valorVencidoAberto = params.inadimplenciaPorCliente.get(clienteNome) ?? 0
    const lucroLiquidoReal = Number(
      (dados.receitaBruta - dados.custoInsumosEstimado - dados.custoRetrabalhoEstimado).toFixed(2),
    )
    const margemRealPercentual = dados.receitaBruta > 0
      ? Math.round((lucroLiquidoReal / dados.receitaBruta) * 100)
      : 0
    const taxaRetrabalhoPercentual = dados.totalOrdens > 0
      ? Math.round((dados.totalAjustesRetorno / dados.totalOrdens) * 100)
      : 0

    let classificacao: RentabilidadeCliente['classificacao'] = 'regular'
    let insightGestor = 'Operação equilibrada dentro da margem esperada.'

    if (valorVencidoAberto > dados.receitaBruta * 0.2 && valorVencidoAberto > 150) {
      classificacao = 'risco_inadimplencia'
      insightGestor = `Possui R$ ${valorVencidoAberto.toFixed(0)} vencidos em aberto — alinhar cobrança antes de novos lotes.`
    } else if (taxaRetrabalhoPercentual >= 35) {
      classificacao = 'atencao_retrabalho'
      insightGestor = `Taxa de ajustes/retorno de ${taxaRetrabalhoPercentual}% consumiu R$ ${dados.custoRetrabalhoEstimado.toFixed(0)} da margem — alinhar moldagem/escaneamento.`
    } else if (margemRealPercentual >= 65 && dados.totalOrdens >= 2) {
      classificacao = 'estrela'
      insightGestor = 'Alta rentabilidade líquida e baixo índice de retrabalho na bancada.'
    }

    resultado.push({
      clienteNome,
      totalOrdens: dados.totalOrdens,
      totalAjustesRetorno: dados.totalAjustesRetorno,
      taxaRetrabalhoPercentual,
      receitaBruta: Number(dados.receitaBruta.toFixed(2)),
      custoInsumosEstimado: Number(dados.custoInsumosEstimado.toFixed(2)),
      custoRetrabalhoEstimado: Number(dados.custoRetrabalhoEstimado.toFixed(2)),
      valorVencidoAberto: Number(valorVencidoAberto.toFixed(2)),
      lucroLiquidoReal,
      margemRealPercentual,
      classificacao,
      insightGestor,
    })
  }

  return resultado.sort((a, b) => b.lucroLiquidoReal - a.lucroLiquidoReal)
}

export function diagnosticarReposicaoEstoque(
  itens: ItemEstoqueResumo[],
  hojeIso = new Date().toISOString().slice(0, 10),
): {
  alertas: AlertaInsumoFinanceiro[]
  custoTotalReposicao: number
  valorTotalEmEstoque: number
} {
  const alertas: AlertaInsumoFinanceiro[] = []
  let custoTotalReposicao = 0
  let valorTotalEmEstoque = 0
  const limiteValidade = new Date(`${hojeIso}T12:00:00Z`)
  limiteValidade.setDate(limiteValidade.getDate() + 30)

  for (const item of itens) {
    const qtd = Math.max(0, Number(item.quantidade) || 0)
    const min = Math.max(0, Number(item.quantidadeMinima) || 0)
    const preco = Math.max(0, Number(item.precoUnitario) || 0)
    valorTotalEmEstoque += qtd * preco

    if (qtd <= min && min > 0) {
      const repor = Math.max(1, min * 2 - qtd)
      const custo = Number((repor * preco).toFixed(2))
      custoTotalReposicao += custo
      alertas.push({
        estoqueId: item.id,
        nome: item.nome,
        categoria: item.categoria,
        quantidadeAtual: qtd,
        quantidadeMinima: min,
        unidade: item.unidade,
        precoUnitario: preco,
        quantidadeSugeridaCompra: repor,
        custoReposicaoEstimado: custo,
        motivo: 'estoque_baixo',
      })
      continue
    }

    if (item.dataValidade) {
      const valDate = new Date(item.dataValidade)
      if (!Number.isNaN(valDate.getTime()) && valDate <= limiteValidade) {
        const repor = Math.max(1, min || 1)
        const custo = Number((repor * preco).toFixed(2))
        custoTotalReposicao += custo
        alertas.push({
          estoqueId: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidadeAtual: qtd,
          quantidadeMinima: min,
          unidade: item.unidade,
          precoUnitario: preco,
          quantidadeSugeridaCompra: repor,
          custoReposicaoEstimado: custo,
          motivo: 'vencimento_proximo',
        })
      }
    }
  }

  return {
    alertas: alertas.sort((a, b) => b.custoReposicaoEstimado - a.custoReposicaoEstimado),
    custoTotalReposicao: Number(custoTotalReposicao.toFixed(2)),
    valorTotalEmEstoque: Number(valorTotalEmEstoque.toFixed(2)),
  }
}
