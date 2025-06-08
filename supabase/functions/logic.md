# YAD Everyday Bot Logic

## Общие принципы

- **Активные пользователи в системе** определяются как `in_chat = true`, что означает:
  - Пользователь физически в чате (`in_chat = true`)

## Схема БД

Основная таблица: `users`

Ключевые поля:
- telegram_id (bigint, primary key) — ID пользователя в Telegram
- first_name, last_name, username (text) — Данные из Telegram
- in_chat (boolean) — Физически присутствует в чате прямо сейчас (true при добавлении в чат, false при удалении)

**Логика активности:**
- Активный пользователь = `in_chat = true`

**Условие участия в челлендже:**
- Физически в чате (in_chat = true) И
- Имеет активную подписку (subscription_active = true ИЛИ subscription_days_left > 0)

Поля состояния:
- subscription_active (boolean) — Активная подписка через Tribute API
- subscription_days_left (int) — Остаток дней подписки с прошлого периода  
- subscription_id (text) — ID подписки в Tribute
- expires_at (timestamp) — Когда истекает текущая подписка
- subscription_started_at, subscription_cancelled_at (timestamp) — Даты
- strikes_count (int) — Количество пропусков подряд (дефолт 0)
- post_today (boolean) — Отправил ли пост сегодня (сбрасывается в 04:00 UTC)
- last_post_date (date) — Дата последнего поста
- units_count (int) — Общее количество постов пользователя
- pause_started_at, pause_until, pause_days — Информация о паузе
- mode (enum: "text", "image") — Режим участия
- pace (enum: "daily", "weekly") — Ритм участия
- public_remind (boolean) — Нужны ли публичные напоминания (дефолт true)
- payment_link_sent (timestamp) — Когда была отправлена ссылка на оплату
- promo_code (text) — Использованный промокод
- club (boolean) — Статус участника клуба (влияет на цену)
- joined_at, left_at (timestamp) — Когда присоединился/покинул чат
- created_at, updated_at, last_activity_at (timestamp) — Временные метки

Дополнительные служебные поля:
- period_id, period, price, amount, currency, subscription_name, tribute_user_id, channel_id, channel_name — Данные из Tribute API
- cancel_reason — Причина отмены подписки
- user_state — Состояние пользователя в процессе настройки

## Логика регистрации пользователей

При команде `/start`:
1. Находим пользователя по telegram_id
2. Если не найден — создаём новую запись с начальными значениями (strikes_count = 0, in_chat = false, telegram_id = ...)
3. Если найден — обновляем имя, фамилию, username из Telegram
4. Определяем тип пользователя:
   - **new_user** (новый) — нет joined_at ИЛИ user_state is null
   - **active_user** (уже активен) — in_chat = true
   - **continue_setup** (продолжение настройки) — user_state is not null
   - **returning_user** (возвращается) — joined_at is not null

### A1. /start → регистрация/актуализация пользователя

**Шаги:**
1. **Регистрация/актуализация пользователя** — находим в БД или создаём нового (см. выше)
2. **Проверка активности** — in_chat = true?
3. **Приветственное сообщение** — в зависимости от типа пользователя  
4. **Выбор режима** — режим участия (text/image)  
5. **Автоматическое назначение ритма** — daily для всех режимов (в коде: AVAILABLE_PACES.DAILY)
6. **Проверка оплаты** — проверяем сохранённые дни, статус клуба, отправляем ссылку

*Обновляются first_name, last_name, username.
* Если активен (in_chat = true) — отправляется MSG_WELCOME_ALREADY_ACTIVE и процесс завершается.
* Если продолжение настройки (user_state != null) — продолжаем с того места где остановились.
* Если возвращающийся с сохранёнными днями — направляем в чат.
* Если новый/возвращающийся без дней — запускаем процесс настройки.

**Детальные шаги настройки:**

1. **Выбор режима** → inline кнопки "Тексты" / "Картинки" → пользователь выбирает → mode сохраняется в БД
2. **Автоматическое назначение ритма** → pace = "daily" (новая логика — убрали выбор ритма)
3. **Проверка статуса клуба** → если club = true → сразу клубная ссылка
4. **Промокод (если не клуб)** → MSG_PROMO → кнопка "У меня нет промокода" ИЛИ ввод промокода текстом
5. **Ссылка на оплату** → в зависимости от клубного статуса
6. **Завершение** → user_state = null

**После оплаты:** 
* Webhook от Tribute → subscription_active = true → пользователь добавляется в чат.
* На этом этапе пользователь остаётся неактивным (in_chat = false).

**При входе в чат:**
* В базе обновляется in_chat = true.
* Отправляется MSG_CHAT_MEMBER_STATUS с детальной информацией о статусе.

### Упрощения в стартовом сценарии

1. **Убран выбор ритма** — автоматически назначается `daily` для всех режимов
2. **Отдельная команда ChangePace** — для тех, кто хочет изменить ритм позже  
3. **Упрощенный флоу** — режим → промокод → оплата (без промежуточного выбора ритма)

## Логика Tribute API

