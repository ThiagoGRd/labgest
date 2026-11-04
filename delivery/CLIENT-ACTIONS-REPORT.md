# Clientes — Visualizar, Editar e Exportar

Base: `8eddf522d82486cda8c32d97ff19abf67ec2eebc`. Branch isolada: `ui/client-actions`, worktree `/workspace/labgest-client-actions`. HEAD final e hashes estão no manifesto do pacote. Nenhum candidato anterior foi sobrescrito.

## Resultado e limites de dados

Bug confirmado nesta base: os três botões não tinham handler. Cliques reais no harness com componentes e Tailwind reais não abriam os modais nem produziam download. Não foi apenas inferência do histórico.

- Visualizar abre Modal existente com dados já carregados, incluindo contato, situação e resumo já disponível. Não lê notas privadas ou novas relações. Escape/Fechar retornam foco ao controle de origem.
- Editar reutiliza NovoClienteModal. A nova action exige requireUser() antes de qualquer acesso; a restrição padrão de recepcao permanece. Aceita somente nome, telefone, CRO e endereço, escritos explicitamente. Rejeita campos extras, tipos inválidos e ID que não seja inteiro positivo seguro. Nome/telefone/CRO obrigatórios, trim, limites 255/20/50 do schema. Endereço opcional textual, sem limite arbitrário novo. Não inventa unicidade CRO. Cliente inexistente e exceção de persistência retornam erro controlado, sem diagnóstico interno.
- Email permanece legível e somente leitura, com explicação sobre alteração de acesso separada. Login, Perfil, pedidos e financeiro do portal resolvem cliente por email+ativo. Nome/CRO aparecem na metadata Auth do fluxo de Perfil, mas CRO não é chave de acesso nos caminhos examinados. Este patch não sincroniza Auth: metadata de nome/CRO pode permanecer com o valor anterior até o fluxo existente atualizá-la. Nenhuma mudança de acesso, credenciais ou permissões.
- Salvar bloqueia duplicação/fechamento durante pendência; mostra erro e permite nova tentativa. Sucesso atualiza os campos da lista e pede refresh sem limpar busca ou Mostrar inativos. Caso a renomeação retire o item da busca, foco retorna à busca. Novo cadastro mantém sua action e campos existentes.
- Exportar gera CSV local de todos e somente os clientes atualmente filtrados, incluindo inativos somente conforme filtro. Escopo/quantidade explícitos. Campos: Nome, CRO, Telefone, Email, Endereço, Situação. Sem IDs, observações, totais, OS ou pacientes. UTF-8 BOM, ponto e vírgula, CRLF, aspas duplicadas; neutralização com apóstrofo de =,+,-,@ após espaços/controles e telefone internacional tratado como texto. Filtro vazio desabilita exportação; object URL liberado em finally. Convenção existente de Estoque reaproveitada, sem relatório financeiro novo.

## Fontes locais consultadas

Todos os arquivos abaixo foram lidos no worktree da base exata e comparados byte a byte com git show 8eddf522; hashes/tamanhos em `inspected-sources.json`:

- `portal/src/actions/auth.ts`
- `portal/src/actions/profile.ts`
- `portal/src/actions/pedidos.ts`
- `portal/src/actions/financeiro.ts`
- `web/src/lib/auth-utils.ts`
- `packages/database/prisma/schema.prisma`
- `web/src/app/(dashboard)/estoque/estoque-view.tsx`

Não houve leitura de .env ou segredos legados. Nenhum AGENTS.md/skill local adicional estava disponível. O plano foi registrado antes de implementar; TDD e verificação antes da conclusão foram seguidos. O limite inicial de endereço proposto durante implementação foi removido para corresponder ao campo textual sem limite novo do schema.

## Testes executados e cronologia

Primeiro foram criados testes vermelhos de servidor/CSV e cliques reais dos três botões, antes de alterar produto (`unit-red.log`, `browser-red.log`). A cobertura foi ampliada depois; esses logs iniciais não representam o hash final dos testes.

Para evidência comparável, a MESMA versão final dos dois testes foi executada contra uma cópia sanitizada da base e do candidato. Nenhum código de produto foi alterado nas cópias base. `final-test-config.json` registra hashes dos testes e configuração; `verified-base-exits.json` e `final-candidate-exits.json` registram comandos/exits.

