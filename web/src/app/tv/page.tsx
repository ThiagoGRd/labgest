import { getPainelTvData } from '@/actions/agenda-tv'
import { normalizarProteticoId } from '@/lib/agenda-tv'
import { PainelTvView } from '@/components/tv/painel-tv-view'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Painel TV Bancada — Tavá & Napoleão | LabGest',
  robots: { index: false, follow: false },
}

export default async function TvBancadaPage({
  searchParams,
}: {
  searchParams: Promise<{ protetico?: string; data?: string; kiosk?: string; tema?: string }>
}) {
  const params = await searchParams
  const protetico = normalizarProteticoId(params.protetico)
  const kiosk = params.kiosk === '1' || params.kiosk === 'true'
  const tema = params.tema === 'light' ? 'light' : 'dark'
  const inicial = await getPainelTvData(params.data)

  return (
    <PainelTvView
      inicial={inicial}
      proteticoInicial={protetico}
      kioskInicial={kiosk}
      temaInicial={tema}
    />
  )
}
