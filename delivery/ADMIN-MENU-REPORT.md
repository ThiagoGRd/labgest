# Candidato local — agrupamento do menu administrativo

Base exata: `1e35added7947359a5ccf6688fb35ee15063fec8`.
Branch: `ui/admin-menu-groups`; worktree: `/workspace/labgest-menu`.
Candidato conservador para revisão; não representa aprovação de todos os detalhes do protótipo. Branches/commits anteriores preservados. Sem publicação.

## Escopo implementado

Os 13 destinos originais continuam independentes, com nomes/hrefs/ícones preservados:

| Grupo | Destinos |
| --- | --- |
| Visão geral | Dashboard, Prioridades |
| Operação | Ordens, Produção, Recepção, Lab Interno, Labs Externos |
| Cadastros e materiais | Clientes, Serviços, Estoque |
| Gestão | Financeiro, Relatórios |
| Rodapé/conta | Configurações |

Cabeçalhos simples; nenhum submenu ou accordion. Configurações usa a mesma filtragem por perfil dos demais links. O perfil `recepcao` mantém somente Recepção entre os itens; o logo `/dashboard` já existente permanece, sem alegar autorização dessa rota. Nenhuma mudança de backend ou permissões.

Badges reais de mensagens continuam em Ordens/Produção no modo expandido, assim como o ícone de Relatórios e o indicador de Novidades. Logout e Novidades continuam disponíveis; logout também é alcançável no modo recolhido. Nomes acessíveis e `aria-current` identificam controles e destino ativo (rota exata ou filha, sem aceitar prefixo semelhante).

O drawer mobile usa Radix Dialog já instalado. Mobile fechado não mantém links do drawer no DOM. A abertura mobile não herda a largura recolhida do desktop. Fechamento por botão, Escape, overlay, nova rota ou clique no destino atual. O provider observa o mesmo breakpoint do layout e fecha o drawer na transição de viewport. O acionador participa do Dialog para foco/estado acessível. Novidades mantém seu modal real, sem trap/Escape global adicional.

Somente três arquivos de produto alterados: sidebar, provider e DashboardLayout (acionador/root do drawer). Nenhuma tela interna, módulo, dependência, lockfile ou regra de negócio alterada.

## Referência não inspecionada

A referência `labgest-preview-revisado.html`, Library ID `libfile_fde3_f-5a47e9e554bc819183c245845ba10f1c_e6a741338be08191845e1814832b5f73`, não pôde ser materializada neste executor. `prepare_materialize` retornou uma transferência sem workspace_path. O helper oficial retornou código 1, `library file transfer failed: download failed`; não deixou HTML no destino. A segunda preparação com destino local explícito também não forneceu arquivo local. A política vigente é restrita e não inclui o domínio retornado, mas o helper não informou status HTTP: causa exata não confirmada, sem alegar negativa de aprovação.

Não foram usados downloads alternativos, outro executor ou mudanças de rede/infra. Não houve nova tentativa de download. O coordenador retirou expressamente a inspeção da referência como pré-requisito e autorizou o agrupamento textual com estilo existente. Bytes/hash da referência não foram confirmados; não se alega reprodução de pixels ou inspeção offline dessa prévia.

## Validação e limites

Plano registrado antes de código. Harness novo usa DashboardLayout, SidebarProvider, Sidebar, MensagensBadge, WhatsNewModal e Radix reais, compilados com Tailwind real de globals.css. Next Link/navigation são adaptados ao histórico local; logout e consulta de badges são spies locais. Usuário e conteúdo são sintéticos. Browser bloqueia requisições fora do servidor local. Não é E2E autenticado ou servidor Next completo.

As primeiras cinco verificações browser falharam antes da implementação por comportamento ausente, sem erros JS/requisições externas (menu-red.log). Testes adicionais de breakpoint/Novidades foram acrescentados depois; não se alega TDD de cada asserção.

Resultados finais:

- `MENU_QA=/workspace/labgest-menu-qa node web/tests/admin-menu-browser.cjs`: **6/6 cenários passaram**, Chromium 1280, 768, 767, 390 e 320 px (320 com altura 640). Cobertura dos 13 hrefs, grupos, seleção exata/filha/prefixo negativo, Tab no recolhido, logout e badge locais, configuração restrita para recepcao, mobile fechado sem links, foco inicial/cíclico/restaurado, botão/Escape/overlay/navegação atual e nova, resize com drawer e com Novidades, fechamento de Novidades e aviso automático. Zero requisições externas/erros de página.
- Regressão adicional de associação acionador/drawer (`aria-controls`): falhou em duas larguras antes de remover o ID que sobrescrevia o ID Radix; passou na execução final (menu-controls-red.log versus menu-browser.log).
- `node_modules/.bin/tsc --noEmit --incremental false -p web/tsconfig.json`: passou.
- `npm run lint --workspace=web`: passou, sem avisos ESLint.
- `node --test web/tests/*.test.cjs web/tests/*.test.mjs`: **53/53 passaram**.
- `node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`: **35/35 passaram**.
- `ORDER_DETAIL_QA=/workspace/labgest-menu-order-qa node web/tests/order-detail-browser.cjs`: passou em 1280/390, ficha real em harness isolado e quatro filas de Prioridades/Produção com shell simulado.
- `node web/tests/attention-build-css.cjs` e `ATTENTION_GIT_ROOT=/workspace/labgest-menu ATTENTION_CSS=/workspace/labgest-menu-validation/delivery/tailwind.css node web/tests/attention-browser.cjs`: passaram, regressões da interface anterior em 1280/390; esse harness usa shell simulado, portanto a cobertura do novo menu pertence exclusivamente ao harness admin-menu.
- `node web/tests/labs-externos-archive-browser.integration.cjs`: passou; ações e shell sintéticos.
- `git diff --check`: passou. Aplicabilidade do patch à base verificada antes da transferência.

Revisão visual local: grupos legíveis, estilos existentes claros/escuros, drawer de 256 px com labels no mobile, área dos destinos com rolagem própria em alturas menores e rodapé independente. Não se promete que todos os destinos caibam simultaneamente em uma tela pequena. Não há falha nova de produto identificada nas verificações executadas. Capturas desktop/mobile são somente QA local, não incluídas no pacote Library. As verificações PostgreSQL dependentes de banco descartável permanecem fora da execução, conforme limitação já registrada na base; nenhum banco real ou infraestrutura foi usado. Não foram lidos .env ou usados node_modules de macOS. Dependências Linux e Prisma offline já validados foram reutilizados em `/workspace/labgest-menu-validation`, sem instalação ou nova obtenção de checksum.

## Entrega

Patch somente desde a base 1e35added, relatório, plano, manifesto de arquivos/hashes e evidências textuais. Nova identidade Library, sem alterar pacotes anteriores. Commit final consta no manifesto. Sem push, PR, merge, deploy, produção, credenciais ou lockfile.


## Arquivos exatos deste incremento

1. web/src/components/layout/sidebar.tsx
2. web/src/components/layout/dashboard-layout.tsx
3. web/src/components/providers/sidebar-provider.tsx
4. web/tests/admin-menu-browser.cjs
5. delivery/ADMIN-MENU-PLAN.md
6. delivery/ADMIN-MENU-REPORT.md

Bloqueio remanescente: somente a referência HTML não materializada (pré-requisito retirado pelo coordenador). Sem operação de implementação negada, pendente ou de resultado incerto. Ações externas do produto não executadas.
