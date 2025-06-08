-- Миграция для добавления функциональности waitlist
-- Добавляет поля для управления списком ожидания

-- Добавляем поля для waitlist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS waitlist BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS waitlist_position INTEGER,
ADD COLUMN IF NOT EXISTS waitlist_added_at TIMESTAMP WITH TIME ZONE;

-- Создаем индекс для быстрого поиска пользователей в waitlist
CREATE INDEX IF NOT EXISTS idx_users_waitlist ON users(waitlist, waitlist_position) 
WHERE waitlist = true;

-- Создаем индекс для поиска по состоянию пользователя
CREATE INDEX IF NOT EXISTS idx_users_state ON users(user_state)
WHERE user_state IS NOT NULL;

-- Добавляем комментарии к полям для документации
COMMENT ON COLUMN users.waitlist IS 'Находится ли пользователь в списке ожидания';
COMMENT ON COLUMN users.waitlist_position IS 'Позиция пользователя в очереди (1, 2, 3...)';
COMMENT ON COLUMN users.waitlist_added_at IS 'Время добавления пользователя в список ожидания';

-- Пример запроса для получения пользователей из waitlist в порядке очереди:
-- SELECT telegram_id, username, waitlist_position 
-- FROM users 
-- WHERE waitlist = true 
-- ORDER BY waitlist_position ASC; 