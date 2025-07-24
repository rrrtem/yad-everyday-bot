-- Исправленный RLS скрипт для CRM админки
-- Выполните этот скрипт в Supabase SQL Editor

-- Проверяем текущие политики
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Удаляем старую политику если она есть (игнорируем ошибки)
DROP POLICY IF EXISTS "CRM admin bypass" ON public.users;

-- Создаём новую политику для service_role
CREATE POLICY "Service role full access" ON public.users
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Проверяем результат
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Информация о статусе RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public'; 