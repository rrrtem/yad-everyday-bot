# TODO: Нереализованные функции Challenge Guardian Bot

✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО:**

## A. Команды пользователей:
- **A1** - Команда /start (startCommandHandler.ts) — полностью реализована

## Б. CRON функции:
- **Б1** - Учёт поста #daily (dailyPostHandler.ts) — полностью реализован
- **Б2** - dailyCron (cronHandler.ts) — полностью реализован с отчетами + функция allInfo
- **Б3** - Публичные напоминания (cronHandler.ts) — полностью реализованы
- **Б4** - Вход пользователя в чат (newChatMemberHandler.ts) — полностью реализован
- **Б5** - Выход пользователя из чата (leftChatMemberHandler.ts) — полностью реализован
- **Б6** - Webhook новой подписки Tribute (tributeApiHandler.ts) — полностью реализован
- **Б7** - Webhook отмены подписки Tribute (tributeApiHandler.ts) — полностью реализован

## В. Админские команды:
- **В1** - Команда /get (commandHandler.ts) — полностью реализована
- **В3** - Симуляция Tribute webhook'ов (commandHandler.ts) — полностью реализована

---

## ❌ НЕ РЕАЛИЗОВАННЫЕ ФУНКЦИИ:

### A. Команды пользователей (ВСЕ НЕ РЕАЛИЗОВАНЫ):

#### A2 - /cancel — отмена подписки
- Команда `/cancel` в личку боту
- Отправка MSG_CANCEL со ссылкой на отмену подписки Tribute
- Фиксация даты отправки ссылки (payment_cancel_link_sent)

#### A3 - /change_pace — смена ритма
- Команда `/change_pace` 
- MSG_CHANGE_PACE с выбором нового ритма
- Обновление поля pace и pace_changed_at

#### A4 - /change_mode — смена режима
- Команда `/change_mode`
- MSG_CHANGE_MODE с выбором нового режима
- Автоматический выбор ритма после смены режима
- Обновление полей mode, pace, mode_changed_at, pace_changed_at

#### A5 - /public_remind — настройка публичных напоминаний  
- Команда `/public_remind`
- Переключение поля public_remind (true/false)
- MSG_CHANGE_PUBLIC_REMIND_ON / MSG_CHANGE_PUBLIC_REMIND_OFF

#### A6 - /pause — взять каникулы
- Команда `/pause`
- Проверка in_chat перед предоставлением паузы
- MSG_PAUSE с запросом количества дней (1-MAX_PAUSE_DAYS)
- Валидация ввода дней паузы
- Установка pause_started_at, pause_until, pause_days
- MSG_PAUSE_CONF, MSG_PAUSE_ALREADY, MSG_PAUSE_INACTIVE и др.

#### A7 - /resume — снять с паузы
- Команда `/resume`
- Досрочное снятие с паузы (сброс pause_started_at, pause_until)
- MSG_RESUME_SOON, MSG_RESUME_ERR

#### A8 - /status — статус подписки
- Команда `/status`
- MSG_STATUS с информацией о:
  - Дате подписки (joined_at)
  - Дате следующего списания (next_payment_at)
  - Оставшихся днях (subscription_days_left)
  - Количестве дней участия (units_count)
  - Текущем режиме и ритме (mode, pace)
  - Статусе active, public_remind

#### A9 - /help — справка
- Команда `/help`
- MSG_HELP со списком всех команд

---

### Б. CRON функции (ЧАСТИЧНО НЕ РЕАЛИЗОВАНЫ):

#### Б2.1 - weeklyCron — еженедельная проверка
- **ПОЛНОСТЬЮ ОТСУТСТВУЕТ** функция weeklyCron в cronHandler.ts
- Проверка пользователей с pace = "weekly"
- Логика еженедельных дедлайнов (понедельник-воскресенье)
- MSG_STRIKE_WEEKLY_FIRST/SECOND/THIRD/FOURTH

---

### В. Админские команды (ЧАСТИЧНО НЕ РЕАЛИЗОВАНЫ):

#### В2 - Недостающие тестовые команды в handleOwnerCommands
- `/weekly` — запуск weeklyCron для тестирования (НЕТ, т.к. нет самой функции)
- `/allinfo` — запуск функции allInfo (✅ РЕАЛИЗОВАН)

---

## ❌ ОТСУТСТВУЮЩИЕ КОНСТАНТЫ В constants.ts:

### Команды пользователей:
- **MAX_PAUSE_DAYS** — максимальное количество дней паузы
- **MSG_CANCEL** — сообщение с ссылкой на отмену подписки
- **MSG_CHANGE_PACE** — сообщение для смены ритма
- **MSG_CHANGE_MODE** — сообщение для смены режима  
- **MSG_CHANGE_PUBLIC_REMIND_ON/OFF** — подтверждения включения/отключения напоминаний
- **MSG_PAUSE** — запрос количества дней паузы
- **MSG_PAUSE_CONF** — подтверждение активации паузы
- **MSG_PAUSE_ALREADY** — сообщение когда пользователь уже на паузе
- **MSG_PAUSE_INACTIVE** — сообщение неактивным пользователям
- **MSG_PAUSE_INVALID_DAYS** — сообщение при неверном вводе дней
- **MSG_PAUSE_TOO_LONG** — сообщение при превышении лимита дней
- **MSG_RESUME_SOON** — подтверждение снятия с паузы
- **MSG_RESUME_ERR** — ошибка при попытке снять с паузы
- **MSG_STATUS** — шаблон сообщения со статусом пользователя
- **MSG_HELP** — справочное сообщение

### Еженедельная проверка:
- **WEEKLY_CHECK_DAY** — день недели для проверки (1 = понедельник)
- **MSG_STRIKE_WEEKLY_FIRST** — сообщение при первом пропуске недели
- **MSG_STRIKE_WEEKLY_SECOND** — сообщение при втором пропуске недели
- **MSG_STRIKE_WEEKLY_THIRD** — сообщение при третьем пропуске недели
- **MSG_STRIKE_WEEKLY_FOURTH** — сообщение при четвертом пропуске недели + пауза

---

## 📋 ПРИОРИТЕТ РЕАЛИЗАЦИИ:

### 🔴 **ВЫСОКИЙ ПРИОРИТЕТ:**
1. **A6-A9** — Базовые команды пользователей (/pause, /resume, /status, /help)
2. **A2-A5** — Дополнительные команды (/cancel, /change_pace, /change_mode, /public_remind)

### 🟡 **СРЕДНИЙ ПРИОРИТЕТ:**
3. **Б2.1** — Еженедельная проверка (weeklyCron) для пользователей с ритмом "weekly"

### 🟢 **НИЗКИЙ ПРИОРИТЕТ:**
4. **В2** — Недостающие админские команды (/weekly)

---

## 📊 **СТАТИСТИКА ГОТОВНОСТИ:**

**Готово: 10/19 функций (53%)**
- ✅ A1 - /start
- ✅ Б1-Б7 - Все CRON функции и webhook'и
- ✅ В1, В3 - Админские команды /get и /test_webhook

**Не готово: 9/19 функций (47%)**
- ❌ A2-A9 - Все остальные команды пользователей (8 функций)
- ❌ Б2.1 - weeklyCron (1 функция)

**Константы: ~35 сообщений отсутствует** 