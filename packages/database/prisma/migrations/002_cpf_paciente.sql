-- CPF usado para associar o paciente do LabGest ao cadastro do Clinicorp.
-- Mantido opcional para preservar as ordens existentes até o preenchimento gradual.
ALTER TABLE ordens
  ADD COLUMN IF NOT EXISTS cpf_paciente VARCHAR(11);

CREATE INDEX IF NOT EXISTS idx_ordens_cpf_paciente ON ordens(cpf_paciente);
