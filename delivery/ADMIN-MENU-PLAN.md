# Candidato: agrupamento do menu administrativo

Base exata: 1e35added7947359a5ccf6688fb35ee15063fec8.
Branch: ui/admin-menu-groups. Worktree: /workspace/labgest-menu.
Status: execução autorizada sem a referência HTML, conforme atualização do coordenador.

## Plano antes do código

1. Usar o agrupamento textual aprovado e estilo existente. A referência HTML não foi materializada; a inspeção foi retirada como pré-requisito pelo coordenador. Não repetir o download.
2. Criar testes comportamentais do menu real/provider/acionador, primeiro falhando para agrupamento, nomes acessíveis, aria-current e isolamento mobile.
3. Implementar cabeçalhos simples: Visão geral (2), Operação (5), Cadastros e materiais (3), Gestão (2), Configurações (1) junto ao rodapé. Manter 13 destinos independentes e o filtro recepcao. Alterar somente sidebar e o provider/acionador se necessário para foco e mobile.
4. Validar componentes reais com Tailwind real, ações/badges locais, sem serviços externos. Executar typecheck, lint e regressões da base na cópia sanitizada já preparada. Revisar capturas localmente.
5. Revisar diff restrito, gerar commit e patch somente desde a base; entregar novo pacote Library com manifesto e evidências textuais, sem imagens.

## Critérios de aceitação

- 13 hrefs originais, nomes reconhecíveis, ícones/badges, conta e novidades preservados. Lab Interno e Produção permanecem separados.
- Rotas exatas e filhas selecionadas; prefixos semelhantes não selecionados; aria-current no destino ativo.
- Tabulação e nomes acessíveis no modo aberto/recolhido; conta disponível; cabeçalhos não criam níveis expansíveis.
- Mobile aberto permanece legível mesmo após recolher desktop. Fechamento por botão, Escape, overlay e navegação; foco inicial, contenção/restauração de foco; controles escondidos inacessíveis.
- Transição mobile ↔ desktop com menu aberto/fechado: não manter foco preso, conteúdo inert ou bloqueio de scroll após resize; preservar controles utilizáveis.
- Menu recolhido: verificar nome acessível e operação por teclado de todos os links e controles, incluindo conta, novidades e expansão.
- Abrir Novidades a partir do mobile: validar interação dos overlays, foco inicial/restauração e fechamento de cada camada; navegação e scroll devem continuar utilizáveis.
- Perfil recepcao mantém somente o destino permitido; Configurações no rodapé também deve respeitar a restrição. Nenhuma ampliação de permissão.
- Não alegar E2E autenticado: browser com ações locais e navegação sintética.

## Regressões concretas do baseline

- Mobile fechado usa apenas translação; testar que links/controles escondidos não recebam Tab ou foco programático.
- Botão de expansão recolhido não tem nome; exigir nome acessível e operação por teclado.
- Links não têm aria-current; exigir seleção exata/filha sem falso positivo por prefixo.
- Clique na rota já atual não altera pathname: exigir fechamento também nesse caso, sem depender exclusivamente do efeito de navegação.
- WhatsNewModal é irmão do aside: evitar trap/Escape global que dispute com esse modal; testar sequência de abertura e fechamento das camadas e recuperação de foco.
- Logo com href /dashboard já aparece para recepcao no baseline. Preservar esse comportamento e verificar separadamente que os itens continuam restritos a Recepção, inclusive no rodapé. Não alegar correção de autorização de rotas nem alterar backend/permissões.

## Bloqueio da referência

prepare_materialize retornou transferência assinada, sem workspace_path. O helper oficial library_file_transfer.py materialize retornou código 1, “library file transfer failed: download failed”. O destino /workspace/labgest-menu-reference está vazio. Uma segunda preparação, com destino local explícito, continuou retornando transferência sem arquivo local. A política atual está enforced/restricted e não inclui o domínio retornado da transferência. Não foi repetido o download, nem usado downloader alternativo, URL inventada, alteração de política/infra ou bypass.

A falha do helper não fornece código HTTP: causa exata não confirmada; indisponibilidade local confirmada. A inspeção visual e verificação de bytes/hash ficam pendentes. Nenhum código de produto alterado.
