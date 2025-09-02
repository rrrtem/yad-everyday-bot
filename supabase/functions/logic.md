# YAD Everyday Bot Logic

## ✅ Реализованные изменения

### Отключение режима картинки (завершено)
- **Удален режим "image"** из всех констант и настроек
- **Оставлен только режим "text"** для всех пользователей
- **Обновлены все компоненты:**
  - constants.ts — удалены AVAILABLE_MODES.IMAGE, PUBLIC_REMINDER_THREAD_ID_IMAGE
  - changeModeHandler.ts — упрощена логика смены режима
  - SetupProcess.ts — убрана кнопка выбора картинок
  - statusCallbackHandlers.ts — упрощена логика выбора режима и ритма
  - ReportGenerator.ts — убрана логика разделения по режимам
  - statusMessageGenerator.ts — упрощено отображение режима
  - Все сообщения обновлены без упоминаний картинок
- **Обновлена документация** — logic.md, README файлы

### Второй администратор (завершено)
- **Добавлен массив ADMIN_TELEGRAM_IDS** вместо одного OWNER_TELEGRAM_ID
- **Создана функция isAdmin()** для проверки административных прав
- **Обновлены все компоненты** для отправки уведомлений всем админам:
  - AdminReporter.ts — отчеты отправляются всем админам
  - SlotManager.ts — уведомления о заполнении слотов
  - tributeApiHandler.ts — уведомления о webhook'ах
  - index.ts — проверка админских команд
  - commandHandler.ts — обработка админских команд
- **Сохранена обратная совместимость** — OWNER_TELEGRAM_ID = ADMIN_TELEGRAM_IDS[0]

**Для активации:** Замените `123456789` в `ADMIN_TELEGRAM_IDS` на реальный Telegram ID второго админа.

## Общие принципы

- **Активные пользователи в системе** определяются как `in_chat = true`, что означает:
  - Пользователь физически в чате (`in_chat = true`)

## Схема БД

Основная таблица: `users`

### Ключевые поля:
- telegram_id (bigint, primary key) — ID пользователя в Telegram
- first_name, last_name, username (text) — Данные из Telegram
- in_chat (boolean) — Физически присутствует в чате прямо сейчас (true при добавлении в чат, false при удалении)

**Логика активности:**
- Активный пользователь = `in_chat = true`

**Условие участия в челлендже:**
- Физически в чате (in_chat = true) И
- Имеет активную подписку (subscription_active = true ИЛИ subscription_days_left > 0)

### Поля состояния:
- subscription_active (boolean) — Активная подписка через Tribute API
- subscription_days_left (int) — Остаток дней подписки с прошлого периода  
- subscription_id (text) — ID подписки в Tribute
- expires_at (timestamp) — Когда истекает текущая подписка
- subscription_started_at, subscription_cancelled_at (timestamp) — Даты
- strikes_count (int) — Количество пропусков подряд (дефолт 0)
- post_today (boolean) — Отправил ли пост сегодня (сбрасывается в 04:00 UTC)
- last_post_date (date) — Дата последнего поста
- units_count (int) — Общее количество постов пользователя
- consecutive_posts_count (int) — Количество постов подряд без пропусков (сбрасывается при страйке)
- pause_started_at, pause_until, pause_days — Информация о паузе
- mode (enum: "text") — Режим участия
- pace (enum: "daily", "weekly") — Ритм участия
- public_remind (boolean) — Нужны ли публичные напоминания (дефолт true)
- payment_link_sent (timestamp) — Когда была отправлена ссылка на оплату
- promo_code (text) — Использованный промокод
- club (boolean) — Статус участника клуба (влияет на цену)
- joined_at, left_at (timestamp) — Когда присоединился/покинул чат
- created_at, updated_at, last_activity_at (timestamp) — Временные метки

### Поля системы waitlist (добавлены в waitlist_migration.sql):
- waitlist (boolean) — Находится ли пользователь в списке ожидания
- waitlist_position (integer) — Позиция пользователя в очереди (1, 2, 3...)
- waitlist_added_at (timestamp) — Время добавления пользователя в список ожидания

