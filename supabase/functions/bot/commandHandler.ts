import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDirectMessage, findUserByTelegramId, registerUser } from "./userHandler.ts";
import { MSG_START, MSG_GET_CHAT_ID, MSG_COMEBACK_RECEIVED, OWNER_TELEGRAM_ID } from "../constants.ts";
import { dailyCron, publicDeadlineReminder } from "./cronHandler.ts";
import { handleStartCommand, handlePromoCode } from "./startCommandHandler.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for commandHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Временное хранилище состояний (fallback, если поле user_state еще не добавлено в БД)
const userStates = new Map<number, string>();

/**
 * Обрабатывает команду /start
 */
export async function handleStartCommandWrapper(message: any): Promise<void> {
  await handleStartCommand(message);
}

/**
 * Обрабатывает текстовые сообщения (промокоды)
 */
export async function handleTextMessage(message: any): Promise<void> {
  const telegramId = message.from.id;
  const text = message.text?.trim();
  
  console.log(`handleTextMessage: telegramId=${telegramId}, text="${text}"`);
  
  if (!text) {
    console.log("handleTextMessage: пустой текст, выход");
    return;
  }
  
  // Проверяем состояние пользователя в БД (с fallback на Map)
  const user = await findUserByTelegramId(telegramId);
  let state = user?.user_state;
  
  // Fallback на Map, если поле user_state не существует в БД
  if (state === undefined && user) {
    state = userStates.get(telegramId);
    console.log(`handleTextMessage: используем fallback Map, состояние = "${state}"`);
  }
  
  console.log(`handleTextMessage: пользователь найден:`, user ? "да" : "нет");
  console.log(`handleTextMessage: итоговое состояние = "${state}"`);
  
  if (state === "waiting_promo") {
    console.log(`handleTextMessage: обрабатываем промокод "${text}"`);
    await handlePromoCode(telegramId, text);
    // Состояние очищается внутри handlePromoCode
    console.log(`handleTextMessage: промокод обработан`);
  } else {
    console.log(`handleTextMessage: состояние не "waiting_promo", игнорируем сообщение`);
  }
}

/**
 * Устанавливает состояние ожидания промокода в БД (с fallback на Map)
 */
export async function setWaitingPromoState(telegramId: number): Promise<void> {
  console.log(`setWaitingPromoState: установка состояния "waiting_promo" для пользователя ${telegramId}`);
  
  // Пробуем установить в БД
  const { error } = await supabase
    .from("users")
    .update({ 
      user_state: "waiting_promo",
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error(`setWaitingPromoState: ошибка обновления БД (используем Map fallback):`, error);
    // Fallback на Map
    userStates.set(telegramId, "waiting_promo");
    console.log(`setWaitingPromoState: состояние установлено в Map для пользователя ${telegramId}`);
  } else {
    console.log(`setWaitingPromoState: состояние "waiting_promo" успешно установлено в БД для пользователя ${telegramId}`);
  }
}

/**
 * Очищает состояние пользователя в БД (с fallback на Map)
 */
export async function clearUserState(telegramId: number): Promise<void> {
  console.log(`clearUserState: очистка состояния для пользователя ${telegramId}`);
  
  // Пробуем очистить в БД
  const { error } = await supabase
    .from("users")
    .update({ 
      user_state: null,
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error(`clearUserState: ошибка очистки в БД (используем Map fallback):`, error);
  } else {
    console.log(`clearUserState: состояние успешно очищено в БД для пользователя ${telegramId}`);
  }
  
  // Всегда очищаем Map (на всякий случай)
  userStates.delete(telegramId);
  console.log(`clearUserState: состояние очищено в Map для пользователя ${telegramId}`);
}

/**
 * Обрабатывает команду /get - получение ID чата
 */
export async function handleGetCommand(message: any): Promise<void> {
  const chatId = message.chat.id;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: MSG_GET_CHAT_ID(chatId),
      parse_mode: "HTML"
    })
  });
}

/**
 * Обрабатывает команду /comeback
 */
export async function handleComebackCommand(message: any): Promise<void> {
  await sendDirectMessage(message.from.id, MSG_COMEBACK_RECEIVED);
}

/**
 * Обрабатывает команды владельца бота
 */
export async function handleOwnerCommands(message: any): Promise<void> {
  const text = message.text || "";
  
  if (text === "/daily") {
    const res = await dailyCron();
    let report = "Команда /daily выполнена:\n";
    try {
      const data = await res.json();
      if (data.stats) {
        report += `✅ Функция выполнена успешно\nПодробный отчет отправлен отдельным сообщением.`;
      } else {
        report += `Статус: ${data.message || 'Неизвестно'}`;
      }
    } catch {
      report += `❌ Ошибка выполнения. Код: ${res.status}`;
    }
    await sendDirectMessage(message.from.id, report);
  } else if (text === "/remind") {
    const res = await publicDeadlineReminder();
    let report = "Команда /remind выполнена:\n";
    try {
      const data = await res.json();
      if (data.usernames?.length) {
        report += `✅ Напомнили ${data.usernames.length} пользователям:\n` + data.usernames.map(u => `@${u}`).join(", ");
        if (data.sentToThreads) {
          report += `\n📩 Отправлено в ${data.sentToThreads} тред(а)`;
        }
      } else {
        report += `ℹ️ ${data.message}`;
      }
      if (data.timeLeftMsg) {
        report += `\n⏰ ${data.timeLeftMsg}`;
      }
    } catch {
      report += `❌ Ошибка выполнения. Код: ${res.status}`;
    }
    await sendDirectMessage(message.from.id, report);
  } else if (text === "/tribute_test") {
    await handleTributeTestCommand(message.from.id);
  }
}

/**
 * Тестирование Tribute webhook'ов (только для владельца)
 */
async function handleTributeTestCommand(telegramId: number): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const webhookUrl = `${SUPABASE_URL}/functions/v1/bot`;
  
  let report = "🧪 Тестирование Tribute webhook:\n\n";
  
  // Проверяем доступность URL
  try {
    const response = await fetch(webhookUrl, { method: 'GET' });
    report += `📡 URL доступен: ${response.status}\n`;
  } catch (error) {
    report += `❌ URL недоступен: ${error.message}\n`;
  }
  
  // Проверяем переменные окружения
  const tributeApiKey = Deno.env.get("TRIBUTE_API_KEY");
  report += `🔑 TRIBUTE_API_KEY: ${tributeApiKey ? '✅ установлен' : '❌ не установлен'}\n`;
  
  report += `\n🔗 Webhook URL для настройки в Tribute:\n\`${webhookUrl}\`\n`;
  report += `\n📋 Tribute webhook'и определяются автоматически по заголовку \`trbt-signature\``;
  report += `\n📋 Один URL обрабатывает и Telegram, и Tribute webhook'и`;
  
  await sendDirectMessage(telegramId, report);
}