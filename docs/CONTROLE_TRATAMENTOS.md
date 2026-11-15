# Controle de tratamentos

Página `/tratamentos` (somente administradores). Mostra, para cada protocolo,
prótese total e parcial removível, quantas consultas e quantos dias o tratamento
já consumiu, com quem o trabalho ficou (laboratório, clínica ou fornecedor) e
avisa o gestor quando um limite é atingido.

## De onde vêm os dados

| Informação | Fonte |
| --- | --- |
| Consultas (data, profissional, categoria, observações, comparecimento) | Agenda do Clinicorp (`/appointment/list`), somente leitura |
| Dias em aberto | Data do pedido da ordem no LabGest |
| Tempo com laboratório / clínica / fornecedor | Movimentações já registradas na ordem (`enviou_recepcao`, `recebeu_laboratorio`, `enviado_fornecedor`, `recebeu_fornecedor`) |
| Provas e pedidos de ajuste | Ciclos de produção |

As consultas são ligadas à ordem pelo **nome do paciente** (sem acentos e
maiúsculas). Quando o cadastro do Clinicorp difere, o gestor informa o nome
correto no próprio cartão do tratamento; a sincronização sugere nomes parecidos.
Só são guardadas consultas de pacientes com prótese em acompanhamento.

## Regras

- Consultas previstas = número de etapas clínicas do fluxo da prótese.
- Padrão: **atenção** em previstas + 1 e **crítico** em previstas + 2
  (protocolo definitivo: atenção na 4ª, crítico na 5ª). Prazos e consultas são
  editáveis por tipo no botão de ajustes da página.
- Contam as consultas com comparecimento e as passadas sem marcação de falta.
  Faltas do paciente e categorias fora de prótese (avaliação, clareamento,
  retorno de 6 meses etc.) não contam; o gestor pode corrigir consulta a consulta.
- Cada alerta nasce uma única vez por ordem e fica aberto até o gestor dar
  ciência ou o tratamento ser concluído.

## Configuração

1. Aplicar `packages/database/prisma/migrations/013_controle_tratamentos.sql`
   (apenas tabelas novas).
2. Variáveis de ambiente do projeto `web` na Vercel:
   - `CLINICORP_URL`, `CLINICORP_SUBSCRIBER`, `CLINICORP_AUTH` — os mesmos valores
     usados pelo CRM ClinPrime (`platform_settings`).
   - `CRON_SECRET` — protege a sincronização diária (`/api/cron/clinicorp-sync`, 06h de Maceió).
   - `GESTOR_WHATSAPP` (opcional) — número que recebe os novos alertas pela
     Evolution API já usada pelo LabGest (`EVOLUTION_*`).

Sem as credenciais do Clinicorp a página funciona só com o controle de prazo.
