# DATABASE.md - Documentação do Banco de Dados

## Visão Geral

O LabGest utiliza PostgreSQL hospedado no Supabase. O banco mantém compatibilidade com a estrutura existente e adiciona novas tabelas para funcionalidades avançadas.

---

## Tabelas Existentes (Migradas)

### `clientes`
Cadastro de dentistas que enviam pedidos ao laboratório.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| nome | VARCHAR(255) | Nome completo |
| telefone | VARCHAR(20) | Telefone de contato |
| email | VARCHAR(255) | Email |
| endereco | TEXT | Endereço completo |
| dentista | VARCHAR(255) | Nome do dentista (se diferente) |
| cro | VARCHAR(50) | Registro no CRO |
| data_cadastro | DATE | Data do cadastro |
| ativo | BOOLEAN | Status ativo/inativo |
| observacoes | TEXT | Observações gerais |
| total_pedidos | INTEGER | Total de pedidos (calculado) |
| valor_total | DECIMAL(10,2) | Valor total (calculado) |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

### `servicos`
Catálogo de serviços oferecidos pelo laboratório.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| nome | VARCHAR(255) | Nome do serviço |
| descricao | TEXT | Descrição detalhada |
| preco | DECIMAL(10,2) | Preço base |
| tempo_producao | INTEGER | Tempo estimado (dias) |
| categoria | VARCHAR(100) | Categoria do serviço |
| materiais | JSONB | Lista de materiais necessários |
| custo_materiais | DECIMAL(10,2) | Custo estimado de materiais |
| margem_lucro | DECIMAL(5,2) | Margem de lucro % |
| ativo | BOOLEAN | Status ativo/inativo |
| data_criacao | DATE | Data de criação |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

**Categorias padrão:**
- Prótese Total
- Parcial Removível
- Provisório Unitário
- Ponte Adesiva
- Protocolo

