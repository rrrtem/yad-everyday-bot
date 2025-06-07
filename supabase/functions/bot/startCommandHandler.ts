import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, registerUser, sendDirectMessage, updateExistingUser } from "./userHandler.ts";
import { setWaitingPromoState } from "./commandHandler.ts";
import { 
  MSG_WELCOME, 
  MSG_MODE, 
  MSG_PACE, 
  MSG_PAYMENT_COND,
  MSG_PROMO,
  MSG_PROMO_ERR,
  MSG_LINK_CLUB,
  MSG_LINK_STANDARD,
  MSG_COMEBACK_RECEIVED,
  AVAILABLE_MODES,
  AVAILABLE_PACES,
  MODE_PACE_CONFIG,
  VALID_PROMO_CODES,
  DEFAULT_PAYMENT_URL,
  SPECIAL_PAYMENT_URL
} from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

if (!SUPABASE_URL || !SUPABASE_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing Supabase or Telegram environment variables for startCommandHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Основная функция обработки команды /start
 * Реализует логику A1 из logic.md
 */
export async function handleStartCommand(message: any): Promise<void> {
  const telegramId = message.from.id;
  
  // Шаг 1: Регистрация/актуализация пользователя
  let user = await findUserByTelegramId(telegramId);
  
  if (!user) {
    // Новый пользователь - регистрируем
    await registerUser(message.from);
    user = await findUserByTelegramId(telegramId);
  } else {
    // Существующий пользователь - актуализируем данные
    await updateExistingUser(telegramId, message.from);
    user = await findUserByTelegramId(telegramId);
    
    // Шаг 2: Проверяем неиспользованные дни подписки
    if (await hasUnusedSubscriptionDays(user)) {
      await sendDirectMessage(telegramId, MSG_COMEBACK_RECEIVED);
      // TODO: отправить индивидуальную ссылку на вступление
      return;
    }
  }
  
  // Шаг 3: Приветственное сообщение для новых пользователей или пользователей без подписки
  await sendDirectMessage(telegramId, MSG_WELCOME);
  
  // Шаг 4: Выбор режима участия
  await sendModeSelection(telegramId);
}

/**
 * Проверяет, есть ли у пользователя неиспользованные дни подписки
 */
async function hasUnusedSubscriptionDays(user: any): Promise<boolean> {
  if (!user.subscription_days_left) return false;
  return user.subscription_days_left > 0;
}

/**
 * Отправляет сообщение с выбором режима участия
 */
async function sendModeSelection(telegramId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "📝 Тексты", callback_data: `mode_${AVAILABLE_MODES.TEXT}` },
        { text: "📸 Картинки", callback_data: `mode_${AVAILABLE_MODES.IMAGE}` }
      ]
    ]
  };
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: MSG_MODE,
      parse_mode: "Markdown",
      reply_markup: keyboard
    })
  });
}

/**
 * Обрабатывает выбор режима пользователя
 */
export async function handleModeSelection(telegramId: number, mode: string): Promise<void> {
  // Сохраняем выбранный режим в БД
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      mode: mode,
      mode_changed_at: now,
      updated_at: now
    })
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error("Ошибка сохранения режима:", error);
    await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    return;
  }
  
  // Отправляем выбор ритма
  await sendPaceSelection(telegramId, mode);
}

/**
 * Отправляет сообщение с выбором ритма участия
 */
async function sendPaceSelection(telegramId: number, mode: string): Promise<void> {
  const availablePaces = MODE_PACE_CONFIG[mode];
  
  if (mode === AVAILABLE_MODES.IMAGE) {
    // Для картинок только один вариант - автоматически выбираем
    await handlePaceSelection(telegramId, AVAILABLE_PACES.DAILY);
    return;
  }
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: "⏰ Каждый день", callback_data: `pace_${AVAILABLE_PACES.DAILY}` },
        { text: "📅 Один раз в неделю", callback_data: `pace_${AVAILABLE_PACES.WEEKLY}` }
      ]
    ]
  };
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: MSG_PACE(mode),
      parse_mode: "Markdown",
      reply_markup: keyboard
    })
  });
}

/**
 * Обрабатывает выбор ритма пользователя
 */
