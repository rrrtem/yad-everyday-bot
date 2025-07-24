-- Простая и надежная настройка RLS для CRM админки
-- Выполните команды по одной в Supabase SQL Editor

-- 1. Удаляем все существующие политики (если есть)
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "service_role_full_access" ON public.users;
DROP POLICY IF EXISTS "anon_no_access" ON public.users;
DROP POLICY IF EXISTS "authenticated_own_data" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;

-- 2. Включаем RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Создаём политику для service_role (полный доступ)
CREATE POLICY "service_role_all_access" ON public.users
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Явно блокируем доступ для anon роли
CREATE POLICY "anon_denied" ON public.users
    FOR ALL
    TO anon
    USING (false);

-- 5. Проверяем результат
SELECT 'Checking RLS status:' as info;

SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

SELECT 'Checking policies:' as info;

SELECT 
    policyname,
    cmd as operation,
    roles
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname; 