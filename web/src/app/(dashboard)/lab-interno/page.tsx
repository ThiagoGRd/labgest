import { getLabInterno } from '@/actions/lab-interno'
import { LabInternoView } from './lab-interno-view'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function LabInternoPage() {
  const {
    ordens,
    historico,
    triagem,
    semEtapaIds,
    retornosDashboard,
    clinicorpConfigurado,
    ultimaSincronizacao,
    agendaTvResumo,
  } = await getLabInterno()

  return (
    <LabInternoView
      ordens={ordens}
      historico={historico}
      triagem={triagem}
      semEtapaIds={semEtapaIds}
      retornosDashboard={retornosDashboard}
      clinicorpConfigurado={clinicorpConfigurado}
      ultimaSincronizacao={ultimaSincronizacao}
      agendaTvResumo={agendaTvResumo}
    />
  )
}
