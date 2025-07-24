# StartCommand Module Architecture

Модульная архитектура для обработки команды `/start` в Telegram боте.

## 📊 Диаграмма архитектуры

```mermaid
graph TD
    A["📱 index.ts<br/>(main entry point)"] --> B["🔄 startCommand/index.ts<br/>(main router)"]
    C["⚙️ commandHandler.ts"] --> B
    D["🧪 startTest.ts"] --> B
    
    B --> E["🔍 UserAnalyzer"]
    E --> F{"User Type?"}
    
    F -->|new_user| G["📝 NewUserFlow"]
    F -->|active_user| H["✅ ActiveUserFlow"]
    F -->|continue_setup| I["🔄 ContinueSetupFlow"]
    F -->|returning_user| J["👋 ReturningUserFlow"]
    F -->|in_waitlist| P["⏳ WaitlistFlow"]
    
    G --> Q{"Slots Available?"}
    Q -->|Yes| K["⚙️ SetupProcess"]
    Q -->|No| P
    
    J --> K
    I --> K
    
    K --> L["🎯 StateHandlers"]
    L --> M["📝 ModeSelectionHandler"]
    L --> N["🎫 PromoCodeHandler"]
    
    M --> O["💳 PaymentHandler"]
    N --> O
    
    style B fill:#e8f5e8
    style E fill:#fff3e0
    style K fill:#f3e5f5
    style L fill:#e3f2fd
    style O fill:#f1f8e9
    style P fill:#ffe0e0
```

## 📁 Структура файлов

```
startCommand/
├── README.md                   # 📖 Документация (этот файл)
├── index.ts                    # 🔄 Главный роутер
├── UserAnalyzer.ts             # 🔍 Анализ типа пользователя
├── flows/                      # 📋 Flows для разных типов пользователей
│   ├── NewUserFlow.ts          # 📝 Новые пользователи
│   ├── ActiveUserFlow.ts       # ✅ Уже активные пользователи
│   ├── ReturningUserFlow.ts    # 👋 Возвращающиеся пользователи
│   ├── ContinueSetupFlow.ts    # 🔄 Продолжение настройки
│   └── WaitlistFlow.ts         # ⏳ Список ожидания
└── states/                     # ⚙️ Обработчики состояний
    ├── index.ts                # 🎯 Центральные обработчики
    ├── SetupProcess.ts         # ⚙️ Процесс настройки
    ├── ModeSelectionHandler.ts # 📝 Выбор режима
    ├── PromoCodeHandler.ts     # 🎫 Обработка промокодов
    └── PaymentHandler.ts       # 💳 Обработка платежей
```

## 🔄 Как это работает

### 1. Анализ пользователя
`UserAnalyzer` определяет тип пользователя:
- **new_user** - новый пользователь или существующий в БД но новый для чата
- **active_user** - уже активный пользователь (in_chat = true)
- **continue_setup** - пользователь в процессе настройки (user_state != null)
- **returning_user** - возвращающийся пользователь (joined_at != null)
- **in_waitlist** - пользователь в списке ожидания (waitlist = true)

### 2. Маршрутизация Flow
Главный роутер (`index.ts`) направляет к соответствующему Flow:

#### NewUserFlow
- Отправляет приветствие
- Проверяет наличие свободных мест (AVAILABLE_SLOTS)
- Если мест нет - направляет в WaitlistFlow
- Если есть - запускает процесс настройки режима

#### ActiveUserFlow  
- Отправляет сообщение что пользователь уже активен

#### ReturningUserFlow
- Проверяет сохраненные дни подписки
- Направляет в чат (если есть дни) или на настройку

#### ContinueSetupFlow
- Продолжает с того места где остановился пользователь
- Обрабатывает состояния: waiting_mode, waiting_promo, payment_link_sent

#### WaitlistFlow
- Добавляет пользователя в список ожидания
- Присваивает позицию в очереди
- Отправляет уведомление о постановке в очередь

### 3. Обработка состояний
`StateHandlers` управляют переходами между состояниями:

#### SetupProcess
- Отправка клавиатуры для выбора режима
- Управление состояниями пользователя в БД