### Дополнительные служебные поля:
- period_id, period, price, amount, currency, subscription_name, tribute_user_id, channel_id, channel_name — Данные из Tribute API
- cancel_reason — Причина отмены подписки
- user_state — Состояние пользователя в процессе настройки
- mode_changed_at, pace_changed_at — Когда изменялись режим и ритм
- payment_cancel_link_sent — Когда была отправлена ссылка на отмену

### Поля отслеживания сообщений (добавлены в message_tracking_migration.sql):
- last_daily_message_id (bigint) — ID последнего сообщения MSG_DAILY_ACCEPTED
- last_milestone_message_id (bigint) — ID последнего сообщения MSG_DAILY_MILESTONE

**Назначение:** Автоматическое удаление предыдущих сообщений того же типа при отправке новых, чтобы избежать накопления сообщений в чате.

### Таблица slot_settings (добавлена в slots_system_migration.sql):
- id (integer, primary key, default 1) — Всегда 1 (единственная запись)
- available_slots (integer) — Количество свободных мест (0 = waitlist режим)
- total_slots_opened (integer) — Общее количество открытых мест в последний раз
- updated_at (timestamp) — Когда последний раз обновлялось
- updated_by (bigint) — Telegram ID админа, который последний раз обновлял

## Система динамических слотов

### Описание
Реализована система ограничения доступа через динамические слоты. Когда available_slots = 0, новые пользователи попадают в waitlist.

### Функции PostgreSQL:
- `get_available_slots()` — Получение количества доступных слотов
- `set_available_slots(new_slots, admin_id)` — Установка количества слотов
- `decrease_available_slots()` — Уменьшение на 1 (при входе пользователя)
- `increase_available_slots()` — Увеличение на 1 (при выходе пользователя, но не больше максимума)

### Класс SlotManager:
- `getAvailableSlots()` — Получает количество доступных слотов
- `setAvailableSlots(slots, adminId)` — Устанавливает количество слотов
- `hasAvailableSlots()` — Проверяет наличие свободных мест
- `decreaseAvailableSlots()` — Занимает слот
- `increaseAvailableSlots()` — Освобождает слот
- `getSlotStats()` — Получает статистику (доступно/всего)

### Команды админа:
- `/open[число]` — Установить количество мест (например, /open20)
- `/close_slots` — Закрыть все места (waitlist режим)
- `/slots` — Показать текущий статус
- `/test_slots` — Тестирование системы слотов

## Логика регистрации пользователей

При команде `/start`:
1. Находим пользователя по telegram_id
2. Если не найден — создаём новую запись с начальными значениями (strikes_count = 0, in_chat = false, telegram_id = ...)
3. Если найден — обновляем имя, фамилию, username из Telegram
4. Определяем тип пользователя через UserAnalyzer:
   - **new_user** (новый) — нет joined_at ИЛИ user_state is null
   - **active_user** (уже активен) — in_chat = true
   - **continue_setup** (продолжение настройки) — user_state is not null
   - **returning_user** (возвращается) — joined_at is not null И не активен
   - **in_waitlist** (в списке ожидания) — waitlist = true

### A1. /start → регистрация/актуализация пользователя

**Шаги (реализовано в startCommand/index.ts):**
1. **UserAnalyzer** — анализ типа пользователя и создание UserContext
2. **Автоматическая проверка клубного статуса** — по username через club.json
3. **Маршрутизация по Flow** в зависимости от типа пользователя:

**Flow NewUserFlow:**
1. Отправляет MSG_WELCOME
2. Проверяет доступные слоты через SlotManager.hasAvailableSlots()
3. Если слотов нет → WaitlistFlow.handle()
4. Если есть → SetupProcess.startModeSelection()

**Flow ActiveUserFlow:**
- Отправляет MSG_WELCOME_ALREADY_ACTIVE и завершается

**Flow ReturningUserFlow:**
1. Проверяет сохранённые дни (hasSavedDays)
2. Если есть → отправляет MSG_WELCOME_RETURNING + PaymentHandler.sendDirectChatLinkWithButton()
3. Если нет → проверяет слоты и запускает настройку или waitlist

**Flow ContinueSetupFlow:**
- Продолжает с состояния user_state (waiting_mode, waiting_promo, payment_link_sent)

