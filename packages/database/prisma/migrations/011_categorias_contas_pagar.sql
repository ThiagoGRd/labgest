ALTER TABLE contas_pagar
  DROP CONSTRAINT IF EXISTS contas_pagar_categoria_check;

ALTER TABLE contas_pagar
  ADD CONSTRAINT contas_pagar_categoria_check CHECK (
    categoria IN (
      'Fornecedor', 'Aluguel', 'Energia', 'Telefone', 'Internet', 'Material', 'Equipamento',
      'Materiais', 'Laboratório externo', 'Folha de pagamento', 'Impostos', 'Estrutura',
      'Manutenção', 'Marketing', 'Administrativo', 'Outros'
    )
  );
