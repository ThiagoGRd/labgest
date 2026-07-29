function normalizarNome(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function servicoCobraPorElemento(nomeServico: string) {
  const nome = normalizarNome(nomeServico)
  return nome.includes('unitario') || nome.includes('enceramento unitario') || nome.includes('ponte adesiva')
}

export function contarElementosInformados(elementos: string) {
  const valor = elementos.trim()
  if (!valor) return 1

  if (/^\d+$/.test(valor)) {
    const numero = Number(valor)
    return numero >= 1 && numero <= 10 ? numero : 1
  }

  return Math.max(1, valor.split(/[,;\/\s]+/).filter(Boolean).length)
}

export function calcularPrecoServico(nomeServico: string, precoUnitario: number, elementos: string) {
  const quantidade = servicoCobraPorElemento(nomeServico) ? contarElementosInformados(elementos) : 1
  return {
    quantidade,
    valorTotal: Number((precoUnitario * quantidade).toFixed(2)),
  }
}
