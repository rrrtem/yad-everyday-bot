-- =====================================================
-- НАСТРОЙКА CRON ЗАДАЧ ДЛЯ YAD EVERYDAY BOT
-- =====================================================
-- Запускать через Supabase SQL Editor или supabase cli

-- 1. Активируем расширение pg_cron (если не активировано)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Ежедневная проверка (dailyCron) - каждый день в 04:00 UTC
-- Реализует логику Б2 из logic.md
SELECT cron.schedule(
    'daily-cron-check',                                    -- название задачи
    '0 4 * * *',                                          -- cron расписание: каждый день в 04:00 UTC
    'SELECT net.http_post(
        url := ''https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/bot'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'',
        body := ''{"type": "daily"}''
    );'
);

-- 3. Публичные напоминания (publicDeadlineReminder) - каждый день в 20:00 UTC  
-- Реализует логику Б3 из logic.md
SELECT cron.schedule(
    'public-reminder',                                     -- название задачи
    '0 20 * * *',                                         -- cron расписание: каждый день в 20:00 UTC
    'SELECT net.http_post(
        url := ''https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/bot'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'',
        body := ''{"type": "public_reminder"}''
    );'
);

-- 4. Еженедельная проверка (weeklyCron) - каждый понедельник в 03:00 UTC
-- TODO: Реализовать функцию weeklyCron в cronHandler.ts (пока отключено)
/*
SELECT cron.schedule(
    'weekly-cron-check',                                   -- название задачи
    '0 3 * * 1',                                          -- cron расписание: каждый понедельник в 03:00 UTC
    'SELECT net.http_post(
        url := ''https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/bot'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'',
        body := ''{"type": "weekly"}''
    );'
);
*/

-- =====================================================
-- КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ CRON ЗАДАЧАМИ
-- =====================================================

-- Просмотр всех активных cron задач
-- SELECT * FROM cron.job;

-- Отключение задачи (если нужно)
-- SELECT cron.unschedule('daily-cron-check');
-- SELECT cron.unschedule('public-reminder');

-- Включение задачи обратно (после отключения)
-- Используйте команды SELECT cron.schedule(...) выше

-- Просмотр логов выполнения cron задач
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- =====================================================
-- ИНСТРУКЦИИ ПО НАСТРОЙКЕ
-- =====================================================

/*
1. ЗАМЕНИТЕ PLACEHOLDER'Ы:
   - YOUR_SUPABASE_PROJECT_REF: ваш project reference (например: abcdefghijk)
   - YOUR_ANON_KEY: ваш anon/public key из Supabase Dashboard

2. ПОЛУЧЕНИЕ ДАННЫХ:
   - Project Ref: Supabase Dashboard → Settings → General → Project Settings
   - Anon Key: Supabase Dashboard → Settings → API → Project API keys → anon/public

3. ВЫПОЛНЕНИЕ:
   - Скопируйте команды в Supabase SQL Editor
   - Замените placeholder'ы на реальные значения
   - Выполните команды

4. ПРОВЕРКА:
   - SELECT * FROM cron.job; - проверить активные задачи
   - SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5; - проверить последние запуски

5. ВРЕМЕННЫЕ ЗОНЫ:
   - Все времена указаны в UTC
   - 04:00 UTC = 07:00 MSK летом, 07:00 MSK зимой  
   - 20:00 UTC = 23:00 MSK летом, 23:00 MSK зимой

6. БЕЗОПАСНОСТЬ:
   - Используйте service_role key вместо anon key для большей безопасности
   - Или настройте RLS политики для доступа к функциям
*/ 