-- Добавление функции для увеличения доступных слотов
-- Выполнить ПОСЛЕ основной миграции slots_system_migration.sql

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

-- Пример использования:
-- SELECT increase_available_slots(); -- Увеличивает available_slots на 1 