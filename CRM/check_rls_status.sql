-- Проверка текущего состояния RLS для таблицы users
-- Выполните в Supabase SQL Editor

-- 1. Проверяем включен ли RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    hasrls as has_rls_policies
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. Смотрим все существующие политики
SELECT 
    policyname,
    cmd as operation,
    roles,
    qual as using_condition,
    with_check as check_condition
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- 3. Проверяем роли в базе данных
SELECT rolname, rolsuper, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY rolname; 