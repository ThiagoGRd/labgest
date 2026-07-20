CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS token_rastreamento UUID,
  ADD COLUMN IF NOT EXISTS data_entrega_real TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(255),
  ADD COLUMN IF NOT EXISTS motivo_pausa TEXT,
  ADD COLUMN IF NOT EXISTS pausado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pausado_por VARCHAR(255);

UPDATE ordens
SET token_rastreamento = gen_random_uuid()
WHERE token_rastreamento IS NULL;

ALTER TABLE ordens
  ALTER COLUMN token_rastreamento SET DEFAULT gen_random_uuid(),
  ALTER COLUMN token_rastreamento SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordens_token_rastreamento
  ON ordens(token_rastreamento);
