ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS tipo_workflow VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_servicos_tipo_workflow ON servicos(tipo_workflow);

UPDATE servicos
SET tipo_workflow = CASE
  WHEN lower(nome) LIKE '%clareamento%' THEN 'placa_clareamento'
  WHEN lower(nome) LIKE '%contenção%' OR lower(nome) LIKE '%contencao%' THEN 'placa_contencao'
  WHEN lower(nome) LIKE '%brux%' OR lower(nome) LIKE '%miorrelax%' THEN 'placa_bruxismo'
  WHEN lower(nome) LIKE '%conserto%' OR lower(nome) LIKE '%reparo%' THEN 'conserto_geral'
  WHEN lower(nome) LIKE '%carga imediata%' OR (lower(nome) LIKE '%provis%' AND lower(nome) LIKE '%protocolo%') THEN 'protocolo_carga_imediata'
  WHEN lower(nome) LIKE '%provis%' THEN 'provisorio_digital'
  WHEN lower(nome) LIKE '%protocolo%' THEN 'protocolo_definitivo'
  WHEN (lower(nome) LIKE '%parcial%' OR lower(nome) LIKE '%ppr%') AND lower(nome) LIKE '%sem estrutura%' THEN 'ppr_sem_estrutura'
  WHEN lower(nome) LIKE '%parcial%' OR lower(nome) LIKE '%ppr%' THEN 'ppr_com_estrutura'
  WHEN lower(nome) LIKE '%total%' THEN 'protese_total_removivel'
  ELSE NULL
END
WHERE tipo_workflow IS NULL;
