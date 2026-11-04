# Candidato isolado — Sair no portal mobile

Base exata: 8debab3962b21c6a4bcbc48f63c8fb6fe26f5bfc.
Branch: ui/portal-mobile-logout. Worktree: /workspace/labgest-portal-logout.
Commit final consta no manifesto. ui/admin-menu-groups permanece limpa no HEAD 8debab39; branches, pacotes Library e evidências anteriores não foram alterados.

## Mudança de produto

Somente portal/src/components/layout/portal-layout.tsx:

- Botão existente Sair deixa de ficar oculto abaixo de sm; alvo 44×44 px, type=button, aria-label=Sair, ícone decorativo e foco visível.
- onClick continua chamando a mesma função logout, sem alteração de auth, permissões, cookies ou sessão.
- O teste da base detectou que, em 768 px, Meu Perfil ficava fora do viewport; também havia 4 px de overflow do cabeçalho em 1280 px. Ajuste mínimo no mesmo cabeçalho: nav com min-w-0 e rolagem interna horizontal; links sem encolher/quebrar texto, padding reduzido de 16 para 12 px; grupo de conta não encolhe e usa gap 8 em vez de 16 px. Todos os destinos e breakpoints existentes preservados. Não foi adicionado submenu, rota, botão de perfil ou fluxo paralelo.

Nenhuma mudança de PerfilView, actions, segurança, banco, infraestrutura, credenciais, dependências ou lockfile.

## TDD e validação afetada

Plano registrado antes do código. O red.log original e o teste final não são versões idênticas; a cronologia e a repetição comparável estão documentadas abaixo. Harness novo portal/tests/mobile-logout-browser.cjs usa PerfilView, PortalLayout, DashboardView, LoginPage, login/logout originais, CSS Tailwind real, Chromium e adapters locais já utilizados. Auth/Prisma e guard de sessão são simulações em memória; não é E2E autenticado.

Execução histórica antes da correção (red.log, exit 1; versão anterior do teste, ainda sem assert de overflow):
- 390 e 320 px falharam por Sair não visível/acessível.
- 768 px falhou por Meu Perfil fora da viewport, achado preexistente no cabeçalho.
- 1280 px passou no fluxo; geometria registrou overflow preexistente de 4 px.

Execução original do candidato com o teste final (green.log, exit 0): **4/4 larguras passaram — 320, 390, 768, 1280 px**, altura 900:
- Login fictício; Perfil real acessado por link existente.
- Sair visível, com nome acessível, dentro da viewport, alvo 44×44 e alcançado por Tab real desde o logo.
- Enter em Sair → login → Back permanece login com sessão simulada nula.
- Novo login → Perfil → clique repetido (dblclick) em Sair → login/Back → novo login funciona, sem erro de página. O adapter adiciona latência de 120 ms para permitir repetição; não se afirma debounce nem robustez do serviço Auth real.
- Cabeçalho sem overflow horizontal nas quatro larguras: clientWidth/scrollWidth 318/318, 388/388, 734/734 e 1246/1246. Em 768 px a navegação tem rolagem interna; links continuam alcançáveis.

Typecheck e lint rodados na base antes do código e novamente após a correção:
- node_modules/.bin/tsc --noEmit --incremental false -p portal/tsconfig.json: exit 0 em ambos.
- npm run lint --workspace=portal: exit 0 em ambos, sem avisos ESLint.
- git diff --check: passou; patch verificado com git apply --check sobre a base exata antes do upload.

Não foram repetidas suítes de módulos não afetados. Capturas locais de 390 e 768 px revisadas: Sair permanece visível, foco distinguível e controles do cabeçalho dentro da tela. Demais estilos da página Perfil são preexistentes. Capturas somente internas, excluídas do pacote.

## Isolamento e processos

Cópia sanitizada /workspace/labgest-portal-logout-validation: nenhum .env/.git/node_modules herdado; dependências Linux previamente validadas reutilizadas por symlink. Sem instalação ou geração Prisma adicional. Node do browser executado com ambiente allowlist PATH/NODE_PATH/LANG, mais LOGOUT_EVIDENCE apontando para diretório local. Defines públicos Supabase vazios; Auth/Prisma interceptados por adapters sem rede. Cadastro e demais actions são bloqueados. Nenhuma conta, API key, grant ou credencial real criada; entradas são fixtures transitórias.

