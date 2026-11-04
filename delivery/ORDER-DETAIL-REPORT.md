# Incremento isolado — organização da ficha existente de OS

Base: `1737ad72235e114f61e8aa504d62ce4338048c08`.
Branch: `ui/order-detail-organization`. Worktree: `/workspace/labgest-order-detail`.
A branch `ui/contextual-attention` e seus commits foram preservados. Este pacote contém somente o incremento sobre 1737ad72. Commit e hashes constam no manifesto.

## Implementado

A ficha continua sendo `VisualizarOrdemModal`, usada por Dashboard, Prioridades, Produção e Ordens. Não foi criado aplicativo ou ficha alternativa.

- Resumo de paciente, serviço, clínica/cliente, status e prioridade no topo.
- Quatro blocos: **Etapa de produção**, **Localização física**, **Prazos e eventos**, **Situação financeira**. Macroetapa e passo detalhado são separados da custódia. Barra existente preservada para macroetapas reconhecidas, identificada como tal; etapa ausente/registro desconhecido não vira recebimento inventado.
- Prazos rotulados por evento: entrada do pedido, previsão de entrega, prazo da etapa, prazo do fornecedor, conclusão da produção, entrega física registrada e agendamento clínico. Vencimento e recebimento financeiro ficam na respectiva cobrança.
- Leitura mínima da relação existente `contasReceber`, somente em `getOrdemById`, depois de `requireUser`. Campos selecionados: id, valor, valorRecebido, status, vencimento, recebimento e cancelamento. Sem escrita, novo cálculo, alteração de permissão ou API pública; `getOrdemPublic` permaneceu byte a byte igual no trecho da função.
- Um objeto adicional `ficha` transporta os fatos originais nullable. Os campos legados consumidos por outros fluxos foram mantidos; a ficha usa os originais para não exibir datas atuais/etapas criadas por fallbacks anteriores.
- Valor final zero preservado com `??` no getter autenticado. “Valor da OS” não indica recebimento ou saldo. Cada cobrança mostra seus valores registrados; canceladas (status ou canceladoEm) são marcadas como inativas. Nenhuma cobrança/sem dados não significa quitado. Não há totalização/saldo novo; portanto não foi necessário aplicar o helper de resumo mensal. Foram reaproveitados formatDate, formatCurrency, rotuloLocalizacaoTrabalho e os helpers de workflow onde a semântica corresponde.
- Histórico e conversa em seções expansíveis; quadro clínico, especificações, observações, fotos, arquivos e STL preservados. Campo `elementos`, já existente no banco, passou a ser serializado para a informação de dentes já suportada pela ficha.
- Conteúdo do modal identificado pela OS e desmontado ao fechar. Trocar OS reinicia chat/preview locais, sem mostrar conteúdo da OS anterior. Nenhuma navegação contextual da base foi alterada.

O restante é apresentação de dados existentes. Não há integração clínica, localização em tempo real, geração/cancelamento de cobrança, baixa de pagamento ou mudança do fluxo de produção.

## Datas conferidas no schema

Campos `@db.Date`: dataPedido, dataEntrega, dataFinalizacao, dataVencimento e dataRecebimento. Exibidos como datas civis com formatDate existente, sem deslocamento do dia.

Campos `@db.Timestamptz(6)`: dataEntregaReal, prazoEtapaAtual, prazoFornecedor, movimentacaoLogisticaEm e agendamentoClinico. Exibidos com horário e fuso `America/Maceio`, usado pelo laboratório. Histórico é apresentado como instante. Teste explícito: `2026-11-05T01:00:00Z` aparece em **04/11/2026 às 22:00**, enquanto a data civil `2026-11-05T00:00:00Z` continua **05/11/2026**.

## Testes e evidências

Plano registrado antes do código em ORDER-DETAIL-PLAN.md. Testes comportamentais de renderização/consulta foram escritos e executados antes da implementação: falharam para os quatro blocos, informação financeira, ausência honesta e leitura de contas. `order-red.log` preserva o resultado. Testes browser foram acrescentados posteriormente; não se alega TDD completo de cada interação.

Execução em `/workspace/labgest-order-validation`, cópia sanitizada sem .env/node_modules herdado. Reutilizados os pacotes Linux já instalados do lockfile e Prisma Client offline engine=none da validação anterior. Nenhuma nova busca de checksum Prisma, conexão/migração de banco ou instalação/alteração de lockfile.

Resultados finais:

