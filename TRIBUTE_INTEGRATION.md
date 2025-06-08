# Интеграция с Tribute API

## 📋 Обзор

Интеграция позволяет автоматически синхронизировать подписки пользователей между Telegram ботом и платформой Tribute. Все webhook'и обрабатываются одной функцией `/bot` с автоматическим определением типа запроса.

## 🔗 URL для настройки

**URL для Tribute Dashboard:**
```
https://bqtgrzauzqlodgipaisz.supabase.co/functions/v1/bot
```

## 🔐 Настройка безопасности

1. **API ключ**: Получите API ключ в Creator Dashboard → Settings → API Keys
2. **Переменная окружения**: Установите `TRIBUTE_API_KEY` в Supabase
3. **Подпись webhook'а**: Запросы проверяются по заголовку `trbt-signature`

## 📨 Поддерживаемые события

### 1. NewSubscriptionEvent (Б6)
- **Триггер**: Пользователь оформляет новую подписку
- **Действие**: Активация подписки, обновление данных в БД
- **Бонусные дни**: Автоматически добавляются к новой подписке

### 2. CancelledSubscriptionEvent (Б7)  
- **Триггер**: Пользователь отменяет подписку
- **Действие**: Деактивация подписки, сохранение неиспользованных дней

## 🛠️ Команды админа

### `/sync_subscriptions`
**Описание**: Синхронизирует состояние всех активных подписок с текущим временем

**Что делает**:
- Проверяет всех пользователей в чате (`in_chat = true`)
- Сравнивает `expires_at` с текущим временем
- **Для истекших подписок**: устанавливает `subscription_active = false`, отправляет уведомления
- **Для действующих подписок**: восстанавливает `subscription_active = true` если было `false`
- Генерирует отчет: проверено/истекших/восстановлено

**Важно**: Команда админа может корректировать `subscription_active` на основе реальных данных `expires_at`

**Пример использования**: Для существующих подписок, оформленных до интеграции

### `/tribute_test`
**Описание**: Проверяет готовность интеграции

**Что проверяет**:
- Доступность webhook URL
- Наличие `TRIBUTE_API_KEY`
- Показывает URL для настройки в Tribute

## 🔄 Обработка существующих подписок

Для подписок, оформленных до внедрения интеграции, есть несколько вариантов:

### Вариант 1: Команда админа
```
/sync_subscriptions
```
Проверит все активные подписки и обновит истекшие.

### Вариант 2: Связаться с поддержкой Tribute
Попросить в поддержке:
- **REST API endpoints** для получения списка подписок
- **Возможность переслать webhook'и** для существующих подписок
- **Документацию API** (если есть скрытые endpoints)

### Вариант 3: Временная отмена/возобновление
⚠️ **Осторожно!** Только для тестирования:
1. Временно отменить подписку → получить `CancelledSubscriptionEvent`
2. Сразу оформить новую → получить `NewSubscriptionEvent`

## 📊 Структура webhook'ов

### NewSubscriptionEvent
```json
{
  "created_at": "2025-03-20T01:15:58.33246Z",
  "name": "new_subscription",
  "payload": {
    "subscription_name": "Support my art 🌟",
    "subscription_id": 1644,
    "period_id": 1547,
    "period": "monthly",
    "price": 1000,
    "amount": 700,
    "currency": "eur",
    "user_id": 31326,
    "telegram_user_id": 12321321,
    "channel_id": 614,
    "channel_name": "lbs",
    "expires_at": "2025-04-20T01:15:57.305733Z"
  },
  "sent_at": "2025-03-20T01:15:58.542279448Z"
}
```

### CancelledSubscriptionEvent
```json
{
  "created_at": "2025-03-21T11:20:44.013969Z",
  "name": "cancelled_subscription",
  "payload": {
    "subscription_name": "Join the private club 🎉",
    "subscription_id": 1646,
    "period_id": 1549,
    "period": "monthly",
    "price": 1000,
    "amount": 1000,
    "currency": "eur",
    "user_id": 31326,
    "telegram_user_id": 12321321,
    "channel_id": 614,
    "channel_name": "lbs",
    "cancel_reason": "",
    "expires_at": "2025-03-20T11:13:44.737Z"
  },
  "sent_at": "2025-03-21T11:20:44.527657077Z"
}
```

## 🔍 Отладка

### Логи Supabase Functions
1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard/project/bqtgrzauzqlodgipaisz/functions)
2. Откройте логи функции `bot`
3. Найдите записи с `=== TRIBUTE WEBHOOK ===`

### Тестирование webhook'ов
Команда `/tribute_test` покажет:
- Статус URL
- Наличие API ключа  
- URL для настройки в Tribute

### Проверка подписи
Если webhook'и не проходят проверку подписи:
1. Убедитесь, что `TRIBUTE_API_KEY` установлен правильно
2. Проверьте, что в Tribute используется тот же API ключ
3. Посмотрите логи для деталей ошибки

## 📚 Ссылки

- **[Tribute API Documentation](https://wiki.tribute.tg/for-content-creators/api-documentation)**
- **[Supabase Functions Dashboard](https://supabase.com/dashboard/project/bqtgrzauzqlodgipaisz/functions)**
- **Поддержка Tribute**: Через Creator Dashboard

---

## 🎯 Статус интеграции

✅ **Готово**: Webhook'и настроены и работают  
✅ **Готово**: Команды админа для управления  
⚠️ **Ограничено**: Нет REST API для получения списка подписок  
📅 **Планы**: Запросить у Tribute документацию REST API 