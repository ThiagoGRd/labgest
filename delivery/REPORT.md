# Entrega local revisada: painel e atalhos contextuais

Base exata: `b8ee4012a140079bef32b3c2103479b6576e346f`.
Branch: `ui/contextual-attention`. Worktree: `/workspace/labgest-attention`.
Commits locais e SHA256 dos arquivos constam no manifesto do pacote. Sem candidato técnico misturado.
Sem push, PR, merge, deploy, consulta a produção, alteração de credenciais/infra ou lockfiles. Nenhum `.env` foi lido/carregado. Worktree original preservada.

## Comportamento entregue

- Painel: atenção antes dos indicadores; métricas, próximas entregas e financeiro preservados.
- `/prioridades?atencao=atrasadas`: todas as ordens ativas com prazo anterior a hoje, incluindo sobreposições de resposta/fornecedor. Provas clínicas em seção própria, sem reclassificá-las como atraso confirmado do laboratório.
- `/prioridades?atencao=hoje`: somente entregas de hoje, com aba correspondente destacada.
- `/producao?atencao=retornos`: uma entrada por ciclo em prova com decisão não nula e ordem não encerrada. Inclui pausados e ciclos anteriores. Somente o ciclo atual de ordem não pausada oferece a confirmação existente; os demais abrem a ordem para revisão.
- `/producao?atencao=sem-etapa`: consulta exata `passoFluxoAtual: null`, excluindo Pausado. Não usa o predicado mais amplo de filaDaOrdem, nem exclui ordens que também tenham retorno.
- Critérios compartilhados com as contagens do painel. getProducao autentica antes das duas novas leituras. Nenhuma regra de negócio alterada.
- Seleção visível, busca, vazio e limpeza que remove apenas `atencao`. Ausência/parâmetro inválido mantém a visão padrão. Contexto derivado da URL a cada renderização.
- Ordens: busca/filtros antes dos contadores; demonstrativo recolhido em “Relatórios e impressão”. Mês/clínica e navegação atual para `/relatorios` preservados. Nenhuma alteração de cobrança.
- Ajuste da revisão: botão de Prioridades agora diz “Relatório geral”; impressão preserva todas as categorias, independentemente do contexto/busca.
- Ajuste visual mínimo decorrente da verificação: botões do modal existente de retorno empilhados em telas pequenas e texto de confirmação pode quebrar linha, sem modificar validações ou ação.

## Preparação segura e verificações

Cópias sanitizadas `/workspace/labgest-validation` (alteração) e `/workspace/labgest-validation-base` (base), sem `.env` ou node_modules herdado. `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/labgest-npm-cache`: 919 pacotes, lockfile preservado. A primeira tentativa falhou por cache padrão não gravável; corrigida apenas a localização do cache.

Prisma Client 6.19.2 gerado offline, engine=none, com schema da cópia e URLs dummy para loopback porta 1. Comando usou `PRISMA_SCHEMA_ENGINE_BINARY=/bin/false PRISMA_QUERY_ENGINE_LIBRARY=/bin/false prisma generate --schema packages/database/prisma/schema.prisma --no-engine`. Nenhum banco foi conectado/migrado. Tentativa anterior de baixar checksum em binaries.prisma.sh recebeu 403; esse acesso não foi repetido. A alternativa offline utilizou somente pacotes já instalados.

Resultados finais:

