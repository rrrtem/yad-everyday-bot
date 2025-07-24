# YAD Everyday CRM

> **🚀 Автоматический деплой настроен!** При каждом push в main ветку проект автоматически деплоится на Vercel.

CRM система для управления пользователями YAD Everyday бота.

## Технологии
- Next.js 14 + TypeScript
- Radix UI
- Tailwind CSS
- Supabase JS SDK

## Структура проекта

```
/CRM
  /src
    /app
      /api/users          - API route для работы с пользователями
      /dashboard          - Главная страница CRM
      /login              - Страница аутентификации
      - layout.tsx        - Главный лейаут
      - page.tsx          - Корневая страница (редирект)
      - globals.css       - Глобальные стили
    /components           - React компоненты
      - LoginForm.tsx     - Форма входа
      - UserCard.tsx      - Карточка пользователя
      - Filters.tsx       - Фильтры пользователей
      - UserList.tsx      - Список пользователей
    /lib
      - supabase.ts       - Клиент Supabase
    - constants.ts        - Все настройки и константы проекта
  - package.json
  - next.config.js        - Конфигурация Next.js
  - tailwind.config.js    - Конфигурация Tailwind
  - tsconfig.json         - Конфигурация TypeScript
```

## Локальный запуск

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env.local` на основе `.env.example`:
```bash
cp .env.example .env.local
```

3. Заполните переменные окружения в `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=ваш-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=ваш-supabase-service-role-key
```

4. Запустите проект:
```bash
npm run dev
```

## Сборка

```bash
npm run build
```

## Деплой на Vercel

### 🎯 Продакшн URL
**Текущий деплой:** https://everyday-acz6r515o-rrrtems-projects.vercel.app

### 📋 Первичная настройка (уже выполнена)

1. **Установка Vercel CLI:**
```bash
npm install -g vercel
```

2. **Авторизация:**
```bash
vercel login
```

3. **Первый деплой:**
```bash
vercel
```

4. **Настройка переменных окружения:**
   - Перейдите в [настройки проекта](https://vercel.com/rrrtems-projects/everyday-crm/settings)
   - В разделе **Environment Variables** добавьте:
     - `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Публичный ключ Supabase
     - `SUPABASE_SERVICE_ROLE_KEY` - Сервисный ключ Supabase (secret)

### 🔄 Обновление деплоя

#### Автоматическое обновление (рекомендуется)
После настройки Git интеграции изменения автоматически деплоятся при push в main ветку.

#### Ручное обновление
Если нужно задеплоить изменения вручную:

1. **Production деплой:**
```bash
vercel --prod
```

2. **Preview деплой (для тестирования):**
```bash
vercel
```

### 🛠 Управление проектом

- **Настройки проекта:** https://vercel.com/rrrtems-projects/everyday-crm/settings
- **Логи деплоя:** https://vercel.com/rrrtems-projects/everyday-crm/deployments
- **Domains:** https://vercel.com/rrrtems-projects/everyday-crm/settings/domains

### 🔧 Переменные окружения

#### Production переменные:
```bash
# Через веб-интерфейс Vercel или CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

#### Локальное получение переменных:
```bash
vercel env pull .env.local
```

### 📝 Команды для быстрого деплоя

```bash
# Деплой в production
npm run build && vercel --prod

# Предварительный просмотр
vercel

# Откатиться к предыдущей версии (через веб-интерфейс)
# https://vercel.com/rrrtems-projects/everyday-crm/deployments
```

## Доступ

- **Логин:** `admin`
- **Пароль:** `yad2024`

## Функционал

- **Аутентификация** через простую форму логин/пароль
- **Фильтрация пользователей:**
  - В чате (`in_chat = true`)
  - Был в чате, но вышел (`in_chat = false` и `joined_at IS NOT NULL`)
  - Никогда не был в чате (`joined_at IS NULL`)
  - Поиск по username/ID
- **Сортировка** по дате регистрации, активности, дням до окончания подписки
- **Адаптивный дизайн** для мобильных устройств и десктопа
- **Детальная информация** о каждом пользователе в карточках
- **Контекстная информация** в зависимости от статуса пользователя

## Безопасность

- Аутентификация только через фронтенд (для внутреннего использования)
- Использование публичного анонимного ключа Supabase
- Настроена Row Level Security (RLS) на уровне базы данных
- Сервисный ключ используется только на сервере через API Routes 