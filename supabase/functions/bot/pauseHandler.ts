import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import {
  MSG_PAUSE_REQUEST,
  MSG_PAUSE_INVALID_NUMBER,
  MSG_PAUSE_TOO_LONG,
  MSG_PAUSE_SET,
  MSG_PAUSE_ALREADY_ON,
  MSG_UNPAUSE_SUCCESS,
  MSG_UNPAUSE_NOT_ON_PAUSE,
  pluralizeDays
} from "./constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for pauseHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Максимальное количество дней паузы
const MAX_PAUSE_DAYS = 30;

/**
 * Обрабатывает команду /pause
 * Запускает процесс постановки пользователя на паузу
 */
export async function handlePauseCommand(message: any): Promise<void> {
  console.log("handlePauseCommand called", JSON.stringify(message));

  if (!message || !message.from) {
    console.log("handlePauseCommand: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;

  try {
    // Проверяем, существует ли пользователь
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handlePauseCommand: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, "❌ Сначала нужно зарегистрироваться в боте. Используй команду /start");
      return;
    }

    // Проверяем, не на паузе ли уже пользователь
    if (user.pause_until) {
      const pauseEnd = new Date(user.pause_until);
      const now = new Date();
      
      if (pauseEnd > now) {
        const endDateFormatted = pauseEnd.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        console.log(`handlePauseCommand: пользователь ${telegramId} уже на паузе до ${endDateFormatted}`);
        await sendDirectMessage(telegramId, MSG_PAUSE_ALREADY_ON(endDateFormatted));
        return;
      }
    }

    // Устанавливаем состояние ожидания количества дней паузы
    await setWaitingPauseDaysState(telegramId);
    
    // Отправляем запрос на указание количества дней
    await sendDirectMessage(telegramId, MSG_PAUSE_REQUEST);
    
    console.log(`handlePauseCommand: пользователю ${telegramId} отправлен запрос на количество дней паузы`);

  } catch (error) {
    console.error(`handlePauseCommand: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке команды. Попробуйте позже.");
  }
}

/**
 * Обрабатывает команду /unpause
 * Снимает пользователя с паузы
 */
export async function handleUnpauseCommand(message: any): Promise<void> {
  console.log("handleUnpauseCommand called", JSON.stringify(message));

  if (!message || !message.from) {
    console.log("handleUnpauseCommand: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;

  try {
    // Проверяем, существует ли пользователь
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      console.log(`handleUnpauseCommand: пользователь ${telegramId} не найден`);
      await sendDirectMessage(telegramId, "❌ Сначала нужно зарегистрироваться в боте. Используй команду /start");
      return;
    }

    // Проверяем, на паузе ли пользователь
    const isOnPause = user.pause_until && new Date(user.pause_until) > new Date();
    
    if (!isOnPause) {
      console.log(`handleUnpauseCommand: пользователь ${telegramId} не на паузе`);
      await sendDirectMessage(telegramId, MSG_UNPAUSE_NOT_ON_PAUSE);
      return;
    }

    // Снимаем пользователя с паузы
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        pause_until: null,
        pause_started_at: null,
        pause_days: 0,
        updated_at: now
      })
      .eq("telegram_id", telegramId);

    if (error) {
      console.error(`handleUnpauseCommand: ошибка снятия с паузы для ${telegramId}:`, error.message);
      await sendDirectMessage(telegramId, "Произошла ошибка при снятии с паузы. Попробуйте позже.");
      return;
    }

    await sendDirectMessage(telegramId, MSG_UNPAUSE_SUCCESS);
    console.log(`handleUnpauseCommand: пользователь ${telegramId} снят с паузы`);

  } catch (error) {
    console.error(`handleUnpauseCommand: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке команды. Попробуйте позже.");
  }
}

/**
 * Обрабатывает текстовое сообщение с количеством дней паузы
 * Вызывается из commandHandler.ts когда пользователь в состоянии waiting_pause_days
 */
export async function handlePauseDaysInput(message: any): Promise<void> {
  console.log("handlePauseDaysInput called", JSON.stringify(message));

  if (!message || !message.from || !message.text) {
    console.log("handlePauseDaysInput: недостаточно данных в сообщении");
    return;
  }

  const telegramId = message.from.id;
  const text = message.text.trim();

  try {
    // Валидируем ввод - должно быть число
    const daysNumber = parseInt(text);
    
    if (isNaN(daysNumber)) {
      console.log(`handlePauseDaysInput: пользователь ${telegramId} прислал не число: "${text}"`);
      await sendDirectMessage(telegramId, MSG_PAUSE_INVALID_NUMBER);
      return;
    }

    // Проверяем диапазон дней
    if (daysNumber < 1 || daysNumber > MAX_PAUSE_DAYS) {
      console.log(`handlePauseDaysInput: пользователь ${telegramId} прислал недопустимое количество дней: ${daysNumber}`);
      await sendDirectMessage(telegramId, MSG_PAUSE_TOO_LONG);
      return;
    }

    // Ставим пользователя на паузу
    await setPauseForUser(telegramId, daysNumber);
    
    console.log(`handlePauseDaysInput: пользователь ${telegramId} поставлен на паузу на ${daysNumber} дней`);

  } catch (error) {
    console.error(`handlePauseDaysInput: ошибка для пользователя ${telegramId}:`, error);
    await sendDirectMessage(telegramId, "Произошла ошибка при обработке запроса. Попробуйте позже.");
  }
}

/**
 * Устанавливает состояние ожидания количества дней паузы
 */
async function setWaitingPauseDaysState(telegramId: number): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      user_state: "waiting_pause_days",
      updated_at: now
    })
    .eq("telegram_id", telegramId);

  if (error) {
    console.error(`setWaitingPauseDaysState: ошибка для ${telegramId}:`, error.message);
    throw error;
  }
}

/**
 * Очищает состояние пользователя
 */
async function clearUserState(telegramId: number): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      user_state: null,
      updated_at: now
    })
    .eq("telegram_id", telegramId);

  if (error) {
    console.error(`clearUserState: ошибка для ${telegramId}:`, error.message);
    throw error;
  }
}

/**
 * Ставит пользователя на паузу на указанное количество дней
 */
async function setPauseForUser(telegramId: number, days: number): Promise<void> {
  const now = new Date();
  const pauseEnd = new Date(now);
  pauseEnd.setDate(pauseEnd.getDate() + days);
  
  const pauseEndFormatted = pauseEnd.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const updateData = {
    pause_started_at: now.toISOString(),
    pause_until: pauseEnd.toISOString(),
    pause_days: days,
    user_state: null, // Очищаем состояние ожидания
    updated_at: now.toISOString()
  };

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);

  if (error) {
    console.error(`setPauseForUser: ошибка для ${telegramId}:`, error.message);
    throw error;
  }

  // Отправляем подтверждение пользователю
  await sendDirectMessage(telegramId, MSG_PAUSE_SET(days, pauseEndFormatted));
} 