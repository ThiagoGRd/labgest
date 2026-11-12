-- Additive logistics vocabulary only. Does not update existing orders/states/events,
-- grants, policies, RLS or capability flags. Apply before deploying the new UI.
-- Existing constraint names come from 20261110_external_reception_PROPOSED.sql.
-- A mismatched/missing constraint aborts the transaction instead of silently
-- dropping a different check. Bounded locks prevent waiting indefinitely.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE labgest_private.external_reception_state
  DROP CONSTRAINT external_reception_state_situacao_check,
  ADD CONSTRAINT external_reception_state_situacao_check
    CHECK (situacao IN ('aguardando_distribuicao','com_dentista','aguardando_envio_laboratorio','em_transito_laboratorio','no_laboratorio'));
ALTER TABLE labgest_private.external_reception_event
  DROP CONSTRAINT external_reception_event_acao_check,
  ADD CONSTRAINT external_reception_event_acao_check
    CHECK (acao IN ('receber','distribuir','receber_retorno','enviar_retorno','registrar_no_laboratorio'));
COMMIT;
-- Rollback must NOT narrow these checks while no_laboratorio states or
-- registrar_no_laboratorio events exist. Older UI lacks the receive action for
-- this external state; use a forward fix or a rollback version supporting it.
