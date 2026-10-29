# Recepção e distribuição

Fluxo recuperado do commit `ae8077b76135945bc69f9e47b8e122afdab6447d`
(30/07/2026), da branch `agent/estoque-hydration`. Esse commit não faz parte
da história de `main`; a tela não havia sido incorporada à versão principal.

O menu **Recepção** abre `/recepcao`. O painel mostra trabalhos aguardando
recebimento, na recepção, com dentistas e retornando ao laboratório. Permite
confirmar recebimento, distribuir ao dentista com finalidade e agendamento,
receber de volta e registrar o retorno ao laboratório. Provas sem resposta
do dentista não podem ser enviadas de volta pelo painel.

O perfil `recepcao` entra diretamente nessa tela e tem acesso restrito a ela.
Administradores e operadores também podem utilizar o painel. Os envios para
prova no fluxo de produção alimentam a fila de recebimento.

## Publicação

1. Aplicar `packages/database/prisma/migrations/012_fluxo_recepcao.sql` no
   banco correto antes de disponibilizar a aplicação. O SQL adiciona seis
   colunas e um índice, com verificações de existência; não remove dados.
   Ele usa o padrão de migrações SQL manuais já existente neste repositório.
2. Gerar o cliente com `npm run db:generate` e executar `npm run build:web`.
3. Publicar a versão que contém a restauração.
4. Com um administrador/operador autenticado, verificar o item Recepção e
   acompanhar uma ordem de prova pelo recebimento, distribuição e retorno.
   Verificar também o redirecionamento e a restrição do perfil `recepcao`.

A restauração não executa a migração nem modifica contas ou dados em produção.
Na validação local, o lint web e os 29 testes existentes passaram. A geração
Prisma foi bloqueada por HTTP 403 ao baixar o checksum em `binaries.prisma.sh`;
o build e o fluxo autenticado com banco não foram validados.