#### ModeSelectionHandler
- Сохраняет выбранный режим (text)
- Автоматически назначает ритм daily
- Переходит к проверке оплаты

#### PromoCodeHandler
- Валидирует промокоды
- Устанавливает статус клуба

#### PaymentHandler
- Проверяет статус клуба и сохраненные дни
- Отправляет соответствующие ссылки на оплату

## 🚦 Система ограничения доступа (Waitlist)

### Константы
- `AVAILABLE_SLOTS` - количество доступных мест (0 = неограниченно)

### Поля в БД
- `waitlist` (boolean) - находится ли пользователь в списке ожидания
- `waitlist_position` (integer) - позиция в очереди
- `waitlist_added_at` (timestamp) - время добавления в waitlist
- `user_state` = 'in_waitlist' - состояние пользователя в waitlist

### Админские команды
- `/open[число]` - открывает указанное количество мест
  - Пример: `/open10` - откроет 10 мест
  - Автоматически уведомляет пользователей из waitlist
  - Запускает для них стандартный процесс настройки

### Логика работы
1. При `/start` проверяется количество активных пользователей
2. Если активных >= AVAILABLE_SLOTS, новый пользователь попадает в waitlist
3. При открытии новых мест первые N пользователей из waitlist получают уведомления
4. Для них автоматически запускается процесс настройки

## 🎯 Преимущества архитектуры

1. **Чёткое разделение ответственности** - каждый класс отвечает за одну задачу
2. **Легко читается** - понятно что происходит на каждом этапе  
3. **Легко тестировать** - можно тестировать каждый компонент отдельно
4. **Легко расширять** - добавление нового типа пользователя или состояния не влияет на остальной код
5. **Модульность** - импорты идут напрямую к нужным модулям
6. **Гибкое управление доступом** - легко контролировать поток новых пользователей

## 📝 Логика работы (по logic.md)

Модуль реализует логику **A1. /start → регистрация/актуализация пользователя** из `logic.md`:

1. **Регистрация/актуализация** - UserAnalyzer
2. **Проверка активности** - маршрутизация Flow  
3. **Приветственное сообщение** - соответствующий Flow
4. **Проверка доступных мест** - WaitlistFlow.shouldAddToWaitlist()
5. **Выбор режима** - SetupProcess + ModeSelectionHandler
6. **Автоматическое назначение ритма** - daily для всех режимов
7. **Проверка оплаты** - PaymentHandler

## 📈 Упрощения в стартовом сценарии

- **Убран выбор ритма** - автоматически назначается `daily` для всех режимов
- **Отдельная команда ChangePace** - для тех, кто хочет изменить ритм позже
- **Упрощенный флоу** - режим → оплата (без промежуточного выбора ритма)
- **Контроль доступа** - ограничение количества новых участников через waitlist

## 🔧 Константы

Все текстовые сообщения и настройки берутся из `/supabase/functions/constants.ts`:
- MSG_WELCOME, MSG_WELCOME_ALREADY_ACTIVE - приветствия
- MSG_MODE - выбор режима
- MSG_PROMO, MSG_PROMO_ERR - промокоды
- MSG_LINK_CLUB, MSG_LINK_STANDARD - ссылки на оплату
- MSG_WAITLIST, MSG_WAITLIST_OPENED - сообщения для waitlist
- AVAILABLE_MODES - доступные режимы
- AVAILABLE_PACES.DAILY - автоматически назначаемый ритм
- VALID_PROMO_CODES - валидные промокоды
- AVAILABLE_SLOTS - количество доступных мест

## 📥 Импорты

Для использования модуля:

```typescript
// Основные функции
import { handleStartCommand, handleStartCallbackQuery } from "./startCommand/index.ts";

// Обработчики состояний  
import { handleModeSelection, handlePromoCode, handleNoPromo } from "./startCommand/states/index.ts";
```

## 🎫 Система промокодов

### Типы промокодов

1. **CLUB2024** - Дает скидку для участников клуба
   - Устанавливает `club = true` в БД
   - Отправляет специальную ссылку на оплату со скидкой

