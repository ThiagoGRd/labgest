# Feedback ao abrir detalhes de pedidos

Base b996df1cbb0c5bb128a17ceee766c0267a1522f4. Nova branch ui/portal-order-detail-feedback em /workspace/labgest-portal-feedback. Preservar candidatos anteriores. Sem regras/queries/persistência/auth ou módulos clínicos alterados.

Inspeção: handleView ignora null e apenas console.error na rejeição; sem Toaster global encontrado. Só desabilita botão do ID atual, permitindo consultas concorrentes que podem abrir outro pedido fora de ordem. Reproduzir com testes vermelhos antes de produto.

Implementação mínima proposta: alerta local role=alert junto à lista, mensagem genérica sem diagnóstico, botão Tentar novamente para o mesmo ID; limpar erro em nova tentativa e sucesso; loading em finally. Controle por sequência/ref: uma tentativa repetida do mesmo ID pendente não duplica; escolher outro ID é permitido, mas só a tentativa mais recente pode alterar erro, loading ou modal. Respostas/falhas tardias ignoradas sem mudar action. Nome acessível por ID e aria-busy no botão solicitante; sucesso abre VisualizarPedidoModal original com resposta recebida. Fechar/reabrir preserva fluxo.

Testes: componentes reais PedidosView/PortalLayout/VisualizarPedidoModal/Radix e Tailwind; getPedidoById simulado em null/throw/pending/success; todas as outras actions bloqueadas, notificações vazias e SDK local bloqueado. 320/390/768/1280: cliques, feedback, retry, erro limpo, loading liberado, dupla tentativa bloqueada; A lento/B novo, resoluções em ambas ordens e falha tardia ignorada, sucesso correto, fechar/reabrir, filtros e navegação/Sair/Histórico preservados. Mesma versão final na base/candidato, logs e hashes. Capturas apenas QA local. Typecheck/lint portal e regressões pertinentes; sem Next/auth real ou DB. Entrega em nova identidade Library com patch incremental, plano, relatório, manifesto e evidências textuais.

Complemento durante revisão: identificar pedido pelo número no alerta e limpar erro/invalidar resposta pendente ao mudar busca ou situação, sem alterar critério de filtro. Regressão vermelha específica antes da correção; comparação final inclui esse contexto.
