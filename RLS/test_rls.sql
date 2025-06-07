-- Тестирование RLS настроек
-- Выполните эти запросы для проверки корректной работы RLS

-- 1. Проверяем что RLS включен
SELECT 
    schemaname,
    tablename, 
    rowsecurity as rls_enabled,
    forcerowsecurity as force_rls
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. Проверяем какие политики созданы
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- 3. Тестовый запрос с service_role (должен работать)
-- Этот запрос нужно выполнить в SQL Editor с service_role ключом
-- SET ROLE service_role;
-- SELECT count(*) FROM users;
-- RESET ROLE;

-- 4. Тестовый запрос с anon ролью (должен вернуть 0 записей)
-- SET ROLE anon;
-- SELECT count(*) FROM users; -- Должен вернуть 0
-- RESET ROLE;

-- 5. Проверка текущей роли
SELECT current_user, current_setting('role');

-- 6. Информация о ролях в базе
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres');

-- ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:
-- 1. rls_enabled должен быть true
-- 2. Должно быть минимум 2 политики: для service_role и authenticated
-- 3. Service role запросы должны работать
-- 4. Anon запросы должны возвращать пустые результаты 