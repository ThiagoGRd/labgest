# Incremento da ficha de OS — plano antes do código

Base obrigatória: 1737ad72235e114f61e8aa504d62ce4338048c08. Branch/worktree novas: ui/order-detail-organization, /workspace/labgest-order-detail. Sem alterar ui/contextual-attention.

Design local: reorganizar VisualizarOrdemModal existente. Resumo de paciente/cliente/serviço/status no topo, quatro blocos (produção, localização física, prazos por evento, financeiro), detalhes clínicos e seções de histórico/conversa/arquivos. Preservar os componentes de chat/STL e callbacks. Manter a barra somente como progresso das macroetapas conhecidas, sem inferir etapa ausente. Não criar ficha paralela.

Dados: ampliar getOrdemById autenticado com leitura seletiva das cobranças existentes e um objeto ficha com campos originais nullable. Preservar campos anteriores consumidos por outros fluxos. Valor da OS e cobranças distintos; mostrar por cobrança valor, recebido registrado, status e vencimento, sem novos cálculos/escritas. Datas civis usam formatDate existente; timestamps explicitam horário de Brasília. Ausência de fonte é informada, não preenchida com data atual/status derivado.

Testes primeiro: render da ficha/consulta sintética deve falhar para blocos ausentes e falta de campos originais/cobranças. Implementação mínima; regressão. Browser com React/modais/chat reais, Tailwind real, dados locais e spies para ações; cobrir status ativa/finalizada/entregue/cancelada/pausada, sem localização/etapa/datas, cobranças parciais/canceladas, datas civis em America/Sao_Paulo, histórico, arquivos/fotos/STL, conversa, abrir/fechar/trocar OS/retornar ao contexto. Estado de chat/preview deve pertencer à OS atual. STL será exercitado com arquivo sintético local; limites de GPU documentados.

Reutilizar dependências Linux e Prisma gerado offline em cópia sanitizada separada. Rodar typecheck/lint, suite estabelecida e novos testes. Comparar baseline quando houver falha. Capturas desktop/mobile somente para QA local, fora da Library conforme orientação posterior. Pacote final contém somente incremento, relatório, plano, manifesto e resultados textuais. Sem env, banco real, push/deploy, infra, credenciais ou lockfile.
