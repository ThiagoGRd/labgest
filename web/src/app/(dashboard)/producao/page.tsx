import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ProducaoPage({
  searchParams,
}: {
  searchParams?: Promise<{ atencao?: string; busca?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const qs = new URLSearchParams()
  if (params.atencao) qs.set('atencao', params.atencao)
  if (params.busca) qs.set('busca', params.busca)
  const sufixo = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/lab-interno${sufixo}`)
}
