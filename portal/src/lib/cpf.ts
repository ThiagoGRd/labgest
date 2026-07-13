export function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, '').slice(0, 11)
}

export function formatarCpf(cpf: string): string {
  return normalizarCpf(cpf)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function isCpfValido(cpf: string): boolean {
  const digits = normalizarCpf(cpf)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce((total, digit, index) => total + Number(digit) * (pesoInicial - index), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const primeiro = calcularDigito(digits.slice(0, 9), 10)
  const segundo = calcularDigito(digits.slice(0, 9) + primeiro, 11)
  return digits.endsWith(`${primeiro}${segundo}`)
}
