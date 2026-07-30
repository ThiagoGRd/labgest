ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS localizacao_atual VARCHAR(40) NOT NULL DEFAULT 'laboratorio',
  ADD COLUMN IF NOT EXISTS situacao_logistica VARCHAR(50) NOT NULL DEFAULT 'no_laboratorio',
  ADD COLUMN IF NOT EXISTS dentista_responsavel VARCHAR(255),
  ADD COLUMN IF NOT EXISTS finalidade_clinica VARCHAR(30),
  ADD COLUMN IF NOT EXISTS agendamento_clinico TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS movimentacao_logistica_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ordens_situacao_logistica
  ON ordens (situacao_logistica);

COMMENT ON COLUMN ordens.localizacao_atual IS 'Custódia física atual: laboratorio, transito, recepcao ou dentista';
COMMENT ON COLUMN ordens.situacao_logistica IS 'Situação administrativa da movimentação clínica, independente da etapa técnica';
