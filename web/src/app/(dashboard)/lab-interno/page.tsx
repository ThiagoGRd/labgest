import { getLabInterno } from '@/actions/lab-interno'
import { LabInternoView } from './lab-interno-view'

export const dynamic = 'force-dynamic'

export default async function LabInternoPage() {
  const { ordens, historico } = await getLabInterno()
  return <LabInternoView ordens={ordens} historico={historico} />
}
