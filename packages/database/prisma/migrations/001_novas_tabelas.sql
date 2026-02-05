-- ================================================
-- LabGest - Novas Tabelas para v2
-- Execute este script no Supabase SQL Editor
-- ================================================

-- Tabela: dentistas_portal (autenticação do portal do dentista)
CREATE TABLE IF NOT EXISTS dentistas_portal (
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

CREATE INDEX IF NOT EXISTS idx_dentistas_portal_cliente ON dentistas_portal(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dentistas_portal_email ON dentistas_portal(email);

-- Tabela: etapas_producao (etapas configuráveis do Kanban)
CREATE TABLE IF NOT EXISTS etapas_producao (
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

-- Dados iniciais das etapas
INSERT INTO etapas_producao (nome, ordem, cor, notificar_dentista) VALUES
  ('Recebimento', 1, '#6366f1', false),
  ('Planejamento/CAD', 2, '#8b5cf6', false),
  ('Impressão/Fresagem', 3, '#a855f7', false),
  ('Acabamento', 4, '#d946ef', false),
  ('Conferência', 5, '#ec4899', false),
  ('Pronto para Entrega', 6, '#22c55e', true)
ON CONFLICT DO NOTHING;

-- Tabela: atribuicoes (atribuição de ordens a técnicos)
CREATE TABLE IF NOT EXISTS atribuicoes (
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

CREATE INDEX IF NOT EXISTS idx_atribuicoes_ordem ON atribuicoes(ordem_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_usuario ON atribuicoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_status ON atribuicoes(status);

-- Tabela: historico_ordens (timeline de alterações)
CREATE TABLE IF NOT EXISTS historico_ordens (
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

CREATE INDEX IF NOT EXISTS idx_historico_ordem ON historico_ordens(ordem_id);
CREATE INDEX IF NOT EXISTS idx_historico_created ON historico_ordens(created_at);

-- Tabela: mensagens_ordem (chat por ordem)
CREATE TABLE IF NOT EXISTS mensagens_ordem (
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

CREATE INDEX IF NOT EXISTS idx_mensagens_ordem ON mensagens_ordem(ordem_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_lida ON mensagens_ordem(lida) WHERE lida = false;

-- Tabela: arquivos (referência de arquivos no storage)
CREATE TABLE IF NOT EXISTS arquivos (
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

CREATE INDEX IF NOT EXISTS idx_arquivos_ordem ON arquivos(ordem_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_tipo ON arquivos(tipo);

-- Tabela: automacoes (configuração de automações)
CREATE TABLE IF NOT EXISTS automacoes (
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
  ('Notificar dentista ao finalizar', 'notificacao', 'status_change', '{"status": "Finalizado"}', 'email', '{}')
ON CONFLICT DO NOTHING;

-- Tabela: execucoes_automacao (log de execução)
CREATE TABLE IF NOT EXISTS execucoes_automacao (
  id SERIAL PRIMARY KEY,
  automacao_id INTEGER REFERENCES automacoes(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  resultado JSONB,
  erro TEXT,
  tempo_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execucoes_automacao ON execucoes_automacao(automacao_id);

-- Tabela: logs_ia (log de uso da IA)
CREATE TABLE IF NOT EXISTS logs_ia (
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

CREATE INDEX IF NOT EXISTS idx_logs_ia_tipo ON logs_ia(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_ia_usuario ON logs_ia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_ia_created ON logs_ia(created_at);

-- Tabela: alertas (alertas do sistema)
CREATE TABLE IF NOT EXISTS alertas (
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

CREATE INDEX IF NOT EXISTS idx_alertas_usuario ON alertas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido) WHERE lido = false;

-- Tabela: relatorios_salvos (relatórios favoritos)
CREATE TABLE IF NOT EXISTS relatorios_salvos (
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

-- Trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION registrar_historico_ordem()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.etapa_atual IS DISTINCT FROM NEW.etapa_atual THEN
      INSERT INTO historico_ordens (ordem_id, acao, dados_anteriores, dados_novos)
      VALUES (
        NEW.id,
        CASE 
          WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_alterado'
          ELSE 'etapa_alterada'
        END,
        jsonb_build_object('status', OLD.status, 'etapa', OLD.etapa_atual),
        jsonb_build_object('status', NEW.status, 'etapa', NEW.etapa_atual)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_historico_ordem') THEN
    CREATE TRIGGER trigger_historico_ordem
    AFTER UPDATE ON ordens
    FOR EACH ROW EXECUTE FUNCTION registrar_historico_ordem();
  END IF;
END $$;

-- ================================================
-- Fim do script
-- ================================================
