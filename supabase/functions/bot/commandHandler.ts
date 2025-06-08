import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendDirectMessage, findUserByTelegramId, registerUser, sendStatusMessageWithButtons } from "./userHandler.ts";
import { MSG_START, MSG_GET_CHAT_ID, MSG_WELCOME_RETURNING, MSG_RESET_SUCCESS, OWNER_TELEGRAM_ID, MSG_CHAT_MEMBER_STATUS } from "./constants.ts";
import { dailyCron, publicDeadlineReminder, allInfo } from "./cronHandler/index.ts";
import { handleStartCommand } from "./startCommand/index.ts";
import { handlePromoCode } from "./startCommand/states/index.ts";
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
  const telegramId = message.from.id;
  
  // Проверяем есть ли у пользователя сохранённые дни
  const user = await findUserByTelegramId(telegramId);
  const hasSavedDays = user && user.subscription_days_left > 0;
  const daysLeft = user?.subscription_days_left || 0;
  
  await sendDirectMessage(telegramId, MSG_WELCOME_RETURNING(hasSavedDays, daysLeft));
}

/**
 * Обрабатывает команду /reset - сбрасывает настройки пользователя
 */
export async function handleResetCommand(message: any): Promise<void> {
  const telegramId = message.from.id;
  
  console.log(`handleResetCommand: сброс настроек для пользователя ${telegramId}`);
  
  try {
    const now = new Date().toISOString();
    
    console.log(`handleResetCommand: начинаю сброс настроек для пользователя ${telegramId}`);
    
    // Сбрасываем поля процесса регистрации
    const { error, data } = await supabase
      .from("users")
      .update({
        user_state: null, // Основное поле - состояние пользователя
        mode: null,
        pace: null,
        updated_at: now
      })
      .eq("telegram_id", telegramId);
      
    if (error) {
      console.error("Ошибка при сбросе настроек пользователя:", error);
      console.error("Детали ошибки:", error.message, error.details, error.hint);
      await sendDirectMessage(telegramId, "Произошла ошибка при сбросе настроек. Попробуй еще раз или напиши @rrrtem");
      return;
    }
    
    console.log(`handleResetCommand: SQL запрос выполнен успешно для пользователя ${telegramId}`);
    
    // Очищаем состояние в Map (fallback для user_state)
    userStates.delete(telegramId);
    console.log(`handleResetCommand: состояние очищено в Map для пользователя ${telegramId}`);
    
    console.log(`handleResetCommand: настройки успешно сброшены для пользователя ${telegramId}`);
    
    // Отправляем подтверждение
    await sendDirectMessage(telegramId, MSG_RESET_SUCCESS);
    
  } catch (error) {
    console.error("Ошибка в handleResetCommand:", error);
    await sendDirectMessage(telegramId, "Произошла ошибка при сбросе настроек. Попробуй еще раз или напиши @rrrtem");
  }
}

/**
 * Обрабатывает команду /status - показывает статус пользователя
 */
