# YAD Everyday CRM

Минималистичная CRM-админка для просмотра и фильтрации пользователей Supabase.

## Технологии
- React + TypeScript
- Radix UI
- Tailwind CSS
- Supabase JS SDK
- Vite

## Локальный запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

## Деплой на GitHub Pages

### Автоматический деплой (рекомендуется)
1. Убедитесь, что в репозитории включены GitHub Pages (Settings → Pages)
2. Включите GitHub Actions (Settings → Actions → General)
3. При пуше в ветку `main` с изменениями в папке `CRM/` автоматически запустится деплой
4. CRM будет доступна по адресу: `https://your-username.github.io/your-repo/CRM/`

### Ручной деплой
1. Соберите проект: `npm run build`
2. Скопируйте содержимое папки `dist/` в ветку `gh-pages` в папку `CRM/`
3. Или используйте GitHub CLI: `gh pages deploy dist/ --dir CRM`

## Переменные окружения
Создайте файл `.env` в папке `CRM/`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Доступ
- Логин: `admin`
- Пароль: `yad2024` 