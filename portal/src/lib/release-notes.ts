// Versão atual do sistema — incrementar a cada release
export const VERSAO_ATUAL = '2.5.0'

export interface NotaRelease {
  versao: string
  data: string
  titulo: string
  novidades: {
    tipo: 'novo' | 'melhoria' | 'correcao'
    texto: string
  }[]
}

export const HISTORICO_RELEASES: NotaRelease[] = [
  {
    versao: '2.5.0',
    data: '17 de Abril de 2026',
    titulo: '🚀 Portal do Dentista & Comunicação',
    novidades: [
      { tipo: 'novo', texto: 'Aba Financeiro: Painel dedicado para acompanhamento de pagamentos em aberto, simplificando o processo de cobrança.' },
      { tipo: 'novo', texto: 'Chat Integrado na O.S: Dentista e Laboratório podem trocar mensagens diretamente dentro do rastreamento/detalhe de cada ordem.' },
      { tipo: 'novo', texto: 'Sino de Notificações Inteligentes: Fique de olho em faturas pendentes e casos "Em Prova" rapidamente!' }
    ]
  },
  {
    versao: '2.4.0',
    data: '15 de Abril de 2025',
    titulo: '🔄 Ciclos de Produção',
    novidades: [
      { tipo: 'novo', texto: 'Sistema de Ciclos para prótese total, PPR e protocolo de implantes — controle de cada ida e volta ao dentista com prazo individual por etapa.' },
      { tipo: 'novo', texto: 'Auxiliar pode registrar "Entrada no Lab" e "Enviar para Prova" diretamente pelo Kanban, definindo o prazo comprometido.' },
      { tipo: 'novo', texto: 'Dentista pode registrar o resultado da prova no portal: fotos, observações e decisão (ajustes ou aprovado).' },
      { tipo: 'novo', texto: 'Linha do tempo de ciclos visível para o dentista no portal — histórico completo de cada etapa.' },
      { tipo: 'melhoria', texto: 'Prazo justo: trabalho em prova na clínica não conta como atraso do laboratório.' },
    ]
  },
  {
    versao: '2.3.0',
    data: '14 de Abril de 2025',
    titulo: '✨ Polimento de UX e IA',
    novidades: [
      { tipo: 'melhoria', texto: 'Consultor de IA agora responde à sua pergunta específica com dados reais do mês.' },
      { tipo: 'melhoria', texto: 'Barra de progresso do dashboard mostra % real baseada na etapa atual do trabalho.' },
      { tipo: 'melhoria', texto: 'EmptyState premium em telas sem dados — com ícone animado e ação rápida.' },
      { tipo: 'correcao', texto: 'Modelo Gemini 2.0 Flash — corrigido erro 404 da API de IA.' },
    ]
  },
  {
    versao: '2.2.0',
    data: '08 de Abril de 2025',
    titulo: '📱 Suporte Mobile',
    novidades: [
      { tipo: 'novo', texto: 'Sidebar flutuante no mobile — menu deslizante com overlay.' },
      { tipo: 'novo', texto: 'Kanban deslizante horizontalmente no celular.' },
      { tipo: 'melhoria', texto: 'Navbar do portal adaptada para telas pequenas.' },
    ]
  },
]
