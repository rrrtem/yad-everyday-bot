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
```

4. Запустите проект:
```bash
npm run dev
```

## Сборка

```bash
npm run build
```

## Деплой на Supabase

### Настройка Supabase CLI

1. Установите Supabase CLI:
```bash
npm install -g supabase
```

2. Войдите в свой аккаунт:
```bash
supabase login
```

3. Инициализируйте проект:
```bash
supabase init
```

4. Свяжите с проектом:
```bash
supabase link --project-ref your-project-id
```

### Деплой

1. Соберите проект:
```bash
npm run build
```

2. Разместите на Supabase:
```bash
supabase deploy
```

Или используйте Supabase Hosting (если включен):
```bash
supabase functions deploy --no-verify-jwt
```

### Альтернативный способ через Vercel

Если вы хотите развернуть на Vercel (рекомендуется для Next.js):

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в настройках проекта
3. Деплой произойдет автоматически

## Переменные окружения

- `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Публичный анонимный ключ Supabase

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

## Безопасность

- Аутентификация только через фронтенд (для внутреннего использования)
- Использование публичного анонимного ключа Supabase
- Настроена Row Level Security (RLS) на уровне базы данных 