**Flow WaitlistFlow:**
1. Добавляет в список ожидания с позицией
2. Устанавливает user_state = "in_waitlist"
3. Отправляет MSG_WAITLIST с позицией в очереди

### Упрощения в стартовом сценарии

1. **Убран выбор ритма** — автоматически назначается `daily` для всех режимов (в ModeSelectionHandler)
2. **Система слотов** — ограничение доступа через waitlist при заполнении мест
3. **Автопроверка клуба** — статус определяется по username из club.json
4. **Упрощенный флоу** — режим → промокод → оплата (без промежуточного выбора ритма)

### A2. /comeback

**Реализация:** handleComebackCommand in commandHandler.ts
1. Находит пользователя по telegram_id
2. Проверяет subscription_days_left > 0
3. Отправляет MSG_WELCOME_RETURNING с информацией о сохранённых днях

### A3. /reset

**Реализация:** handleResetCommand in commandHandler.ts
1. Сбрасывает user_state = null, mode = null, pace = null
2. Очищает временное состояние из Map
3. Отправляет MSG_RESET_SUCCESS

### A4. /status

**Реализация:** handleStatusCommand in commandHandler.ts
1. Получает данные пользователя из БД
2. Формирует MSG_CHAT_MEMBER_STATUS с подробной информацией
3. Отправляет через sendStatusMessageWithButtons с кнопками:
   - 💳 "Подписка и платежи" → TRIBUTE_BOT_LINK
   - 🆘 "Поддержка" → ADMIN_CONTACT

### A5. /get

**Реализация:** handleGetCommand in commandHandler.ts
- Показывает ID текущего чата для настройки PUBLIC_REMINDER_THREAD_ID

### A6. Команды изменения настроек

**A6.1. /change_mode — смена режима участия**

**Реализация:** handleChangeModeCommand in changeModeHandler.ts

**Логика:**
1. **Проверка активности** — пользователь должен быть активным (in_chat = true ИЛИ subscription_active = true ИЛИ subscription_days_left > 0)
2. **Отправка выбора** — показывает доступные режимы:
   - Показывает 📝 "Тексты" → callback_data: "change_mode:text"
   - Если режим уже выбран — показывает MSG_CHANGE_MODE_ALL_SET без кнопок
3. **Обработка callback** — handleChangeModeCallback:
   - Проверяет, не выбран ли уже этот режим
   - Обновляет mode в БД + mode_changed_at
   - Отправляет подтверждение с информацией о топике

**Константы:**
- MSG_CHANGE_MODE_SELECTION — сообщение с выбором режимов
- MSG_CHANGE_MODE_SUCCESS — подтверждение смены с информацией о топике
- MSG_CHANGE_MODE_SAME — если режим уже выбран
- MSG_CHANGE_MODE_NOT_ACTIVE — если пользователь не активен
- MSG_CHANGE_MODE_ALL_SET — если нет доступных для переключения режимов
- CALLBACK_CHANGE_MODE_TEXT — callback data для кнопки

**Эталонные переменные:**
- mode: "text" (из AVAILABLE_MODES)
- PUBLIC_REMINDER_THREAD_ID_TEXT — ID топика для напоминаний

**Изменения в логике (текущая версия):**
- sendModeSelectionMessage теперь принимает currentMode и фильтрует кнопки
- Показывает только режимы, отличные от текущего

## Система персонализированных команд меню

### Описание логики

**Реализация:** BotMenuManager in utils/botMenuManager.ts

Бот показывает персонализированные команды в меню в зависимости от состояния пользователя:

### Для пользователей НЕ в чате (in_chat = false):
- ❤️‍🔥 `/start` — Начать участие

### Для пользователей В чате (in_chat = true):
- 👀 `/status` — Мой статус  
- 🌗 `/change_mode` — Изменить режим
- 💨 `/change_pace` — Изменить ритм
- 😴 `/pause` — Каникулы
- 🔔/🔕 `/reminder` — Включить/Выключить напоминания (динамическая)
- 💳 `/tribute` — Подписка

### Динамическая команда напоминаний:
- **Если public_remind = true:** 🔕 "Выключить напоминания"
- **Если public_remind = false:** 🔔 "Включить напоминания"

