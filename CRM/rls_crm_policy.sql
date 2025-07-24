-- RLS политика для CRM админки
-- Выполните этот скрипт в Supabase SQL Editor

BEGIN;

-- Проверяем текущие политики
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- Создаём политику для service_role если её нет
-- Эта политика позволяет service_role обходить все ограничения RLS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND schemaname = 'public' 
        AND policyname = 'Service role full access'
    ) THEN
        CREATE POLICY "Service role full access" ON public.users
            FOR ALL 
            TO service_role
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE 'Created service role policy';
    ELSE
        RAISE NOTICE 'Service role policy already exists';
    END IF;
END $$;

-- Альтернативно: создаём политику которая разрешает все операции для bypass
-- если используем специальный bypass header
CREATE OR REPLACE POLICY "CRM admin bypass" ON public.users
    FOR ALL
    USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR 
        current_setting('rls.bypass', true) = 'true'
    )
    WITH CHECK (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR 
        current_setting('rls.bypass', true) = 'true'
    );

-- Проверяем результат
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

COMMIT;

-- ИНСТРУКЦИИ:
-- 1. Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- 2. Убедитесь что политики созданы успешно  
-- 3. Если всё ещё не работает, можно временно отключить RLS:
--    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- 4. После отладки обязательно включите обратно:
--    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; 