2. **FREE30** - Дает 30 бесплатных дней участия
   - Начисляет `subscription_days_left = 30` в БД
   - Отправляет прямую ссылку на вход в чат без оплаты

### Логика обработки

```typescript
// В PromoCodeHandler.ts
if (promoType === PROMO_TYPES.CLUB_DISCOUNT) {
  await this.handleClubDiscountPromo(telegramId, promoCode);
} else if (promoType === PROMO_TYPES.FREE_DAYS) {
  await this.handleFreeDaysPromo(telegramId, promoCode);
}
```

### Константы

- `VALID_PROMO_CODES` - массив валидных промокодов
- `PROMO_TYPES` - типы промокодов с соответствующими кодами
- `FREE_PROMO_DAYS` - количество дней для FREE30 (30)
- `MSG_FREE_PROMO_SUCCESS` - сообщение об успешной активации FREE30

### Флоу обработки

1. Пользователь вводит промокод
2. `PromoCodeHandler.handlePromoCode()` проверяет валидность
3. Определяется тип промокода и вызывается соответствующий метод:
   - `handleClubDiscountPromo()` - для CLUB2024
   - `handleFreeDaysPromo()` - для FREE30
4. Обновляется БД и отправляется соответствующее сообщение

### Преимущества модульной структуры

- **Легко расширять** - добавление нового типа промокода требует только добавления нового метода
- **Четкое разделение логики** - каждый тип промокода обрабатывается отдельно
- **Централизованная валидация** - все промокоды проверяются в одном месте
- **Гибкая настройка** - все параметры вынесены в константы

## 🎯 Преимущества архитектуры

1. **Чёткое разделение ответственности** - каждый класс отвечает за одну задачу
2. **Легко читается** - понятно что происходит на каждом этапе  
3. **Легко тестировать** - можно тестировать каждый компонент отдельно
4. **Легко расширять** - добавление нового типа пользователя или состояния не влияет на остальной код
5. **Модульность** - импорты идут напрямую к нужным модулям
6. **Гибкое управление доступом** - легко контролировать поток новых пользователей

## 📝 Логика работы (по logic.md)

Модуль реализует логику **A1. /start → регистрация/актуализация пользователя** из `logic.md`:

1. **Регистрация/актуализация** - UserAnalyzer
2. **Проверка активности** - маршрутизация Flow  
3. **Приветственное сообщение** - соответствующий Flow
4. **Проверка доступных мест** - WaitlistFlow.shouldAddToWaitlist()
5. **Выбор режима** - SetupProcess + ModeSelectionHandler
6. **Автоматическое назначение ритма** - daily для всех режимов
7. **Проверка оплаты** - PaymentHandler

## 📈 Упрощения в стартовом сценарии

- **Убран выбор ритма** - автоматически назначается `daily` для всех режимов
- **Отдельная команда ChangePace** - для тех, кто хочет изменить ритм позже
- **Упрощенный флоу** - режим → оплата (без промежуточного выбора ритма)
- **Контроль доступа** - ограничение количества новых участников через waitlist

## 🔧 Константы

Все текстовые сообщения и настройки берутся из `/supabase/functions/constants.ts`:
- MSG_WELCOME, MSG_WELCOME_ALREADY_ACTIVE - приветствия
- MSG_MODE - выбор режима
- MSG_PROMO, MSG_PROMO_ERR - промокоды
- MSG_LINK_CLUB, MSG_LINK_STANDARD - ссылки на оплату
- MSG_WAITLIST, MSG_WAITLIST_OPENED - сообщения для waitlist
- AVAILABLE_MODES - доступные режимы
- AVAILABLE_PACES.DAILY - автоматически назначаемый ритм
- VALID_PROMO_CODES - валидные промокоды
- AVAILABLE_SLOTS - количество доступных мест

## 📥 Импорты

Для использования модуля:

```typescript
// Основные функции
import { handleStartCommand, handleStartCallbackQuery } from "./startCommand/index.ts";

// Обработчики состояний  
import { handleModeSelection, handlePromoCode, handleNoPromo } from "./startCommand/states/index.ts";
``` 