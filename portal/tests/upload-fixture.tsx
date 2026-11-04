import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FileUpload } from '../src/components/ui/file-upload'
import { CameraUpload } from '../src/components/ui/camera-upload'
import { ChatPedido } from '../src/components/pedidos/chat-pedido'
import { FeedbackProva } from '../src/components/pedidos/feedback-prova'
import { NovoPedidoView } from '../src/app/(dashboard)/novo-pedido/novo-pedido-view'
type Deferred = { resolve: (result: unknown) => void; reject: (error: Error) => void }
class ControlledReader {
  onload: ((event: { target: { result: string } }) => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  readAsDataURL() { w.readers.push(this) }
}
const w = window as unknown as {
  uploads: Deferred[]; actions: Deferred[]; readers: ControlledReader[]
  FileReader: typeof ControlledReader
  resolveUpload: (index: number, path: string) => void
  rejectUpload: (index: number) => void
  resolveAction: (index: number, result: unknown) => void
}
w.uploads = []; w.actions = []; w.readers = []
w.FileReader = ControlledReader
w.resolveUpload = (i: number, path: string) => w.uploads[i].resolve({ data: { path }, error: null })
w.rejectUpload = (i: number) => w.uploads[i].reject(new Error('Falha de upload sintética'))
w.resolveAction = (i: number, result: unknown) => w.actions[i].resolve(result)
function Fixture() {
 const [path, setPath] = useState('')
 const kind = location.pathname.slice(1)
 if (kind === 'chat') return <ChatPedido ordemId={1} dentistaNome="Teste" mensagensIniciais={[]} />
 if (kind === 'proof') return <FeedbackProva cicloId={1} numeroCiclo={1} />
 if (kind === 'order') return <NovoPedidoView user={{nome:'Teste', email:'test@example.invalid', cro:'TEST'}} servicos={[]} />
 const Upload = kind === 'camera' || kind === 'persisted-camera' ? CameraUpload : FileUpload
 return <><Upload onUploadComplete={async path => {
   if (kind === 'persisted-camera' && path) await new Promise((resolve, reject) => w.actions.push({resolve, reject}))
   setPath(path)
 }} /><output data-testid="path">{path}</output></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
