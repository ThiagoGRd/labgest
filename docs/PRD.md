# PRD - LabGest: Sistema de Gestão para Laboratório de Prótese Dentária

**Versão:** 1.0  
**Data:** 05/02/2026  
**Autor:** Thiago Cruz + Pi (OpenClaw)

---

## 1. Visão Geral

### 1.1 Problema
Laboratórios de prótese dentária enfrentam dificuldades para:
- Gerenciar ordens de serviço de múltiplos dentistas
- Controlar etapas de produção e prazos
- Manter comunicação eficiente com clientes (dentistas)
- Gerenciar estoque de materiais
- Ter visibilidade sobre produtividade e faturamento
- Receber e organizar arquivos digitais (STL, ZIP)

### 1.2 Solução
**LabGest** é um sistema completo de gestão que:
- Centraliza ordens de serviço com workflow visual (Kanban)
- Oferece portal exclusivo para dentistas acompanharem seus casos
- Automatiza alertas e tarefas repetitivas com IA
- Gera relatórios inteligentes via linguagem natural
- Funciona em todas as plataformas (web, desktop, mobile)

### 1.3 Usuários-Alvo

| Persona | Descrição | Necessidades |
|---------|-----------|--------------|
| **Administrador do Lab** | Dono/gestor do laboratório | Visão geral, relatórios, financeiro, configurações |
| **Técnico/Protético** | Profissional de produção | Ver tarefas atribuídas, atualizar progresso, anexar arquivos |
| **Dentista (Cliente)** | Envia casos para o laboratório | Acompanhar status, enviar arquivos, histórico de pedidos |

---

## 2. Escopo do Produto

### 2.1 Funcionalidades Core (MVP)

#### 📋 Módulo de Ordens de Serviço
- CRUD completo de ordens
- Vinculação com cliente (dentista) e serviço
- Upload de arquivos STL/ZIP
- Campos específicos: cor dos dentes, material, marca, elementos dentais
- Status: Aguardando → Em Produção → Finalizado / Cancelado / Pausado
- Prioridade: Baixa, Normal, Alta, Urgente
- Observações e histórico de alterações

#### 🦷 Cadastro de Serviços
- Categorias de prótese:
  - Próteses Totais
  - Parciais Removíveis
  - Provisórios Unitários
  - Pontes Adesivas
  - Protocolo (Implantes)
- Preço base por serviço
- Tempo estimado de produção
- Materiais vinculados (consumo automático do estoque)
- Custo de materiais e margem de lucro

#### 👥 Cadastro de Clientes (Dentistas)
- Dados cadastrais (nome, telefone, email, endereço)
- CRO obrigatório
- Histórico de pedidos
- Totais: quantidade de pedidos, valor total
- Status ativo/inativo

#### 📦 Controle de Estoque
- Cadastro de materiais por categoria
- Quantidade atual e quantidade mínima (alerta)
- Unidade de medida
- Preço unitário
- Fornecedor
- Data de validade
- Código de barras
- Localização no laboratório

#### 📊 Kanban de Produção
- Board visual estilo Trello
- Colunas configuráveis por etapa de produção:
  1. Recebimento do arquivo STL
  2. Planejamento/CAD
  3. Impressão/Fresagem
  4. Acabamento
  5. Conferência
  6. Pronto para Entrega
- Drag & drop entre etapas
- Atribuição de técnico por tarefa
- Filtros: prioridade, dentista, data de entrega, técnico
- Indicadores visuais de atraso

#### 🌐 Portal do Dentista
- Login exclusivo para dentistas
- Dashboard com resumo de casos
- Lista de ordens com status em tempo real
- Envio de novos pedidos com upload de arquivos
- Histórico completo de pedidos
- Aprovação de projetos/mockups (quando aplicável)
- Notificações de atualização de status

#### 💰 Módulo Financeiro
- Contas a receber (vinculadas às ordens)
- Contas a pagar
- Status: Pendente, Recebido/Pago, Vencido, Cancelado
- Formas de pagamento
- Relatório de inadimplência