export async function handlePaceSelection(telegramId: number, pace: string): Promise<void> {
  // Сохраняем выбранный ритм в БД
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      pace: pace,
      pace_changed_at: now,
      updated_at: now
    })
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error("Ошибка сохранения ритма:", error);
    await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    return;
  }
  
  // Отправляем объяснение оплаты
  await sendDirectMessage(telegramId, MSG_PAYMENT_COND);
  
  // Проверяем статус клуба и отправляем соответствующее сообщение
  await checkClubStatusAndSendPayment(telegramId);
}

/**
 * Проверяет статус клуба и отправляет соответствующую ссылку на оплату
 */
async function checkClubStatusAndSendPayment(telegramId: number): Promise<void> {
  const user = await findUserByTelegramId(telegramId);
  
  if (user.club === true) {
    // Пользователь в клубе - отправляем специальную ссылку
    await sendDirectMessage(telegramId, MSG_LINK_CLUB(SPECIAL_PAYMENT_URL));
    await recordPaymentLinkSent(telegramId);
  } else {
    // Обычный пользователь - спрашиваем про промокод
    await sendPromoSelection(telegramId);
  }
}

/**
 * Отправляет сообщение с выбором промокода
 */
async function sendPromoSelection(telegramId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [{ text: "💳 У меня нет промокода", callback_data: "no_promo" }]
    ]
  };
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: MSG_PROMO + "\n\n_Введи промокод текстом или нажми кнопку ниже._",
      parse_mode: "Markdown",
      reply_markup: keyboard
    })
  });
  
  // Устанавливаем состояние ожидания промокода
  await setWaitingPromoState(telegramId);
}

/**
 * Обрабатывает промокод от пользователя
 */
export async function handlePromoCode(telegramId: number, promoCode: string): Promise<void> {
  console.log(`handlePromoCode: пользователь ${telegramId} ввел промокод "${promoCode}"`);
  console.log(`handlePromoCode: валидные промокоды:`, VALID_PROMO_CODES);
  
  if (VALID_PROMO_CODES.includes(promoCode.toUpperCase())) {
    console.log(`handlePromoCode: промокод "${promoCode}" валидный`);
    // Промокод валидный
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        club: true,
        promo_code: promoCode.toUpperCase(),
        user_state: null, // Очищаем состояние
        updated_at: now
      })
      .eq("telegram_id", telegramId);
      
    if (error) {
      console.error(`handlePromoCode: ошибка обновления БД:`, error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
      return;
    }
      
    await sendDirectMessage(telegramId, MSG_LINK_CLUB(SPECIAL_PAYMENT_URL));
    await recordPaymentLinkSent(telegramId);
    console.log(`handlePromoCode: отправлена клубная ссылка для пользователя ${telegramId}`);
  } else {
    console.log(`handlePromoCode: промокод "${promoCode}" невалидный`);
    // Промокод невалидный - НЕ очищаем состояние, пользователь может попробовать еще раз
    await sendDirectMessage(telegramId, MSG_PROMO_ERR);
    // Не вызываем sendPromoSelection повторно, пользователь уже в состоянии ожидания
    console.log(`handlePromoCode: отправлено сообщение об ошибке, состояние ожидания сохранено`);
  }
}

/**
 * Обрабатывает отсутствие промокода
 */
export async function handleNoPromo(telegramId: number): Promise<void> {
  await sendDirectMessage(telegramId, MSG_LINK_STANDARD(DEFAULT_PAYMENT_URL));
  await recordPaymentLinkSent(telegramId);
}

/**
 * Записывает дату отправки ссылки на оплату
 */
async function recordPaymentLinkSent(telegramId: number): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("users")
    .update({
      payment_link_sent: now,
      updated_at: now
    })
    .eq("telegram_id", telegramId);
}

/**
 * Обрабатывает callback query от inline кнопок
 */
export async function handleStartCallbackQuery(callbackQuery: any): Promise<void> {
  const data = callbackQuery.data;
  const telegramId = callbackQuery.from.id;
  
  if (data.startsWith("mode_")) {
    const mode = data.replace("mode_", "");
    await handleModeSelection(telegramId, mode);
  } else if (data.startsWith("pace_")) {
    const pace = data.replace("pace_", "");
    await handlePaceSelection(telegramId, pace);
  } else if (data === "no_promo") {
    await handleNoPromo(telegramId);
  }
  
  // Отвечаем на callback query
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQuery.id
    })
  });
} 