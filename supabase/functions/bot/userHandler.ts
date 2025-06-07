import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_STRIKES_COUNT } from "../constants.ts";

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
    is_active: false,
    in_chat: false,
    subscription_active: false,
    club: false,
    strikes_count: DEFAULT_STRIKES_COUNT,
    post_today: false,
    last_post_date: null,
    units_count: 0,
    mode: null,
    mode_changed_at: null,
    pace: null,
    pace_changed_at: null,
    public_remind: true,
    pause_started_at: null,
    pause_until: null,
    pause_days: 0,
    subscription_days_left: 0,
    promo_code: null,
    payment_link_sent: null,
    payment_cancel_link_sent: null,
    subscription_started_at: null,
    subscription_cancelled_at: null,
    expires_at: null,
    left_at: null,
    joined_at: null, // joined_at устанавливается только при добавлении в чат
    updated_at: now,
    last_activity_at: now,
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
 * Обновляет данные существующего пользователя (имя, фамилия, username)
 * is_active остается как есть
 */
export async function updateExistingUser(telegramId: number, telegramUser: any) {
  console.log("updateExistingUser called", telegramId, telegramUser);
  const now = new Date().toISOString();
  const updateData = {
    first_name: telegramUser.first_name || null,
    last_name: telegramUser.last_name || null,
    username: telegramUser.username || null,
    updated_at: now,
  };
  
  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error("Ошибка при обновлении пользователя:", error.message);
    return null;
  }
  
  console.log("updateExistingUser success", telegramId);
  return updateData;
}

/**
 * Обрабатывает событие chat_member (добавление/удаление участников)
 * Реализует логику Б4 и Б5 из logic.md
 */
export async function updateUserFromChatMember(chatMemberUpdate: any) {
  console.log("updateUserFromChatMember called", JSON.stringify(chatMemberUpdate));
  if (!chatMemberUpdate || !chatMemberUpdate.new_chat_member) return;
  
  const member = chatMemberUpdate.new_chat_member;
  const user = member.user;
  const telegramId = user.id;
  const inChat = ["member", "administrator", "creator"].includes(member.status);
  const firstName = user.first_name || null;
  const lastName = user.last_name || null;
  const username = user.username || null;
  const now = new Date().toISOString();

  const existingUser = await findUserByTelegramId(telegramId);
  console.log("updateUserFromChatMember existingUser", existingUser);

  if (!existingUser) {
    // Новый пользователь - создаём запись
    await registerUser(user);
    const newUser = await findUserByTelegramId(telegramId);
    if (inChat && newUser) {
      // Обновляем статус входа в чат
      await supabase
        .from("users")
        .update({
          in_chat: true,
          joined_at: now,
          strikes_count: 0,
          updated_at: now
        })
        .eq("telegram_id", telegramId);
    }
    console.log(`Пользователь ${telegramId} (${firstName}) зарегистрирован.`);
    return;
  }

  let updateData: any = {
    first_name: firstName,
    last_name: lastName,
    username: username,
    updated_at: now,
  };

  if (inChat) {
    // Пользователь вошел в чат (Б4)
    updateData.in_chat = true;
    updateData.joined_at = now;
    updateData.left_at = null;
    updateData.strikes_count = 0;
    updateData.post_today = false;
    
    // is_active = true только если есть активная подписка
    if (existingUser.subscription_active) {
      updateData.is_active = true;
    }
    
    // Если есть сохранённые дни подписки, возобновляем
    if (existingUser.subscription_days_left > 0) {
      const daysToAdd = existingUser.subscription_days_left;
      updateData.expires_at = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
      updateData.subscription_days_left = 0;
      updateData.is_active = true;
      // subscription_active НЕ изменяем - только через webhook Tribute
    }
  } else {
    // Пользователь покинул чат (Б5)
    updateData.in_chat = false;
    updateData.is_active = false;
    updateData.left_at = now;
    
    // Рассчитываем и сохраняем неиспользованные дни
    if (existingUser.subscription_days_left > 0) {
      // Дни уже сохранены
    } else if (existingUser.expires_at) {
      const expiresAt = new Date(existingUser.expires_at);
      const today = new Date();
      if (expiresAt > today) {
        const daysLeft = Math.ceil((expiresAt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        updateData.subscription_days_left = daysLeft;
      }
    }
  }

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error("Ошибка при обновлении пользователя:", error.message);
  } else {
    console.log(`Пользователь ${telegramId} (${firstName}) — статус: ${inChat ? "в группе" : "вышел"}. Данные обновлены.`);
  }
}

// Функции для списания/восстановления жизней будут здесь или в cron.ts
// Например, функция, вызываемая из cron.ts:
// export async function deductLifeForNoPost(userId: number, livesToDeduct: number = 1) { ... }
// export async function giveLifeForPenalty(userId: number, livesToAdd: number = 1) { ... } 