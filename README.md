# YAD Everyday Bot

Телеграм-бот для проекта "Ясность&Движение / Каждый день" - челлендж с платной подпиской через Tribute.

## Структура проекта

```
supabase/
  functions/
    bot/                        # Основная Edge Function для Telegram бота
      index.ts                 # Главный файл - точка входа
      commandHandler.ts        # Обработка команд бота (/start, /get, /comeback и т.д.)
      dailyPostHandler.ts      # Обработка постов с тегом #daily
      userHandler.ts           # Работа с пользователями (регистрация, обновление)
      cronHandler.ts           # Cron-задачи (ежедневная проверка активности)
      startCommandHandler.ts   # Полная обработка команды /start (A1)
      newChatMemberHandler.ts  # Обработка входа пользователей в чат (Б4)
      leftChatMemberHandler.ts # Обработка выхода пользователей из чата (Б5)
      tributeApiHandler.ts     # Обработка webhook'ов от Tribute API (Б6, Б7)
    constants.ts               # Все настройки и константы проекта  
    logic.md                   # Подробное описание логики работы (754 строки)
```

## Функционал

### Основные возможности
- ✅ Регистрация и настройка участников (режим: тексты/картинки, ритм: ежедневно/еженедельно)
- ✅ Интеграция с Tribute для платных подписок
- ✅ Автоматический учёт постов с тегом #daily
- ✅ Система страйков и автоматическая постановка на паузу
- ✅ Сохранение неиспользованных дней подписки при выходе из чата
- ✅ Публичные напоминания в тематических тредах
- ✅ Детальные отчёты для администратора

### Команды пользователей
- `/start` - Регистрация и настройка участия
- `/reset` - Сброс настроек и начало процесса заново
- `/change_mode` - Смена режима (тексты/картинки) 
- `/change_pace` - Смена ритма (ежедневно/еженедельно)
- `/pause` - Взять каникулы (отпуск)
- `/resume` - Снять с паузы досрочно
- `/status` - Статус подписки и активности
- `/cancel` - Ссылка на отмену подписки
- `/comeback` - Возвращение с сохранёнными днями
- `/public_remind` - Настройка публичных напоминаний

### Команды администратора  
- `/daily` - Запуск ежедневной проверки активности
- `/remind` - Запуск публичных напоминаний
- `/tribute_test` - Тестирование интеграции с Tribute
- `/get` - Получение ID чата

## Развертывание

1. Установите Supabase CLI
2. Настройте переменные окружения
3. Разверните Edge Function:
   ```bash
   supabase && npx supabase functions deploy bot --project-ref bqtgrzauzqlodgipaisz
   ```
4. Настройте webhook в Tribute Dashboard

5. git add . && git commit -m "update" && git push origin main
## Переменные окружения

### Основные
- `TELEGRAM_BOT_TOKEN` - токен бота от @BotFather
- `SUPABASE_URL` - URL вашего Supabase проекта  
- `SUPABASE_ANON_KEY` - Anon key из Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

### Tribute API
- `TRIBUTE_API_KEY` - API ключ от Tribute для проверки подписей webhook'ов

## Интеграция с Tribute

Бот интегрирован с [Tribute API](https://wiki.tribute.tg/for-content-creators/api-documentation) для обработки платных подписок:

- **Новая подписка** - автоматическое добавление в чат и активация участника
- **Отмена подписки** - сохранение неиспользованных дней для будущего возвращения
- **Проверка подписей** - защита от поддельных webhook'ов через HMAC-SHA256

URL для webhook'а в Tribute: `https://bqtgrzauzqlodgipaisz.supabase.co/functions/v1/bot`

Webhook'и от Tribute автоматически определяются по заголовку `trbt-signature` и обрабатываются тем же URL, что и Telegram webhook'и.
