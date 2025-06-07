# 🔐 Руководство по настройке Row Level Security (RLS)

## 📋 Что это даёт

✅ **Безопасность**: Анонимные пользователи не смогут читать/изменять данные  
✅ **Бот продолжит работать**: Service Role обходит RLS  
✅ **Готовность к расширению**: Основа для будущего веб-интерфейса  
✅ **Соответствие best practices**: Стандарт безопасности для продакшена  

## 🚀 Пошаговая настройка

### Шаг 1: Подготовка
1. Сделайте резервную копию БД (если данные критичны)
2. Убедитесь что бот использует `SUPABASE_SERVICE_ROLE_KEY` (уже настроено ✅)
3. Проверьте что у вас есть доступ к Supabase Dashboard

### Шаг 2: Выполнение миграции RLS
1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте и выполните содержимое файла `supabase/functions/rls_setup.sql`
3. Проверьте что все команды выполнились без ошибок

### Шаг 3: Тестирование
1. Выполните тесты из файла `supabase/functions/test_rls.sql`
2. Проверьте что бот продолжает работать:
   ```bash
   # Протестируйте webhook бота
   curl -X POST your-bot-function-url \
     -H "Content-Type: application/json" \
     -d '{"type": "test"}'
   ```

### Шаг 4: Проверка безопасности
Попробуйте выполнить запрос с анонимным ключом - должен вернуть пустой результат:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'your-project-url',
  'your-anon-key' // НЕ service_role!
)

// Этот запрос должен вернуть пустой массив
const { data } = await supabase.from('users').select('*')
console.log(data) // Должно быть []
```

## 🛡️ Политики безопасности

### Созданные политики:

1. **"Service role full access"**
   - Роль: `service_role` 
   - Доступ: Полный (SELECT, INSERT, UPDATE, DELETE)
   - Назначение: Для работы бота

2. **"Users can view own data"**
   - Роль: `authenticated`
   - Доступ: SELECT (только свои данные)
   - Назначение: Для будущего веб-интерфейса

3. **Анонимные пользователи**
   - Доступ: Запрещён (по умолчанию)
   - Назначение: Безопасность

## 🔧 Если что-то пошло не так

### Проблема: Бот перестал работать
**Решение:**
```sql
-- Временно отключить RLS для отладки
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- После исправления включить обратно
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### Проблема: Ошибки доступа
**Проверьте:**
1. Используется ли правильный ключ (`SUPABASE_SERVICE_ROLE_KEY`)
2. Выполнился ли скрипт setup полностью
3. Нет ли ошибок в логах функций

### Проблема: Политики не работают
**Решение:**
```sql
-- Пересоздать политики
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;

-- Затем выполнить rls_setup.sql заново
```

## 📊 Мониторинг

### Проверка статуса RLS:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';
```

### Просмотр активных политик:
```sql
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'users';
```

### Логи доступа:
Следите за логами Edge Functions в Supabase Dashboard для выявления проблем с доступом.

## 🚀 Дальнейшие шаги

После успешной настройки RLS вы можете:

1. **Добавить веб-интерфейс** с аутентификацией пользователей
2. **Создать API endpoints** с ограниченным доступом  
3. **Настроить дополнительные таблицы** с RLS
4. **Добавить аудит логи** для отслеживания действий

## 💡 Best Practices

- ✅ Всегда тестируйте RLS на staging окружении
- ✅ Используйте минимальные права доступа для каждой роли
- ✅ Регулярно аудитуйте политики безопасности
- ✅ Логируйте критичные операции с данными
- ✅ Имейте план отката (rollback) при проблемах

## 📚 Полезные ссылки

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security) 