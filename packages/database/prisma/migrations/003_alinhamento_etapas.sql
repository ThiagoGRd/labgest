-- Alinha o Kanban e as ordens sem reescrever o histórico finalizado.
-- A subetapa guarda o detalhe técnico; etapa_atual permanece a macroetapa canônica.
ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS subetapa_atual VARCHAR(255);

-- A restrição original antecede os estados de prova e entrega.
ALTER TABLE ordens DROP CONSTRAINT IF EXISTS ordens_status_check;
ALTER TABLE ordens ADD CONSTRAINT ordens_status_check CHECK (
  status IN ('Aguardando', 'Em Produção', 'Em Prova', 'Finalizado', 'Entregue', 'Cancelado', 'Pausado')
);

-- Preserva como subetapa qualquer descrição técnica legada antes da normalização.
UPDATE ordens
SET subetapa_atual = etapa_atual
WHERE status NOT IN ('Finalizado', 'Entregue', 'Cancelado')
  AND subetapa_atual IS NULL
  AND LOWER(TRIM(COALESCE(etapa_atual, ''))) NOT IN (
    'recebimento', 'modelagem', 'confeccao', 'em_prova', 'ajuste',
    'acabamento', 'conferencia', 'pronto', 'entregue'
  );

UPDATE ordens
SET etapa_atual = CASE
  WHEN LOWER(TRIM(COALESCE(etapa_atual, ''))) IN ('entregue') THEN 'entregue'
  WHEN LOWER(TRIM(COALESCE(etapa_atual, ''))) IN ('pronto', 'finalizado')
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%pronto%' THEN 'pronto'
  WHEN LOWER(COALESCE(etapa_atual, '')) LIKE '%confer%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%controle de qualidade%' THEN 'conferencia'
  WHEN LOWER(COALESCE(etapa_atual, '')) LIKE '%ajuste%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%remontagem%' THEN 'ajuste'
  WHEN LOWER(TRIM(COALESCE(etapa_atual, ''))) IN ('emprova', 'em_prova')
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%prova%' THEN 'em_prova'
  WHEN LOWER(COALESCE(etapa_atual, '')) LIKE '%acabamento%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%polimento%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%montagem%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%finaliza%' THEN 'acabamento'
  WHEN LOWER(COALESCE(etapa_atual, '')) LIKE '%planejamento%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%modelagem%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%delineamento%' THEN 'modelagem'
  WHEN LOWER(TRIM(COALESCE(etapa_atual, ''))) IN ('produção', 'producao', 'confeccao')
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%impress%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%confec%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%fresagem%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%acriliza%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%estrutura%'
    OR LOWER(COALESCE(etapa_atual, '')) LIKE '%rodete%' THEN 'confeccao'
  ELSE 'recebimento'
END
WHERE status NOT IN ('Finalizado', 'Entregue', 'Cancelado');

-- Status é consequência da macroetapa nas ordens ativas. Pausas e cancelamentos
-- continuam sendo decisões manuais e, por isso, não são sobrescritos.
UPDATE ordens
SET status = CASE etapa_atual
  WHEN 'recebimento' THEN 'Aguardando'
  WHEN 'em_prova' THEN 'Em Prova'
  WHEN 'pronto' THEN 'Finalizado'
  WHEN 'entregue' THEN 'Entregue'
  ELSE 'Em Produção'
END
WHERE status NOT IN ('Finalizado', 'Entregue', 'Cancelado', 'Pausado');

CREATE INDEX IF NOT EXISTS idx_ordens_etapa_atual ON ordens(etapa_atual);
