import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDirectMessage } from "../bot/userHandler.ts";
import { DEFAULT_MAX_LIVES, MSG_LIFE_DEDUCTED, MSG_PAUSED, MSG_MONTHLY_RESET, CHALLENGE_JOIN_LINK, MSG_PUBLIC_DEADLINE_REMINDER, PUBLIC_REMINDER_THREAD_ID } from "../constants.ts";

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

function getTodayCET() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "CET" }); // YYYY-MM-DD
}

/**
 * Ежедневная проверка: списание жизней, начисление штрафов, сброс post_today, напоминания, удаление из чата.
 */
export async function dailyCron(): Promise<Response> {
  const now = new Date();
  const todayDate = getTodayCET();
  const usersRes = await supabase.from("users").select("telegram_id, first_name, username, current_lives, max_lives, is_active, post_today");
  if (usersRes.error) {
    console.error("CRON: Ошибка получения пользователей:", usersRes.error);
    return new Response("Ошибка получения пользователей", { status: 500 });
  }
  const users = usersRes.data || [];
  let livesDeducted = 0, kicked = 0;
  const livesDeductedUsers: {username: string, lives: number}[] = [];
  const kickedUsers: string[] = [];

  for (const user of users) {
    if (user.is_active) {
      if (!user.post_today) {
        const newLives = (user.current_lives || 0) - 1;
        if (newLives <= 0) {
          await supabase.from("users").update({
            current_lives: 0,
            is_active: false,
            left_at: now.toISOString(),
            updated_at: now.toISOString(),
          }).eq("telegram_id", user.telegram_id);
          try {
            const res = await fetch(`${TELEGRAM_API}/kickChatMember`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: TELEGRAM_GROUP_CHAT_ID,
                user_id: user.telegram_id
              })
            });
            const data = await res.json();
            if (!data.ok) {
              console.error("Ошибка удаления пользователя из чата:", data);
            }
          } catch (err) {
            console.error("Ошибка обращения к Telegram API для удаления:", err);
          }
          await sendDirectMessage(user.telegram_id, MSG_PAUSED(CHALLENGE_JOIN_LINK));
          kicked++;
          kickedUsers.push(user.username || String(user.telegram_id));
        } else {
          await supabase.from("users").update({
            current_lives: newLives,
            updated_at: now.toISOString(),
          }).eq("telegram_id", user.telegram_id);
          await sendDirectMessage(user.telegram_id, MSG_LIFE_DEDUCTED(newLives));
          livesDeducted++;
          livesDeductedUsers.push({username: user.username || String(user.telegram_id), lives: newLives});
        }
      }
    }
  }
  await supabase.from("users").update({ post_today: false }).neq("post_today", false);
  return new Response(JSON.stringify({
    message: "CRON завершён",
    livesDeducted,
    kicked,
    livesDeductedUsers,
    kickedUsers
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Ежемесячный сброс жизней и penalty_month у всех пользователей.
 */
export async function monthlyReset(): Promise<Response> {
  const now = new Date();
  const usersRes = await supabase.from("users").select("telegram_id, max_lives, is_active, username");
  if (usersRes.error) {
    console.error("CRON: Ошибка получения пользователей:", usersRes.error);
    return new Response("Ошибка получения пользователей", { status: 500 });
  }
  const users = usersRes.data || [];
  const resetUsers: {username: string, lives: number}[] = [];
  for (const user of users) {
    const lives = user.max_lives > 0 ? user.max_lives : DEFAULT_MAX_LIVES;
    await supabase.from("users").update({
      current_lives: lives,
      updated_at: now.toISOString(),
    }).eq("telegram_id", user.telegram_id);
    if (user.is_active) {
      await sendDirectMessage(user.telegram_id, MSG_MONTHLY_RESET(lives));
    }
    resetUsers.push({username: user.username || String(user.telegram_id), lives});
  }
  return new Response(JSON.stringify({ message: "Monthly reset completed", resetUsers }), { status: 200, headers: { "Content-Type": "application/json" } });
}

/**
 * Публичное напоминание в канал за X часов до конца дня: кто не прислал пост
 */
export async function publicDeadlineReminder(): Promise<Response> {
  const now = new Date();
  // Конец дня — 02:59 следующего дня по CET
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(1, 59, 0, 0); // 02:59 по CET = 01:59 UTC
  // Если текущее время уже после 02:59, то конец дня — завтра в 02:59
  if (now.getUTCHours() > 1 || (now.getUTCHours() === 1 && now.getUTCMinutes() >= 59)) {
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  }
  const diffMs = endOfDay.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const usersRes = await supabase.from("users").select("username, is_active, post_today");
  if (usersRes.error) {
    console.error("CRON: Ошибка получения пользователей:", usersRes.error);
    return new Response("Ошибка получения пользователей", { status: 500 });
  }
  const users = usersRes.data || [];
  // Фильтруем только активных, кто не прислал пост и у кого есть username
  const pending = users.filter(u => u.is_active && !u.post_today && u.username);
  if (pending.length === 0) {
    // Если все участники уже прислали посты, не отправляем сообщение
    return new Response(JSON.stringify({ message: "Все участники уже прислали посты" }), { status: 200 });
  }
  const usernames = pending.map(u => u.username);
  // Формируем сообщение с динамическим временем
  let timeLeftMsg = "";
  if (diffHours > 0) {
    timeLeftMsg = `До конца дня осталось ${diffHours} ${pluralizeHours(diffHours)}!`;
  } else {
    timeLeftMsg = `До конца дня осталось меньше часа! (${diffMinutes} минут)`;
  }
  const text = MSG_PUBLIC_DEADLINE_REMINDER(usernames, timeLeftMsg);
  // Отправляем сообщение в канал
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_GROUP_CHAT_ID,
      message_thread_id: PUBLIC_REMINDER_THREAD_ID,
      text,
    })
  });
  return new Response(JSON.stringify({ message: "Публичное напоминание отправлено", usernames, timeLeftMsg }), { status: 200 });
}

function pluralizeHours(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'час';
  if (abs >= 2 && abs <= 4) return 'часа';
  return 'часов';
} 