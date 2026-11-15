# Ações diárias mobile — revisão local

Base exata: `b62b8cc0e62c5822d00bc67cdf002c4c90888fc2`. Branch `ui/mobile-daily-actions`, worktree `/workspace/labgest-mobile-daily`. HEAD final no manifesto. Todos os candidatos anteriores preservados; sem push/PR/merge/deploy/publicação, alterações de credenciais/infra/schema/lockfiles ou acesso real.

## Achados confirmados e implementação

Financeiro administrativo: o cartão mobile não oferecia Cancelar, enquanto a tabela desktop oferecia. Reprodução no browser em 320/390: quatro falhas por ausência do controle (receber/pagar); em 768/1280 os quatro percursos desktop já passavam. Adicionado ao cartão somente o Button existente, com XCircle, nome acessível `Cancelar ${descricao}`, título Cancelar lançamento e `onCancelar(item.id)`. Guarda copiada exatamente: `item.liquidado === 0 && item.status !== 'Cancelado'`. Não usa statusAberto. O callback existente continua selecionando `{id,tipo}` e abrindo ReasonModal; confirmação continua enviando ID/tipo/motivo pelo handler original. Área de valor/ações permite wrap para caber em 320 px. Não adicionado link de OS.

Portal: /historico existe em `portal/src/app/(dashboard)/historico/page.tsx`, usa getHistoricoPedidos e HistoricoView. O link já existia no menu desktop, mas faltava nos atalhos mobile. Adicionado Histórico com href /historico aos atalhos existentes. Seis destinos em duas linhas de três, altura 112 px e reserva inferior equivalente; nomes completos e alvos suficientes em 320 px, sem remover Início/Pedidos/Novo/Financeiro/Perfil. Indicação ativa existente preservada; aria-current=page acrescentado aos links ativos mobile/desktop. Proteções desktop min-w-0/overflow-x-auto, shrink-0/whitespace-nowrap, menu sem encolher e Sair 44×44 intactas. Não alterados Histórico, filtros, dados, status ou autenticação.

## TDD e comparação reproduzível

Plano registrado antes do código. Nenhum AGENTS.md/skill local adicional encontrado. Skill de TDD aplicada. As primeiras tentativas foram preservadas: `red-web.log` parou ao aguardar um título comprimido no cabeçalho de 320 px; corrigido o teste para aguardar a aba real (sem alterar produto), e `red-web-final.log` reproduziu a ausência de Cancelar antes de implementar. Portal reproduziu Histórico ausente em 320/390 e aria-current ausente em desktop. Testes foram depois ampliados com capturas e alcance de Sair por teclado; não se atribuem hashes finais aos logs iniciais.

A MESMA versão final de cada teste foi executada nas cópias sanitizadas base/candidato. Hashes, comandos, cwd e exits completos em `final-browser-checks.json`:

| Teste | Base | Candidato |
| --- | --- | --- |
| node web/tests/mobile-finance-actions-browser.cjs | 4 PASS desktop, 4 FAIL mobile; exit 1 | 8 PASS; exit 0 |
| node portal/tests/mobile-history-browser.cjs | 4 FAIL; exit 1 | 4 PASS; exit 0 |

Financeiro em 320/390/768/1280, receber e pagar: matriz literal Pendente/Vencido com liquidação zero elegíveis; Parcial com 30, Recebido/Pago com 100 e Cancelado com zero inelegíveis. Incluídos casos sintéticos Pago e Parcial com zero, elegíveis pela guarda atual, para impedir reinterpretar a regra. Controle cabe no viewport, nome acessível, Tab de Editar para Cancelar, Enter abre modal real. Cancelar/Desistir e Escape não chamam action; confirmação feita EXCLUSIVAMENTE com cancelarConta substituída por spy em bundle, comprovando `[2,'receber','Motivo fictício']` e `[102,'pagar','Motivo fictício']`, incluindo trim. Nenhum cancelamento real.