#### 📈 Relatórios
- Faturamento por período
- Produção por técnico
- Serviços mais realizados
- Clientes mais ativos
- Tempo médio de produção
- Estoque baixo
- Contas a vencer

---

### 2.2 Funcionalidades de IA

#### 🤖 Automações Inteligentes
| Automação | Trigger | Ação |
|-----------|---------|------|
| Alerta de prazo | Ordem a 24h da entrega + status não "Pronto" | Notificar técnico e admin |
| Alerta de estoque | Material abaixo do mínimo | Notificar admin |
| Sugestão de preço | Novo serviço cadastrado | Calcular baseado em custo + margem histórica |
| Detecção de atraso | Ordem passou do prazo | Marcar como "Atrasado", notificar |
| Cliente inativo | Dentista sem pedido há 60+ dias | Sugerir contato |
| Previsão de demanda | Histórico de pedidos | Sugerir reposição de estoque |

#### 💬 Relatórios Conversacionais
Perguntas em linguagem natural:
- "Qual foi o faturamento de janeiro?"
- "Quais ordens estão atrasadas?"
- "Qual dentista mais pediu protocolo no último trimestre?"
- "Quanto gastei em PMMA esse mês?"
- "Qual o tempo médio de produção de prótese total?"

#### 📊 Insights Automáticos
- Dashboard com cards de insights:
  - "Você tem 3 ordens atrasadas"
  - "Estoque de dentes A2 vai acabar em ~5 dias"
  - "Dr. João não faz pedidos há 45 dias"
  - "Produtividade aumentou 12% esse mês"

---

### 2.3 Funcionalidades Futuras (v2+)

- [ ] Integração WhatsApp (notificações automáticas)
- [ ] Integração com scanners intraorais (IOS Inbox)
- [ ] App mobile nativo (iOS/Android)
- [ ] Módulo de orçamentos com aprovação online
- [ ] Assinatura digital de documentos
- [ ] Integração com sistemas de nota fiscal
- [ ] Marketplace de materiais
- [ ] Backup automático de arquivos STL

---

## 3. Arquitetura Técnica

### 3.1 Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Frontend Web** | Next.js 14 (App Router) | SSR, API routes, PWA ready |
| **Frontend Mobile** | PWA (mesmo Next.js) | Código único, funciona offline |
| **Desktop** | Tauri ou Electron | Wrapper do app web |
| **Backend** | Next.js API Routes + Supabase | Já usa Supabase, manter ecossistema |
| **Banco de Dados** | PostgreSQL (Supabase) | Já em uso, robusto |
| **ORM** | Prisma | Type-safe, migrations |
| **Autenticação** | Supabase Auth | Já configurado |
| **Storage** | Supabase Storage | Arquivos STL/ZIP |
| **IA** | OpenAI API (GPT-4) | Relatórios conversacionais |
| **Realtime** | Supabase Realtime | Atualizações do Kanban |
| **UI** | shadcn/ui + Tailwind | Componentes modernos |

### 3.2 Estrutura do Projeto

```
labgest/
├── apps/
│   ├── web/                    # App principal do laboratório
│   │   ├── app/
│   │   │   ├── (auth)/         # Login, registro
│   │   │   ├── (dashboard)/    # Área logada
│   │   │   │   ├── ordens/
│   │   │   │   ├── clientes/
│   │   │   │   ├── servicos/
│   │   │   │   ├── estoque/
│   │   │   │   ├── producao/   # Kanban
│   │   │   │   ├── financeiro/
│   │   │   │   ├── relatorios/
│   │   │   │   └── configuracoes/
│   │   │   └── api/
│   │   │       ├── ordens/
│   │   │       ├── clientes/
│   │   │       ├── ai/         # Endpoints de IA
│   │   │       └── webhooks/
│   │   └── components/
│   │
│   └── portal/                 # Portal do Dentista
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   │   ├── pedidos/
│       │   │   ├── novo-pedido/
│       │   │   ├── arquivos/
│       │   │   └── perfil/
│       │   └── api/
│       └── components/
│
├── packages/
│   ├── database/               # Prisma schema compartilhado
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       └── client.ts
│   │
│   ├── ai/                     # Engine de IA
│   │   ├── automations/        # Regras de automação
│   │   ├── reports/            # Gerador de relatórios
│   │   └── insights/           # Análise de dados
│   │
│   └── shared/                 # Código compartilhado
│       ├── types/
│       ├── utils/
│       └── constants/
│
├── supabase/
│   ├── functions/              # Edge functions
│   └── migrations/             # SQL migrations (backup)
│
└── docs/
    ├── PRD.md                  # Este documento
    ├── DATABASE.md             # Documentação do banco
    └── API.md                  # Documentação da API
```