| Check final | Base | Candidato |
| --- | --- | --- |
| node --test web/tests/client-actions.test.cjs | 8 falhas esperadas; exit 1 | 8/8; exit 0 |
| node web/tests/client-actions-browser.cjs | 6 falhas esperadas; exit 1 | 6/6; exit 0 |

Unidade: auth antes do DB, requireUser real com recepcao simulado, whitelist exata, IDs inválidos, limites/tipos, payloads extras (email/ativo/ordens/contasReceber/totais/permissões/observações), exceção e inexistente, CSV acentos/aspas/quebra/separador/fórmulas/telefone internacional/vazio. Nenhuma conexão Prisma foi criada.

Browser, em 1280 e 390 px: abrir/fechar/alternar cliente; retorno de foco; cancelar sem gravação; readonly email; erros retornado e lançado; duplo clique com uma chamada; pendência impede Escape/Cancelar; sucesso mantém filtro; edição que remove item do filtro; editar inativo mantendo filtro; exportação filtrada/vazio/inativos/revokeObjectURL; cadastro novo existente. Foram usados ClientesView, DashboardLayout/provider/sidebar, formulário e Modal/Radix originais, com CSS Tailwind compilado real. Capturas de visualização, pendência e lista revisadas localmente: legíveis, sem corte horizontal nos casos vistos; não incluídas no pacote.

Checks gerais finais (todos exit 0, logs e comandos em `final-check-exits.json`):

- `node_modules/.bin/tsc --noEmit -p web/tsconfig.json`
- `npm run lint` (web e portal)
- `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: 61/61 (inclui os 8 acima)
- `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: 35/35
- `git diff --check`

Falhas intermediárias resolvidas: typecheck identificou união ambígua de retorno no formulário compartilhado; tipagem corrigida. Um teste de renomeação buscava Gama, que ainda correspondia ao email; passou a usar Clínica Gama para testar remoção correta do resultado. Na última execução, NODE_PATH inicialmente omitiu o Playwright já instalado; falhou antes de iniciar navegador (`candidate-missing-tool-path.log`). Corrigido somente o caminho para a ferramenta existente, sem instalar pacote. Nenhuma dessas falhas é atribuída à base.

## Isolamento e cobertura não executada

Dependências Linux sanitizadas e Prisma offline já existentes foram reutilizados. Ambiente dos comandos limitado a PATH, NODE_PATH, LANG e CLIENT_QA quando necessário. Nenhum .env, banco ou serviço externo. Browser só permite a origem HTTP loopback do servidor estático; o backend é apenas arquivos locais, sem Next/Prisma/runtime externo. Requests registram somente método/caminho, sem cookies/payloads. Candidato: PID 21053, origem `http://127.0.0.1:36587`, 18 GET locais, zero externos, zero erros de página. Browser e servidor encerrados em finally. Base tem seu próprio registro, porta temporária e encerramento.

Persistência/download/router/auth são adapters ou spies locais. Testes de servidor executam a action e requireUser originais com Prisma/Supabase simulados. Não foi E2E autenticado, não testou Next/RSC, DB/Supabase real, arquivo salvo pelo SO ou abertura em planilhas reais. Integrações que exigem PostgreSQL não foram executadas; não houve alteração nesses fluxos. Nenhum build que executasse geração/download Prisma foi necessário. Não houve nova negativa de permissão nesta tarefa nem tentativa de contornar bloqueios antigos.

## Incremento entregue

Quatro arquivos de produto: `web/src/actions/clientes.ts`, `web/src/app/(dashboard)/clientes/clientes-view.tsx`, `web/src/components/clientes/novo-cliente-modal.tsx`, `web/src/lib/clientes-cadastro.ts`.

Dois testes: `web/tests/client-actions.test.cjs`, `web/tests/client-actions-browser.cjs`. Documentos: este relatório e `delivery/CLIENT-ACTIONS-PLAN.md`. Manifesto contém lista exata/versionada, hashes e patch incremental completo desde a base. Pacote privado novo contém somente patch, plano/relatório/manifesto, testes e logs textuais sanitizados; não contém capturas, .env, dumps, árvore inteira ou credenciais. Sem push, PR, merge, deploy ou publicação.
