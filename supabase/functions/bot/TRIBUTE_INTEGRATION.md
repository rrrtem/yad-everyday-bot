# Интеграция с Tribute API

Бот интегрирован с [Tribute API](https://wiki.tribute.tg/for-content-creators/api-documentation) для обработки платных подписок.

## Настройка webhook'а в Tribute

### 1. Переменные окружения

В Supabase Dashboard добавьте переменную окружения:

```
TRIBUTE_API_KEY=your_tribute_api_key_here
```

### 2. URL для webhook'а

В настройках API в Tribute Dashboard укажите URL:

```
https://your-project-id.supabase.co/functions/v1/bot
```

**Важно:** Тот же URL обрабатывает и Telegram webhook'и, и Tribute webhook'и. Различие происходит автоматически по наличию заголовка `trbt-signature`.

### 3. Обрабатываемые события

- `new_subscription` — новая подписка активирована (функция Б6)
- `cancelled_subscription` — подписка отменена (функция Б7)

## Безопасность

- Все webhook'и защищены подписью HMAC-SHA256 в заголовке `trbt-signature`
- Подпись проверяется автоматически с использованием `TRIBUTE_API_KEY`
- Webhook'и дедуплицируются по времени последней обработки (1 час)

## Логика работы

### Новая подписка (Б6)
1. Проверяется дедупликация и подпись
2. Находится пользователь по `telegram_user_id`
3. Обновляются данные подписки из webhook'а
4. Если есть сохранённые дни, добавляются к новой подписке
5. Отправляется уведомление пользователю

### Отмена подписки (Б7)
1. Проверяется дедупликация и подпись
2. Находится пользователь по `telegram_user_id`
3. Рассчитываются неиспользованные дни
4. Обновляется статус подписки (`subscription_active = false`)
5. Отправляется уведомление пользователю

## Мониторинг

- Все ошибки и критические события отправляются администратору бота
- Детальное логирование всех операций
- Команда `/tribute_test` для проверки настроек

## Структура данных

Все поля из Tribute API сохраняются в таблице `users`:

```sql
-- Поля из Tribute webhook'ов
subscription_id BIGINT,
period_id BIGINT,
period TEXT,
price BIGINT,
amount BIGINT,
currency TEXT,
subscription_name TEXT,
tribute_user_id BIGINT,
channel_id BIGINT,
channel_name TEXT,
expires_at TIMESTAMPTZ,
cancel_reason TEXT,

-- Вычисляемые поля
subscription_started_at TIMESTAMPTZ,
subscription_cancelled_at TIMESTAMPTZ,
subscription_active BOOLEAN,
subscription_days_left INTEGER,
tribute_webhook_processed_at TIMESTAMPTZ
```

## Тестирование

1. Отправить команду `/tribute_test` боту от имени владельца
2. Проверить переменные окружения и доступность URL
3. Настроить webhook в Tribute Dashboard
4. Протестировать с реальной подпиской 