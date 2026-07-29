ALTER TABLE "estoque"
ADD COLUMN IF NOT EXISTS "marca" VARCHAR(120);

CREATE TABLE IF NOT EXISTS "movimentacoes_estoque" (
  "id" SERIAL PRIMARY KEY,
  "estoque_id" INTEGER NOT NULL,
  "tipo" VARCHAR(20) NOT NULL,
  "quantidade" DECIMAL(10,3) NOT NULL,
  "saldo_anterior" DECIMAL(10,3) NOT NULL,
  "saldo_posterior" DECIMAL(10,3) NOT NULL,
  "valor_unitario" DECIMAL(10,2),
  "motivo" VARCHAR(255) NOT NULL,
  "documento" VARCHAR(100),
  "ordem_id" INTEGER,
  "usuario_id" INTEGER,
  "usuario_nome" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "movimentacoes_estoque_estoque_id_fkey"
    FOREIGN KEY ("estoque_id") REFERENCES "estoque"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_movimentacoes_estoque_item_data"
  ON "movimentacoes_estoque"("estoque_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_movimentacoes_estoque_tipo"
  ON "movimentacoes_estoque"("tipo");
CREATE INDEX IF NOT EXISTS "idx_movimentacoes_estoque_data"
  ON "movimentacoes_estoque"("created_at");

-- Cria um marco inicial auditável para os saldos que já existiam antes desta melhoria.
INSERT INTO "movimentacoes_estoque" (
  "estoque_id", "tipo", "quantidade", "saldo_anterior", "saldo_posterior",
  "valor_unitario", "motivo", "usuario_nome"
)
SELECT
  e."id", 'Ajuste', ABS(e."quantidade"), 0, e."quantidade",
  e."preco_unitario", 'Saldo existente na implantação do controle de movimentações', 'Sistema'
FROM "estoque" e
WHERE e."quantidade" <> 0
  AND NOT EXISTS (
    SELECT 1 FROM "movimentacoes_estoque" m WHERE m."estoque_id" = e."id"
  );
