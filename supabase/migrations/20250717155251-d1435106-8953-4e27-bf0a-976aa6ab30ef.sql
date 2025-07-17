-- Adicionar política de leitura para permitir consultas na tabela
CREATE POLICY "Allow select for all users" 
ON public.dbpraiativa2 
FOR SELECT 
USING (true);