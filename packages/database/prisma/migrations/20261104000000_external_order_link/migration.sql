-- Review and apply only with an approved deployment. No historical reconciliation.
ALTER TABLE labs_externos_pedidos ADD COLUMN ordem_id INTEGER,
  ADD COLUMN fornecedor_confirmado_em TIMESTAMP(6);
ALTER TABLE labs_externos_pedidos ADD CONSTRAINT labs_externos_pedidos_ordem_id_fkey
  FOREIGN KEY (ordem_id) REFERENCES ordens(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
-- Multiple completed supplier cycles are legitimate. Only one unconfirmed cycle per OS.
CREATE UNIQUE INDEX labs_externos_pedidos_active_ordem_key ON labs_externos_pedidos(ordem_id)
  WHERE ordem_id IS NOT NULL AND fornecedor_confirmado_em IS NULL;
