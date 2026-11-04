-- Synthetic fixture only, for a fresh isolated labgest_archive_test database.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.usuarios (id integer PRIMARY KEY, nome text NOT NULL);
CREATE TABLE public.labs_externos (id integer PRIMARY KEY, nome varchar(255) NOT NULL, ativo boolean DEFAULT true);
CREATE TABLE public.labs_externos_pedidos (
 id integer PRIMARY KEY,
 lab_id integer REFERENCES public.labs_externos(id), lab_nome varchar(255) NOT NULL,
 paciente varchar(255) NOT NULL, dentista varchar(255), data_envio date, prazo date,
 data_retorno date, situacao varchar(50) NOT NULL DEFAULT 'Enviado'
   CHECK (situacao IN ('Enviado', 'Provando', 'Pronto', 'Entregue')),
 servico text, is_retrabalho boolean DEFAULT false, motivo_retrabalho text,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE FUNCTION public.fixture_refresh_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER fixture_refresh_timestamp BEFORE UPDATE ON public.labs_externos_pedidos
FOR EACH ROW EXECUTE FUNCTION public.fixture_refresh_timestamp();
CREATE VIEW public.labs_externos_atrasados AS
 SELECT p.*, CURRENT_DATE - prazo AS dias_atraso FROM public.labs_externos_pedidos p
 WHERE prazo IS NOT NULL AND prazo < CURRENT_DATE AND situacao <> 'Entregue';
CREATE VIEW public.labs_externos_retrabalhos AS
 SELECT * FROM public.labs_externos_pedidos WHERE is_retrabalho = true;
CREATE VIEW public.labs_externos_dashboard AS
 SELECT l.id AS lab_id, l.nome AS lab_nome,
 count(p.id) FILTER (WHERE p.situacao = 'Enviado') AS total_enviados,
 count(p.id) FILTER (WHERE p.situacao = 'Provando') AS total_provando,
 count(p.id) FILTER (WHERE p.situacao = 'Pronto') AS total_prontos,
 count(p.id) FILTER (WHERE p.situacao = 'Entregue') AS total_entregues,
 count(p.id) FILTER (WHERE p.prazo < CURRENT_DATE AND p.situacao <> 'Entregue') AS total_atrasados,
 count(p.id) FILTER (WHERE p.is_retrabalho AND p.situacao <> 'Entregue') AS total_retrabalhos
 FROM public.labs_externos l LEFT JOIN public.labs_externos_pedidos p ON p.lab_id = l.id
 WHERE l.ativo GROUP BY l.id, l.nome;
INSERT INTO public.usuarios VALUES (1, 'Synthetic Administrator');
INSERT INTO public.labs_externos VALUES (1, 'Synthetic Laboratory', true);
INSERT INTO public.labs_externos_pedidos (id, lab_id, lab_nome, paciente, situacao, updated_at)
 SELECT i, 1, 'Synthetic Laboratory', 'Synthetic Patient ' || i, 'Entregue', '2026-11-04 10:00:00.123456'::timestamp
 FROM generate_series(1, 5) AS i;
