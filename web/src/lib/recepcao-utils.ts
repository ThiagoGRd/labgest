export function rotuloLocalizacaoTrabalho(situacao?: string | null, dentista?: string | null, localizacao?: string | null) {
  if (situacao === 'aguardando_recepcao') return 'Em trânsito para a recepção'
  if (situacao === 'aguardando_distribuicao') return 'Na recepção — aguardando distribuição'
  if (situacao === 'com_dentista') return `Com ${dentista || 'o dentista'}`
  if (situacao === 'aguardando_resultado_dentista') return 'Na recepção — aguardando resposta do dentista'
  if (situacao === 'aguardando_envio_laboratorio') return 'Na recepção — aguardando retorno ao laboratório'
  if (situacao === 'em_transito_laboratorio') return 'Em trânsito para o laboratório'
  return localizacao === 'laboratorio' ? 'No laboratório' : localizacao || 'Localização não informada'
}
