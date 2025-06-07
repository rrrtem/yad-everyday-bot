# TODO: Нереализованные функции Challenge Guardian Bot

✅ РЕАЛИЗОВАНО:
A1 - Команда /start (полностью)
Б3 - Публичные напоминания
Б4, Б5 - Вход/выход из чата
В1 - Команда /get
Частично Б1, Б2 - обработка постов и ежедневные проверки

## A. Команды пользователей (НЕ РЕАЛИЗОВАНЫ)

### ❌ A2 - /cancel — отмена подписки
- Команда `/cancel` в личку боту
- Отправка MSG_CANCEL со ссылкой на отмену подписки Tribute
- Фиксация даты отправки ссылки (payment_cancel_link_sent)

### ❌ A3 - /change_pace — смена ритма
- Команда `/change_pace` 
- MSG_CHANGE_PACE с выбором нового ритма
- Обновление поля pace и pace_changed_at

### ❌ A4 - /change_mode — смена режима
- Команда `/change_mode`
- MSG_CHANGE_MODE с выбором нового режима
- Автоматический выбор ритма после смены режима
- Обновление полей mode, pace, mode_changed_at, pace_changed_at

### ❌ A5 - /public_remind — настройка публичных напоминаний  
- Команда `/public_remind`
- Переключение поля public_remind (true/false)
- MSG_CHANGE_PUBLIC_REMIND_ON / MSG_CHANGE_PUBLIC_REMIND_OFF

### ❌ A6 - /pause — взять каникулы
- Команда `/pause`
- Проверка is_active перед предоставлением паузы
- MSG_PAUSE с запросом количества дней (1-MAX_PAUSE_DAYS)
- Валидация ввода дней паузы
- Установка pause_started_at, pause_until, pause_days
- MSG_PAUSE_CONF, MSG_PAUSE_ALREADY, MSG_PAUSE_INACTIVE и др.

### ❌ A7 - /resume — снять с паузы
- Команда `/resume`
- Досрочное снятие с паузы (сброс pause_started_at, pause_until)
- MSG_RESUME_SOON, MSG_RESUME_ERR

### ❌ A8 - /status — статус подписки
- Команда `/status`
- MSG_STATUS с информацией о:
  - Дате подписки (joined_at)
  - Дате следующего списания (next_payment_at)
  - Оставшихся днях (subscription_days_left)
  - Количестве дней участия (units_count)
  - Текущем режиме и ритме (mode, pace)
  - Статусе active, public_remind

### ❌ A9 - /help — справка
- Команда `/help`
- MSG_HELP со списком всех команд

## Б. CRON функции (ЧАСТИЧНО РЕАЛИЗОВАНЫ)

### ⚠️ Б1 - Учёт поста #daily (postHandler.ts)
**Реализовано:** Основная логика обработки #daily
**Отсутствует:**
- MSG_PAUSE_AUTO_OFF (автоматическое уведомление об окончании паузы)

### ⚠️ Б2 - dailyCron (cronHandler.ts)  
**Реализовано:** Основная логика страйков и проверок
**Отсутствует:**
- Функция allInfo (отправка детального отчета админу)
- Проверка "опасных случаев" (dangerousCases в stats)
- Некоторые сообщения из constants.ts

### ❌ Б2.1 - weeklyCron — еженедельная проверка
- Полностью отсутствует функция weeklyCron
- Проверка пользователей с pace = "weekly"
- Логика еженедельных дедлайнов (понедельник-воскресенье)
- MSG_STRIKE_WEEKLY_FIRST/SECOND/THIRD/FOURTH

### ❌ Б6 - Webhook отмены подписки Tribute
- Обработка cancelled_subscription от Tribute API
- Дедупликация по tribute_webhook_processed_at
- Расчёт subscription_days_left при отмене
- MSG_SUBSCRIPTION_CANCELLED

### ❌ Б7 - Webhook новой подписки Tribute  
- Обработка new_subscription от Tribute API
- Сохранение всех полей из Tribute API
- Добавление сохранённых дней к новой подписке
- MSG_SUBSCRIPTION_RENEWED, MSG_SUBSCRIPTION_RENEWED_WITH_BONUS

## В. Админские команды (ЧАСТИЧНО РЕАЛИЗОВАНЫ)

### ❌ В2 - Недостающие тестовые команды
- `/weekly` — запуск weeklyCron для тестирования
- `/allinfo` — запуск функции allInfo

## Константы и сообщения (ЧАСТИЧНО В constants.ts)

### ❌ Отсутствующие константы:
- MAX_PAUSE_DAYS
- MSG_CHANGE_PACE, MSG_CHANGE_MODE  
- MSG_CHANGE_PUBLIC_REMIND_ON/OFF
- MSG_PAUSE, MSG_PAUSE_CONF, MSG_PAUSE_ALREADY, MSG_PAUSE_INACTIVE
- MSG_PAUSE_INVALID_DAYS, MSG_PAUSE_TOO_LONG, MSG_PAUSE_AUTO_OFF
- MSG_RESUME_SOON, MSG_RESUME_ERR
- MSG_STATUS, MSG_HELP
- MSG_CANCEL
- MSG_STRIKE_WEEKLY_* (для еженедельных участников)
- MSG_SUBSCRIPTION_CANCELLED, MSG_SUBSCRIPTION_RENEWED*
- WEBHOOK_DEDUPLICATION_HOURS = 1

### ✅ Поля в БД УЖЕ ЕСТЬ:
Все необходимые поля уже присутствуют в схеме БД:
- user_state ✅
- next_payment_at ✅  
- tribute_webhook_processed_at ✅
- cancel_reason ✅

## Приоритет реализации:

1. **Высокий:** A6-A9 (базовые команды пользователей)
2. **Высокий:** Б6-Б7 (интеграция с Tribute API)  
3. **Средний:** A2-A5 (дополнительные команды)
4. **Средний:** Б2.1 (еженедельная проверка)
5. **Низкий:** Доработка Б1-Б2 (мелкие улучшения) 