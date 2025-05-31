-- migration.sql
-- Удаление старых таблиц
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS penalties CASCADE;
DROP TABLE IF EXISTS config CASCADE;

-- Пересоздание таблицы users по новой схеме
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    user_id bigint PRIMARY KEY,         -- внутренний идентификатор пользователя
    telegram_id bigint NOT NULL,        -- Telegram ID пользователя
    first_name text,                    -- Имя
    last_name text,                     -- Фамилия
    username text,                      -- Telegram username
    is_active boolean DEFAULT true,     -- Активен ли пользователь
    current_lives int DEFAULT 3,        -- Текущее количество жизней
    max_lives int DEFAULT 3,            -- Максимальное количество жизней
    post_today boolean DEFAULT false,   -- Был ли сегодня пост с тегом #daily
    last_post_date date,                -- Дата последнего поста с тегом #daily
    left_at timestamptz,                -- Когда пользователь был удалён из чата
    joined_at timestamptz DEFAULT now(),-- Когда пользователь присоединился
    updated_at timestamptz DEFAULT now()-- Последнее обновление записи
); 