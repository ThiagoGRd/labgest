ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS passo_fluxo_atual VARCHAR(80),
  ADD COLUMN IF NOT EXISTS arcadas SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prazo_etapa_atual TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fornecedor_estrutura VARCHAR(255),
  ADD COLUMN IF NOT EXISTS data_envio_fornecedor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prazo_fornecedor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_recebimento_fornecedor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS justificativa_atraso_fornecedor TEXT;

CREATE INDEX IF NOT EXISTS idx_ordens_tipo_workflow ON ordens(tipo_workflow);
CREATE INDEX IF NOT EXISTS idx_ordens_passo_fluxo_atual ON ordens(passo_fluxo_atual);

ALTER TABLE ordens
  DROP CONSTRAINT IF EXISTS ordens_arcadas_check;

ALTER TABLE ordens
  ADD CONSTRAINT ordens_arcadas_check CHECK (arcadas IN (1, 2));
