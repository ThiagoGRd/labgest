-- Additive only; no legacy appointment backfill and no permissions changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.ordens ADD COLUMN agendamento_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN agendamento_dentista varchar(255);
ALTER TABLE labgest_private.external_reception_state ADD COLUMN agendamento_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN agendamento_em timestamptz, ADD COLUMN agendamento_dentista varchar(255);
ALTER TABLE labgest_private.external_reception_event
  DROP CONSTRAINT external_reception_event_acao_check,
  ADD CONSTRAINT external_reception_event_acao_check CHECK (acao IN
    ('receber','distribuir','receber_retorno','enviar_retorno','registrar_no_laboratorio','agendar','cancelar_agendamento'));
COMMIT;
