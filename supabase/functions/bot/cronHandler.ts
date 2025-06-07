import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDirectMessage } from "../bot/userHandler.ts";
import { 
  MSG_STRIKE_FIRST,
  MSG_STRIKE_SECOND,
  MSG_STRIKE_THIRD,
  MSG_STRIKE_FOURTH,
  MSG_PAUSE_EXPIRED_REMOVED,
  MSG_SUBSCRIPTION_ENDING_REMINDER,
  MSG_SUBSCRIPTION_EXPIRED,
  MSG_REMOVED_SUBSCRIPTION_EXPIRED,
  MSG_PUBLIC_DEADLINE_REMINDER,
  MSG_DAILY_CRON_REPORT,
  AUTO_PAUSE_DAYS,
  SUBSCRIPTION_REMINDER_DAYS,
  OWNER_TELEGRAM_ID,
  PUBLIC_REMINDER_THREAD_ID_TEXT,
  PUBLIC_REMINDER_THREAD_ID_IMAGE
} from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_GROUP_CHAT_ID = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");
if (!TELEGRAM_GROUP_CHAT_ID) {
  throw new Error("TELEGRAM_GROUP_CHAT_ID is not set in environment variables!");
}

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for cron functions.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Ежедневная проверка (dailyCron) - реализует логику Б2 из logic.md
 * Запускается в 04:00 UTC каждый день
 */