### `ordens`
Ordens de serviço (pedidos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| cliente_id | INTEGER FK | Referência ao cliente |
| cliente_nome | VARCHAR(255) | Nome do cliente (desnormalizado) |
| servico_id | INTEGER FK | Referência ao serviço |
| servico_nome | VARCHAR(255) | Nome do serviço (desnormalizado) |
| nome_paciente | VARCHAR(255) | Nome do paciente |
| data_pedido | DATE | Data do pedido |
| data_entrega | DATE | Data prevista de entrega |
| data_finalizacao | DATE | Data real de finalização |
| status | VARCHAR(20) | Status atual |
| valor | DECIMAL(10,2) | Valor bruto |
| valor_final | DECIMAL(10,2) | Valor com desconto |
| desconto | DECIMAL(10,2) | Valor do desconto |
| observacoes | TEXT | Observações |
| cor_dentes | VARCHAR(50) | Cor dos dentes |
| material | VARCHAR(100) | Material utilizado |
| marca_dentes | VARCHAR(100) | Marca dos dentes |
| prioridade | VARCHAR(20) | Nível de prioridade |
| etapa_atual | VARCHAR(255) | Etapa atual de produção |
| etapas_completas | TEXT[] | Array de etapas concluídas |
| progresso | INTEGER | Progresso 0-100% |
| arquivo_stl | JSONB | Metadados dos arquivos |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

**Status possíveis:** Aguardando, Em Produção, Finalizado, Cancelado, Pausado  
**Prioridades:** Baixa, Normal, Alta, Urgente

### `itens_ordem`
Itens detalhados de cada ordem (múltiplos serviços por ordem).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGSERIAL PK | Identificador único |
| ordem_id | BIGINT FK | Referência à ordem |
| servico_id | BIGINT FK | Referência ao serviço |
| quantidade | INTEGER | Quantidade |
| valor_unitario | DECIMAL(10,2) | Valor unitário |
| valor_total | DECIMAL(10,2) | Valor total do item |
| elementos_dentais | JSONB | Elementos dentais envolvidos |
| especificacao_protese | JSONB | Especificações técnicas |
| observacoes | TEXT | Observações do item |
| created_at | TIMESTAMP | Criação do registro |

### `estoque`
Controle de materiais e insumos.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| nome | VARCHAR(255) | Nome do material |
| categoria | VARCHAR(100) | Categoria |
| quantidade | DECIMAL(10,3) | Quantidade atual |
| quantidade_minima | DECIMAL(10,3) | Quantidade mínima (alerta) |
| unidade | VARCHAR(10) | Unidade de medida |
| preco_unitario | DECIMAL(10,2) | Preço unitário |
| fornecedor | VARCHAR(255) | Fornecedor |
| localizacao | VARCHAR(255) | Localização no lab |
| data_validade | DATE | Data de validade |
| codigo_barras | VARCHAR(100) | Código de barras |
| data_cadastro | DATE | Data do cadastro |
| ativo | BOOLEAN | Status ativo/inativo |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

### `usuarios`
Usuários internos do laboratório.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| nome | VARCHAR(255) | Nome completo |
| email | VARCHAR(255) | Email (único) |
| senha | VARCHAR(255) | Senha hash |
| tipo | VARCHAR(20) | Tipo de usuário |
| ativo | BOOLEAN | Status ativo/inativo |
| data_criacao | TIMESTAMP | Data de criação |
| ultimo_acesso | TIMESTAMP | Último acesso |
| permissoes | TEXT[] | Lista de permissões |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

**Tipos:** admin, operador, visualizador

### `contas_receber`
Contas a receber (financeiro).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | Identificador único |
| descricao | VARCHAR(255) | Descrição |
| cliente_id | INTEGER FK | Referência ao cliente |
| cliente_nome | VARCHAR(255) | Nome do cliente |
| ordem_id | INTEGER FK | Referência à ordem |
| valor | DECIMAL(10,2) | Valor |
| data_vencimento | DATE | Data de vencimento |
| data_recebimento | DATE | Data do recebimento |
| status | VARCHAR(20) | Status |
| observacoes | TEXT | Observações |
| forma_recebimento | VARCHAR(100) | Forma de pagamento |
| data_criacao | DATE | Data de criação |
| usuario_id | INTEGER FK | Usuário responsável |
| created_at | TIMESTAMP | Criação do registro |
| updated_at | TIMESTAMP | Última atualização |

**Status:** Pendente, Recebido, Vencido, Cancelado

### `contas_pagar`
Contas a pagar (financeiro).

### `notificacoes`
Notificações internas do sistema.

### `configuracoes`
Configurações gerais do sistema.

---

## Novas Tabelas (v2)

### `dentistas_portal`
Autenticação de dentistas no portal.

```sql
CREATE TABLE dentistas_portal (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  token_reset VARCHAR(255),
  token_reset_expira TIMESTAMP,
  ativo BOOLEAN DEFAULT true,
  email_verificado BOOLEAN DEFAULT false,
  ultimo_acesso TIMESTAMP,
  tentativas_login INTEGER DEFAULT 0,
  bloqueado_ate TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dentistas_portal_cliente ON dentistas_portal(cliente_id);
CREATE INDEX idx_dentistas_portal_email ON dentistas_portal(email);
```

### `etapas_producao`
Etapas configuráveis do workflow de produção.

```sql
CREATE TABLE etapas_producao (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL,
  cor VARCHAR(7) DEFAULT '#6366f1',
  icone VARCHAR(50),
  tempo_estimado_horas INTEGER,
  notificar_dentista BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais
INSERT INTO etapas_producao (nome, ordem, cor) VALUES
  ('Recebimento', 1, '#6366f1'),
  ('Planejamento/CAD', 2, '#8b5cf6'),
  ('Impressão/Fresagem', 3, '#a855f7'),
  ('Acabamento', 4, '#d946ef'),
  ('Conferência', 5, '#ec4899'),
  ('Pronto para Entrega', 6, '#22c55e');
```

### `atribuicoes`
Atribuição de ordens/etapas a técnicos.

```sql
CREATE TABLE atribuicoes (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  etapa_id INTEGER REFERENCES etapas_producao(id) ON DELETE SET NULL,
  data_atribuicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  tempo_gasto_minutos INTEGER,
  status VARCHAR(20) DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_atribuicoes_ordem ON atribuicoes(ordem_id);
CREATE INDEX idx_atribuicoes_usuario ON atribuicoes(usuario_id);
CREATE INDEX idx_atribuicoes_status ON atribuicoes(status);
```

### `historico_ordens`
Histórico de alterações para timeline.

```sql
CREATE TABLE historico_ordens (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nome VARCHAR(255),
  acao VARCHAR(50) NOT NULL,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_historico_ordem ON historico_ordens(ordem_id);
CREATE INDEX idx_historico_created ON historico_ordens(created_at);
```

### `mensagens_ordem`
Chat/comunicação por ordem.

```sql
CREATE TABLE mensagens_ordem (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id) ON DELETE CASCADE,
  autor_tipo VARCHAR(20) NOT NULL CHECK (autor_tipo IN ('laboratorio', 'dentista')),
  autor_id INTEGER NOT NULL,
  autor_nome VARCHAR(255),
  mensagem TEXT NOT NULL,
  anexos JSONB DEFAULT '[]',
  lida BOOLEAN DEFAULT false,
  lida_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mensagens_ordem ON mensagens_ordem(ordem_id);
CREATE INDEX idx_mensagens_lida ON mensagens_ordem(lida) WHERE lida = false;
```

### `arquivos`
Referência de arquivos no storage.

```sql
CREATE TABLE arquivos (
  id SERIAL PRIMARY KEY,
  ordem_id INTEGER REFERENCES ordens(id) ON DELETE CASCADE,
  nome_original VARCHAR(255) NOT NULL,
  nome_storage VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100),
  tamanho_bytes BIGINT,
  storage_bucket VARCHAR(100) DEFAULT 'ordens',
  storage_path VARCHAR(500) NOT NULL,
  url_publica TEXT,
  uploaded_by_tipo VARCHAR(20),
  uploaded_by_id INTEGER,
  uploaded_by_nome VARCHAR(255),
  checksum_md5 VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_arquivos_ordem ON arquivos(ordem_id);
CREATE INDEX idx_arquivos_tipo ON arquivos(tipo);
```

### `automacoes`
Configuração de automações.

```sql
CREATE TABLE automacoes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL,
  trigger_evento VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  acao_tipo VARCHAR(50) NOT NULL,
  acao_config JSONB NOT NULL DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  ultima_execucao TIMESTAMP,
  total_execucoes INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Automações padrão
INSERT INTO automacoes (nome, tipo, trigger_evento, trigger_config, acao_tipo, acao_config) VALUES
  ('Alerta de prazo', 'alerta', 'cron', '{"schedule": "0 8 * * *"}', 'notificacao', '{"dias_antes": 1}'),
  ('Estoque baixo', 'alerta', 'estoque_update', '{}', 'notificacao', '{}'),
  ('Notificar dentista', 'notificacao', 'status_change', '{"status": "Finalizado"}', 'email', '{}');
```

### `execucoes_automacao`
Log de execução de automações.

```sql
CREATE TABLE execucoes_automacao (
  id SERIAL PRIMARY KEY,
  automacao_id INTEGER REFERENCES automacoes(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  resultado JSONB,
  erro TEXT,
  tempo_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_execucoes_automacao ON execucoes_automacao(automacao_id);
```

### `logs_ia`
Log de uso da IA.

```sql
CREATE TABLE logs_ia (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  input TEXT,
  output TEXT,
  modelo VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  custo_usd DECIMAL(10,6),
  tempo_ms INTEGER,
  sucesso BOOLEAN DEFAULT true,
  erro TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_ia_tipo ON logs_ia(tipo);
CREATE INDEX idx_logs_ia_usuario ON logs_ia(usuario_id);
CREATE INDEX idx_logs_ia_created ON logs_ia(created_at);
```

### `alertas`
Alertas gerados pelo sistema.

```sql
CREATE TABLE alertas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  severidade VARCHAR(20) DEFAULT 'info',
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  entidade_tipo VARCHAR(50),
  entidade_id INTEGER,
  link VARCHAR(500),
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  lido BOOLEAN DEFAULT false,
  lido_em TIMESTAMP,
  dispensado BOOLEAN DEFAULT false,
  expira_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alertas_usuario ON alertas(usuario_id);
CREATE INDEX idx_alertas_lido ON alertas(lido) WHERE lido = false;
CREATE INDEX idx_alertas_tipo ON alertas(tipo);
```

### `relatorios_salvos`
Relatórios salvos/favoritos.

```sql
CREATE TABLE relatorios_salvos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL,
  query_natural TEXT,
  filtros JSONB DEFAULT '{}',
  colunas JSONB DEFAULT '[]',
  ordenacao JSONB,
  publico BOOLEAN DEFAULT false,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Views Úteis

### `v_ordens_completas`
View com dados completos das ordens.

```sql
CREATE OR REPLACE VIEW v_ordens_completas AS
SELECT 
  o.*,
  c.telefone as cliente_telefone,
  c.email as cliente_email,
  c.cro as cliente_cro,
  s.categoria as servico_categoria,
  s.tempo_producao as servico_tempo_estimado,
  CASE 
    WHEN o.data_entrega < CURRENT_DATE AND o.status NOT IN ('Finalizado', 'Cancelado') 
    THEN true 
    ELSE false 
  END as atrasado,
  o.data_entrega - CURRENT_DATE as dias_para_entrega
FROM ordens o
LEFT JOIN clientes c ON o.cliente_id = c.id
LEFT JOIN servicos s ON o.servico_id = s.id;
```

### `v_estoque_alertas`
View de itens com estoque baixo.

```sql
CREATE OR REPLACE VIEW v_estoque_alertas AS
SELECT *,
  quantidade - quantidade_minima as diferenca,
  CASE 
    WHEN quantidade <= 0 THEN 'critico'
    WHEN quantidade <= quantidade_minima THEN 'baixo'
    WHEN quantidade <= quantidade_minima * 1.5 THEN 'atencao'
    ELSE 'ok'
  END as nivel_alerta
FROM estoque
WHERE ativo = true
ORDER BY nivel_alerta DESC, quantidade ASC;
```

### `v_dashboard_resumo`
View para o dashboard.

```sql
CREATE OR REPLACE VIEW v_dashboard_resumo AS
SELECT
  (SELECT COUNT(*) FROM ordens WHERE status = 'Aguardando') as aguardando,
  (SELECT COUNT(*) FROM ordens WHERE status = 'Em Produção') as em_producao,
  (SELECT COUNT(*) FROM ordens WHERE data_entrega < CURRENT_DATE AND status NOT IN ('Finalizado', 'Cancelado')) as atrasadas,
  (SELECT COUNT(*) FROM ordens WHERE data_entrega = CURRENT_DATE AND status NOT IN ('Finalizado', 'Cancelado')) as para_hoje,
  (SELECT COALESCE(SUM(valor_final), 0) FROM ordens WHERE data_finalizacao >= date_trunc('month', CURRENT_DATE)) as faturamento_mes,
  (SELECT COUNT(*) FROM estoque WHERE quantidade <= quantidade_minima AND ativo = true) as estoque_baixo;
```

---

## Funções e Triggers

### Atualizar updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';
```

### Atualizar totais do cliente
```sql
CREATE OR REPLACE FUNCTION atualizar_totais_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE clientes SET
      total_pedidos = (SELECT COUNT(*) FROM ordens WHERE cliente_id = OLD.cliente_id),
      valor_total = (SELECT COALESCE(SUM(valor_final), 0) FROM ordens WHERE cliente_id = OLD.cliente_id)
    WHERE id = OLD.cliente_id;
    RETURN OLD;
  ELSE
    UPDATE clientes SET
      total_pedidos = (SELECT COUNT(*) FROM ordens WHERE cliente_id = NEW.cliente_id),
      valor_total = (SELECT COALESCE(SUM(valor_final), 0) FROM ordens WHERE cliente_id = NEW.cliente_id)
    WHERE id = NEW.cliente_id;
    RETURN NEW;
  END IF;
END;
$$ language 'plpgsql';
```

### Registrar histórico de ordem
```sql
CREATE OR REPLACE FUNCTION registrar_historico_ordem()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status OR OLD.etapa_atual != NEW.etapa_atual THEN
      INSERT INTO historico_ordens (ordem_id, acao, dados_anteriores, dados_novos)
      VALUES (
        NEW.id,
        CASE 
          WHEN OLD.status != NEW.status THEN 'status_alterado'
          ELSE 'etapa_alterada'
        END,
        jsonb_build_object('status', OLD.status, 'etapa', OLD.etapa_atual),
        jsonb_build_object('status', NEW.status, 'etapa', NEW.etapa_atual)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_historico_ordem
AFTER UPDATE ON ordens
FOR EACH ROW EXECUTE FUNCTION registrar_historico_ordem();
```

---

## Row Level Security (RLS)

### Políticas para o Portal do Dentista

```sql
-- Habilitar RLS
ALTER TABLE ordens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_ordem ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos ENABLE ROW LEVEL SECURITY;

-- Política: Dentista só vê suas ordens
CREATE POLICY dentista_ordens ON ordens
  FOR SELECT
  USING (
    cliente_id IN (
      SELECT cliente_id FROM dentistas_portal 
      WHERE id = auth.uid()::integer
    )
  );

-- Política: Dentista só vê mensagens de suas ordens
CREATE POLICY dentista_mensagens ON mensagens_ordem
  FOR ALL
  USING (
    ordem_id IN (
      SELECT o.id FROM ordens o
      JOIN dentistas_portal dp ON o.cliente_id = dp.cliente_id
      WHERE dp.id = auth.uid()::integer
    )
  );
```

---

## Índices de Performance

```sql
-- Ordens
CREATE INDEX CONCURRENTLY idx_ordens_status_entrega ON ordens(status, data_entrega);
CREATE INDEX CONCURRENTLY idx_ordens_cliente_status ON ordens(cliente_id, status);

-- Busca full-text
CREATE INDEX idx_ordens_search ON ordens USING gin(
  to_tsvector('portuguese', coalesce(nome_paciente, '') || ' ' || coalesce(observacoes, ''))
);

-- Arquivos por ordem
CREATE INDEX idx_arquivos_ordem_tipo ON arquivos(ordem_id, tipo);
```

---

## Backup e Manutenção

### Backup diário (via Supabase)
Supabase realiza backups automáticos diários com retenção de 7 dias (plano free) ou 30 dias (plano pro).

### Vacuum e Analyze
```sql
-- Executar semanalmente
VACUUM ANALYZE ordens;
VACUUM ANALYZE historico_ordens;
VACUUM ANALYZE logs_ia;
```

---

*Última atualização: 05/02/2026*