### Константы команд меню:
**В constants.ts:**
- MENU_CMD_START — для неактивных пользователей
- MENU_CMD_STATUS, MENU_CMD_CHANGE_MODE, MENU_CMD_CHANGE_PACE, MENU_CMD_PAUSE, MENU_CMD_TRIBUTE — для активных пользователей
- MENU_CMD_REMINDER_ENABLE, MENU_CMD_REMINDER_DISABLE — динамические варианты
- MENU_CMD_REMINDER_GENERIC — fallback для глобальных команд

### Методы BotMenuManager:
- `updateUserMenu(telegramId)` — Обновляет меню для конкретного пользователя
- `generateCommandsForUser(user)` — Генерирует список команд на основе состояния пользователя
- `setUserCommands(telegramId, commands)` — Устанавливает персональные команды через Telegram API
- `setDefaultCommands()` — Устанавливает универсальные команды (fallback)
- `clearUserCommands(telegramId)` — Удаляет персональные команды пользователя

### Триггеры обновления меню:
Меню обновляется автоматически при изменениях состояния пользователя:
- Регистрация нового пользователя (userHandler.ts)
- Вход/выход из чата (userHandler.ts)
- Сброс настроек (commandHandler.ts)
- Изменение настроек напоминаний (statusCallbackHandlers.ts)

### Использование Telegram API:
- **Персональные команды:** scope = "chat" с конкретным chat_id
- **Глобальные команды:** scope = "default" для всех пользователей (fallback)
- **Очистка команд:** deleteMyCommands для сброса персонализации
- Готова к добавлению новых режимов в будущем

**НЕ РЕАЛИЗОВАНО:**
- `/change_pace` — для смены ритма (упоминается в MSG_WELCOME_ALREADY_ACTIVE, MSG_STRIKE_FOURTH)

## Логика Tribute API

### Б6. Webhook новой подписки (new_subscription)

**Реализация:** handleNewSubscription in tributeApiHandler.ts

1. **Дедупликация** — проверяем через isWebhookAlreadyProcessed (по telegram_user_id в последний час)
2. **Поиск пользователя** — находим по telegram_user_id, если не найден — создаём новую запись
3. **Проверка сохранённых дней** — если subscription_days_left > 0, добавляем их к expires_at
4. **Обновление данных** — subscription_active = true, expires_at (с учётом бонуса), обнуляем subscription_days_left
5. **Уведомление пользователя** — MSG_SUBSCRIPTION_RENEWED или MSG_SUBSCRIPTION_RENEWED_WITH_BONUS

### Б7. Webhook отмены подписки (cancelled_subscription)

**Реализация:** handleCancelledSubscription in tributeApiHandler.ts

1. **Дедупликация** — аналогично Б6
2. **Поиск пользователя** — находим по telegram_user_id, если не найден — создаём
3. **Расчёт остатка** — считаем дни между текущей датой и expires_at
4. **Обновление данных** — subscription_active = false, subscription_days_left = остаток
5. **Уведомление** — MSG_SUBSCRIPTION_CANCELLED с информацией об остатке

После отмены подписки пользователь остается в чате до истечения оплаченного периода.

## Логика ежедневных процессов

### Б1. Обработка поста с #daily (dailyPostHandler)

**Реализация:** handleDailyPost in dailyPostHandler.ts

**Логика:**
- Если сообщение с #daily пришло в личку — отправляем MSG_DAILY_TO_GROUPCHAT
- Если в групповом чате — проверяем пользователя и засчитываем пост

**Детали:**
- Если пользователь не найден в БД — создаём новую запись и засчитываем первый пост
- **Увеличиваем units_count при каждом принятом посте с #daily** (всегда)
- Если первый пост за день (post_today = false):
  - post_today = true, strikes_count = 0
  - **Увеличиваем consecutive_posts_count на 1** (количество постов подряд без пропусков)
  - Если был на паузе — снимаем с паузы, отправляем MSG_PAUSE_REMOVED_BY_POST
  - Отправляем MSG_DAILY_ACCEPTED(units_count, consecutive_posts_count) **с автоудалением предыдущего**
  - **Если units_count кратно 10 — отправляем MSG_DAILY_MILESTONE(units_count)** **с автоудалением предыдущего**
