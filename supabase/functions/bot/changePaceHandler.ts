import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import {
  MSG_CHANGE_PACE_CURRENT_DAILY,
  MSG_CHANGE_PACE_CURRENT_WEEKLY,
  MSG_CHANGE_PACE_SUCCESS_TO_DAILY,
  MSG_CHANGE_PACE_SUCCESS_TO_WEEKLY,
  MSG_CHANGE_PACE_NOT_ACTIVE,
  AVAILABLE_PACES,
  CALLBACK_CHANGE_PACE_DAILY,
  CALLBACK_CHANGE_PACE_WEEKLY
} from "./constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for changePaceHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Отправляет сообщение с кнопкой смены ритма
 */
async function sendPaceChangeMessage(telegramId: number, currentPace: string): Promise<void> {
  try {
    let message: string;
    let buttonText: string;
    let callbackData: string;

    if (currentPace === AVAILABLE_PACES.DAILY) {
      message = MSG_CHANGE_PACE_CURRENT_DAILY;
      buttonText = "Раз в неделю";
      callbackData = CALLBACK_CHANGE_PACE_WEEKLY;
    } else {
      message = MSG_CHANGE_PACE_CURRENT_WEEKLY;
      buttonText = "Каждый день";
      callbackData = CALLBACK_CHANGE_PACE_DAILY;
    }

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
        reply_markup: keyboard
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to send pace change message:", result);
      // Fallback: отправляем без кнопок
      await sendDirectMessage(telegramId, message);
    }
  } catch (error) {
    console.error("Error sending pace change message:", error);
    // Fallback: отправляем без кнопок
    await sendDirectMessage(telegramId, message);
  }
}

/**
 * Отправляет подтверждение смены ритма с кнопкой обратного переключения
 */
async function sendPaceSuccessMessage(telegramId: number, newPace: string): Promise<void> {
  try {
    let message: string;
    let buttonText: string;
    let callbackData: string;

    if (newPace === AVAILABLE_PACES.WEEKLY) {
      message = MSG_CHANGE_PACE_SUCCESS_TO_WEEKLY;
      buttonText = "Каждый день";
      callbackData = CALLBACK_CHANGE_PACE_DAILY;
    } else {
      message = MSG_CHANGE_PACE_SUCCESS_TO_DAILY;
      buttonText = "Раз в неделю";
      callbackData = CALLBACK_CHANGE_PACE_WEEKLY;
    }

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
        reply_markup: keyboard
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to send pace success message:", result);
      // Fallback: отправляем без кнопок
      await sendDirectMessage(telegramId, message);
    }
  } catch (error) {
    console.error("Error sending pace success message:", error);
    // Fallback: отправляем без кнопок
    await sendDirectMessage(telegramId, message);
  }
}

/**
 * Обрабатывает команду /change_pace
 * Показывает пользователю возможность изменить ритм участия
 */
export async function handleChangePaceCommand(message: any): Promise<void> {
  console.log("handleChangePaceCommand called", JSON.stringify(message));

  if (!message || !message.from) {
    console.log("handleChangePaceCommand: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;

  try {
    // Проверяем, существует ли пользователь и активен ли он
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleChangePaceCommand: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, MSG_CHANGE_PACE_NOT_ACTIVE);
      return;
    }

    // Проверяем, активен ли пользователь (в чате или имеет подписку)
    const isActive = user.in_chat || user.subscription_active || user.subscription_days_left > 0;
    
    if (!isActive) {
      console.log(`handleChangePaceCommand: пользователь ${telegramId} не активен`);
      await sendDirectMessage(telegramId, MSG_CHANGE_PACE_NOT_ACTIVE);
      return;
    }

    // Получаем текущий ритм пользователя (по умолчанию daily)
    const currentPace = user.pace || AVAILABLE_PACES.DAILY;

    // Отправляем сообщение с возможностью смены ритма
    console.log(`handleChangePaceCommand: отправляем предложение смены ритма пользователю ${telegramId}, текущий ритм: ${currentPace}`);
    await sendPaceChangeMessage(telegramId, currentPace);

  } catch (error) {
    console.error(`handleChangePaceCommand: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке команды. Попробуйте позже.");
  }
}

/**
 * Обрабатывает callback query для смены ритма
 * Обновляет ритм пользователя в БД и отправляет подтверждение
 */
export async function handleChangePaceCallback(callbackQuery: any): Promise<void> {
  console.log("handleChangePaceCallback called", JSON.stringify(callbackQuery));

  if (!callbackQuery || !callbackQuery.from || !callbackQuery.data) {
    console.log("handleChangePaceCallback: недостаточно данных в callback");
    return;
  }

  const telegramId = callbackQuery.from.id;
  const callbackData = callbackQuery.data;

  try {
    // Определяем выбранный ритм из callback_data
    let selectedPace: string | null = null;
    
    if (callbackData === CALLBACK_CHANGE_PACE_DAILY) {
      selectedPace = AVAILABLE_PACES.DAILY;
    } else if (callbackData === CALLBACK_CHANGE_PACE_WEEKLY) {
      selectedPace = AVAILABLE_PACES.WEEKLY;
    } else {
      console.log(`handleChangePaceCallback: неизвестный callback_data: ${callbackData}`);
      return;
    }

    // Получаем данные пользователя
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleChangePaceCallback: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, MSG_CHANGE_PACE_NOT_ACTIVE);
      return;
    }

    // Обновляем ритм в БД
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        pace: selectedPace,
        pace_changed_at: now,
        updated_at: now
      })
      .eq("telegram_id", telegramId);

    if (error) {
      console.error(`handleChangePaceCallback: ошибка обновления ритма для ${telegramId}:`, error.message);
      await sendDirectMessage(telegramId, "Произошла ошибка при смене ритма. Попробуйте позже.");
      
      // Отвечаем на callback query с ошибкой
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "Ошибка при смене ритма",
          show_alert: true
        })
      });
      return;
    }

    // Отправляем подтверждение с кнопкой обратного переключения
    await sendPaceSuccessMessage(telegramId, selectedPace);
    
    // Отвечаем на callback query
    const paceText = selectedPace === AVAILABLE_PACES.DAILY ? 'Каждый день' : 'Раз в неделю';
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: `Ритм изменён на "${paceText}"!`
      })
    });

    console.log(`handleChangePaceCallback: ритм пользователя ${telegramId} изменён на ${selectedPace}`);

  } catch (error) {
    console.error(`handleChangePaceCallback: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при смене ритма. Попробуйте позже.");
    
    // Отвечаем на callback query с ошибкой
    try {
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "Произошла ошибка",
          show_alert: true
        })
      });
    } catch (callbackError) {
      console.error("Ошибка при ответе на callback query:", callbackError);
    }
  }
} 