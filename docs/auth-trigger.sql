-- Cria um trigger para inserir na tabela publica 'usuarios' quando um novo usuario for criado no Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nome, tipo, ativo)
  values (
    new.id, -- Assumindo que mudamos o ID para UUID, ou precisaremos adaptar se for Int
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    'admin', -- Default para admin por enquanto
    true
  );
  return new;
end;
$$;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
