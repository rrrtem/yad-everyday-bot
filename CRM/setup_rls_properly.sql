-- Правильная настройка RLS для CRM админки
-- Выполните по частям в Supabase SQL Editor

-- ЧАСТЬ 1: Очистка существующих политик (если есть конфликты)
DO $$ 
DECLARE
    policy_name TEXT;
BEGIN
    -- Удаляем все существующие политики для таблицы users
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', policy_name);
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END $$;

-- ЧАСТЬ 2: Включаем RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ЧАСТЬ 3: Создаём политику для service_role (полный доступ)
CREATE POLICY "service_role_full_access" ON public.users
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ЧАСТЬ 4: Создаём политику для authenticated пользователей (только свои данные)
CREATE POLICY "authenticated_own_data" ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = telegram_id::text);

-- ЧАСТЬ 5: Блокируем доступ для анонимных пользователей (явно)
-- По умолчанию anon роль не имеет доступа при включенном RLS, но для ясности:
CREATE POLICY "anon_no_access" ON public.users
    FOR ALL
    TO anon
    USING (false);

-- ЧАСТЬ 6: Проверяем результат
SELECT 'RLS Status:' as info;
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

SELECT 'Policies:' as info;
SELECT 
    policyname,
    cmd as operation,
    roles,
    CASE 
        WHEN qual = 'true'::text THEN 'Allow All'
        WHEN qual = 'false'::text THEN 'Deny All'  
        ELSE qual
    END as condition
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname; 