### 3.3 Modelo de Dados (Extensão)

#### Novas Tabelas

```sql
-- Autenticação de dentistas (separada de usuários internos)
CREATE TABLE dentistas_portal (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Etapas de produção configuráveis
CREATE TABLE etapas_producao (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ordem INTEGER NOT NULL,
  cor VARCHAR(7), -- Hex color
  ativo BOOLEAN DEFAULT true
);

-- Atribuição de ordens a técnicos
CREATE TABLE atribuicoes (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  etapa_id INTEGER REFERENCES etapas_producao(id),
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pendente'
);

-- Histórico de alterações (timeline)
CREATE TABLE historico_ordens (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  acao VARCHAR(50) NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mensagens/Comunicação por ordem
CREATE TABLE mensagens_ordem (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id),
  autor_tipo VARCHAR(20) NOT NULL, -- 'laboratorio' ou 'dentista'
  autor_id INTEGER NOT NULL,
  mensagem TEXT NOT NULL,
  anexos JSONB DEFAULT '[]',
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automações configuradas
CREATE TABLE automacoes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL,
  acao_config JSONB NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ultima_execucao TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log de execuções de IA
CREATE TABLE logs_ia (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL, -- 'relatorio', 'automacao', 'insight'
  input TEXT,
  output TEXT,
  tokens_usados INTEGER,
  tempo_ms INTEGER,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alertas gerados pelo sistema
CREATE TABLE alertas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  entidade_tipo VARCHAR(50), -- 'ordem', 'estoque', 'cliente'
  entidade_id INTEGER,
  usuario_id INTEGER REFERENCES usuarios(id),
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Arquivos (storage reference)
CREATE TABLE arquivos (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'stl', 'zip', 'foto', 'documento'
  tamanho_bytes BIGINT,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by_tipo VARCHAR(20), -- 'laboratorio' ou 'dentista'
  uploaded_by_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Interface do Usuário

### 4.1 App Principal (Laboratório)

#### Telas Principais

1. **Dashboard**
   - Cards de resumo (ordens hoje, atrasadas, faturamento)
   - Gráfico de produção semanal
   - Alertas e insights da IA
   - Atalhos rápidos

2. **Ordens de Serviço**
   - Listagem com filtros avançados
   - Formulário de criação/edição
   - Detalhes com timeline de histórico
   - Upload de arquivos

3. **Kanban de Produção**
   - Board com colunas por etapa
   - Cards de ordem com info resumida
   - Drag & drop
   - Filtros por técnico, prioridade, prazo

4. **Clientes**
   - Listagem com busca
   - Ficha do cliente com histórico
   - Métricas por cliente

5. **Estoque**
   - Listagem por categoria
   - Alertas de estoque baixo
   - Movimentações

6. **Financeiro**
   - Contas a receber/pagar
   - Calendário de vencimentos
   - Relatório de inadimplência

7. **Relatórios**
   - Chat com IA para perguntas
   - Relatórios pré-configurados
   - Exportação PDF/Excel

8. **Configurações**
   - Etapas de produção
   - Automações
   - Usuários e permissões
   - Dados do laboratório

### 4.2 Portal do Dentista

#### Telas

1. **Dashboard**
   - Resumo de pedidos ativos
   - Últimas atualizações

2. **Meus Pedidos**
   - Lista de ordens com status
   - Detalhes do pedido
   - Timeline de progresso

3. **Novo Pedido**
   - Wizard step-by-step
   - Upload de arquivos
   - Seleção de serviço
   - Informações do paciente

4. **Histórico**
   - Todos os pedidos finalizados
   - Filtros por período

5. **Perfil**
   - Dados cadastrais
   - Alterar senha

---

## 5. Requisitos Não-Funcionais

### 5.1 Performance
- Tempo de carregamento inicial < 3s
- Interações < 100ms
- Suporte a 100+ ordens simultâneas no Kanban

### 5.2 Segurança
- Autenticação JWT via Supabase
- Row Level Security (RLS) no banco
- HTTPS obrigatório
- Senhas com bcrypt
- Rate limiting nas APIs
- Backup diário automático

### 5.3 Disponibilidade
- Uptime 99.5%
- Failover automático (Supabase managed)

### 5.4 Escalabilidade
- Arquitetura serverless (Vercel + Supabase)
- CDN para assets estáticos
- Lazy loading de componentes

### 5.5 Acessibilidade
- WCAG 2.1 AA
- Navegação por teclado
- Labels em formulários
- Contraste adequado

### 5.6 Responsividade
- Mobile-first design
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch-friendly no mobile

---

## 6. Métricas de Sucesso

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Adoção do Portal | 80% dos dentistas ativos usando | Logins únicos / Total dentistas |
| Redução de tempo | -30% tempo gasto com gestão | Survey antes/depois |
| Precisão de prazos | 95% ordens entregues no prazo | Ordens no prazo / Total |
| Uso da IA | 50+ perguntas/mês | Logs de relatórios |
| Satisfação | NPS > 8 | Survey periódico |

---

## 7. Cronograma Estimado

### Fase 1: Fundação (2 semanas)
- [ ] Setup do projeto (monorepo, configs)
- [ ] Migrações do banco de dados
- [ ] Autenticação (lab + portal)
- [ ] Layout base e componentes UI

### Fase 2: Core Features (3 semanas)
- [ ] CRUD Ordens de Serviço
- [ ] CRUD Clientes
- [ ] CRUD Serviços
- [ ] CRUD Estoque
- [ ] Upload de arquivos

### Fase 3: Produção (2 semanas)
- [ ] Kanban de produção
- [ ] Atribuição de técnicos
- [ ] Timeline/histórico
- [ ] Notificações internas

### Fase 4: Portal do Dentista (2 semanas)
- [ ] Autenticação dentista
- [ ] Dashboard dentista
- [ ] Novo pedido (wizard)
- [ ] Acompanhamento de status

### Fase 5: IA e Automações (2 semanas)
- [ ] Engine de automações
- [ ] Relatórios conversacionais
- [ ] Alertas inteligentes
- [ ] Insights no dashboard

### Fase 6: Financeiro e Relatórios (1 semana)
- [ ] Contas a receber/pagar
- [ ] Relatórios pré-configurados
- [ ] Exportação

### Fase 7: Polish e Deploy (1 semana)
- [ ] Testes E2E
- [ ] Otimizações
- [ ] Documentação
- [ ] Deploy produção

**Total estimado: 13 semanas**

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migração de dados falha | Média | Alto | Scripts de migração testados, rollback plan |
| Dentistas não adotam portal | Média | Médio | Onboarding guiado, incentivos |
| Custos de IA elevados | Baixa | Médio | Cache de respostas, limites de uso |
| Performance do Kanban | Baixa | Alto | Virtualização, paginação |

---

## 9. Glossário

| Termo | Definição |
|-------|-----------|
| **Ordem de Serviço (OS)** | Pedido de um dentista para produção de prótese |
| **STL** | Formato de arquivo 3D para impressão/fresagem |
| **CRO** | Conselho Regional de Odontologia (registro do dentista) |
| **Protocolo** | Prótese fixa sobre implantes |
| **PMMA** | Polimetilmetacrilato (material para próteses) |
| **IOS** | Intraoral Scanner (escâner intraoral) |

---

## 10. Aprovações

| Nome | Papel | Data | Assinatura |
|------|-------|------|------------|
| Thiago Cruz | Product Owner | ___/___/2026 | __________ |

---

*Documento gerado por Pi (OpenClaw) em 05/02/2026*
