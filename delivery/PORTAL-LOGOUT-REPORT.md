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

Plano registrado antes do código. Harness novo portal/tests/mobile-logout-browser.cjs usa PerfilView, PortalLayout, DashboardView, LoginPage, login/logout originais, CSS Tailwind real, Chromium e adapters locais já utilizados. Auth/Prisma e guard de sessão são simulações em memória; não é E2E autenticado.

Antes da correção (red.log, exit 1):
- 390 e 320 px falharam por Sair não visível/acessível.
- 768 px falhou por Meu Perfil fora da viewport, achado preexistente no cabeçalho.
- 1280 px passou no fluxo; geometria registrou overflow preexistente de 4 px.

Depois (green.log, exit 0): **4/4 larguras passaram — 320, 390, 768, 1280 px**, altura 900:
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
