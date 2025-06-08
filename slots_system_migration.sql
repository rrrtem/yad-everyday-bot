-- Миграция для системы динамических слотов
-- Создает таблицу для хранения настроек количества доступных мест

-- Создаем таблицу для настроек слотов
CREATE TABLE IF NOT EXISTS slot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  available_slots INTEGER NOT NULL DEFAULT 0,
  total_slots_opened INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by BIGINT, -- telegram_id админа, который последний раз обновлял
  
  -- Ограничение: только одна запись в таблице
  CONSTRAINT single_row CHECK (id = 1)
);

-- Вставляем единственную запись с начальными значениями
INSERT INTO slot_settings (id, available_slots, total_slots_opened) 
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Создаем функцию для получения доступных слотов
CREATE OR REPLACE FUNCTION get_available_slots()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    slots INTEGER;
BEGIN
    SELECT available_slots INTO slots FROM slot_settings WHERE id = 1;
    RETURN COALESCE(slots, 0);
END;
$$;

-- Создаем функцию для уменьшения количества слотов
CREATE OR REPLACE FUNCTION decrease_available_slots()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_slots INTEGER;
BEGIN
    UPDATE slot_settings 
    SET available_slots = GREATEST(available_slots - 1, 0),
        updated_at = NOW()
    WHERE id = 1
    RETURNING available_slots INTO new_slots;
    
    RETURN COALESCE(new_slots, 0);
END;
$$;

-- Создаем функцию для увеличения количества слотов
CREATE OR REPLACE FUNCTION increase_available_slots()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_slots INTEGER;
    max_slots INTEGER;
BEGIN
    -- Получаем максимальное количество открытых слотов
    SELECT total_slots_opened INTO max_slots FROM slot_settings WHERE id = 1;
    
    -- Увеличиваем, но не больше максимума
    UPDATE slot_settings 
    SET available_slots = LEAST(available_slots + 1, COALESCE(max_slots, 0)),
        updated_at = NOW()
    WHERE id = 1
    RETURNING available_slots INTO new_slots;
    
    RETURN COALESCE(new_slots, 0);
END;
$$;

-- Создаем функцию для установки количества слотов
CREATE OR REPLACE FUNCTION set_available_slots(new_slots INTEGER, admin_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    result_slots INTEGER;
BEGIN
    UPDATE slot_settings 
    SET available_slots = new_slots,
        total_slots_opened = new_slots,
        updated_at = NOW(),
        updated_by = admin_id
    WHERE id = 1
    RETURNING available_slots INTO result_slots;
    
    RETURN COALESCE(result_slots, 0);
END;
$$;

-- Создаем индекс для быстрого доступа
CREATE INDEX IF NOT EXISTS idx_slot_settings_id ON slot_settings(id);

-- Добавляем комментарии
COMMENT ON TABLE slot_settings IS 'Настройки системы слотов для ограничения доступа';
COMMENT ON COLUMN slot_settings.available_slots IS 'Количество свободных мест (0 = waitlist режим)';
COMMENT ON COLUMN slot_settings.total_slots_opened IS 'Общее количество открытых мест в последний раз';
COMMENT ON COLUMN slot_settings.updated_by IS 'Telegram ID админа, который последний раз обновлял настройки'; 