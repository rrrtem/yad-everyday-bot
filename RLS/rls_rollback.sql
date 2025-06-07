-- ОТКАТ RLS настроек (используйте только в случае проблем)
-- ВНИМАНИЕ: Этот скрипт отключает RLS и удаляет все политики безопасности

BEGIN;

-- 1. Отключаем RLS для таблицы users
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Удаляем все созданные политики
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;

-- 3. Проверяем что RLS отключен
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 4. Проверяем что политики удалены
SELECT COUNT(*) as policies_count
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

COMMIT;

-- РЕЗУЛЬТАТ: 
-- - RLS отключен, таблица users снова доступна всем ролям
-- - Все политики удалены  
-- - Система вернулась к состоянию "до RLS"
--
-- ВАЖНО:
-- - После отката таблица users будет доступна anon роли!
-- - Используйте этот скрипт только для диагностики проблем
-- - После исправления проблем запустите rls_setup.sql заново 