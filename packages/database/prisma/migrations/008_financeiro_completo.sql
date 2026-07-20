ALTER TABLE contas_receber
  ADD COLUMN IF NOT EXISTS valor_recebido DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(255),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(255),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

UPDATE contas_receber
SET valor_recebido = valor
WHERE status = 'Recebido' AND valor_recebido = 0;

UPDATE contas_pagar
SET valor_pago = valor
WHERE status = 'Pago' AND valor_pago = 0;

CREATE TABLE IF NOT EXISTS contas_financeiras (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'Banco',
  saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO contas_financeiras (nome, tipo)
SELECT 'Caixa principal', 'Caixa'
WHERE NOT EXISTS (SELECT 1 FROM contas_financeiras);

CREATE TABLE IF NOT EXISTS movimentacoes_financeiras (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('Entrada', 'Saida')),
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  data_movimentacao DATE NOT NULL,
  forma_pagamento VARCHAR(100),
  observacoes TEXT,
  conta_receber_id INTEGER REFERENCES contas_receber(id) ON DELETE RESTRICT,
  conta_pagar_id INTEGER REFERENCES contas_pagar(id) ON DELETE RESTRICT,
  conta_financeira_id INTEGER REFERENCES contas_financeiras(id) ON DELETE RESTRICT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE NO ACTION,
  estornada_em TIMESTAMPTZ,
  estornada_por VARCHAR(255),
  motivo_estorno TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((conta_receber_id IS NOT NULL)::int + (conta_pagar_id IS NOT NULL)::int <= 1)
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_data ON movimentacoes_financeiras(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_receber ON movimentacoes_financeiras(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_pagar ON movimentacoes_financeiras(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cancelado ON contas_receber(cancelado_em);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cancelado ON contas_pagar(cancelado_em);

-- Converte baixas históricas em movimentações para que o saldo realizado não comece zerado.
INSERT INTO movimentacoes_financeiras (
  tipo, valor, data_movimentacao, forma_pagamento, observacoes,
  conta_receber_id, conta_financeira_id, usuario_id
)
SELECT
  'Entrada', cr.valor_recebido, COALESCE(cr.data_recebimento, cr.data_vencimento),
  cr.forma_recebimento, 'Movimentação histórica migrada automaticamente',
  cr.id, (SELECT id FROM contas_financeiras ORDER BY id LIMIT 1), cr.usuario_id
FROM contas_receber cr
WHERE cr.valor_recebido > 0
  AND NOT EXISTS (SELECT 1 FROM movimentacoes_financeiras mf WHERE mf.conta_receber_id = cr.id);

INSERT INTO movimentacoes_financeiras (
  tipo, valor, data_movimentacao, forma_pagamento, observacoes,
  conta_pagar_id, conta_financeira_id, usuario_id
)
SELECT
  'Saida', cp.valor_pago, COALESCE(cp.data_pagamento, cp.data_vencimento),
  cp.forma_pagamento, 'Movimentação histórica migrada automaticamente',
  cp.id, (SELECT id FROM contas_financeiras ORDER BY id LIMIT 1), cp.usuario_id
FROM contas_pagar cp
WHERE cp.valor_pago > 0
  AND NOT EXISTS (SELECT 1 FROM movimentacoes_financeiras mf WHERE mf.conta_pagar_id = cp.id);
