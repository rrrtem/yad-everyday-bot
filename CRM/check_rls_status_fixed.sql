-- Исправленная проверка текущего состояния RLS для таблицы users
-- Выполните в Supabase SQL Editor

-- 1. Проверяем включен ли RLS (исправленная версия)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. Альтернативный способ проверки RLS через pg_class
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'users' AND n.nspname = 'public';

-- 3. Смотрим все существующие политики
SELECT 
    policyname,
    cmd as operation,
    roles,
    qual as using_condition,
    with_check as check_condition
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- 4. Проверяем роли в базе данных
SELECT rolname, rolsuper, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY rolname;

-- 5. Дополнительная информация о правах на таблицу
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY grantee, privilege_type; 