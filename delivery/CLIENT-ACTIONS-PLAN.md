# Clientes — três ações existentes

Base exata 8eddf522d82486cda8c32d97ff19abf67ec2eebc. Branch ui/client-actions, worktree /workspace/labgest-client-actions. Inspeção confirmou Eye/Edit/Download sem onClick e ausência de updateCliente. Nenhum AGENTS/skill local relevante disponível; seguir TDD e verificação antes de conclusão.

Plano: reproduzir clicks reais no browser antes de editar produto; adicionar testes vermelhos da ação update e CSV; implementar mínimo em view/modal já existente, action autenticada e utilitário específico; repetir testes, typecheck/lint e suítes pertinentes; revisar capturas apenas locais; entregar patch incremental em nova Library.

Campos de edição: nome (1–255), telefone (1–20), CRO (1–50), endereço opcional textual (sem limite novo, conforme schema). Trim nas extremidades; strings e ID inteiro positivo seguro obrigatórios. Dados extras serão rejeitados; nenhuma gravação por spread de entrada. Email não editável: ele associa cliente ao Auth do portal por email; alterá-lo excederia a proibição de mudar acesso. Status, IDs, observações, ordens, financeiro e relações fora da whitelist. requireUser antes de qualquer acesso. Erro de validação/persistência explícito; falha não altera lista. Não modificar createCliente ou regras existentes.

Visualizar: somente dados já carregados da lista, Modal real acessível, sem consulta nova ou notas privadas. Editar: reutilizar NovoClienteModal com modo edição, estado isolado por abertura/cliente; sucesso atualiza os campos na lista sem perder busca/showInactive; pendência impede duplicação/fechamento; erro permite tentar novamente; voltar foco a controle visível quando possível.

CSV: convenção encontrada em estoque-view (Blob local, UTF-8 BOM, separador ponto e vírgula, aspas duplicadas). Proposta mínima registrada antes do código: Nome, CRO, Telefone, Email, Endereço, Situação. Somente filteredClientes no instante do clique; label informa escopo/quantidade; vazio não baixa arquivo. Excluir ID, observações, totais, pacientes e OS. Neutralizar prefixos de fórmula (=,+,-,@ com espaços/controles iniciais), preservar acentos/aspas/quebras/separador. Sem chamadas externas.

Checks: servidor com Prisma/auth simulados (auth antes do acesso, whitelist, ID e campos inválidos, falha/exceção, nenhum vazamento de erro); CSV casos extremos; browser 1280/390 com componentes/CSS reais, visualização/fechamento/foco, alternância, cancelar, pendente/clique repetido, falha/exceção, sucesso com filtro, criação existente, download por spy local, vazio/status. Login/Next/RSC/banco reais não serão alegados. Dependências Linux e Prisma offline existentes; nenhum env/segredo/download Prisma/referência HTML.

Investigação local confirmou email+ativo no login/Perfil/pedidos do portal, clienteId nas relações e CRO apenas como cadastro/metadata, sem chave de acesso; requireUser rejeita recepcao por padrão. Sem sincronização de nome/CRO em Auth.
