ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS estoque_baixado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cobranca_gerada_em TIMESTAMPTZ;

UPDATE ordens AS ordem
SET cobranca_gerada_em = COALESCE(conta.created_at, NOW())
FROM contas_receber AS conta
WHERE conta.ordem_id = ordem.id
  AND ordem.cobranca_gerada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_ordens_estoque_baixado_em
  ON ordens(estoque_baixado_em);
