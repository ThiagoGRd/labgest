-- Criar um bucket privado para arquivos do laboratório
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-files', 
  'lab-files', 
  false, 
  52428800, -- 50MB limit
  ARRAY['application/zip', 'application/x-zip-compressed', 'model/stl', 'model/obj', 'application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir upload para usuários autenticados
CREATE POLICY "Upload autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'lab-files' );

-- Política: Permitir download para usuários autenticados
CREATE POLICY "Download autenticado"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'lab-files' );

-- Política: Permitir update/delete para donos ou admins (simplificado para authenticated por enquanto)
CREATE POLICY "Gerenciar arquivos"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'lab-files' );