### Б6. Webhook новой подписки (new_subscription)

1. **Дедупликация** — проверяем, не был ли webhook уже обработан для этого пользователя в последний час
2. **Поиск пользователя** — находим по telegram_user_id, если не найден — создаём  
3. **Проверка сохранённых дней** — если subscription_days_left > 0, добавляем их к новой подписке
4. **Обновление данных** — subscription_active = true, expires_at, обнуляем subscription_days_left  
5. **Уведомление пользователя** — MSG_SUBSCRIPTION_RENEWED[_WITH_BONUS]

### Б7. Webhook отмены подписки (cancelled_subscription)

1. **Дедупликация** — аналогично Б6
2. **Поиск пользователя** — находим по telegram_user_id  
3. **Расчёт остатка** — считаем дни между текущей датой и expires_at
4. **Обновление данных** — subscription_active = false, subscription_days_left = остаток
5. **Уведомление** — MSG_SUBSCRIPTION_CANCELLED с информацией об остатке

* После отмены подписки (через webhook Tribute) — пользователь остается в чате до истечения оплаченного периода
* subscription_active = false, но subscription_days_left сохраняет остаток дней

## Логика ежедневных процессов

### Б1. Обработка поста с #daily (dailyPostHandler)

**Логика:**
* Если сообщение с #daily пришло в личку — отправляем предупреждение.
* Если в групповом чате — проверяем пользователя и засчитываем пост.

**Детали:**
* Если in_chat = false (пользователь неактивен):
  - Ничего не делаем
* Если in_chat = true (пользователь активен):
  - Увеличиваем units_count при каждом принятом посте с #daily
  - Если первый пост за день (post_today = false) → post_today = true, strikes_count = 0, отправляем MSG_DAILY_ACCEPTED
  - Если уже был пост сегодня (post_today = true) → только обновляем units_count и last_post_date

**Снятие с паузы через пост:**
* Если пользователь был на паузе (pause_until > now()) и прислал пост → снимаем с паузы, отправляем MSG_PAUSE_REMOVED_BY_POST

### Б2. Ежедневный cron в 04:00 UTC (dailyCron)

1. Для всех пользователей с in_chat = true и pace = "daily":
   - Если post_today = false (не прислал пост) → увеличиваем strikes_count на 1
   - Отправляем сообщения о страйках (MSG_STRIKE_FIRST, MSG_STRIKE_SECOND, MSG_STRIKE_THIRD, MSG_STRIKE_FOURTH)  
   - При 4-м страйке → ставим на паузу (pause_until = now + 7 дней)

2. Проверка истечения пауз:
   - Если pause_until <= now() и strikes_count = 4 (не было постов) → удаляем из чата БЕЗ БАНА (ban + unban), отправляем MSG_PAUSE_EXPIRED_REMOVED
   - Если pause_until <= now() и strikes_count < 4 (был пост) → снимаем с паузы

3. Для всех пользователей с subscription_days_left > 0 и in_chat = true и subscription_active = false:
   - Уменьшаем subscription_days_left на 1
   - За 3 дня до истечения → отправляем MSG_SUBSCRIPTION_ENDING_REMINDER
   - При достижении 0 → отправляем MSG_SUBSCRIPTION_EXPIRED

4. Для всех пользователей с subscription_days_left > 0 и in_chat = false:
   - НЕ уменьшаем subscription_days_left (дни сохраняются)

5. Для всех пользователей с in_chat = true и subscription_days_left = 0 (после истечения сохраненных дней):
   - Удаляем из чата БЕЗ БАНА (ban + unban — пользователь может вернуться по ссылке)
   - in_chat = false
   - Отправляем MSG_REMOVED_SUBSCRIPTION_EXPIRED

6. Сброс флагов: post_today = false для всех

7. **Отчёт админу:** детальная статистика через MSG_DAILY_CRON_REPORT

### Б3. Публичное напоминание в 20:00 UTC (publicDeadlineReminder)

1. Для всех пользователей с in_chat = true и pace = "weekly":
   - Отдельная логика еженедельных напоминаний (пока не реализована)

2. **Основная логика для ежедневных участников:**
   - Фильтруем пользователей: in_chat = true, pace = "daily", НЕ на паузе, public_remind = true, НЕ прислали пост сегодня
   - Разделяем по режимам: mode = "text" и mode = "image"  
   - Отправляем в соответствующие треды группового чата: PUBLIC_REMINDER_THREAD_ID_TEXT и PUBLIC_REMINDER_THREAD_ID_IMAGE
   - Используем MSG_PUBLIC_DEADLINE_REMINDER с динамическим временем до конца дня (04:00 UTC следующего дня)

**Механизм тредов:**
- TEXT участники → сообщение в тред ID = PUBLIC_REMINDER_THREAD_ID_TEXT
- IMAGE участники → сообщение в тред ID = PUBLIC_REMINDER_THREAD_ID_IMAGE
- Формат: "@username1, @username2 До конца дня осталось X часов!"

## Логика участия в чате

### Б4. Новый участник чата (handleNewChatMember) 