Portal nos quatro tamanhos: todos os seis hrefs/nome visíveis no menu pertinente, labels mobile sem truncamento, Histórico alcançado por Tab/Enter e clique, HistoricoView real com dados vazios fictícios, aria-current único e atualização ao voltar a Perfil; Back retorna ao contexto. Sair visível, 44×44 e alcançável por Tab, SEM ativar logout; lista de chamadas externas permanece vazia. Sem overflow horizontal de página/cabeçalho; menu desktop conserva rolagem própria. Outros destinos usam conteúdo sintético sob PortalLayout real; não foi execução das páginas internas de Pedidos/Perfil/Financeiro.

Capturas revisadas localmente em 320/390/768/1280. QA adicional em 320/390 repetiu os mesmos percursos financeiros com pausa de 750 ms após fechar modal e captura dos controles: em 320 valor/ações passam a linhas separadas, em 390 continuam compactos quando cabem. Script derivado exclusivamente de QA e seu hash acompanham evidência textual; imagens ficam locais. Nada visual foi enviado à Library.

## Checks e limitações

Todos exit 0 (comandos/logs em checks.json):

- `node_modules/.bin/tsc --noEmit -p web/tsconfig.json`
- `node_modules/.bin/tsc --noEmit -p portal/tsconfig.json`
- `npm run lint` (web e portal), repetido após ajustes finais dos testes
- `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: 61/61
- `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: 35/35
- `git diff --check`; aplicação do patch à base verificada

Sem nova falha de produto/checks. Ocorrência separada preexistente: Header administrativo comprime o título Financeiro em 320 px (e trunca em 390); não corrigido fora do escopo. ReasonModal e handler financeiro de exceção não foram alterados. A inspeção mostra que confirmarCancelamento não possui try/finally, mas exceção lançada não foi exercitada nesta rodada; portanto não alegamos correção nem reprodução do antigo loading preso. Os testes usam resposta de sucesso do spy; não validam persistência financeira.

Componentes/layout/modal e Tailwind reais, fontes externas não carregadas. Todas as actions importadas são substituídas: cancelarConta é spy de sucesso; badges/notificações retornam vazio/zero; demais actions lançam erro se chamadas. Imports de SDK Supabase/database proibidos no bundle. Servidor Node serve somente HTML/JS/CSS em 127.0.0.1; não há runtime Next/Prisma. Browser bloqueia qualquer request fora da origem local. Cada teste/rodada inicia contexto próprio. Dados exclusivamente fictícios; nenhum .env lido ou copiado. Ambiente limitado a PATH/NODE_PATH/LANG/DAILY_QA. Dependências Linux/Prisma offline anteriores reutilizados, sem instalar/alterar dependências ou retentar bloqueios antigos.

Cada execução final registrou 12 GET locais, zero requests externos e zero erros de página; requests.json contém apenas origem, método e caminho. Browser/servidores encerrados em finally, PIDs/portas conferidos ao empacotar. Não é E2E Next/autenticado, não testa banco/Supabase real, autorização ou filtros/dados reais do Histórico. Integrações PostgreSQL não executadas; nada mudou nelas. Sem ação negada, pendente ou incerta nesta tarefa.

## Arquivos e entrega

Somente dois arquivos de produto: `web/src/app/(dashboard)/financeiro/financeiro-view.tsx` e `portal/src/components/layout/portal-layout.tsx`. Dois testes novos: `web/tests/mobile-finance-actions-browser.cjs` e `portal/tests/mobile-history-browser.cjs`. Plano e este relatório em delivery. Manifesto lista arquivos/blobs/SHA256/tamanhos, base/HEAD, checks e preservação dos candidatos. Pacote novo privado: patch completo somente desde b62b8cc0, relatório/plano, testes e evidências textuais sanitizadas. Sem screenshots, CSV, .env, dados reais ou árvore inteira.
