export function validarNovoUsuario(data: { nome: string; email: string; senhaProvisoria: string }): string | null {
  if (!data.nome.trim() || !data.email.trim() || !data.senhaProvisoria.trim()) return 'Preencha nome, email e senha provisória.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return 'Informe um email válido.'
  return null
}

export function podeVerConfiguracoes(user: { tipo: string; permissoes?: string[] }): boolean {
  return user.tipo !== 'recepcao' && (user.tipo === 'admin' || !!user.permissoes?.includes('all'))
}

export async function executarAcaoPendente<T>(action: () => Promise<T>, pending: (value: boolean) => void): Promise<T> {
  pending(true)
  try { return await action() } finally { pending(false) }
}