export async function handleStatusCommand(message: any): Promise<void> {
  const telegramId = message.from.id;
  
  console.log(`handleStatusCommand: запрос статуса для пользователя ${telegramId}`);
  
  try {
    // Получаем данные пользователя из БД
    const user = await findUserByTelegramId(telegramId);
    
    if (!user) {
      await sendDirectMessage(telegramId, "❌ Пользователь не найден в системе. Используй команду /start для регистрации.");
      return;
    }
    
    console.log(`handleStatusCommand: пользователь найден, формирую статус`);
    
    // Формируем и отправляем сообщение со статусом с кнопками
    const statusMessage = MSG_CHAT_MEMBER_STATUS(user);
    await sendStatusMessageWithButtons(telegramId, statusMessage);
    
    console.log(`handleStatusCommand: статус отправлен пользователю ${telegramId}`);
    
  } catch (error) {
    console.error("Ошибка в handleStatusCommand:", error);
    await sendDirectMessage(telegramId, "Произошла ошибка при получении статуса. Попробуй еще раз или напиши @rrrtem");
  }
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
  } else if (text.startsWith("/open")) {
    await handleOpenSlotsCommand(message.from.id, text);
  } else if (text === "/slots") {
    await handleSlotsStatusCommand(message.from.id);
  } else if (text === "/test_slots") {
    await handleTestSlotsCommand(message.from.id);
  } else if (text === "/close_slots") {
    await handleCloseSlotsCommand(message.from.id);
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

/**
 * Обрабатывает команду /open[число] - установка количества доступных мест
 * Только для владельца бота
 */
async function handleOpenSlotsCommand(telegramId: number, text: string): Promise<void> {
  console.log(`🔓 handleOpenSlotsCommand called with text: "${text}"`);
  
  // Извлекаем число из команды
  const match = text.match(/^\/open(\d+)$/);
  
  if (!match) {
    await sendDirectMessage(telegramId, 
      "❌ Неверный формат команды.\n\nИспользование: /open[число]\nПример: /open20 - установит 20 доступных мест");
    return;
  }
  
  const slotsToSet = parseInt(match[1]);
  
  if (slotsToSet <= 0) {
    await sendDirectMessage(telegramId, "❌ Количество мест должно быть больше 0");
    return;
  }
  
  try {
    // Импортируем SlotManager
    const { SlotManager } = await import("./startCommand/flows/SlotManager.ts");
    const { MSG_SLOTS_OPENED, MSG_SLOTS_STATUS } = await import("../constants.ts");
    
    await sendDirectMessage(telegramId, `🔄 Устанавливаю ${slotsToSet} доступных мест...`);
    
    // Устанавливаем количество слотов
    await SlotManager.setAvailableSlots(slotsToSet, telegramId);
    
    // Получаем обновленную статистику
    const stats = await SlotManager.getSlotStats();
    
    // Формируем отчет
    let report = MSG_SLOTS_OPENED(slotsToSet) + '\n\n';
    report += MSG_SLOTS_STATUS(stats.available, stats.total);
    
    await sendDirectMessage(telegramId, report);
    
    // Если есть пользователи в waitlist, уведомляем их
    const waitlistProcessed = await processWaitlistUsers(slotsToSet);
    
    if (waitlistProcessed > 0) {
      await sendDirectMessage(telegramId, 
        `📨 Дополнительно: уведомлено ${waitlistProcessed} пользователей из списка ожидания`);
    }
    
  } catch (error) {
    console.error("Ошибка в handleOpenSlotsCommand:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка выполнения: ${error.message}`);
  }
}

/**
 * Обрабатывает пользователей из waitlist при открытии новых мест
 */
async function processWaitlistUsers(maxUsers: number): Promise<number> {
  try {
    // Получаем пользователей из waitlist
    const { data: waitlistUsers, error: fetchError } = await supabase
      .from("users")
      .select("telegram_id, username, waitlist_position")
      .eq("waitlist", true)
      .order("waitlist_position", { ascending: true })
      .limit(maxUsers);
    
    if (fetchError) {
      throw fetchError;
    }
    
    const usersToProcess = waitlistUsers || [];
    
    if (usersToProcess.length === 0) {
      return 0;
    }
    
    let successCount = 0;
    
    for (const user of usersToProcess) {
      try {
        // Убираем из waitlist
        const { error: updateError } = await supabase
          .from("users")
          .update({
            waitlist: false,
            waitlist_position: null,
            waitlist_added_at: null,
            user_state: null,
            updated_at: new Date().toISOString()
          })
          .eq("telegram_id", user.telegram_id);
        
        if (updateError) {
          throw updateError;
        }
        
        // Отправляем уведомление
        const { MSG_WAITLIST_OPENED } = await import("../constants.ts");
        await sendDirectMessage(user.telegram_id, MSG_WAITLIST_OPENED);
        
        // Запускаем процесс настройки
        const { SetupProcess } = await import("./startCommand/states/SetupProcess.ts");
        await SetupProcess.startModeSelection(user.telegram_id);
        
        successCount++;
      } catch (error) {
        console.error(`Ошибка обработки пользователя ${user.telegram_id}:`, error);
      }
    }
    
    return successCount;
    
  } catch (error) {
    console.error("Ошибка в processWaitlistUsers:", error);
    return 0;
  }
}

/**
 * Обрабатывает команду /slots - показ статуса доступных мест
 * Только для владельца бота
 */
async function handleSlotsStatusCommand(telegramId: number): Promise<void> {
  try {
    const { SlotManager } = await import("./startCommand/flows/SlotManager.ts");
    const { MSG_SLOTS_STATUS } = await import("../constants.ts");
    
    const stats = await SlotManager.getSlotStats();
    const statusMessage = MSG_SLOTS_STATUS(stats.available, stats.total);
    
    // Получаем количество пользователей в waitlist
    const { count: waitlistCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("waitlist", true);
    
    let report = statusMessage;
    
    if (waitlistCount && waitlistCount > 0) {
      report += `\n⏳ Пользователей в списке ожидания: ${waitlistCount}`;
    }
    
    report += '\n\n💡 Команды:\n';
    report += '• /open[число] - установить количество мест\n';
    report += '• /close_slots - закрыть все места (waitlist режим)\n';
    report += '• /slots - показать текущий статус';
    
    await sendDirectMessage(telegramId, report);
    
  } catch (error) {
    console.error("Ошибка в handleSlotsStatusCommand:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка получения статуса: ${error.message}`);
  }
}

/**
 * Обрабатывает команду /test_slots для тестирования системы слотов
 */
async function handleTestSlotsCommand(telegramId: number): Promise<void> {
  try {
    const { SlotManager } = await import("./startCommand/flows/SlotManager.ts");
    
    let report = "🧪 Тестирование системы слотов:\n\n";
    
    // Тест 1: Получение доступных слотов
    try {
      const availableSlots = await SlotManager.getAvailableSlots();
      report += `✅ getAvailableSlots(): ${availableSlots}\n`;
    } catch (error) {
      report += `❌ getAvailableSlots(): ${error.message}\n`;
    }
    
    // Тест 2: Проверка hasAvailableSlots
    try {
      const hasSlots = await SlotManager.hasAvailableSlots();
      report += `✅ hasAvailableSlots(): ${hasSlots}\n`;
    } catch (error) {
      report += `❌ hasAvailableSlots(): ${error.message}\n`;
    }
    
    // Тест 3: Получение статистики
    try {
      const stats = await SlotManager.getSlotStats();
      report += `✅ getSlotStats(): available=${stats.available}, total=${stats.total}\n`;
    } catch (error) {
      report += `❌ getSlotStats(): ${error.message}\n`;
    }
    
    // Тест 4: Проверка waitlist логики
    try {
      const { WaitlistFlow } = await import("./startCommand/flows/WaitlistFlow.ts");
      const shouldWaitlist = await WaitlistFlow.shouldAddToWaitlist();
      report += `✅ shouldAddToWaitlist(): ${shouldWaitlist}\n`;
    } catch (error) {
      report += `❌ shouldAddToWaitlist(): ${error.message}\n`;
    }
    
    report += "\n💡 Если есть ошибки, вероятно нужно выполнить SQL миграцию slots_system_migration.sql";
    
    await sendDirectMessage(telegramId, report);
    
  } catch (error) {
    console.error("Ошибка в handleTestSlotsCommand:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка тестирования: ${error.message}`);
  }
}

/**
 * Обрабатывает команду /close_slots для закрытия доступных мест
 */
async function handleCloseSlotsCommand(telegramId: number): Promise<void> {
  try {
    const { SlotManager } = await import("./startCommand/flows/SlotManager.ts");
    const { MSG_SLOTS_CLOSED, MSG_SLOTS_STATUS } = await import("../constants.ts");
    
    await sendDirectMessage(telegramId, "🔄 Закрываю все доступные места...");
    
    // Закрываем все места
    await SlotManager.closeAllSlots(telegramId);
    
    // Получаем обновленную статистику
    const stats = await SlotManager.getSlotStats();
    
    // Формируем отчет
    let report = MSG_SLOTS_CLOSED + '\n\n';
    report += MSG_SLOTS_STATUS(stats.available, stats.total);
    
    await sendDirectMessage(telegramId, report);
    
  } catch (error) {
    console.error("Ошибка в handleCloseSlotsCommand:", error);
    await sendDirectMessage(telegramId, `❌ Ошибка закрытия мест: ${error.message}`);
  }
}