- Если уже был пост сегодня (post_today = true) — только обновляем units_count и last_post_date без сообщения

**Новые поля БД:**
- **consecutive_posts_count** — количество постов подряд без пропусков (сбрасывается при страйке или входе в чат)

**Автоудаление сообщений:**
- Сообщения MSG_DAILY_ACCEPTED и MSG_DAILY_MILESTONE автоматически удаляют предыдущие сообщения того же типа
- ID сообщений сохраняются в полях last_daily_message_id и last_milestone_message_id
- Это предотвращает накопление уведомлений в личном чате пользователя

### Б2. Ежедневный cron в 04:00 UTC (dailyCron)

**Реализация:** DailyCronFlow in cronHandler/flows/DailyCronFlow.ts
**Обработка:** UserProcessor in cronHandler/helpers/UserProcessor.ts

**Фазы выполнения:**

1. **Проверка активных пользователей с ежедневным ритмом (страйки)**
   - Для всех пользователей с in_chat = true и pace = "daily"
   - Если post_today = false (не прислал пост) и НЕ на паузе → увеличиваем strikes_count на 1
   - **Сбрасываем consecutive_posts_count = 0** (прерывается серия постов)
   - Отправляем сообщения о страйках (MSG_STRIKE_FIRST/SECOND/THIRD/FOURTH)
   - При 4-м страйке → ставим на паузу (pause_until = now + 7 дней)

2. **Проверка пользователей на паузе**
   - Если pause_until <= now() и strikes_count = 4 (не было постов) → удаляем из чата БЕЗ БАНА, отправляем MSG_PAUSE_EXPIRED_REMOVED
   - Если pause_until <= now() и strikes_count < 4 (был пост) → снимаем с паузы

3. **Обработка подписок (subscription_days_left)**
   - Для пользователей с subscription_days_left > 0, in_chat = true, subscription_active = false
   - Уменьшаем subscription_days_left на 1
   - За 3 дня до истечения → отправляем MSG_SUBSCRIPTION_ENDING_REMINDER
   - При достижении 0 → добавляем в список для удаления

4. **Удаление пользователей с истекшей подпиской**
   - Удаляем из чата БЕЗ БАНА (ban + unban)
   - in_chat = false
   - Отправляем MSG_REMOVED_SUBSCRIPTION_EXPIRED

5. **Сброс ежедневных флагов**
   - post_today = false для всех пользователей

6. **Анализ опасных случаев**
   - Пользователи с 3 страйками
   - Новые пользователи без подписки
   - Пользователи в чате без активной подписки и сохранённых дней

7. **Отправка отчёта админу**
   - MSG_DAILY_CRON_REPORT с детальной статистикой

### Б3. Публичное напоминание в 20:00 UTC (publicDeadlineReminder)

**Реализация:** PublicReminderFlow in cronHandler/flows/PublicReminderFlow.ts

**Логика:**
1. Фильтрует пользователей: in_chat = true, pace = "daily", НЕ на паузе, public_remind = true, НЕ прислали пост сегодня, username != null
2. Создает сообщение с тегами всех подходящих пользователей: "@nickname1 @nickname2 @nickname3 Ждем ваш текст!"
3. Отправляет в тред PUBLIC_REMINDER_THREAD_ID_TEXT

### Б4. allInfo - детальный отчёт для админа

**Реализация:** AllInfoFlow in cronHandler/flows/AllInfoFlow.ts

Отправляет тот же MSG_DAILY_CRON_REPORT что и dailyCron, но без изменения данных в БД.

## Логика участия в чате

### Б5. Новый участник чата (handleNewChatMember)

**Реализация:** handleNewChatMember in newChatMemberHandler.ts

**Шаги:**
1. **Проверка пользователя** — находим в БД, если нет — создаём через registerUser
2. **Обновление статуса** — in_chat = true, joined_at = now(), strikes_count = 0
3. **Уменьшение слотов** — вызываем SlotManager.decreaseAvailableSlots()
4. **Отправка статуса** — MSG_CHAT_MEMBER_STATUS с кнопками

