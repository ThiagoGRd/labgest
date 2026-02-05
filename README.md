# LabGest 🦷

Sistema completo de gestão para laboratórios de prótese dentária.

## 🚀 Funcionalidades

### App Principal (Laboratório)
- **Dashboard** - Visão geral com métricas e insights de IA
- **Ordens de Serviço** - CRUD completo com filtros avançados
- **Produção (Kanban)** - Board visual drag & drop por etapas
- **Clientes** - Cadastro de dentistas com histórico
- **Serviços** - Catálogo com preços e custos
- **Estoque** - Controle de materiais com alertas
- **Financeiro** - Contas a receber/pagar
- **Relatórios IA** - Chat para perguntas em linguagem natural

### Portal do Dentista
- Dashboard pessoal
- Acompanhamento de pedidos
- Envio de novos pedidos com upload de arquivos
- Histórico completo

## 🛠️ Stack Tecnológica

- **Frontend**: Next.js 16, React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (arquivos STL/ZIP)
- **IA**: OpenAI API (relatórios conversacionais)

## 📁 Estrutura do Projeto

```
labgest/
├── web/                    # App principal (laboratório)
├── portal/                 # Portal do dentista
├── packages/
│   ├── database/          # Prisma schema compartilhado
│   ├── shared/            # Types, utils, constants
│   └── ai/                # Engine de automações e IA
└── docs/                  # Documentação
    ├── PRD.md             # Product Requirements Document
    └── DATABASE.md        # Documentação do banco
```

## 🏃‍♂️ Rodando Localmente

### Pré-requisitos
- Node.js 18+
- npm ou pnpm

### Setup

```bash
# Clonar e instalar
cd labgest
npm install

# Configurar ambiente
cp web/.env.local.example web/.env.local
# Editar com suas credenciais Supabase

# Gerar cliente Prisma
npm run db:generate

# Rodar migrações
npm run db:push

# Iniciar app web
npm run dev:web

# Ou iniciar ambos (web + portal)
npm run dev:all
```

### Acessos

- **App Web**: http://localhost:3000
- **Portal Dentista**: http://localhost:3001
- **Prisma Studio**: `npm run db:studio`

### Credenciais de Teste

```
Email: admin@labgest.com
Senha: 123456
```

## 📊 Comandos Úteis

```bash
# Desenvolvimento
npm run dev:web          # App principal
npm run dev:portal       # Portal dentista
npm run dev:all          # Ambos

# Database
npm run db:generate      # Gerar cliente Prisma
npm run db:push          # Push schema para o banco
npm run db:migrate       # Rodar migrações
npm run db:studio        # Abrir Prisma Studio

# Build
npm run build            # Build de produção
npm run lint             # Linting
```

## 🔐 Variáveis de Ambiente

### Web (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=
DIRECT_URL=

# OpenAI (para relatórios IA)
OPENAI_API_KEY=
```

## 📱 Screenshots

> *Em breve*

## 🗓️ Roadmap

- [x] Setup inicial do projeto
- [x] PRD e documentação do banco
- [x] Dashboard
- [x] Ordens de Serviço
- [x] Kanban de Produção
- [x] Clientes
- [x] Serviços
- [x] Estoque
- [x] Relatórios com IA
- [x] Login
- [ ] Portal do Dentista
- [ ] Integração real com banco
- [ ] Upload de arquivos STL
- [ ] Automações (alertas, notificações)
- [ ] Módulo financeiro completo
- [ ] Integração WhatsApp

## 📄 Licença

Privado - Uso exclusivo do laboratório.

---

Desenvolvido com 💜 por Pi (OpenClaw) para Thiago Cruz
