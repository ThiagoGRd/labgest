ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS grupo_parcelamento UUID,
  ADD COLUMN IF NOT EXISTS parcela_numero SMALLINT,
  ADD COLUMN IF NOT EXISTS parcela_total SMALLINT;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_grupo_parcelamento
  ON contas_pagar(grupo_parcelamento);

ALTER TABLE contas_pagar
  DROP CONSTRAINT IF EXISTS chk_contas_pagar_parcelamento;

ALTER TABLE contas_pagar
  ADD CONSTRAINT chk_contas_pagar_parcelamento CHECK (
    (grupo_parcelamento IS NULL AND parcela_numero IS NULL AND parcela_total IS NULL)
    OR
    (grupo_parcelamento IS NOT NULL AND parcela_numero BETWEEN 1 AND parcela_total AND parcela_total BETWEEN 2 AND 60)
  );
