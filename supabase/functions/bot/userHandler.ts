import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_STRIKES_COUNT } from "./constants.ts";
import { BotMenuManager } from "./utils/botMenuManager.ts";

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
 * @returns ID отправленного сообщения или null в случае ошибки
 */
export async function sendDirectMessage(telegramId: number, text: string): Promise<number | null> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: telegramId, 
        text,
        parse_mode: "HTML"
      }),
    });
    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sending DM to ${telegramId}: ${respJson.description}`);
      return null;
    } else {
      console.log(`DM sent to ${telegramId}: "${text}"`);
      return respJson.result?.message_id || null;
    }
  } catch (error) {
    console.error(`Failed to send DM to ${telegramId}:`, error);
    return null;
  }
}

/**
 * Отправляет картинку с подписью пользователю
 */
export async function sendPhotoWithCaption(telegramId: number, photoFileId: string, caption: string): Promise<number | null> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: telegramId, 
        photo: photoFileId,
        caption,
        parse_mode: "HTML"
      }),
    });
    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sending photo to ${telegramId}: ${respJson.description}`);
      return null;
    } else {
      console.log(`Photo sent to ${telegramId} with caption: "${caption}"`);
      return respJson.result?.message_id || null;
    }
  } catch (error) {
    console.error(`Failed to send photo to ${telegramId}:`, error);
    return null;
  }
}

/**
 * Отправляет медиагруппу (альбом) пользователю
 * media: [{ type: 'photo', media: 'https://...' }, ...]
 */
export async function sendMediaGroup(telegramId: number, media: Array<{ type: string; media: string; caption?: string }>): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        media
      })
    });
    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sendMediaGroup to ${telegramId}: ${respJson.description}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Failed to sendMediaGroup to ${telegramId}:`, error);
    return false;
  }
}

/**
 * Отправляет нативный видео-кружок (video note)
 * video может быть file_id (уже загруженный в Telegram) или HTTPS URL
 * Доп. опции: duration (секунды), length (ширина/высота, для кружка должно быть квадратное видео)
 */
export async function sendVideoNote(
  telegramId: number,
  video: string,
  options?: { duration?: number; length?: number; disable_notification?: boolean; protect_content?: boolean }
): Promise<number | null> {
  try {
    const body: any = {
      chat_id: telegramId,
      video_note: video
    };
    if (options?.duration !== undefined) body.duration = options.duration;
    if (options?.length !== undefined) body.length = options.length;
    if (options?.disable_notification !== undefined) body.disable_notification = options.disable_notification;
    if (options?.protect_content !== undefined) body.protect_content = options.protect_content;

    const response = await fetch(`${TELEGRAM_API}/sendVideoNote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sending video note to ${telegramId}: ${respJson.description}`);
      return null;
    }
    return respJson.result?.message_id || null;
  } catch (error) {
    console.error(`Failed to send video note to ${telegramId}:`, error);
    return null;
  }
}

/**
 * Удаляет сообщение пользователя
 */
export async function deleteMessage(telegramId: number, messageId: number): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        message_id: messageId
      }),
    });
    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error deleting message ${messageId} for ${telegramId}: ${respJson.description}`);
      return false;
    } else {
      console.log(`Message ${messageId} deleted for ${telegramId}`);
      return true;
    }
  } catch (error) {
    console.error(`Failed to delete message ${messageId} for ${telegramId}:`, error);
    return false;
  }
}

/**
 * Отправляет сообщение с автоматическим удалением предыдущего сообщения того же типа
 * @param telegramId - ID пользователя Telegram
 * @param text - текст сообщения
 * @param messageType - тип сообщения ('daily' или 'milestone')
 * @returns ID нового отправленного сообщения или null
 */