export async function dailyCron(): Promise<Response> {
  const now = new Date();
  const startTime = Date.now();
  
  console.log(`\n=== DAILY CRON STARTED ===`);
  console.log(`🕐 Время запуска: ${now.toISOString()}`);
  console.log(`🌐 UTC: ${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}`);
  console.log(`📅 Дата: ${now.toDateString()}`);
  
  // Получаем всех пользователей
  console.log(`📊 Получаем данные пользователей из БД...`);
  const usersRes = await supabase
    .from("users")
    .select("*");
    
  if (usersRes.error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить пользователей:", usersRes.error);
    console.error("❌ Stack trace:", usersRes.error.stack || 'нет стека');
    return new Response(`Ошибка получения пользователей: ${usersRes.error.message}`, { status: 500 });
  }
  
  const users = usersRes.data || [];
  console.log(`✅ Загружено ${users.length} записей пользователей из БД`);
  
  // Предварительная статистика пользователей
  const activeUsers = users.filter(u => u.in_chat && u.is_active);
  const dailyUsers = activeUsers.filter(u => u.pace === "daily");
  const weeklyUsers = activeUsers.filter(u => u.pace === "weekly");
  const pausedUsers = users.filter(u => u.pause_until && new Date(u.pause_until) > now);
  
  console.log(`📈 Предварительная статистика:`);
  console.log(`   - Всего активных: ${activeUsers.length}`);
  console.log(`   - Ежедневный ритм: ${dailyUsers.length}`);
  console.log(`   - Еженедельный ритм: ${weeklyUsers.length}`);
  console.log(`   - На паузе: ${pausedUsers.length}`);
  
  // Статистика для отчета
  const stats = {
    totalActive: 0,
    postsToday: 0,
    noPosts: 0,
    newStrikes: [] as Array<{username: string, strikes: number}>,
    riskyUsers: [] as Array<{username: string, strikes: number}>,
    autoPaused: [] as Array<{username: string}>,
    pauseCompleted: [] as Array<{username: string}>,
    pauseExpiredRemoved: [] as Array<{username: string}>,
    currentlyPaused: [] as Array<{username: string, pauseUntil: string}>,
    subscriptionWarnings: [] as Array<{username: string, daysLeft: number}>,
    subscriptionRemoved: [] as Array<{username: string}>,
    dangerousCases: [] as Array<{username: string, reason: string}>
  };

  console.log(`\n🔍 ФАЗА 1: Проверка активных пользователей с ежедневным ритмом`);

  // 1. Проверка активных пользователей с ежедневным ритмом
  for (const user of users) {
    if (user.in_chat && user.is_active && user.pace === "daily") {
      stats.totalActive++;
      
      if (user.post_today) {
        stats.postsToday++;
      } else {
        stats.noPosts++;
        
        // Проверяем, не на паузе ли пользователь
        if (user.pause_until && new Date(user.pause_until) > now) {
          continue; // Пропускаем пользователей на паузе
        }
        
        const newStrikes = (user.strikes_count || 0) + 1;
        let messageToSend = "";
        let updateData: any = {
          strikes_count: newStrikes,
          updated_at: now.toISOString()
        };
        
        switch (newStrikes) {
          case 1:
            messageToSend = MSG_STRIKE_FIRST;
            break;
          case 2:
            messageToSend = MSG_STRIKE_SECOND;
            break;
          case 3:
            messageToSend = MSG_STRIKE_THIRD;
            stats.riskyUsers.push({username: user.username || String(user.telegram_id), strikes: newStrikes});
            break;
          case 4:
            messageToSend = MSG_STRIKE_FOURTH;
            updateData.pause_started_at = now.toISOString();
            updateData.pause_until = new Date(now.getTime() + AUTO_PAUSE_DAYS * 24 * 60 * 60 * 1000).toISOString();
            updateData.pause_days = AUTO_PAUSE_DAYS;
            stats.autoPaused.push({username: user.username || String(user.telegram_id)});
            break;
        }
        
        if (newStrikes <= 4) {
          await supabase
            .from("users")
            .update(updateData)
            .eq("telegram_id", user.telegram_id);
            
          await sendDirectMessage(user.telegram_id, messageToSend);
          
          if (newStrikes < 4) {
            stats.newStrikes.push({username: user.username || String(user.telegram_id), strikes: newStrikes});
          }
        }
      }
    }
  }

  // 2. Проверка пользователей на паузе
  console.log(`\n🔍 ФАЗА 2: Проверка пользователей на паузе (${pausedUsers.length} пользователей)`);
  for (const user of users) {
    if (user.pause_until) {
      const pauseEnd = new Date(user.pause_until);
      if (pauseEnd <= now) {
        console.log(`⏰ Пауза истекла для ${user.username || user.telegram_id}, strikes: ${user.strikes_count}`);
        // Пауза истекла
        if (user.strikes_count === 4) {
          console.log(`🚨 Удаляем пользователя ${user.username || user.telegram_id} из чата (4 страйка)`);
          // Удаляем из чата
          try {
            await fetch(`${TELEGRAM_API}/kickChatMember`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: TELEGRAM_GROUP_CHAT_ID,
                user_id: user.telegram_id
              })
            });
            console.log(`✅ Пользователь ${user.username || user.telegram_id} удален из чата`);
          } catch (err) {
            console.error(`❌ Ошибка удаления пользователя ${user.username || user.telegram_id}:`, err);
          }
          
          await supabase
            .from("users")
            .update({
              in_chat: false,
              is_active: false,
              strikes_count: 0,
              pause_started_at: null,
              pause_until: null,
              pause_days: 0,
              left_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq("telegram_id", user.telegram_id);
            
          await sendDirectMessage(user.telegram_id, MSG_PAUSE_EXPIRED_REMOVED);
          stats.pauseExpiredRemoved.push({username: user.username || String(user.telegram_id)});
        } else {
          console.log(`✅ Снимаем с паузы ${user.username || user.telegram_id} (был пост во время паузы)`);
          // Был пост во время паузы - снимаем с паузы
          await supabase
            .from("users")
            .update({
              pause_started_at: null,
              pause_until: null,
              pause_days: 0,
              updated_at: now.toISOString()
            })
            .eq("telegram_id", user.telegram_id);
            
          stats.pauseCompleted.push({username: user.username || String(user.telegram_id)});
        }
      } else {
        // Все еще на паузе
        stats.currentlyPaused.push({
          username: user.username || String(user.telegram_id),
          pauseUntil: pauseEnd.toLocaleDateString('ru-RU')
        });
      }
    }
  }

  // 3. Обработка подписок и subscription_days_left (остаток с прошлого сезона)
  console.log(`\n🔍 ФАЗА 3: Обработка subscription_days_left`);
  let subscriptionProcessed = 0;
  for (const user of users) {
    if (user.subscription_days_left > 0 && user.is_active && user.subscription_active === false) {
      subscriptionProcessed++;
      const newDaysLeft = user.subscription_days_left - 1;
      console.log(`📉 ${user.username || user.telegram_id}: ${user.subscription_days_left} -> ${newDaysLeft} дней`);
      
      if (newDaysLeft === SUBSCRIPTION_REMINDER_DAYS) {
        console.log(`⚠️ Отправляем напоминание ${user.username || user.telegram_id} (${newDaysLeft} дней осталось)`);
        await sendDirectMessage(user.telegram_id, MSG_SUBSCRIPTION_ENDING_REMINDER);
        stats.subscriptionWarnings.push({username: user.username || String(user.telegram_id), daysLeft: newDaysLeft});
      } else if (newDaysLeft === 0) {
        console.log(`🚨 Подписка истекла у ${user.username || user.telegram_id}`);
        await sendDirectMessage(user.telegram_id, MSG_SUBSCRIPTION_EXPIRED);
        await supabase
          .from("users")
          .update({
            expires_at: now.toISOString(),
            is_active: false,
            subscription_days_left: 0,
            updated_at: now.toISOString()
          })
          .eq("telegram_id", user.telegram_id);
      } else {
        await supabase
          .from("users")
          .update({
            subscription_days_left: newDaysLeft,
            updated_at: now.toISOString()
          })
          .eq("telegram_id", user.telegram_id);
      }
    }
  }
  console.log(`📊 Обработано подписок: ${subscriptionProcessed}`);

  // 4. Удаление пользователей с истекшей подпиской
  console.log(`\n🔍 ФАЗА 4: Удаление пользователей с истекшей подпиской`);
  let expiredRemoved = 0;
  for (const user of users) {
    if (user.is_active && user.expires_at && new Date(user.expires_at) <= now && user.subscription_days_left === 0) {
      expiredRemoved++;
      console.log(`🚨 Удаляем ${user.username || user.telegram_id} (подписка истекла)`);
      try {
        await fetch(`${TELEGRAM_API}/kickChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_GROUP_CHAT_ID,
            user_id: user.telegram_id
          })
        });
        console.log(`✅ Пользователь ${user.username || user.telegram_id} удален из чата`);
      } catch (err) {
        console.error(`❌ Ошибка удаления пользователя ${user.username || user.telegram_id}:`, err);
      }
      
      await supabase
        .from("users")
        .update({
          in_chat: false,
          is_active: false,
          updated_at: now.toISOString()
        })
        .eq("telegram_id", user.telegram_id);
        
      await sendDirectMessage(user.telegram_id, MSG_REMOVED_SUBSCRIPTION_EXPIRED);
      stats.subscriptionRemoved.push({username: user.username || String(user.telegram_id)});
    }
  }
  console.log(`📊 Удалено пользователей: ${expiredRemoved}`);

  // 5. Сброс ежедневных флагов
  console.log(`\n🔍 ФАЗА 5: Сброс флагов post_today`);
  const resetResult = await supabase
    .from("users")
    .update({ post_today: false })
    .neq("post_today", false);
    
  if (resetResult.error) {
    console.error(`❌ Ошибка сброса post_today:`, resetResult.error);
  } else {
    console.log(`✅ Сброшены флаги post_today`);
  }

  // 5.1. Анализ опасных случаев (требуют внимания админа)
  console.log(`\n🔍 ФАЗА 6: Анализ опасных случаев`);
  for (const user of users) {
    const username = user.username || String(user.telegram_id);
    
    // Участники с 3 страйками
    if (user.strikes_count === 3 && user.is_active) {
      stats.dangerousCases.push({
        username,
        reason: "3 страйка - на грани исключения"
      });
    }
    
    // Участники с истекающей подпиской и страйками
    if (user.subscription_days_left <= 3 && user.subscription_days_left > 0 && user.strikes_count > 0) {
      stats.dangerousCases.push({
        username,
        reason: `Подписка истекает через ${user.subscription_days_left} дн. + ${user.strikes_count} страйк(а)`
      });
    }
    
    // Новые неактивные пользователи (в чате, но без подписки)
    if (user.in_chat && !user.is_active && user.created_at) {
      const createdDate = new Date(user.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceCreated <= 7) { // Новые за последнюю неделю
        stats.dangerousCases.push({
          username,
          reason: `Новый пользователь в чате без активной подписки (${daysSinceCreated} дн.)`
        });
      }
    }
    
    // Пользователи в чате без активной подписки (is_active = true, но expires_at <= now() и subscription_days_left = 0)
    if (user.is_active && user.expires_at && new Date(user.expires_at) <= now && user.subscription_days_left === 0) {
      stats.dangerousCases.push({
        username,
        reason: "Активен в системе, но подписка истекла"
      });
    }
  }

  // 6. Отправка отчета владельцу
  console.log(`\n🔍 ФАЗА 7: Отправка отчета владельцу (${OWNER_TELEGRAM_ID})`);
  try {
    const report = MSG_DAILY_CRON_REPORT(stats);
    await sendDirectMessage(OWNER_TELEGRAM_ID, report);
    console.log(`✅ Отчет отправлен владельцу`);
  } catch (err) {
    console.error(`❌ Ошибка отправки отчета владельцу:`, err);
  }

  // Финальная статистика
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log(`\n=== DAILY CRON COMPLETED ===`);
  console.log(`⏱️ Время выполнения: ${executionTime}ms`);
  console.log(`📊 Итоговая статистика:`);
  console.log(`   - Активных пользователей: ${stats.totalActive}`);
  console.log(`   - Отправили посты: ${stats.postsToday}`);
  console.log(`   - Не отправили: ${stats.noPosts}`);
  console.log(`   - Новых страйков: ${stats.newStrikes.length}`);
  console.log(`   - Автопауз: ${stats.autoPaused.length}`);
  console.log(`   - Удалений: ${stats.pauseExpiredRemoved.length + stats.subscriptionRemoved.length}`);
  console.log(`   - На паузе: ${stats.currentlyPaused.length}`);
  console.log(`   - Опасных случаев: ${stats.dangerousCases.length}`);
  console.log(`🏁 Daily cron завершен успешно в ${new Date().toISOString()}`);

  return new Response(JSON.stringify({
    message: "dailyCron завершён",
    executionTime,
    stats
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Публичное напоминание в 20:00 UTC (publicDeadlineReminder)
 * Реализует логику Б3 из logic.md
 */
export async function publicDeadlineReminder(): Promise<Response> {
  const now = new Date();
  const startTime = Date.now();
  
  console.log(`\n=== PUBLIC REMINDER STARTED ===`);
  console.log(`🕐 Время запуска: ${now.toISOString()}`);
  console.log(`🌐 UTC: ${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}`);
  
  // Конец дня — 04:00 следующего дня по UTC (время запуска dailyCron)
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(4, 0, 0, 0);
  
  // Если текущее время уже после 04:00, то конец дня — завтра в 04:00
  if (now.getUTCHours() >= 4) {
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  }
  
  const diffMs = endOfDay.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  console.log(`⏰ До конца дня (04:00 UTC): ${diffHours}ч ${diffMinutes}мин`);

  // Получаем пользователей, которым нужно напомнить
  console.log(`📊 Получаем данные пользователей из БД...`);
  const usersRes = await supabase
    .from("users")
    .select("username, mode, pace, in_chat, is_active, pause_until, public_remind, post_today");
    
  if (usersRes.error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить пользователей:", usersRes.error);
    return new Response(`Ошибка получения пользователей: ${usersRes.error.message}`, { status: 500 });
  }
  
  const users = usersRes.data || [];
  console.log(`✅ Загружено ${users.length} записей пользователей`);
  
  // Диагностика пользователей
  const activeDailyUsers = users.filter(u => u.in_chat && u.is_active && u.pace === "daily");
  console.log(`🔍 Активных пользователей с pace="daily": ${activeDailyUsers.length}`);
  if (activeDailyUsers.length > 0) {
    console.log(`   📋 Список: ${activeDailyUsers.map(u => `${u.username}(${u.pace})`).join(', ')}`);
  }
  
  // Детальная диагностика фильтрации
  console.log(`\n🔎 ДЕТАЛЬНАЯ ДИАГНОСТИКА:`);
  for (const user of activeDailyUsers.slice(0, 5)) { // Показываем первых 5 для примера
    console.log(`👤 ${user.username}:`);
    console.log(`   - mode: "${user.mode}" (trimmed: "${user.mode?.trim()}")`);
    console.log(`   - post_today: ${user.post_today}`);
    console.log(`   - public_remind: ${user.public_remind}`);
    console.log(`   - pause_until: ${user.pause_until}`);
    console.log(`   - username: ${user.username ? 'есть' : 'НЕТ'}`);
  }
  
  // Фильтруем пользователей по условиям для напоминания
  const textUsers = users.filter(u => 
    u.in_chat && 
    u.is_active && 
    u.pace === "daily" &&                                 // ТОЛЬКО ежедневный ритм!
    (!u.pause_until || new Date(u.pause_until) <= now) &&
    u.public_remind && 
    !u.post_today && 
    u.mode?.trim() === "text" &&                          // TRIM для удаления \n!
    u.username
  );
  
  const imageUsers = users.filter(u => 
    u.in_chat && 
    u.is_active && 
    u.pace === "daily" &&                                 // ТОЛЬКО ежедневный ритм!
    (!u.pause_until || new Date(u.pause_until) <= now) &&
    u.public_remind && 
    !u.post_today && 
    u.mode?.trim() === "image" &&                         // TRIM для удаления \n!
    u.username
  );
  
  console.log(`🎯 Пользователи для напоминания (ТОЛЬКО pace="daily"):`);
  console.log(`   - Режим "text": ${textUsers.length} чел.`);
  console.log(`   - Режим "image": ${imageUsers.length} чел.`);
  
  if (textUsers.length > 0) {
    console.log(`   📝 Text пользователи: ${textUsers.map(u => u.username).join(', ')}`);
  }
  if (imageUsers.length > 0) {
    console.log(`   🖼️ Image пользователи: ${imageUsers.map(u => u.username).join(', ')}`);
  }
  
  let sentReminders = 0;
  const allUsernames: string[] = [];

  // Формируем сообщение с динамическим временем
  let timeLeftMsg = "";
  if (diffHours > 0) {
    timeLeftMsg = `До конца дня осталось ${diffHours} ${pluralizeHours(diffHours)}!`;
  } else {
    timeLeftMsg = `До конца дня осталось меньше часа! (${diffMinutes} минут)`;
  }

  console.log(`💬 Текст напоминания: "${timeLeftMsg}"`);

  // Отправляем напоминание для текстовиков
  if (textUsers.length > 0) {
    console.log(`📤 Отправляем напоминание для text пользователей в тред ${PUBLIC_REMINDER_THREAD_ID_TEXT}...`);
    const usernames = textUsers.map(u => u.username);
    allUsernames.push(...usernames);
    const text = MSG_PUBLIC_DEADLINE_REMINDER(usernames, timeLeftMsg);
    
    try {
      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_GROUP_CHAT_ID,
          message_thread_id: PUBLIC_REMINDER_THREAD_ID_TEXT,
          text,
        })
      });
      
      if (response.ok) {
        console.log(`✅ Напоминание для text пользователей отправлено`);
        sentReminders++;
      } else {
        const errorData = await response.text();
        console.error(`❌ Ошибка отправки напоминания для text: ${response.status} - ${errorData}`);
      }
    } catch (err) {
      console.error(`❌ Исключение при отправке напоминания для text:`, err);
    }
  }

  // Отправляем напоминание для картинщиков
  if (imageUsers.length > 0) {
    console.log(`📤 Отправляем напоминание для image пользователей в тред ${PUBLIC_REMINDER_THREAD_ID_IMAGE}...`);
    const usernames = imageUsers.map(u => u.username);
    allUsernames.push(...usernames);
    const text = MSG_PUBLIC_DEADLINE_REMINDER(usernames, timeLeftMsg);
    
    try {
      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_GROUP_CHAT_ID,
          message_thread_id: PUBLIC_REMINDER_THREAD_ID_IMAGE,
          text,
        })
      });
      
      if (response.ok) {
        console.log(`✅ Напоминание для image пользователей отправлено`);
        sentReminders++;
      } else {
        const errorData = await response.text();
        console.error(`❌ Ошибка отправки напоминания для image: ${response.status} - ${errorData}`);
      }
    } catch (err) {
      console.error(`❌ Исключение при отправке напоминания для image:`, err);
    }
  }

  // Финальная статистика
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log(`\n=== PUBLIC REMINDER COMPLETED ===`);
  console.log(`⏱️ Время выполнения: ${executionTime}ms`);
  console.log(`📊 Результат: отправлено ${sentReminders} напоминаний в ${sentReminders} тредов`);
  console.log(`👥 Всего пользователей в напоминаниях: ${allUsernames.length}`);
  console.log(`🏁 Public reminder завершен в ${new Date().toISOString()}`);

  if (sentReminders === 0) {
    console.log(`ℹ️ Все участники уже прислали посты или не требуют напоминаний`);
    return new Response(JSON.stringify({ 
      message: "Все участники уже прислали посты или не требуют напоминаний",
      executionTime 
    }), { status: 200 });
  }

  return new Response(JSON.stringify({ 
    message: "Публичные напоминания отправлены", 
    usernames: allUsernames, 
    timeLeftMsg,
    sentToThreads: sentReminders,
    executionTime
  }), { status: 200 });
}

function pluralizeHours(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'час';
  if (abs >= 2 && abs <= 4) return 'часа';
  return 'часов';
}

/**
 * Функция allInfo - отправка детального отчета админу
 * Может быть вызвана отдельно через команду /allinfo
 */
export async function allInfo(): Promise<Response> {
  const now = new Date();
  const startTime = Date.now();
  
  console.log(`\n=== ALL INFO STARTED ===`);
  console.log(`🕐 Время запуска: ${now.toISOString()}`);
  console.log(`👤 Отправка отчета владельцу: ${OWNER_TELEGRAM_ID}`);
  
  // Получаем всех пользователей для анализа
  console.log(`📊 Получаем данные пользователей из БД...`);
  const usersRes = await supabase
    .from("users")
    .select("*");
    
  if (usersRes.error) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить пользователей:", usersRes.error);
    return new Response(`Ошибка получения пользователей: ${usersRes.error.message}`, { status: 500 });
  }
  
  const users = usersRes.data || [];
  console.log(`✅ Загружено ${users.length} записей пользователей для анализа`);
  
  // Собираем статистику как в dailyCron
  const stats = {
    totalActive: 0,
    postsToday: 0,
    noPosts: 0,
    newStrikes: [] as Array<{username: string, strikes: number}>,
    riskyUsers: [] as Array<{username: string, strikes: number}>,
    autoPaused: [] as Array<{username: string}>,
    pauseCompleted: [] as Array<{username: string}>,
    pauseExpiredRemoved: [] as Array<{username: string}>,
    currentlyPaused: [] as Array<{username: string, pauseUntil: string}>,
    subscriptionWarnings: [] as Array<{username: string, daysLeft: number}>,
    subscriptionRemoved: [] as Array<{username: string}>,
    dangerousCases: [] as Array<{username: string, reason: string}>
  };

  console.log(`🔍 Анализируем данные пользователей...`);
  for (const user of users) {
    const username = user.username || String(user.telegram_id);
    
    // Активные пользователи
    if (user.in_chat && user.is_active) {
      stats.totalActive++;
      
      if (user.post_today) {
        stats.postsToday++;
      } else {
        stats.noPosts++;
      }
    }
    
    // Пользователи с риском
    if (user.strikes_count === 3 && user.is_active) {
      stats.riskyUsers.push({username, strikes: user.strikes_count});
    }
    
    // Пользователи на паузе
    if (user.pause_until && new Date(user.pause_until) > now) {
      const pauseEnd = new Date(user.pause_until);
      stats.currentlyPaused.push({
        username,
        pauseUntil: pauseEnd.toLocaleDateString('ru-RU')
      });
    }
    
    // Предупреждения о подписке
    if (user.subscription_days_left <= 3 && user.subscription_days_left > 0) {
      stats.subscriptionWarnings.push({username, daysLeft: user.subscription_days_left});
    }
    
    // Опасные случаи
    if (user.strikes_count === 3 && user.is_active) {
      stats.dangerousCases.push({
        username,
        reason: "3 страйка - на грани исключения"
      });
    }
    
    if (user.subscription_days_left <= 3 && user.subscription_days_left > 0 && user.strikes_count > 0) {
      stats.dangerousCases.push({
        username,
        reason: `Подписка истекает через ${user.subscription_days_left} дн. + ${user.strikes_count} страйк(а)`
      });
    }
    
    if (user.in_chat && !user.is_active && user.created_at) {
      const createdDate = new Date(user.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceCreated <= 7) {
        stats.dangerousCases.push({
          username,
          reason: `Новый пользователь в чате без активной подписки (${daysSinceCreated} дн.)`
        });
      }
    }
    
    if (user.is_active && user.expires_at && new Date(user.expires_at) <= now && user.subscription_days_left === 0) {
      stats.dangerousCases.push({
        username,
        reason: "Активен в системе, но подписка истекла"
      });
    }
  }

  // Отправляем отчет
  console.log(`📤 Отправляем отчет владельцу...`);
  try {
    const report = MSG_DAILY_CRON_REPORT(stats);
    await sendDirectMessage(OWNER_TELEGRAM_ID, report);
    console.log(`✅ Отчет успешно отправлен`);
  } catch (err) {
    console.error(`❌ Ошибка отправки отчета:`, err);
  }

  // Финальная статистика
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log(`\n=== ALL INFO COMPLETED ===`);
  console.log(`⏱️ Время выполнения: ${executionTime}ms`);
  console.log(`📊 Итоговая статистика:`);
  console.log(`   - Активных пользователей: ${stats.totalActive}`);
  console.log(`   - Отправили посты: ${stats.postsToday}`);
  console.log(`   - Не отправили: ${stats.noPosts}`);
  console.log(`   - На паузе: ${stats.currentlyPaused.length}`);
  console.log(`   - Предупреждений о подписке: ${stats.subscriptionWarnings.length}`);
  console.log(`   - Опасных случаев: ${stats.dangerousCases.length}`);
  console.log(`🏁 allInfo завершен в ${new Date().toISOString()}`);

  return new Response(JSON.stringify({
    message: "allInfo отчет отправлен",
    executionTime,
    stats
  }), { status: 200, headers: { "Content-Type": "application/json" } });
} 