**Шаги:**
1. **Проверка пользователя** — находим в БД, если нет — создаём новую запись
2. **Обновление статуса** — in_chat = true, joined_at = now(), strikes_count = 0
3. **Восстановление подписки** — если subscription_days_left > 0, устанавливаем expires_at и обнуляем subscription_days_left
4. **Отправка статуса** — MSG_CHAT_MEMBER_STATUS с подробной информацией

**Логика активации:**
- in_chat = true (физически в чате)
- Активность в челлендже зависит от наличия подписки

### Б5. Участник покинул чат (handleLeftChatMember)

**Шаги:**
1. **Обновление статуса** — in_chat = false, left_at = now()
2. **Сохранение подписки** — если expires_at > now(), рассчитываем и сохраняем subscription_days_left
3. **Отправка уведомления** — MSG_LEFT_CHAT[_DAYS_SAVED] с информацией о сохранённых днях

**Логика сохранения дней:**
- Если уже есть subscription_days_left — оставляем как есть
- Если subscription_days_left = 0 ТОЛЬКО если subscription_days_left = 0 (если есть сохраненные дни, остается активным)
- Если есть действующая подписка (expires_at > now()) — рассчитываем остаток дней

**Сообщения при выходе:**
4. Если пользователь ещё активен в чате (in_chat = true):
   - Если есть сохранённые дни → MSG_LEFT_CHAT_DAYS_SAVED
   - Если нет сохранённых дней → MSG_LEFT_CHAT
5. Если пользователя удалил бот:
   - MSG_PAUSE_EXPIRED_REMOVED (после истечения паузы)  
   - MSG_REMOVED_SUBSCRIPTION_EXPIRED (после истечения подписки)

## Команды бота

### /start
- Основная логика регистрации (см. A1)

### /get  
- Показывает ID текущего чата (для настройки PUBLIC_REMINDER_THREAD_ID)

### /comeback
- Показывает приветствие для возвращающихся с информацией о сохранённых днях

### /reset
- Сбрасывает настройки: user_state = null, mode = null, pace = null
- Пользователь может начать процесс настройки заново

## Константы и переменные среды

**Временные параметры:**
- **AUTO_PAUSE_DAYS = 7** — количество дней паузы при 4-м страйке  
- **SUBSCRIPTION_REMINDER_DAYS = 3** — за сколько дней до истечения отправлять напоминание
- **DURATION_PENALTY_DAYS = 1** — штраф в днях за пропуск (не используется в текущей логике)
- **RESTORED_LIVES_AFTER_PENALTY = 2** — восстановление жизней после штрафа (не используется)

**ID и ссылки:**
- **PUBLIC_REMINDER_THREAD_ID_TEXT** — ID топика для текстовиков
- **PUBLIC_REMINDER_THREAD_ID_IMAGE** — ID топика для картинщиков  
- **OWNER_TELEGRAM_ID** — ID владельца бота для отчётов
- **CHALLENGE_JOIN_LINK** — ссылка на групповой чат
- **DEFAULT_PAYMENT_URL** — стандартная ссылка на оплату
- **SPECIAL_PAYMENT_URL** — клубная ссылка на оплату
- **MAIN_CHAT_ID** — ID основного чата проекта (для удаления пользователей)

**Режимы и ритмы:**
- **AVAILABLE_MODES** — доступные режимы: { TEXT: "text", IMAGE: "image" }
- **AVAILABLE_PACES** — доступные ритмы: { DAILY: "daily", WEEKLY: "weekly" }
- **MODE_PACE_CONFIG** — конфигурация режим-ритм (в будущем для расширения функциональности)

**Промокоды:**
- **VALID_PROMO_CODES** — массив валидных промокодов ["CLUB2024", "RETURN"]

**Переменные среды:**
- **TELEGRAM_BOT_TOKEN** — токен Telegram бота
- **TELEGRAM_GROUP_CHAT_ID** — ID группового чата для удаления пользователей
- **SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY** — параметры доступа к БД
- **TRIBUTE_API_KEY** — ключ для проверки подписи webhook'ов Tribute

## Методы удаления пользователей

**ВАЖНО:** Все удаления пользователей из чата происходят БЕЗ БАНА, чтобы пользователи могли вернуться по ссылке на чат.

**Реализация:** 
```typescript
// ❌ НЕПРАВИЛЬНО: kickChatMember (банит навсегда)
await fetch(`${TELEGRAM_API}/kickChatMember`, {...})

// ✅ ПРАВИЛЬНО: banChatMember с until_date в прошлом (мгновенный разбан)
const untilDate = Math.floor(Date.now() / 1000) - 1; // время в прошлом
await fetch(`${TELEGRAM_API}/banChatMember`, { 
  until_date: untilDate, 
  revoke_messages: false 
})
```

**Функция:** `removeUserFromChatWithoutBan(userId, groupChatId, telegramBotToken)` в `constants.ts`

**Применяется при:**
- Истечении паузы с 4 страйками
- Истечении сохраненных дней подписки без продления

