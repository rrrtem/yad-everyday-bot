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
  
  // Получаем всех пользователей
  const usersRes = await supabase
    .from("users")
    .select("*");
    
  if (usersRes.error) {
    console.error("CRON: Ошибка получения пользователей:", usersRes.error);
    return new Response("Ошибка получения пользователей", { status: 500 });
  }
  
  const users = usersRes.data || [];
  
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
  for (const user of users) {
    if (user.pause_until) {
      const pauseEnd = new Date(user.pause_until);
      if (pauseEnd <= now) {
        // Пауза истекла
        if (user.strikes_count === 4) {
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
          } catch (err) {
            console.error("Ошибка удаления пользователя:", err);
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
  for (const user of users) {
    if (user.subscription_days_left > 0 && user.is_active && user.subscription_active === false) {
      const newDaysLeft = user.subscription_days_left - 1;
      
      if (newDaysLeft === SUBSCRIPTION_REMINDER_DAYS) {
        await sendDirectMessage(user.telegram_id, MSG_SUBSCRIPTION_ENDING_REMINDER);
        stats.subscriptionWarnings.push({username: user.username || String(user.telegram_id), daysLeft: newDaysLeft});
      } else if (newDaysLeft === 0) {
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

  // 4. Удаление пользователей с истекшей подпиской
  for (const user of users) {
    if (user.is_active && user.expires_at && new Date(user.expires_at) <= now && user.subscription_days_left === 0) {
      try {
        await fetch(`${TELEGRAM_API}/kickChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_GROUP_CHAT_ID,
            user_id: user.telegram_id
          })
        });
      } catch (err) {
        console.error("Ошибка удаления пользователя:", err);
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

  // 5. Сброс ежедневных флагов
  await supabase
    .from("users")
    .update({ post_today: false })
    .neq("post_today", false);

  // 6. Отправка отчета владельцу
  const report = MSG_DAILY_CRON_REPORT(stats);
  await sendDirectMessage(OWNER_TELEGRAM_ID, report);

  return new Response(JSON.stringify({
    message: "dailyCron завершён",
    stats
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}



/**
 * Публичное напоминание в 20:00 UTC (publicDeadlineReminder)
 * Реализует логику Б3 из logic.md
 */
export async function publicDeadlineReminder(): Promise<Response> {
  const now = new Date();
  
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

  // Получаем пользователей, которым нужно напомнить
  const usersRes = await supabase
    .from("users")
    .select("username, mode, in_chat, is_active, pause_until, public_remind, post_today");
    
  if (usersRes.error) {
    console.error("CRON: Ошибка получения пользователей:", usersRes.error);
    return new Response("Ошибка получения пользователей", { status: 500 });
  }
  
  const users = usersRes.data || [];
  
  // Фильтруем пользователей по условиям для напоминания
  const textUsers = users.filter(u => 
    u.in_chat && 
    u.is_active && 
    (!u.pause_until || new Date(u.pause_until) <= now) &&
    u.public_remind && 
    !u.post_today && 
    u.mode === "text" &&
    u.username
  );
  
  const imageUsers = users.filter(u => 
    u.in_chat && 
    u.is_active && 
    (!u.pause_until || new Date(u.pause_until) <= now) &&
    u.public_remind && 
    !u.post_today && 
    u.mode === "image" &&
    u.username
  );
  
  let sentReminders = 0;
  const allUsernames: string[] = [];

  // Формируем сообщение с динамическим временем
  let timeLeftMsg = "";
  if (diffHours > 0) {
    timeLeftMsg = `До конца дня осталось ${diffHours} ${pluralizeHours(diffHours)}!`;
  } else {
    timeLeftMsg = `До конца дня осталось меньше часа! (${diffMinutes} минут)`;
  }

  // Отправляем напоминание для текстовиков
  if (textUsers.length > 0) {
    const usernames = textUsers.map(u => u.username);
    allUsernames.push(...usernames);
    const text = MSG_PUBLIC_DEADLINE_REMINDER(usernames, timeLeftMsg);
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_GROUP_CHAT_ID,
        message_thread_id: PUBLIC_REMINDER_THREAD_ID_TEXT,
        text,
      })
    });
    sentReminders++;
  }

  // Отправляем напоминание для картинщиков
  if (imageUsers.length > 0) {
    const usernames = imageUsers.map(u => u.username);
    allUsernames.push(...usernames);
    const text = MSG_PUBLIC_DEADLINE_REMINDER(usernames, timeLeftMsg);
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_GROUP_CHAT_ID,
        message_thread_id: PUBLIC_REMINDER_THREAD_ID_IMAGE,
        text,
      })
    });
    sentReminders++;
  }

  if (sentReminders === 0) {
    return new Response(JSON.stringify({ 
      message: "Все участники уже прислали посты или не требуют напоминаний" 
    }), { status: 200 });
  }

  return new Response(JSON.stringify({ 
    message: "Публичные напоминания отправлены", 
    usernames: allUsernames, 
    timeLeftMsg,
    sentToThreads: sentReminders 
  }), { status: 200 });
}

function pluralizeHours(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'час';
  if (abs >= 2 && abs <= 4) return 'часа';
  return 'часов';
} 