export async function sendMessageWithAutoDelete(telegramId: number, text: string, messageType: 'daily' | 'milestone'): Promise<number | null> {
  try {
    // Получаем текущего пользователя для проверки предыдущих сообщений
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      console.error(`sendMessageWithAutoDelete: пользователь ${telegramId} не найден`);
      return await sendDirectMessage(telegramId, text);
    }

    // Определяем поле для хранения ID сообщения
    const messageIdField = messageType === 'daily' ? 'last_daily_message_id' : 'last_milestone_message_id';
    const previousMessageId = user[messageIdField];

    // Удаляем предыдущее сообщение, если оно существует
    if (previousMessageId) {
      console.log(`sendMessageWithAutoDelete: удаляем предыдущее ${messageType} сообщение ${previousMessageId} для пользователя ${telegramId}`);
      await deleteMessage(telegramId, previousMessageId);
    }

    // Отправляем новое сообщение
    const newMessageId = await sendDirectMessage(telegramId, text);
    
    if (newMessageId) {
      // Сохраняем ID нового сообщения в БД
      const updateData = {
        [messageIdField]: newMessageId,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error(`sendMessageWithAutoDelete: ошибка сохранения message_id для ${telegramId}:`, error.message);
      } else {
        console.log(`sendMessageWithAutoDelete: сохранен ${messageType} message_id ${newMessageId} для пользователя ${telegramId}`);
      }
    }

    return newMessageId;
  } catch (error) {
    console.error(`sendMessageWithAutoDelete: ошибка для пользователя ${telegramId}:`, error);
    // Fallback - отправляем обычное сообщение
    return await sendDirectMessage(telegramId, text);
  }
}

/**
 * Отправляет сообщение статуса с адаптивными кнопками
 */
export async function sendStatusMessageWithButtons(telegramId: number, statusMessage: string, user?: any): Promise<void> {
  try {
    const { generateStatusKeyboard } = await import("./utils/statusMessageGenerator.ts");
    
    // Если пользователь не передан, получаем его из БД
    let userData = user;
    if (!userData) {
      userData = await findUserByTelegramId(telegramId);
      if (!userData) {
        console.error(`sendStatusMessageWithButtons: пользователь ${telegramId} не найден`);
        await sendDirectMessage(telegramId, statusMessage);
        return;
      }
    }
    
    const keyboard = await generateStatusKeyboard(userData);
    
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: statusMessage,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });

    const respJson = await response.json();
    if (!respJson.ok) {
      console.error(`Error sending status message with buttons to ${telegramId}: ${respJson.description}`);
      // Fallback: отправляем без кнопок
      await sendDirectMessage(telegramId, statusMessage);
    } else {
      console.log(`Status message with buttons sent to ${telegramId}`);
    }
  } catch (error) {
    console.error(`Failed to send status message with buttons to ${telegramId}:`, error);
    // Fallback: отправляем без кнопок
    await sendDirectMessage(telegramId, statusMessage);
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
    in_chat: false,
    subscription_active: false,
    club: false,
    strikes_count: DEFAULT_STRIKES_COUNT,
    consecutive_posts_count: 0,
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
  
  // Обновляем меню для нового пользователя
  await BotMenuManager.updateUserMenu(telegramUser.id);
  
  return userData;
}

/**
 * Обновляет данные существующего пользователя (имя, фамилия, username)
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
          consecutive_posts_count: 0,
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
    updateData.consecutive_posts_count = 0;
    updateData.post_today = false;
    
    // ❌ УБИРАЕМ ОШИБОЧНОЕ ОБНУЛЕНИЕ subscription_days_left
    // Сохраненные дни НЕ должны обнуляться при входе в чат!
    // Они должны списываться постепенно в dailyCron
    
    // Если есть сохранённые дни подписки, НО НЕ ОБНУЛЯЕМ ИХ!
    if (existingUser.subscription_days_left > 0) {
      console.log(`🔄 Пользователь ${telegramId} входит в чат с ${existingUser.subscription_days_left} сохраненными днями - НЕ обнуляем их!`);
      // НЕ устанавливаем expires_at - сохраненные дни обрабатываются в dailyCron
      // НЕ обнуляем subscription_days_left - они должны списываться постепенно!
    }
  } else {
    // Пользователь покинул чат (Б5)
    updateData.in_chat = false;
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
    
    // Обновляем меню пользователя после изменения статуса
    await BotMenuManager.updateUserMenu(telegramId);
  }
}

// Функции для списания/восстановления жизней будут здесь или в cron.ts
// Например, функция, вызываемая из cron.ts:
// export async function deductLifeForNoPost(userId: number, livesToDeduct: number = 1) { ... }
// export async function giveLifeForPenalty(userId: number, livesToAdd: number = 1) { ... } 