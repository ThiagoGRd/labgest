# Correção isolada — saída no portal mobile

Base exata: 8debab3962b21c6a4bcbc48f63c8fb6fe26f5bfc. Branch ui/portal-mobile-logout, worktree /workspace/labgest-portal-logout. Candidato anterior e evidências preservados.

1. Regressão browser antes de produto: PerfilView/PortalLayout reais, Sair visível e alcançável em 390 px; falha esperada pela classe hidden sm:block. Registrar geometria do cabeçalho antes/depois também em 320/768/1280.
2. Menor ajuste do botão existente: visibilidade mobile, nome acessível e foco de teclado, preservando logout original; sem reestruturar Perfil/autenticação.
3. Verificar Perfil→Sair→login→Back e novo login, desktop/mobile; teclado e repetição de acionamento; Tailwind real e adapters locais de Auth/Prisma/sessão. Não afirmar E2E autenticado.
4. Typecheck/lint portal e integração afetada. Distinguir falhas preexistentes. Comparar fonte/estado das branches e fechar servidores loopback.
5. Commit e patch somente desde a base; novo pacote privado Library com plano/relatório/manifesto/teste/evidências textuais, sem imagens/segredos/env/árvore completa.

Nenhum AGENTS.md ou skill local encontrado no catálogo/diretórios do repo; TDD e verificação antes de conclusão aplicados. Dependências sanitizadas já instaladas serão reutilizadas; nenhum novo serviço ou dependência.