**ВАЖНО:** Сохранённые дни НЕ обнуляются при входе в чат (была ошибка в старой версии).

### Б6. Участник покинул чат (handleLeftChatMember)

**Реализация:** handleLeftChatMember in leftChatMemberHandler.ts

**Шаги:**
1. **Обновление статуса** — in_chat = false, left_at = now()
2. **Увеличение слотов** — вызываем SlotManager.increaseAvailableSlots()
3. **Сохранение подписки** — если expires_at > now(), рассчитываем и сохраняем subscription_days_left
4. **Отправка уведомления** — MSG_LEFT_CHAT или MSG_LEFT_CHAT_DAYS_SAVED

## Команды бота

### Пользовательские команды:
- `/start` — Основная логика регистрации (A1)
- `/comeback` — Информация о возвращении с сохранёнными днями (A2)
- `/reset` — Сброс настроек (A3)
- `/status` — Детальная информация о статусе (A4)
- `/get` — ID текущего чата (A5)

### Команды владельца бота:

**Основные команды:**
- `/daily` — Запуск dailyCron вручную
- `/remind` — Запуск publicDeadlineReminder вручную
- `/allinfo` — Запуск детального отчёта
- `/get` — Получение ID текущего чата (для настройки тредов)
- `/update_menu` — Принудительное обновление команд меню

**Tribute API команды:**
- `/tribute_test` — Тестирование Tribute webhook'ов
- `/sync_subscriptions` — Синхронизация подписок
- `/test_webhook [тип] [telegram_id]` — Симуляция webhook'а

**Команды системы слотов:**
- `/open[число]` — Установить количество мест (например, /open20)
- `/close_slots` — Закрыть все места (waitlist режим)
- `/slots` — Показать текущий статус слотов
- `/test_slots` — Тестирование системы слотов

**Команды массовых действий:**
- `/broadcast_chat [сообщение]` — Рассылка пользователям В чате
- `/broadcast_nochat [сообщение]` — Рассылка пользователям НЕ в чате
- `/mass_status` — Массовый вызов /status у всех пользователей в чате

**Системные команды:**
- `/force_update_commands` — Принудительное обновление команд с очисткой кэша

**Полный список и документация:** см. `docs/ADMIN_COMMANDS.md` и `constants.ts` (ADMIN_COMMANDS)

### Команды НЕ РЕАЛИЗОВАНЫ:
- `/change_mode` — Смена режима участия
- `/change_pace` — Смена ритма участия

## Обработка callback кнопок

**Реализация:** handleStartCallbackQuery in startCommand/index.ts

Обрабатывает нажатия inline кнопок:
- Выбор режима (text)
- Промокоды (no_promo/have_promo)
- Кнопки статуса (tribute_bot/admin_contact)

## Обработка текстовых сообщений

**Реализация:** handleTextMessage in commandHandler.ts

Обрабатывает промокоды когда user_state = "waiting_promo".

## Константы и переменные среды

**Администраторы:**
- **ADMIN_TELEGRAM_IDS = [149365895, 123456789]** — массив ID администраторов бота
- **isAdmin(telegramId)** — функция проверки, является ли пользователь администратором

**Временные параметры:**
- **AUTO_PAUSE_DAYS = 7** — количество дней паузы при 4-м страйке
- **SUBSCRIPTION_REMINDER_DAYS = 3** — за сколько дней до истечения отправлять напоминание
- **WEBHOOK_DEDUPLICATION_HOURS = 1** — время дедупликации webhook'ов

**ID и ссылки:**
- **PUBLIC_REMINDER_THREAD_ID_TEXT = 2** — ID топика для текстовиков

- **ADMIN_TELEGRAM_IDS = [149365895, 123456789]** — ID администраторов бота для отчётов (замените 123456789 на реальный ID второго админа)
- **CHALLENGE_JOIN_LINK** — ссылка на групповой чат
- **DEFAULT_PAYMENT_URL** — стандартная ссылка на оплату
- **SPECIAL_PAYMENT_URL** — клубная ссылка на оплату
- **TRIBUTE_BOT_LINK** — ссылка на Tribute для управления подпиской
- **ADMIN_CONTACT = "@rrrtem"** — контакт поддержки

