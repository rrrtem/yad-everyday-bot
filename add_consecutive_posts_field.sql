-- Миграция для добавления поля consecutive_posts_count
-- Добавляет поле для учета количества постов подряд без пропусков

-- Добавляем новое поле для подсчета последовательных постов
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consecutive_posts_count INTEGER DEFAULT 0;

-- Добавляем комментарий к полю для документации  
COMMENT ON COLUMN users.consecutive_posts_count IS 'Количество постов подряд без пропусков (сбрасывается при страйке)';

-- Устанавливаем начальное значение 0 для всех существующих пользователей
UPDATE users SET consecutive_posts_count = 0 WHERE consecutive_posts_count IS NULL;

-- Создаем индекс для быстрого поиска по количеству последовательных постов
CREATE INDEX IF NOT EXISTS idx_users_consecutive_posts ON users(consecutive_posts_count)
WHERE consecutive_posts_count > 0; 