Apenas servidor estático loopback, sem Next/Prisma/Supabase backend real. Chromium permite somente sua origem local. Execução final PID 17498, http://127.0.0.1:44477: **12 GETs locais, zero requests externos e zero erros de página**. Servidor/browser encerrados no finally, confirmado por ss; listener preexistente 1040 não foi acessado.

Comando browser: LOGOUT_EVIDENCE=/workspace/labgest-portal-logout-evidence/green node portal/tests/mobile-logout-browser.cjs, via subprocess com ambiente sanitizado. Logs de base/vermelho/verde e requests completos sem payload integram o pacote.

## Entrega e limites

Arquivos exatos: portal/src/components/layout/portal-layout.tsx; portal/tests/mobile-logout-browser.cjs; delivery/PORTAL-LOGOUT-PLAN.md; delivery/PORTAL-LOGOUT-REPORT.md.

Novo pacote privado Library contém patch incremental desde 8debab39, relatório/plano, manifesto, teste standalone e evidências textuais sanitizadas. Nenhuma imagem, .env ou árvore completa. Nenhum push, PR, merge, deploy ou acesso real. Autenticação real, JWT/cookies/refresh e servidor Next continuam não executados; somente o comportamento de UI/ações originais com adapters foi validado.

Bloqueios: nenhum operacional nesta entrega. Nenhuma ação negada, pendente ou de resultado incerto. Problema preexistente do cabeçalho encontrado e corrigido estritamente no mesmo componente; nenhuma auditoria ou correção fora do escopo.


## Correção da evidência após revisão independente

O reviewer identificou corretamente que red.log não veio da versão final do teste: em 1280 px registrava clientWidth 1246/scrollWidth 1250 e PASS porque ainda não existia a asserção de ausência de overflow. Após observar essa geometria, foram acrescentados o assert de header.scrollWidth <= clientWidth e a escolha do link Perfil conforme a navegação efetivamente visível, em vez de apenas um corte fixo de largura. O hash da versão intermediária não foi retido; não se atribui a ela o hash do teste final. Os logs históricos red.log/green.log foram preservados byte a byte, não regenerados.

Para resolver a comparação, a MESMA versão final de portal/tests/mobile-logout-browser.cjs, extraída do candidato 49cf911e75338fec5e96aac01cdc4365e47290dd, foi executada primeiro na base 8debab3962b21c6a4bcbc48f63c8fb6fe26f5bfc e depois no candidato. SHA256 idêntico em ambas as cópias: 8e12b2cb52c8c63c307f9476d78602f4550c78af38fa400946bd21612a5d1bf0.

Cópias novas, isoladas, sem .env/dependências herdadas: /workspace/labgest-portal-logout-replay-base e /workspace/labgest-portal-logout-replay-candidate. Os 52 arquivos portal/src de cada cópia foram comparados byte a byte com seu commit exato. Nenhum arquivo de produto ou teste foi alterado nesta revisão.

Comando em ambas: node portal/tests/mobile-logout-browser.cjs. Executado via subprocess com allowlist PATH/NODE_PATH/LANG e LOGOUT_EVIDENCE específico por cópia; configuração integral em replay-config.json.

- Base: exit 1, **0 PASS / 4 FAIL**. 320/390: Sair oculto; 768: link Meu Perfil fora da viewport; 1280: assert “header fits without horizontal overflow”. Log replay-base.log, SHA256 094eb1b0feb35f7660088149a540767ba2a71d84ea836955c21531cc02ab246a.
- Candidato: exit 0, **4 PASS / 0 FAIL**. Mesmo fluxo, asserções e quatro larguras. Log replay-candidate.log, SHA256 36b0a35ab2d2002b3e6b115d2ec5167341b400e980edab7b48c113bb98ed5611.

Este é o par vermelho/verde comparável da versão FINAL do teste. Os resultados históricos continuam incluídos e identificados separadamente no manifesto. Typecheck/lint não foram repetidos nesta revisão exclusivamente documental; os resultados anteriores pertencem ao código testado do candidato 49cf911e, preservado.

Replay base: PID 18261, http://127.0.0.1:44255. Replay candidato: PID 18525, http://127.0.0.1:33571. Ambos encerrados no finally e confirmados por ss; cada rodada teve 12 GETs locais, zero externos e zero erros de página. Nenhum novo serviço, dado real ou acesso criado.