**Режимы и ритмы:**
- **AVAILABLE_MODES** — { TEXT: "text" }
- **AVAILABLE_PACES** — { DAILY: "daily", WEEKLY: "weekly" }

**Промокоды:**
- **VALID_PROMO_CODES = ["YASSS", "FREE10"]**
- **PROMO_TYPES** — YASSS (клубная скидка), FREE10 (бесплатные дни)
- **FREE_PROMO_DAYS = 10** — количество дней для FREE10

**Переменные среды:**
- **TELEGRAM_BOT_TOKEN** — токен Telegram бота
- **TELEGRAM_GROUP_CHAT_ID** — ID группового чата для удаления пользователей
- **SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY** — параметры доступа к БД
- **TRIBUTE_API_KEY** — ключ для проверки подписи webhook'ов Tribute

## Архитектура cronHandler

Модуль разделён на компоненты:

**flows/** — Основные потоки:
- DailyCronFlow.ts — ежедневная проверка
- PublicReminderFlow.ts — публичные напоминания  
- AllInfoFlow.ts — детальный отчёт

**helpers/** — Вспомогательные классы:
- UserProcessor.ts — обработка логики пользователей
- ReportGenerator.ts — генерация отчётов
- ChatManager.ts — работа с чатом

## Архитектура startCommand

Модуль разделён на компоненты:

**flows/** — Основные потоки:
- NewUserFlow.ts — новые пользователи
- ActiveUserFlow.ts — активные пользователи
- ReturningUserFlow.ts — возвращающиеся пользователи
- ContinueSetupFlow.ts — продолжение настройки
- WaitlistFlow.ts — список ожидания
- SlotManager.ts — управление слотами

**states/** — Обработчики состояний:
- SetupProcess.ts — процесс настройки
- ModeSelectionHandler.ts — выбор режима
- PromoCodeHandler.ts — обработка промокодов
- PaymentHandler.ts — обработка платежей

**UserAnalyzer.ts** — анализ типа пользователя и создание контекста

## Известные проблемы и TODO

1. **Команды не реализованы:**
   - `/change_mode` — смена режима участия
   - `/change_pace` — смена ритма участия

2. **Еженедельный ритм:**
   - В БД есть поле pace = "weekly", но логика обработки не реализована
   - В publicDeadlineReminder есть заготовка, но не работает

3. **RLS безопасность:**
   - Настроен RLS для таблицы users (см. RLS/rls_setup.sql)
   - Service Role имеет полный доступ
   - Anon роль заблокирована

4. **Система слотов:**
   - Требует выполнения SQL миграции slots_system_migration.sql
   - Fallback на 0 слотов при ошибках БД

## Архитектура и компоненты

### Генератор статусных сообщений (statusMessageGenerator.ts)

**Назначение:** Вынесенный из constants.ts компонент для генерации сообщений о статусе пользователя.

**Используется в:**
- Команда `/status` — отображение статуса пользователя
- При входе пользователя в чат — уведомление о текущем статусе
- Везде, где нужно показать полную информацию об участии пользователя

**Основная функция:** `generateUserStatusMessage(user: UserStatusData): string`

**Типы состояний подписки (SubscriptionStatus enum):**
- `NOT_IN_CHAT` — пользователь не в чате
- `USING_SAVED_DAYS` — использует сохранённые дни без активной подписки  
- `ACTIVE_SUBSCRIPTION` — активная подписка без сохранённых дней
- `MIXED_STATUS` — активная подписка + сохранённые дни
- `UNCLEAR_STATUS` — неопределённое состояние

**Структура сообщения:**
1. **Информация о подписке** — статус, даты, количество дней
2. **Режим и ритм участия** — выбранные настройки
3. **Статистика активности** — количество постов, страйки, последний пост (если есть)

**Ключевые функции обработки:**
- `determineSubscriptionStatus()` — определение типа статуса подписки
- `formatSubscriptionInfo()` — форматирование информации о подписке
- `formatParticipationInfo()` — режим и ритм участия
- `formatActivityStats()` — статистика постов (показывается только при наличии)

**Эталонные переменные:**
- `UserStatusData` interface — типизированные данные пользователя
- Форматы дат: `toLocaleDateString('ru-RU')` — русский формат
- Использует `pluralizeDays()` из constants.ts для склонения

**Преимущества вынесения:**
- Модульность — отдельная ответственность
- Типизация — строгие типы для данных пользователя
- Читаемость — разбиение большой функции на логические блоки
- Тестируемость — изолированная логика форматирования
- Переиспользование — можно использовать в разных местах

**Адаптивная клавиатура (generateStatusKeyboard):**

Генерирует кнопки в зависимости от состояния пользователя:

**Ряд 1** (всегда): Управление подпиской + Поддержка
- "💳 Управление подпиской" → TRIBUTE_BOT_LINK  
- "🆘 Поддержка" → ADMIN_CONTACT

**Ряд 2** (только для активных): Изменение режима + ритма  
- "🎨 Изменить режим" → запускает команду /change_mode
- "⏰ Изменить ритм" → запускает команду /change_pace

**Ряд 3** (только для активных): Каникулы + напоминания
- "🏖️ Каникулы" → запускает команду /pause
- "🔔 Включить напоминания" / "🔕 Отключить напоминания" → переключает настройку public_remind (адаптивный текст)

**Обработчики callback'ов (statusCallbackHandlers.ts):**
- `handleChangeModeCallbackQuery` — вызывает /change_mode команду
- `handleChangePaceCallbackQuery` — вызывает /change_pace команду  
- `handlePauseCallbackQuery` — вызывает /pause команду
- `handleChooseModeCallbackQuery` — выбор режима для новых пользователей
- `handleChoosePaceCallbackQuery` — выбор ритма для новых пользователей

**Константы callback'ов:**
- CALLBACK_CHANGE_MODE, CALLBACK_CHANGE_PACE — основные команды
- CALLBACK_TOGGLE_PUBLIC_REMINDER — переключение напоминаний (новый)
- CALLBACK_CHANGE_PUBLIC_REMINDER — переключение напоминаний (старый, deprecated)
- CALLBACK_PAUSE — каникулы
- CALLBACK_CHOOSE_MODE, CALLBACK_CHOOSE_PACE — первичный выбор

**Статусное сообщение включает:**
- Информацию о подписке и сохранённых днях
- Режим и ритм участия
- **Статус публичных напоминаний** (включены/отключены)
- Статистику активности (если есть посты)

### Управление напоминаниями (reminderHandler.ts)

**Назначение:** Вынесенный из commandHandler.ts и statusCallbackHandlers.ts компонент для управления публичными напоминаниями.

**Функции:**
- `handleReminderCommand()` — обработка команды /reminder
- `handleToggleReminderCallback()` — обработка нажатия кнопки переключения
- `sendReminderToggleMessage()` — отправка сообщения с актуальной кнопкой

**Логика команды /reminder:**
1. Проверяет, что пользователь существует и активен (в чате или имеет подписку)
2. Получает текущее состояние `public_remind` (по умолчанию `true`)
3. Отправляет информативное сообщение с кнопкой переключения

**Сообщение включает:**
- Текущий статус напоминаний (включены/отключены)
- Объяснение что это такое
- Адаптивную кнопку для переключения состояния

**Callback обработчик (CALLBACK_TOGGLE_PUBLIC_REMINDER):**
1. Получает текущее состояние `public_remind`
2. Переключает на противоположное
3. Обновляет БД
4. Отправляет новое сообщение с обновленной кнопкой
5. Обновляет меню бота через `BotMenuManager.updateUserMenu()`

**Адаптивная кнопка:**
- Если `public_remind = true`: "🔕 Отключить напоминания"
- Если `public_remind = false`: "🔔 Включить напоминания"

**Константы:**
- `CALLBACK_TOGGLE_PUBLIC_REMINDER = "toggle_public_reminder"`
- `MSG_REMINDERS_ENABLED` — подтверждение включения
- `MSG_REMINDERS_DISABLED` — подтверждение отключения

**Интеграция:**
- В `index.ts` добавлен обработчик callback'а `toggle_public_reminder`
- В `commandHandler.ts` команда `/reminder` перенаправляется в новый компонент
- Обновляет меню пользователя для отражения изменений

