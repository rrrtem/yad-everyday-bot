import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import {
  MSG_CHANGE_MODE_SELECTION,
  MSG_CHANGE_MODE_SUCCESS,
  MSG_CHANGE_MODE_SAME,
  MSG_CHANGE_MODE_NOT_ACTIVE,
  MSG_THREAD_INFO_TEXT,
  MSG_THREAD_INFO_IMAGE,
  AVAILABLE_MODES,
  CALLBACK_CHANGE_MODE_TEXT,
  CALLBACK_CHANGE_MODE_IMAGE,
  PUBLIC_REMINDER_THREAD_ID_TEXT,
  PUBLIC_REMINDER_THREAD_ID_IMAGE
} from "./constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for changeModeHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Отправляет сообщение с кнопками выбора режима
 */
async function sendModeSelectionMessage(telegramId: number): Promise<void> {
  try {
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 Тексты", callback_data: CALLBACK_CHANGE_MODE_TEXT },
          { text: "🎨 Картинки", callback_data: CALLBACK_CHANGE_MODE_IMAGE }
        ]
      ]
    };

    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: MSG_CHANGE_MODE_SELECTION,
        parse_mode: "Markdown",
        reply_markup: keyboard
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to send mode selection message:", result);
      // Fallback: отправляем без кнопок
      await sendDirectMessage(telegramId, MSG_CHANGE_MODE_SELECTION);
    }
  } catch (error) {
    console.error("Error sending mode selection message:", error);
    // Fallback: отправляем без кнопок
    await sendDirectMessage(telegramId, MSG_CHANGE_MODE_SELECTION);
  }
}

/**
 * Получает информацию о топике для режима
 */
function getThreadInfo(mode: string): string {
  const threadId = mode === AVAILABLE_MODES.TEXT ? PUBLIC_REMINDER_THREAD_ID_TEXT : PUBLIC_REMINDER_THREAD_ID_IMAGE;
  const threadName = mode === AVAILABLE_MODES.TEXT ? 'Тексты' : 'Картинки';
  return `📍 Твой топик для публичных напоминаний: **${threadName}** (ID: ${threadId})`;
}

/**
 * Обрабатывает команду /change_mode
 * Показывает пользователю доступные режимы для выбора
 */
export async function handleChangeModeCommand(message: any): Promise<void> {
  console.log("handleChangeModeCommand called", JSON.stringify(message));

  if (!message || !message.from) {
    console.log("handleChangeModeCommand: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;

  try {
    // Проверяем, существует ли пользователь и активен ли он
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleChangeModeCommand: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, MSG_CHANGE_MODE_NOT_ACTIVE);
      return;
    }

    // Проверяем, активен ли пользователь (в чате или имеет подписку)
    const isActive = user.in_chat || user.subscription_active || user.subscription_days_left > 0;
    
    if (!isActive) {
      console.log(`handleChangeModeCommand: пользователь ${telegramId} не активен`);
      await sendDirectMessage(telegramId, MSG_CHANGE_MODE_NOT_ACTIVE);
      return;
    }

    // Отправляем сообщение с выбором режима
    console.log(`handleChangeModeCommand: отправляем выбор режима пользователю ${telegramId}`);
    await sendModeSelectionMessage(telegramId);

  } catch (error) {
    console.error(`handleChangeModeCommand: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке команды. Попробуйте позже.");
  }
}

/**
 * Обрабатывает callback query для смены режима
 * Обновляет режим пользователя в БД и отправляет подтверждение
 */
export async function handleChangeModeCallback(callbackQuery: any): Promise<void> {
  console.log("handleChangeModeCallback called", JSON.stringify(callbackQuery));

  if (!callbackQuery || !callbackQuery.from || !callbackQuery.data) {
    console.log("handleChangeModeCallback: недостаточно данных в callback");
    return;
  }

  const telegramId = callbackQuery.from.id;
  const callbackData = callbackQuery.data;

  try {
    // Определяем выбранный режим из callback_data
    let selectedMode: string | null = null;
    
    if (callbackData === CALLBACK_CHANGE_MODE_TEXT) {
      selectedMode = AVAILABLE_MODES.TEXT;
    } else if (callbackData === CALLBACK_CHANGE_MODE_IMAGE) {
      selectedMode = AVAILABLE_MODES.IMAGE;
    } else {
      console.log(`handleChangeModeCallback: неизвестный callback_data: ${callbackData}`);
      return;
    }

    // Получаем данные пользователя
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleChangeModeCallback: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, MSG_CHANGE_MODE_NOT_ACTIVE);
      return;
    }

    // Проверяем, не выбран ли уже этот режим
    if (user.mode === selectedMode) {
      console.log(`handleChangeModeCallback: пользователь ${telegramId} уже в режиме ${selectedMode}`);
      await sendDirectMessage(telegramId, MSG_CHANGE_MODE_SAME(selectedMode));
      
      // Отвечаем на callback query
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "Этот режим уже выбран"
        })
      });
      return;
    }

    // Обновляем режим в БД
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        mode: selectedMode,
        mode_changed_at: now,
        updated_at: now
      })
      .eq("telegram_id", telegramId);

    if (error) {
      console.error(`handleChangeModeCallback: ошибка обновления режима для ${telegramId}:`, error.message);
      await sendDirectMessage(telegramId, "Произошла ошибка при смене режима. Попробуйте позже.");
      
      // Отвечаем на callback query с ошибкой
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "Ошибка при смене режима",
          show_alert: true
        })
      });
      return;
    }

    // Отправляем подтверждение
    const threadInfo = getThreadInfo(selectedMode);
    const successMessage = MSG_CHANGE_MODE_SUCCESS(selectedMode, threadInfo);
    
    await sendDirectMessage(telegramId, successMessage);
    
    // Отвечаем на callback query
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: `Режим изменён на ${selectedMode === AVAILABLE_MODES.TEXT ? 'Тексты' : 'Картинки'}!`
      })
    });

    console.log(`handleChangeModeCallback: режим пользователя ${telegramId} изменён на ${selectedMode}`);

  } catch (error) {
    console.error(`handleChangeModeCallback: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при смене режима. Попробуйте позже.");
    
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