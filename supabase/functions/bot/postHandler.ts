import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, registerUser, sendDirectMessage } from "./userHandler.ts";
import { DEFAULT_MAX_LIVES, MSG_DAILY_ACCEPTED } from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for postHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Обрабатывает сообщение с тегом #daily.
 */
export async function handleDailyPost(message: any) {
  console.log("handleDailyPost called", JSON.stringify(message));
  if (!message || !message.from || !message.chat) return;

  // Игнорировать личку
  if (message.chat.type === "private") return;

  const text = message.text || message.caption || "";
  if (!/\B#daily\b/i.test(text)) return;

  const telegramId = message.from.id;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const today = new Date();
  const todayDate = today.toLocaleDateString("sv-SE", { timeZone: "CET" }); // YYYY-MM-DD
  const now = today.toISOString();

  // Найти пользователя
  let user = await findUserByTelegramId(telegramId);
  console.log("findUserByTelegramId result", user);
  if (!user) {
    console.log("User not found, registering new user", telegramId);
    await registerUser(message.from);
    user = await findUserByTelegramId(telegramId);
    console.log("User after registerUser", user);
  }

  // Если уже был пост сегодня — только реакция
  if (user.post_today === true) {
    console.log("User already posted today, only reaction");
    await sendDirectMessage(telegramId, MSG_DAILY_ACCEPTED);
    return;
  }

  // Обновить post_today, last_post_date, updated_at
  const { error } = await supabase
    .from("users")
    .update({
      post_today: true,
      last_post_date: todayDate,
      updated_at: now,
      is_active: true, // если вдруг был неактивен, стал активен
    })
    .eq("telegram_id", telegramId);
  if (error) {
    console.error("Ошибка при обновлении пользователя после #daily:", error.message);
  } else {
    console.log("User updated after #daily", telegramId);
    await sendDirectMessage(telegramId, MSG_DAILY_ACCEPTED);
  }
} 