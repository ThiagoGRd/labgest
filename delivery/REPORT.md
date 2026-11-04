# Entrega local: painel e atalhos contextuais

Base exata: `b8ee4012a140079bef32b3c2103479b6576e346f`.
Branch: `ui/contextual-attention`. Worktree: `/workspace/labgest-attention`.
Sem push, PR, merge, deploy, consulta a produção, alteração de credenciais ou infraestrutura. Nenhum `.env` foi lido/carregado; a cópia rastreada existente no repositório não foi incluída nos artefatos. Worktree original permaneceu sem alterações.

## Comportamento

- Painel: atenção aparece antes dos indicadores; métricas, próximas entregas e financeiro preservados.
- `/prioridades?atencao=atrasadas`: todas as ordens ativas com data anterior a hoje, incluindo sobreposições de resposta/fornecedor. Provas clínicas ficam em seção própria, com aviso de conferência, sem reclassificar como atraso confirmado do laboratório. Usa a consulta existente de prazo vencido.
- `/prioridades?atencao=hoje`: somente entregas de hoje, com aba correspondente destacada.
- `/producao?atencao=retornos`: uma entrada por ciclo em prova com decisão não nula e ordem não encerrada. Inclui pausados e ciclos anteriores, não apenas o ciclo ativo mais recente. Confirmação existente é oferecida apenas para o ciclo atual de ordem não pausada; demais entradas abrem a ordem para revisão.
- `/producao?atencao=sem-etapa`: IDs consultados com `passoFluxoAtual: null` e status ativo, excluindo Pausado. Não usa o predicado mais amplo de filaDaOrdem, nem exclui ordens que também tenham retorno.
- Critérios de consulta compartilhados com as contagens do painel, sem mudanças nas regras de negócio. Consulta de retornos e consulta de IDs sem etapa autenticadas via getProducao antes de executar; duas leituras adicionais na página Produção.
- Contexto visível, busca, vazio e “Limpar seleção”. Limpeza remove só `atencao`. Ausência/valor inválido mantém a visão padrão. Estado derivado de useSearchParams durante render, não inicializado uma vez em useState.
- Ordens: busca/filtros vêm antes dos contadores. O demonstrativo mensal recolhido em `details` “Relatórios e impressão” depois dos filtros. Nova Ordem, filtros, paginação e handler de `/relatorios?mes=...&imprimir=1[&cliente=...]` preservados. Nenhuma alteração de cobrança.

## Verificação executada

Plano anterior ao código em PLAN.md. `red.log` documenta falhas iniciais nos links/ordem dos blocos e ausência do helper; `red-production.log` documenta ausência da consulta de ciclos completos. Testes de coerência das consultas e browser foram adicionados depois da implementação, portanto não se alega ciclo TDD completo para esses testes.

1. `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: **43/43 passaram** (inclui 7 novos testes de atenção).
2. `node --require ./web/tests/attention-typescript-register.cjs --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: **35/35 passaram**. Carregador transpila TypeScript e resolve alias local sem instalar dependências ou carregar env.
3. `node web/tests/attention-browser.cjs`: **passou em Chromium, 1280 e 390 px**. Componentes reais das quatro views e React real; Next navigation substituído por adaptador com pushState/popstate nativos. Exercita quatro links, entrada direta, recarregar, busca combinada, vazio da busca e de dados, limpar, Back/Forward reais, inválido, pausados/múltiplos ciclos e relatório com/sem clínica. Ações externas substituídas por função que falha; nenhum acionamento externo. Dados somente sintéticos.
4. `git diff --check`: passou.
5. `node_modules/.bin/tsc --noEmit --incremental false -p web/tsconfig.json`: **falhou**, também na base. Dependências Next/React types ausentes, pacote shared sem link e Prisma gerado desatualizado. Não é possível certificar typecheck global neste ambiente. Logs base e alterado incluídos para comparação; erros de JSX/any também afetam o novo componente. Não se afirma que todos os diagnósticos novos sejam preexistentes.
6. `npm run lint --workspace=web`: **não executou lint**, `eslint: not found` (127). Não houve instalação nem alteração do lockfile.
7. Comando inicial `node_modules/.bin/tsx --test ...`: falhou antes de executar os testes por esbuild darwin-arm64 em Linux. Fallback acima passou.
8. Suíte ampla inicial `node --test web/tests/*.cjs web/tests/*.mjs`: 41 passaram, 3 integrações falharam antes de executar: `archive-runtime-diagnostic-postgres.integration.cjs` e `labs-externos-archive-postgres.integration.cjs` por ausência de `pg`; `labs-externos-archive-browser.integration.cjs` por esbuild de outra plataforma. Não foram conectadas a banco nem contornadas com infra externa.

## Limites e revisão

Não houve build/servidor Next completo nem E2E autenticado. O harness substitui layout global, modais, componentes filhos não envolvidos e ações; não prova navegação RSC, permissões reais, confirmação de retorno ou impressão real. Capturas before/after em 1280/390 mostram DOM do painel com CSS mínimo e rótulo explícito: **não são screenshots do produto com Tailwind, nem aprovação visual responsiva**. Necessária revisão visual com dependências completas antes de integração. Busca contextual de Produção é local; limpar e retornar remonta esse campo. Atualizações concorrentes entre dashboard e página podem naturalmente mudar os números.

Revisão local com checklist React: estado derivado de URL, chave por ID de ciclo, sem efeito de sincronização do contexto, botões/inputs nomeados, details nativo, regras comuns para contagens. Sem revisão independente por outro agente nesta execução.

Bloqueios: typecheck global (alvo web, falha por checkout/dependências); lint (alvo web, indisponível); integrações citadas (ferramentas ausentes). Nenhuma operação negada por auto-review, pendente ou de resultado incerto. Validação visual Tailwind/Next permanece não realizada. Integração com candidato técnico exclusivamente a cargo do coordenador.

## Transferência

Pacote privado contém patch completo de commit local, este relatório, plano, manifesto SHA256 dos arquivos alterados, logs de validação e quatro capturas sintéticas. Não contém `.env`, node_modules, credenciais ou dumps. Aplicar o patch somente sobre a base especificada, em checkout isolado. Identificador Library, commit completo, hash e tamanho do pacote constam no resultado final.
