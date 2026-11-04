# Portal — feedback ao abrir detalhes

Base exata `b996df1cbb0c5bb128a17ceee766c0267a1522f4`. Branch isolada `ui/portal-order-detail-feedback`, worktree `/workspace/labgest-portal-feedback`. HEAD final no manifesto. Candidatos anteriores preservados; sem produção, publicação, push/PR/merge/deploy, credenciais, infraestrutura, dependências novas ou .env.

## Problema confirmado e correção

O handler de Visualizar em `portal/src/app/(dashboard)/pedidos/pedidos-view.tsx` ainda ignorava null e apenas imprimia diagnóstico no console em caso de exceção. A reprodução com cliques reais encontrou ausência de aviso/modal em 320/390/768/1280. Não foi tratado apenas como achado histórico. Inspeção do portal atual não encontrou Toaster global; nenhuma chamada toast foi adicionada.

Há agora alerta local role=alert entre filtros e lista: “Não foi possível carregar os detalhes do pedido #N. Tente novamente.” O número já pertence à linha visível; mensagem idêntica para null/exceção não revela existência, autorização ou diagnóstico interno. Tentar novamente consulta o mesmo ID. Nova tentativa limpa o erro; finally libera loading. Eye tem nome acessível Visualizar pedido #N e aria-busy. Sucesso continua usando VisualizarPedidoModal original e os dados recebidos da action. Fechar limpa a seleção local; reabrir faz nova consulta.

Corrida também confirmada: consultas A/B podiam terminar fora de ordem, resposta de A substituir B ou finally de A liberar loading de B. Ref com sequência identifica a tentativa mais recente; só ela altera modal/erro/loading. Duplo acionamento do mesmo pedido pendente é ignorado; escolher outro pedido continua permitido. Respostas e falhas anteriores são ignoradas, sem cancelar ou mudar a consulta do servidor. Cleanup invalida a sequência no unmount.

Complemento da revisão: alerta é limpo ao mudar busca ou situação, e qualquer resposta pendente do contexto anterior é invalidada. Assim o retry não abre um pedido antigo depois de mudar o filtro. Critérios de filtragem e dados exibidos não mudaram.

Único arquivo de produto alterado: pedidos-view.tsx. A action getPedidoById, auth, seleção de registros, regras de pedidos/financeiras e persistência não foram alteradas. Modal, chat, uploads/STL, ações clínicas, PortalLayout, Sair e Histórico permanecem intactos.

## TDD e evidências

Plano registrado antes de código; skill TDD aplicada. Nenhum AGENTS.md/skill local adicional encontrado. Logs iniciais preservados (`red.log`, `red-races.log`): null/throw sem alerta e respostas antigas abrindo o modal errado. Primeira rodada do candidato encontrou ambiguidade no seletor Fechar: o modal real tem botão no cabeçalho e no conteúdo; seletor passou a escolher o do cabeçalho, sem mudar produto. Após a revisão sobre contexto, `filter-red.log` reproduziu ausência de identificação por número e `filter-clear-red.log` reproduziu alerta permanecendo após busca; somente depois foi implementada limpeza/invalidação. Esses testes intermediários têm versões próprias e não são apresentados como a versão final.

A MESMA versão final de `portal/tests/order-detail-feedback-browser.cjs` roda na cópia sanitizada da base e do candidato. Hash/command/cwd/exits em `complete-base-exit.json` e `complete-candidate-exit.json`; logs completos em complete-base.log e complete-candidate.log. Base: 32 falhas esperadas e quatro passes (a falha tardia depois do sucesso de B já não substituía B). Candidato: 36 PASS, exit 0. São nove percursos em cada largura 320/390/768/1280:

- Null e throw: alerta seguro, loading liberado, nenhum modal; retry por Enter passa por pendência, limpa erro e abre modal original correto; Fechar/Escape e reabrir confirmam refetch e ausência de consulta causada só pelo fechamento.
- Pendência: Eye nomeado, disabled/aria-busy; clicks nativos repetidos no botão desabilitado não geram nova consulta. Resposta abre o ID correto; loading libera e outro pedido pode abrir.
- A lento/B novo: A resolve primeiro; B resolve primeiro; A falha depois do sucesso de B; A falha enquanto B continua pendente. Apenas B altera detalhes; A não limpa o loading de B, nem injeta erro ou reabre outro modal.
- A sucesso → fechar → B null: alerta, nenhum modal antigo reaberto.
- Busca/situação: erro identificado pelo ID, troca de busca remove retry sem consultar; B abre somente após clique explícito. Resposta pendente de A após mudança de busca não abre modal nem alerta. Troca de situação também limpa erro.

Assertions exercitam PedidosView, PortalLayout, VisualizarPedidoModal e componentes filhos originais, Radix e Tailwind compilado real. Fixtures de dois pedidos inteiramente fictícios. Todas as actions interceptadas: getPedidoById responde null/throw/pending/success sob controle local; notificações vazias; demais actions falham se chamadas. SDK local também bloqueado; nenhum chat/upload/ação clínica foi acionado. As chamadas registradas comprovam IDs e quantidades, sem persistência.

## Regressões e revisão visual

Typecheck portal e lint portal: exit 0, repetidos após mudança de filtro. Suítes estabelecidas: `node --test web/tests/*.test.cjs web/tests/*.test.mjs` 61/61; `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts` 35/35. Navegação anterior `node portal/tests/mobile-history-browser.cjs`: quatro PASS, Histórico/rotas/aria-current/Sair 44×44/teclado preservados e sem disparar logout. Comandos completos em checks.json, complete-checks.json e regressions.json. git diff --check e aplicação do patch à base verificados.

Capturas internas do alerta em mobile/desktop e modal de sucesso revisadas localmente. Alerta/retry cabem em 320 px. A lista mantém sua rolagem horizontal existente. Modal conserva seu comportamento existente, inclusive scroll interno do chat; nenhuma mudança desses componentes. Capturas não integram a entrega. Uma tentativa de abrir captura desktop antes de o teste produzi-la retornou arquivo ausente; a inspeção foi feita após a geração, sem bloqueio ou alteração de produto.

## Isolamento e limites

Cópias sem .env/.next/node_modules do checkout; links somente para dependências Linux sanitizadas já preparadas. Ambiente allowlist PATH/NODE_PATH/LANG/FEEDBACK_QA (DAILY_QA para regressão de navegação). Node serve apenas HTML/JS/CSS em loopback; não inicia Next, Prisma, banco ou SDK externo. Browser permite somente a origem local, registra método/caminho e bloqueia externos. Requests JSON não incluem cookies/payloads. Zero requests externos e zero erros de página nas rodadas; browsers/servidores encerrados em finally, PIDs/portas verificados no pacote.

É prova de UI/controle de respostas, não E2E autenticado, não consulta real de pedidos, não valida auth/DB/Supabase/Next RSC. Navegação usa adapter local; outros módulos não foram auditados. Nenhuma integração PostgreSQL executada nem downloads/rede/instalações tentados. Sem operação negada, pendente ou de resultado incerto.

## Entrega

Quatro arquivos: pedidos-view.tsx, teste novo portal/tests/order-detail-feedback-browser.cjs, delivery/PORTAL-FEEDBACK-PLAN.md e este relatório. Patch incremental completo somente desde b996df1c. Manifesto contém base/HEAD/branch, arquivos/blobs/hashes/tamanhos, preservação dos candidatos e evidências. Nova identidade privada Library, somente patch/plano/relatório/manifesto/testes/logs textuais sanitizados; sem imagens, .env, dados reais, CSV ou árvore completa.
