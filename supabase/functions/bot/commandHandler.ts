import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDirectMessage, findUserByTelegramId, registerUser } from "./userHandler.ts";
import { MSG_START, MSG_GET_CHAT_ID, MSG_COMEBACK_RECEIVED, OWNER_TELEGRAM_ID } from "../constants.ts";
import { dailyCron, publicDeadlineReminder, allInfo } from "./cronHandler.ts";
import { handleStartCommand, handlePromoCode } from "./startCommandHandler.ts";
import { syncSubscriptionsCommand } from "./tributeApiHandler.ts";

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
  console.log(`🔧 handleOwnerCommands called with text: "${text}"`);
  
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
  } else if (text === "/allinfo") {
    const res = await allInfo();
    let report = "Команда /allinfo выполнена:\n";
    try {
      const data = await res.json();
      if (data.stats) {
        report += `✅ Детальный отчет отправлен`;
      } else {
        report += `Статус: ${data.message || 'Неизвестно'}`;
      }
    } catch {
      report += `❌ Ошибка выполнения. Код: ${res.status}`;
    }
    await sendDirectMessage(message.from.id, report);
  } else if (text === "/tribute_test") {
    await handleTributeTestCommand(message.from.id);
  } else if (text === "/sync_subscriptions") {
    await handleSyncSubscriptionsCommand(message.from.id);
  } else if (text.startsWith("/test_webhook ")) {
    await handleTestWebhookCommand(message.from.id, text);
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

/**
 * Синхронизация подписок с актуальным статусом (только для владельца)
 */
async function handleSyncSubscriptionsCommand(telegramId: number): Promise<void> {
  await sendDirectMessage(telegramId, "🔄 Запускаю синхронизацию подписок...");
  
  try {
    const result = await syncSubscriptionsCommand();
    await sendDirectMessage(telegramId, result);
  } catch (error) {
    console.error("Error in sync subscriptions command:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка синхронизации: ${error.message}`);
  }
}

/**
 * Симуляция Tribute webhook'а (только для владельца)
 * Использование: /test_webhook new_subscription 327223364
 */
async function handleTestWebhookCommand(telegramId: number, text: string): Promise<void> {
  console.log(`🧪 handleTestWebhookCommand called for user ${telegramId} with text: "${text}"`);
  const parts = text.split(" ");
  
  if (parts.length < 3) {
    await sendDirectMessage(telegramId, `🧪 Симуляция Tribute webhook\n\nИспользование:\n/test_webhook new_subscription TELEGRAM_ID\n/test_webhook cancelled_subscription TELEGRAM_ID\n\nПример:\n/test_webhook new_subscription 327223364`);
    return;
  }
  
  const [, eventType, targetTelegramId] = parts;
  const targetId = parseInt(targetTelegramId);
  
  if (!targetId || isNaN(targetId)) {
    await sendDirectMessage(telegramId, "❌ Неверный telegram_id. Должно быть число.");
    return;
  }
  
  if (!["new_subscription", "cancelled_subscription"].includes(eventType)) {
    await sendDirectMessage(telegramId, "❌ Неверный тип события. Используйте: new_subscription или cancelled_subscription");
    return;
  }
  
  await sendDirectMessage(telegramId, `🧪 Симулирую ${eventType} для пользователя ${targetId}...`);
  
  try {
    // Создаем полноценный Tribute webhook в реальном формате
    const now = new Date().toISOString();
    
    let webhookPayload: any;
    
    if (eventType === "new_subscription") {
      webhookPayload = {
        subscription_name: "Support my art 🌟",
        subscription_id: 999999,
        period_id: 888888, 
        period: "monthly",
        price: 500, // 5 евро в центах
        amount: 500,
        currency: "eur",
        user_id: 777777,
        telegram_user_id: targetId,
        channel_id: 666666,
        channel_name: "YAD Challenge Test",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 дней
      };
    } else {
      webhookPayload = {
        subscription_name: "Support my art 🌟",
        subscription_id: 999999,
        period_id: 888888,
        period: "monthly", 
        price: 500,
        amount: 500,
        currency: "eur",
        user_id: 777777,
        telegram_user_id: targetId,
        channel_id: 666666,
        channel_name: "YAD Challenge Test",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 дней
        cancel_reason: "User cancelled subscription"
      };
    }
    
    // Создаем полный webhook в формате Tribute
    const fullWebhook = {
      created_at: now,
      name: eventType,
      payload: webhookPayload,
      sent_at: now
    };
    
    // Симулируем HTTP request к нашему webhook endpoint
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const webhookUrl = `${SUPABASE_URL}/functions/v1/bot`;
    
    // Создаем тестовую подпись (заглушка)
    const testSignature = "test_signature_" + Math.random().toString(36).substring(7);
    
    const requestBody = JSON.stringify(fullWebhook);
    
    await sendDirectMessage(telegramId, `📡 Отправляю реалистичный webhook...\n\nURL: ${webhookUrl}\nТело: ${requestBody.substring(0, 200)}...`);
    
    // Отправляем webhook запрос
    const result = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "trbt-signature": testSignature,
        "X-Test-Webhook": "true" // Маркер что это тестовый webhook
      },
      body: requestBody
    });
    
    if (result) {
      const resultData = await result.json();
      const status = result.status;
      
      if (status === 200) {
        await sendDirectMessage(telegramId, `✅ Webhook симулирован успешно!\n\nОтвет: ${JSON.stringify(resultData, null, 2)}`);
      } else {
        await sendDirectMessage(telegramId, `❌ Ошибка симуляции (${status}):\n\n${JSON.stringify(resultData, null, 2)}`);
      }
    }
    
  } catch (error) {
    console.error("Error in test webhook command:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка выполнения симуляции: ${error.message}`);
  }
}