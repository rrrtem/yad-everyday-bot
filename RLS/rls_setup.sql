-- RLS Setup для Challenge Guardian Bot
-- Этот скрипт безопасно настраивает Row Level Security

BEGIN;

-- 1. Включаем RLS для таблицы users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Создаём политику для Service Role (наш бот)
-- Service Role должен иметь полный доступ ко всем операциям
CREATE POLICY "Service role full access" ON users
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Политика для authenticated роли (если понадобится в будущем)
-- На случай, если добавим веб-интерфейс или API для пользователей
CREATE POLICY "Users can view own data" ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = telegram_id::text);

-- 4. Запрещаем все операции для anon роли
-- Анонимные пользователи не должны иметь доступа к данным
-- (это поведение по умолчанию при включении RLS, но явно прописываем для ясности)

-- 5. Проверяем что RLS включен
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

COMMIT;

-- ВАЖНЫЕ ЗАМЕТКИ:
-- 
-- 1. Service Role Key обходит RLS - бот продолжит работать нормально
-- 2. Anon ключ больше не сможет читать/писать данные (что и нужно)
-- 3. Если нужен веб-интерфейс - добавьте аутентификацию через Supabase Auth
-- 4. Для отладки можно временно отключить RLS: ALTER TABLE users DISABLE ROW LEVEL SECURITY;
--
-- ТЕСТИРОВАНИЕ:
-- 1. Проверьте что бот продолжает работать (должен работать через service_role)
-- 2. Попробуйте запрос с anon ключом - должен вернуть пустой результат
-- 3. Проверьте логи функций на ошибки 