- `node_modules/.bin/tsc --noEmit --incremental false -p web/tsconfig.json`: passou.
- `npm run lint --workspace=web`: passou, sem avisos. Aviso do novo arquivo de fixtures corrigido.
- `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: **53/53 passaram** (44 estabelecidos + 9 novos).
- `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: **35/35 passaram**.
- `ORDER_DETAIL_QA=/workspace/labgest-order-qa node web/tests/order-detail-browser.cjs`: **Chromium 1280 e 390 px passou**, Tailwind real compilado de globals.css, timezone do navegador America/Sao_Paulo. Cobertura: ativa/finalizada/entregue/cancelada/pausada, etapa/localização/datas ausentes, valor zero, cobrança parcial/cancelada por timestamp, limites de data civil/instante, histórico, fotos/links de arquivos, envio de conversa local, fechar/reabrir/trocar OS, abertura/fechamento nas quatro filas contextuais de Prioridades/Produção e Voltar de Prioridades.
- VisualizarOrdemModal, ResumoOrdem, ChatOrdem, Radix e STLViewer reais. STL carregou uma geometria sintética local e criou canvas; iluminação/Stage substituída por cena local para evitar o HDR externo. Foto e PDF sintéticos locais. Ações substituídas por spies/funções bloqueadas; envio de chat validou OS e texto. **Zero requisições externas de browser e zero erros de página**.
- Harness estabelecido `attention-browser.cjs` com CSS real: passou em 1280/390 px (atalhos, histórico, filtros, relatórios e modais da base).
- `node web/tests/labs-externos-archive-browser.integration.cjs`: passou com ações/shell sintéticos; módulo não alterado.
- `git diff --check`: passou. Patch será acompanhado de confirmação de aplicabilidade sobre a base.

A base 1737ad72 já havia passado typecheck/lint e a suite estabelecida na cópia sanitizada. Não apareceram falhas de produto novas. As duas integrações PostgreSQL do módulo de arquivo externo continuam fora da execução bem-sucedida: requerem pacote pg e banco descartável específico; falha de pré-requisito já registrada na base, não reproduzida como se fosse falha da ficha. Nenhuma infraestrutura foi criada para esse escopo.

## Correção após revisão independente

O resumo agora resolve o passo detalhado por correspondência exata do ID dentro do fluxo. Não usa o fallback de getPassoProtese; o helper global não foi alterado. Fluxo válido com passo nulo ou ficha ausente mostra “Não informado”; ID desconhecido preserva seu texto; o caso normal continua “Montagem dos dentes”. Três regressões falharam antes da correção (6 passaram/3 falharam, order-step-red.log) e passaram depois (9/9, order-step-green.log). Os quatro casos também foram verificados no modal real em Chromium desktop/mobile com Tailwind real e capturas locais.

`motivoPausa` já era serializado por getOrdemById na base 1737ad72 (`motivoPausa: ordem.motivoPausa`); não depende somente do fixture e não exigiu mudança na consulta.

Precisão da cobertura: order-detail-browser abre o harness isolado da ficha e quatro filas nas páginas de Prioridades/Produção. Isso não equivale a quatro telas reais. Não se alega abertura desta ficha em Dashboard/Ordens; o harness estabelecido valida seus próprios atalhos/relatórios e modais da base, sem ampliar essa alegação.

## QA visual interna e limites

Capturas desktop/mobile revisadas localmente em `/workspace/labgest-order-qa`, incluindo resumo, financeiro, cinco status, ausências, conversa e STL. Não foram incluídas imagens no pacote Library, conforme orientação posterior do coordenador. As capturas antigas da entrega v2 não foram alteradas.

Layout real dos componentes e Tailwind, com shell global/navegação Next simulados. Não é E2E autenticado nem servidor Next/RSC completo. Escrita real de chat, upload ao Storage, download de um documento de produção e iluminação HDR do STL não foram exercitados. Backend financeiro foi validado com consulta/retorno simulados; nenhum dado real. Barra de macroetapas não pretende medir progresso do passo detalhado. Há uma relação adicional carregada por ficha, sem paginação de cobranças; volume real deve ser observado na integração.

## Arquivos exatos do incremento

1. web/src/actions/ordens.ts
2. web/src/components/ordens/visualizar-ordem-modal.tsx
3. web/src/components/ordens/resumo-ordem.tsx
4. web/tests/order-detail.test.cjs
5. web/tests/order-detail-browser.cjs
6. web/tests/order-detail-fixtures.cjs
7. delivery/ORDER-DETAIL-PLAN.md
8. delivery/ORDER-DETAIL-REPORT.md

Sem mudanças em sidebar, portal, schema, migrações, credenciais, infraestrutura, lockfile ou rastreamento público. Sem push, PR ou deploy.

Bloqueios: nenhum bloqueio operacional deste incremento; limites de E2E/integração descritos acima. Nenhuma operação negada, pendente ou incerta. Pacote privado inclui somente patch incremental, relatório/plano, manifesto e logs textuais sintéticos.
