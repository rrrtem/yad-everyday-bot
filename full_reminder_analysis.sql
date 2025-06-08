-- ПОЛНЫЙ АНАЛИЗ: Все пользователи и их статус для публичных напоминаний
-- Показывает кто получит напоминание СЕЙЧАС, а кто нет и почему

SELECT 
  telegram_id,
  first_name,
  last_name,
  username,
  mode,
  pace,
  in_chat,
  post_today,
  public_remind,
  pause_until,
  strikes_count,
  subscription_active,
  subscription_days_left,
  expires_at,
  
  -- 7 условий с проверками
  CASE WHEN in_chat = true THEN '✅' ELSE '❌' END as "1️⃣_in_chat", 
  CASE WHEN pace = 'daily' THEN '✅' ELSE '❌' END as "3️⃣_pace_daily",
  CASE WHEN (pause_until IS NULL OR pause_until <= NOW()) THEN '✅' ELSE '❌' END as "4️⃣_not_paused",
  CASE WHEN public_remind = true THEN '✅' ELSE '❌' END as "5️⃣_public_remind",
  CASE WHEN post_today = false THEN '✅' ELSE '❌' END as "6️⃣_no_post_today",
  CASE WHEN username IS NOT NULL AND username != '' THEN '✅' ELSE '❌' END as "7️⃣_has_username",
  
  -- РЕЗУЛЬТАТ и детальная причина
  CASE WHEN 
    in_chat = true AND 
    pace = 'daily' AND 
    (pause_until IS NULL OR pause_until <= NOW()) AND
    public_remind = true AND 
    post_today = false AND 
    username IS NOT NULL AND username != ''
  THEN '🎯 ПОЛУЧИТ НАПОМИНАНИЕ' 
  ELSE '❌ НЕ ПОЛУЧИТ' 
  END as "РЕЗУЛЬТАТ",
  
  -- Детальная причина исключения (первая найденная)
  CASE 
    WHEN in_chat = false THEN '🚪 Не в чате'
    WHEN pace IS NULL THEN '❓ Не выбрал ритм'
    WHEN pace != 'daily' THEN '📅 Еженедельный ритм'
    WHEN pause_until IS NOT NULL AND pause_until > NOW() THEN '⏸️ На паузе до ' || TO_CHAR(pause_until, 'DD.MM.YYYY HH24:MI')
    WHEN public_remind = false THEN '🔕 Отключил напоминания'
    WHEN post_today = true THEN '✅ Уже отправил пост'
    WHEN username IS NULL OR username = '' THEN '👤 Нет username'
    ELSE '✅ ВСЕ УСЛОВИЯ ВЫПОЛНЕНЫ'
  END as "ПРИЧИНА"

FROM users 

ORDER BY 
  -- Сначала те, кто получит напоминание
  CASE WHEN 
    in_chat = true AND 
    pace = 'daily' AND 
    (pause_until IS NULL OR pause_until <= NOW()) AND
    public_remind = true AND 
    post_today = false AND 
    username IS NOT NULL AND username != ''
  THEN 0 ELSE 1 END,
  
  -- Потом по статусу
  in_chat DESC,
  mode,
  first_name;

-- КРАТКАЯ СТАТИСТИКА
SELECT '═══ СТАТИСТИКА ═══' as "ИТОГИ";

SELECT 
  COUNT(*) as "Всего пользователей",
  COUNT(CASE WHEN in_chat = true THEN 1 END) as "В чате",
  COUNT(CASE WHEN pace = 'daily' THEN 1 END) as "С ежедневным ритмом",
  COUNT(CASE WHEN 
    in_chat = true AND 
    pace = 'daily' AND 
    (pause_until IS NULL OR pause_until <= NOW()) AND
    public_remind = true AND 
    post_today = false AND 
    username IS NOT NULL AND username != ''
  THEN 1 END) as "🎯 ПОЛУЧАТ НАПОМИНАНИЕ"
FROM users;

-- ГРУППИРОВКА ПО ПРИЧИНАМ
SELECT '═══ ПРИЧИНЫ ИСКЛЮЧЕНИЯ ═══' as "АНАЛИЗ";

SELECT 
  CASE 
    WHEN in_chat = false THEN '🚪 Не в чате'
    WHEN pace IS NULL THEN '❓ Не выбрал ритм'
    WHEN pace != 'daily' THEN '📅 Еженедельный ритм'
    WHEN pause_until IS NOT NULL AND pause_until > NOW() THEN '⏸️ На паузе'
    WHEN public_remind = false THEN '🔕 Отключил напоминания'
    WHEN post_today = true THEN '✅ Уже отправил пост'
    WHEN username IS NULL OR username = '' THEN '👤 Нет username'
    ELSE '🎯 ПОЛУЧИТ НАПОМИНАНИЕ'
  END as "Причина",
  COUNT(*) as "Количество"
FROM users 
GROUP BY 
  CASE 
    WHEN in_chat = false THEN '🚪 Не в чате'
    WHEN pace IS NULL THEN '❓ Не выбрал ритм'
    WHEN pace != 'daily' THEN '📅 Еженедельный ритм'
    WHEN pause_until IS NOT NULL AND pause_until > NOW() THEN '⏸️ На паузе'
    WHEN public_remind = false THEN '🔕 Отключил напоминания'
    WHEN post_today = true THEN '✅ Уже отправил пост'
    WHEN username IS NULL OR username = '' THEN '👤 Нет username'
    ELSE '🎯 ПОЛУЧИТ НАПОМИНАНИЕ'
  END
ORDER BY 
  CASE 
    WHEN COUNT(*) > 0 AND 
      CASE 
        WHEN in_chat = false THEN '🚪 Не в чате'
        WHEN pace IS NULL THEN '❓ Не выбрал ритм'
        WHEN pace != 'daily' THEN '📅 Еженедельный ритм'
        WHEN pause_until IS NOT NULL AND pause_until > NOW() THEN '⏸️ На паузе'
        WHEN public_remind = false THEN '🔕 Отключил напоминания'
        WHEN post_today = true THEN '✅ Уже отправил пост'
        WHEN username IS NULL OR username = '' THEN '👤 Нет username'
        ELSE '🎯 ПОЛУЧИТ НАПОМИНАНИЕ'
      END = '🎯 ПОЛУЧИТ НАПОМИНАНИЕ'
    THEN 0 ELSE 1 
  END,
  COUNT(*) DESC; 