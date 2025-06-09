import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import {
  MSG_REMINDERS_ENABLED,
  MSG_REMINDERS_DISABLED,
  CALLBACK_TOGGLE_PUBLIC_REMINDER
} from "./constants.ts";
import { BotMenuManager } from "./utils/botMenuManager.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for reminderHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Отправляет сообщение с кнопкой для управления напоминаниями
 */
async function sendReminderToggleMessage(telegramId: number, currentReminderState: boolean): Promise<void> {
  try {
    const statusText = currentReminderState 
      ? "🔔 Публичные напоминания сейчас <b>включены</b>"
      : "🔕 Публичные напоминания сейчас <b>отключены</b>";
    
    const buttonText = currentReminderState 
      ? "🔕 Отключить напоминания"
      : "🔔 Включить напоминания";
    
    const callbackData = CALLBACK_TOGGLE_PUBLIC_REMINDER;
    
    const message = `${statusText}

Публичные напоминания отправляются в групповой чат всем участникам ежедневного ритма, которые еще не прислали пост сегодня.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: buttonText, callback_data: callbackData }]
      ]
    };

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to send reminder toggle message:", result);
      // Fallback: отправляем без кнопок
      await sendDirectMessage(telegramId, message);
    }
  } catch (error) {
    console.error("Error sending reminder toggle message:", error);
    // Fallback: отправляем без кнопок
    const fallbackMessage = currentReminderState 
      ? "🔔 Публичные напоминания включены"
      : "🔕 Публичные напоминания отключены";
    await sendDirectMessage(telegramId, fallbackMessage);
  }
}

/**
 * Обрабатывает команду /reminder - показывает текущее состояние напоминаний с кнопкой
 */
export async function handleReminderCommand(message: any): Promise<void> {
  console.log("handleReminderCommand called", JSON.stringify(message));

  if (!message || !message.from) {
    console.log("handleReminderCommand: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;

  try {
    // Проверяем, существует ли пользователь и активен ли он
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleReminderCommand: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, "❌ Пользователь не найден. Используй /start для регистрации.");
      return;
    }

    // Проверяем, активен ли пользователь (в чате или имеет подписку)
    const isActive = user.in_chat || user.subscription_active || user.subscription_days_left > 0;
    
    if (!isActive) {
      console.log(`handleReminderCommand: пользователь ${telegramId} не активен`);
      await sendDirectMessage(telegramId, "❌ Команда доступна только активным участникам.\n\nЧтобы начать участие, используй команду /start");
      return;
    }

    // Отправляем сообщение с текущим состоянием и кнопкой переключения
    const currentReminderState = user.public_remind !== false; // По умолчанию true
    console.log(`handleReminderCommand: отправляем состояние напоминаний пользователю ${telegramId}, текущее состояние: ${currentReminderState}`);
    await sendReminderToggleMessage(telegramId, currentReminderState);

  } catch (error) {
    console.error(`handleReminderCommand: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке команды. Попробуйте позже.");
  }
}

/**
 * Обрабатывает callback query для переключения напоминаний
 * Обновляет настройку в БД и отправляет подтверждение с обновленной кнопкой
 */
export async function handleToggleReminderCallback(callbackQuery: any): Promise<void> {
  console.log("handleToggleReminderCallback called", JSON.stringify(callbackQuery));

  if (!callbackQuery || !callbackQuery.from || !callbackQuery.data) {
    console.log("handleToggleReminderCallback: недостаточно данных в callback");
    return;
  }

  const telegramId = callbackQuery.from.id;

  try {
    // Получаем данные пользователя
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleToggleReminderCallback: пользователь ${telegramId} не найден`);
      await answerCallbackQuery(callbackQuery.id, "Пользователь не найден", true);
      return;
    }

    // Переключаем настройку напоминаний на противоположную
    const currentReminderState = user.public_remind !== false; // По умолчанию true
    const newReminderState = !currentReminderState;

    // Обновляем настройку в БД
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        public_remind: newReminderState,
        updated_at: now
      })
      .eq("telegram_id", telegramId);

    if (error) {
      console.error(`handleToggleReminderCallback: ошибка обновления настройки для ${telegramId}:`, error.message);
      await answerCallbackQuery(callbackQuery.id, "Ошибка при обновлении настройки", true);
      return;
    }

    // Отправляем подтверждение
    const confirmMessage = newReminderState ? MSG_REMINDERS_ENABLED : MSG_REMINDERS_DISABLED;
    
    // Отвечаем на callback query
    const callbackMessage = newReminderState 
      ? "✅ Напоминания включены" 
      : "🔕 Напоминания отключены";
    
    await answerCallbackQuery(callbackQuery.id, callbackMessage);
    
    // Отправляем новое сообщение с обновленной кнопкой
    await sendReminderToggleMessage(telegramId, newReminderState);
    
    // Обновляем меню пользователя для отражения изменений
    await BotMenuManager.updateUserMenu(telegramId);

    console.log(`handleToggleReminderCallback: настройка напоминаний пользователя ${telegramId} изменена на ${newReminderState}`);

  } catch (error) {
    console.error(`handleToggleReminderCallback: ошибка для пользователя ${telegramId}:`, error);
    await answerCallbackQuery(callbackQuery.id, "Произошла ошибка", true);
  }
}

/**
 * Отвечает на callback query
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: showAlert
      })
    });
  } catch (error) {
    console.error("Error answering callback query:", error);
  }
} 