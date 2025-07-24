import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import { handlePauseCommand, handleUnpauseCommand } from "./pauseHandler.ts";
import { handleChangeModeCommand } from "./commandHandler.ts";
import { handleChangePaceCommand } from "./changePaceHandler.ts";
import { BotMenuManager } from "./utils/botMenuManager.ts";
import {
  CALLBACK_CHANGE_MODE_TEXT,
  CALLBACK_CHANGE_PACE_DAILY,
  CALLBACK_CHANGE_PACE_WEEKLY,
  AVAILABLE_MODES,
  MSG_REMINDERS_ENABLED,
  MSG_REMINDERS_DISABLED
} from "./constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for statusCallbackHandlers.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Отправляет ответ на callback_query для уведомления пользователя
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "",
        show_alert: showAlert
      })
    });
  } catch (error) {
    console.error("Error answering callback query:", error);
  }
}

/**
 * Обработчик для кнопки "Поставить на паузу"
 */
export async function handlePauseCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handlePauseCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    // Имитируем сообщение для совместимости с существующим обработчиком
    const fakeMessage = {
      from: callbackQuery.from,
      chat: { id: callbackQuery.from.id, type: "private" }
    };
    
    await handlePauseCommand(fakeMessage);
    await answerCallbackQuery(callbackQuery.id, "Запрос на паузу отправлен");
    
  } catch (error) {
    console.error("handlePauseCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Снять с паузы"
 */
export async function handleUnpauseCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleUnpauseCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    // Имитируем сообщение для совместимости с существующим обработчиком
    const fakeMessage = {
      from: callbackQuery.from,
      chat: { id: callbackQuery.from.id, type: "private" }
    };
    
    await handleUnpauseCommand(fakeMessage);
    await answerCallbackQuery(callbackQuery.id, "Пауза снята");
    
  } catch (error) {
    console.error("handleUnpauseCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Изменить режим" 
 */
export async function handleChangeModeCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleChangeModeCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    // Имитируем сообщение для совместимости с существующим обработчиком
    const fakeMessage = {
      from: callbackQuery.from,
      chat: { id: callbackQuery.from.id, type: "private" }
    };
    
    await handleChangeModeCommand(fakeMessage);
    await answerCallbackQuery(callbackQuery.id, "Выбери новый режим");
    
  } catch (error) {
    console.error("handleChangeModeCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Изменить ритм"
 */
export async function handleChangePaceCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleChangePaceCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    // Имитируем сообщение для совместимости с существующим обработчиком
    const fakeMessage = {
      from: callbackQuery.from,
      chat: { id: callbackQuery.from.id, type: "private" }
    };
    
    await handleChangePaceCommand(fakeMessage);
    await answerCallbackQuery(callbackQuery.id, "Выбери новый ритм");
    
  } catch (error) {
    console.error("handleChangePaceCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Напоминания"
 */
export async function handleChangePublicReminderCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleChangePublicReminderCallbackQuery called", JSON.stringify(callbackQuery));
  
  const telegramId = callbackQuery.from.id;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await answerCallbackQuery(callbackQuery.id, "Пользователь не найден", true);
      return;
    }
    
    // Переключаем настройку напоминаний на противоположную
    const newReminderSetting = !user.public_remind;
    
    // Обновляем настройку напоминаний
    const { error } = await supabase
      .from("users")
      .update({ 
        public_remind: newReminderSetting,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_id", telegramId);
    
    if (error) {
      console.error("Error updating reminders setting:", error);
      await answerCallbackQuery(callbackQuery.id, "Ошибка при обновлении настройки", true);
      return;
    }
    
    const message = newReminderSetting 
      ? "✅ Напоминания включены" 
      : "🔕 Напоминания отключены";
    
    await answerCallbackQuery(callbackQuery.id, message);
    
    // Отправляем подтверждающее сообщение
    const confirmMessage = newReminderSetting ? MSG_REMINDERS_ENABLED : MSG_REMINDERS_DISABLED;
    await sendDirectMessage(telegramId, confirmMessage);
    
    // Обновляем меню пользователя для отражения изменений
    await BotMenuManager.updateUserMenu(telegramId);
    
  } catch (error) {
    console.error("handleChangePublicReminderCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопок управления напоминаниями (старый, для совместимости)
 */
export async function handleRemindersCallbackQuery(callbackQuery: any, enableReminders: boolean): Promise<void> {
  console.log("handleRemindersCallbackQuery called", JSON.stringify(callbackQuery), "enable:", enableReminders);
  
  const telegramId = callbackQuery.from.id;
  
  try {
    const user = await findUserByTelegramId(telegramId);
    if (!user) {
      await answerCallbackQuery(callbackQuery.id, "Пользователь не найден", true);
      return;
    }
    
    // Обновляем настройку напоминаний
    const { error } = await supabase
      .from("users")
      .update({ 
        public_remind: enableReminders,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_id", telegramId);
    
    if (error) {
      console.error("Error updating reminders setting:", error);
      await answerCallbackQuery(callbackQuery.id, "Ошибка при обновлении настройки", true);
      return;
    }
    
    const message = enableReminders 
      ? "✅ Напоминания включены" 
      : "🔕 Напоминания отключены";
    
    await answerCallbackQuery(callbackQuery.id, message);
    
    // Отправляем подтверждающее сообщение
    const confirmMessage = enableReminders ? MSG_REMINDERS_ENABLED : MSG_REMINDERS_DISABLED;
    await sendDirectMessage(telegramId, confirmMessage);
    
    // Обновляем меню пользователя для отражения изменений
    await BotMenuManager.updateUserMenu(telegramId);
    
  } catch (error) {
    console.error("handleRemindersCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Выбрать режим" (когда режим не установлен)
 */
export async function handleChooseModeCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleChooseModeCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    const telegramId = callbackQuery.from.id;
    
    // Отправляем меню выбора режима
    const keyboard = {
      inline_keyboard: [
        [{ text: "📝 Тексты", callback_data: CALLBACK_CHANGE_MODE_TEXT }]
      ]
    };
    
    const message = `Выбери режим участия:

• **Тексты** — эссе, наблюдения за собой или миром, дневники, посты, анонсы и любые другие жанры`;
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "Markdown",
        reply_markup: keyboard
      })
    });
    
    await answerCallbackQuery(callbackQuery.id, "Выбери режим участия");
    
  } catch (error) {
    console.error("handleChooseModeCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
}

/**
 * Обработчик для кнопки "Выбрать ритм" (когда ритм не установлен)
 */
export async function handleChoosePaceCallbackQuery(callbackQuery: any): Promise<void> {
  console.log("handleChoosePaceCallbackQuery called", JSON.stringify(callbackQuery));
  
  try {
    const telegramId = callbackQuery.from.id;
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      await answerCallbackQuery(callbackQuery.id, "Пользователь не найден", true);
      return;
    }
    
    // Определяем доступные ритмы в зависимости от режима
    let keyboard;
    let message;
    
    // Для всех режимов доступны оба ритма
    keyboard = {
      inline_keyboard: [
        [{ text: "⚡ Каждый день", callback_data: CALLBACK_CHANGE_PACE_DAILY }],
        [{ text: "📅 Раз в неделю", callback_data: CALLBACK_CHANGE_PACE_WEEKLY }]
      ]
    };
    message = `⏰ Выбери ритм участия:

• **Каждый день** — публикуешь пост ежедневно
• **Один раз в неделю** — публикуешь пост раз в неделю`;
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "Markdown",
        reply_markup: keyboard
      })
    });
    
    await answerCallbackQuery(callbackQuery.id, "Выбери ритм участия");
    
  } catch (error) {
    console.error("handleChoosePaceCallbackQuery error:", error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка при обработке запроса", true);
  }
} 