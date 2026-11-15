-- Controle de tratamentos: consultas do Clinicorp, limites por tipo de prótese e
-- alertas ao gestor. Somente tabelas novas: nenhuma tabela existente é alterada,
-- então o restante do sistema segue funcionando antes e depois desta migração.

CREATE TABLE IF NOT EXISTS clinicorp_consultas (
  id               SERIAL PRIMARY KEY,
  clinicorp_id     VARCHAR(40)  NOT NULL UNIQUE,
  paciente_nome    VARCHAR(255) NOT NULL,
  paciente_chave   VARCHAR(255) NOT NULL,
  data             DATE         NOT NULL,
  hora_inicio      VARCHAR(5),
  hora_fim         VARCHAR(5),
  status           VARCHAR(20)  NOT NULL DEFAULT 'agendado',
  dentista_id      VARCHAR(40),
  dentista_nome    VARCHAR(255),
  categoria        VARCHAR(255),
  observacoes      TEXT,
  conta_manual     BOOLEAN,
  sincronizado_em  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinicorp_consultas_paciente ON clinicorp_consultas (paciente_chave, data);

COMMENT ON TABLE clinicorp_consultas IS 'Cópia das consultas do Clinicorp apenas dos pacientes com prótese em acompanhamento';
COMMENT ON COLUMN clinicorp_consultas.paciente_chave IS 'Nome normalizado (sem acento/caixa) usado para casar com ordens.nome_paciente';
COMMENT ON COLUMN clinicorp_consultas.conta_manual IS 'Decisão do gestor: true conta para a prótese, false não conta, NULL segue a categoria';

-- Quando o nome no Clinicorp difere do nome na ordem, o gestor informa o nome correto.
CREATE TABLE IF NOT EXISTS tratamento_vinculos (
  ordem_id        INTEGER PRIMARY KEY,
  paciente_chave  VARCHAR(255) NOT NULL,
  paciente_nome   VARCHAR(255) NOT NULL,
  criado_por      VARCHAR(255),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Limites editáveis pelo gestor; sem linha, vale o padrão calculado pelo fluxo da prótese.
CREATE TABLE IF NOT EXISTS limites_tratamento (
  tipo_workflow      VARCHAR(50) PRIMARY KEY,
  consultas_atencao  SMALLINT NOT NULL,
  consultas_max      SMALLINT NOT NULL,
  dias_atencao       SMALLINT NOT NULL,
  dias_max           SMALLINT NOT NULL,
  atualizado_por     VARCHAR(255),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (consultas_atencao > 0 AND consultas_atencao <= consultas_max),
  CHECK (dias_atencao > 0 AND dias_atencao <= dias_max)
);

CREATE TABLE IF NOT EXISTS alertas_tratamento (
  id               SERIAL PRIMARY KEY,
  ordem_id         INTEGER NOT NULL,
  tipo             VARCHAR(30) NOT NULL,
  mensagem         TEXT NOT NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ciente_em        TIMESTAMPTZ,
  ciente_por       VARCHAR(255),
  ciente_nota      TEXT,
  resolvido_em     TIMESTAMPTZ,
  UNIQUE (ordem_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_alertas_tratamento_abertos ON alertas_tratamento (resolvido_em, ciente_em);

COMMENT ON COLUMN alertas_tratamento.tipo IS 'consultas_atencao, consultas_critico, tempo_atencao ou tempo_critico';

CREATE TABLE IF NOT EXISTS clinicorp_sincronizacoes (
  id             SERIAL PRIMARY KEY,
  iniciada_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em   TIMESTAMPTZ,
  origem         VARCHAR(20) NOT NULL DEFAULT 'manual',
  sucesso        BOOLEAN NOT NULL DEFAULT false,
  consultas      INTEGER NOT NULL DEFAULT 0,
  erro           TEXT,
  sugestoes      JSONB NOT NULL DEFAULT '{}'
);

-- O LabGest acessa o banco pelo Prisma (conexão direta). Estas tabelas guardam dados
-- clínicos, então ficam fechadas para a API pública do Supabase (anon/authenticated).
ALTER TABLE clinicorp_consultas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamento_vinculos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE limites_tratamento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_tratamento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicorp_sincronizacoes ENABLE ROW LEVEL SECURITY;