1. `node_modules/.bin/tsc --noEmit --incremental false -p web/tsconfig.json`: passou na base e na alteração.
2. `npm run lint --workspace=web`: passou na base e na alteração, sem erros/avisos. Aviso inicial do harness corrigido.
3. `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: 44/44 passaram, incluindo oito testes específicos de atenção/relatório.
4. `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: 35/35 passaram com esbuild Linux instalado normalmente.
5. Harness `attention-browser.cjs` com CSS real: Chromium, 1280/390 px; quatro atalhos, entrada direta/recarga, limpar/Back/Forward nativos, busca/vazio, parâmetro inválido, múltiplos ciclos/pausados, relatório mensal com/sem clínica. Sem overflow horizontal da página nos quatro contextos e relatório mensal aberto.
6. Modais reais de retorno e definição de etapa, componentes Radix reais e spies locais: ciclo antigo e ordem pausada sem botão de confirmação; ciclo atual abre modal real e envia `confirmarRetorno(11, 7)`; definição segue selects existentes e envia `definirEtapaFluxoProtese(1, 'protese_total_removivel', 'moldagem_estudo')`, fechando após sucesso. Nada é enviado a servidor.
7. Relatório de Prioridades real: mesmo com seleção “hoje” e busca sem resultado, clicar “Relatório geral” entrega ao spy de impressão o conteúdo geral, incluindo a prova clínica fora da seleção.
8. `node web/tests/labs-externos-archive-browser.integration.cjs`: passou após preparar dependências; ações sintéticas e CSS real. Não houve alteração nesse módulo.
9. `git diff --check` e aplicação do patch sobre a base: verificados.

O plano inicial foi registrado antes do código. Falhas anteriores aos links/posição dos blocos/consulta de retornos foram registradas. Novo rótulo teve teste vermelho antes da alteração. O corte mobile do botão de retorno teve reprodução no navegador/assertion antes da correção. Testes de consulta e parte do harness foram adicionados após implementação; não se alega TDD completo de todos os caminhos.

## Evidências visuais e limites

Tailwind compilado do `web/src/app/globals.css` real com PostCSS/plugin do lockfile. Script reproduzível: `node web/tests/attention-build-css.cjs`. Harness: `ATTENTION_GIT_ROOT=/workspace/labgest-attention ATTENTION_CSS=/workspace/labgest-validation/delivery/tailwind.css node web/tests/attention-browser.cjs` na cópia sanitizada. ATTENTION_GIT_ROOT só permite ler as views da base com git show para as capturas anteriores.

Pacote inclui capturas before/after do painel, quatro contextos, relatório mensal e modais reais em desktop/mobile. Header e layout global continuam simulados; fontes remotas não carregadas. As capturas demonstram os componentes e CSS reais, não a aplicação Next completa com sidebar, sessão e navegação RSC. Testes usam histórico nativo com adaptador Next, relatório real com impressão interceptada e modais reais com ações substituídas por spies. Não houve E2E autenticado nem confirmação/impressão real.

Duas integrações PostgreSQL de outro módulo continuam não executadas com sucesso: `archive-runtime-diagnostic-postgres.integration.cjs` e `labs-externos-archive-postgres.integration.cjs`, pois exigem pg e banco PostgreSQL descartável local específico; não foi criado banco nem instalada infra para este escopo de UI. As antigas falhas globais de typecheck/lint/esbuild foram resolvidas na cópia sanitizada e não permanecem bloqueios da entrega.

Riscos restantes: duas consultas extras em Produção; contagens podem naturalmente mudar entre leituras concorrentes; busca contextual de Produção é local e remonta ao limpar/retornar. Necessária validação de integração no ambiente completo antes de merge/deploy. Nenhuma alteração de cobrança, portal, sidebar ou módulos de terceiros.

Revisão independente comunicada pelo coordenador: não encontrou defeito funcional bloqueante e pediu explicitação de relatório geral e ampliação dos testes de modais; ambos incorporados. Não houve nova delegação.

## Bloqueios e transferência

Ação bloqueada por rede: obter checksum do schema-engine em `https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/schema-engine.sha256`, HTTP 403. Interrompida, sem repetir download. Geração offline concluiu o objetivo. Nenhuma operação de produto foi negada por auto-review; nenhum resultado incerto ou ação externa pendente.

Novo pacote privado substitui a primeira entrega para revisão. Contém patch completo desde a base, relatório, plano, manifesto com hashes, logs finais e capturas sintéticas com Tailwind. Não contém .env, credenciais, node_modules, dumps ou dados reais. IDs, commit, tamanho e SHA256 constam no resultado final.
