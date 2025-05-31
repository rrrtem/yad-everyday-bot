import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_MAX_LIVES } from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for userHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Отправляет прямое сообщение пользователю (по telegram_id).
 */
export async function sendDirectMessage(telegramId: number, text: string): Promise<void> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text }),
    });
    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sending DM to ${telegramId}: ${respJson.description}`);
    } else {
      console.log(`DM sent to ${telegramId}: "${text}"`);
    }
  } catch (error) {
    console.error(`Failed to send DM to ${telegramId}:`, error);
  }
}

/**
 * Находит пользователя по telegram_id.
 */
export async function findUserByTelegramId(telegramId: number) {
  console.log("findUserByTelegramId called", telegramId);
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user by telegram_id:", error);
    return null;
  }
  console.log("findUserByTelegramId result", data);
  return data;
}

/**
 * Регистрирует нового пользователя по telegram_id и данным Telegram.
 */
export async function registerUser(telegramUser: any) {
  console.log("registerUser called", telegramUser);
  const now = new Date().toISOString();
  const userData = {
    telegram_id: telegramUser.id,
    first_name: telegramUser.first_name || null,
    last_name: telegramUser.last_name || null,
    username: telegramUser.username || null,
    is_active: true,
    current_lives: DEFAULT_MAX_LIVES,
    max_lives: DEFAULT_MAX_LIVES,
    post_today: false,
    last_post_date: null,
    penalty_active: false,
    penalty_assigned_at: null,
    penalty_paid_at: null,
    penalty_total: 0,
    penalty_month: 0,
    left_at: null,
    joined_at: now,
    updated_at: now,
    last_penalty_reminder_at: null,
  };
  const { error } = await supabase.from("users").insert(userData);
  if (error) {
    console.error("Ошибка при регистрации пользователя:", error.message);
    return null;
  }
  console.log("registerUser success", userData);
  return userData;
}

/**
 * Актуализирует пользователя по telegram_id (обновляет имя, username, is_active, left_at, updated_at).
 * Если пользователь возвращается после удаления — left_at = null, is_active = true, жизни и штрафы не сбрасываются.
 */
export async function updateUserFromChatMember(chatMemberUpdate: any) {
  console.log("updateUserFromChatMember called", JSON.stringify(chatMemberUpdate));
  if (!chatMemberUpdate || !chatMemberUpdate.new_chat_member) return;
  const member = chatMemberUpdate.new_chat_member;
  const user = member.user;
  const telegramId = user.id;
  const isActive = ["member", "administrator", "creator"].includes(member.status);
  const firstName = user.first_name || null;
  const lastName = user.last_name || null;
  const username = user.username || null;
  const now = new Date().toISOString();

  const existingUser = await findUserByTelegramId(telegramId);
  console.log("updateUserFromChatMember existingUser", existingUser);

  if (!existingUser) {
    // Новый пользователь
    await registerUser(user);
    console.log(`Пользователь ${telegramId} (${firstName}) зарегистрирован.`);
    return;
  }

  let updateData: any = {
    first_name: firstName,
    last_name: lastName,
    username: username,
    is_active: isActive,
    updated_at: now,
  };

  if (isActive) {
    // Возврат в чат
    if (existingUser.is_active === false) {
      updateData.left_at = null;
      // joined_at не меняем, жизни не сбрасываем
    }
  } else {
    // Выход из чата
    updateData.left_at = now;
    updateData.is_active = false;
  }

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
  if (error) {
    console.error("Ошибка при обновлении пользователя:", error.message);
  } else {
    console.log(`Пользователь ${telegramId} (${firstName}) — статус: ${isActive ? "в группе" : "вышел"}. Данные обновлены.`);
  }
}

// Функции для списания/восстановления жизней будут здесь или в cron.ts
// Например, функция, вызываемая из cron.ts:
// export async function deductLifeForNoPost(userId: number, livesToDeduct: number = 1) { ... }
// export async function giveLifeForPenalty(userId: number, livesToAdd: number = 1) { ... } 