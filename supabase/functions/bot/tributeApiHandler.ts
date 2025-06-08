import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WEBHOOK_DEDUPLICATION_HOURS,
  MSG_SUBSCRIPTION_RENEWED,
  MSG_SUBSCRIPTION_RENEWED_WITH_BONUS,
  MSG_SUBSCRIPTION_CANCELLED,
  MSG_TRIBUTE_WEBHOOK_ERROR,
  MSG_TRIBUTE_SIGNATURE_ERROR,
  MSG_SYNC_NO_ACTIVE_USERS,
  MSG_SYNC_COMPLETE,
  MSG_SUBSCRIPTION_EXPIRED_NOTIFICATION,
  OWNER_TELEGRAM_ID,
  pluralizeDays
} from "../constants.ts";

// Инициализация Supabase клиента
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Telegram API
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Tribute API ключ
const TRIBUTE_API_KEY = Deno.env.get("TRIBUTE_API_KEY")!;

/**
 * Интерфейсы для Tribute API webhook'ов
 */
interface TributeNewSubscriptionPayload {
  subscription_name: string;
  subscription_id: number;
  period_id: number;
  period: string;
  price: number;
  amount: number;
  currency: string;
  user_id: number;
  telegram_user_id: number;
  channel_id: number;
  channel_name: string;
  expires_at: string;
}

interface TributeCancelledSubscriptionPayload extends TributeNewSubscriptionPayload {
  cancel_reason: string;
}

interface TributeWebhookEvent {
  created_at: string;
  name: "new_subscription" | "cancelled_subscription";
  payload: TributeNewSubscriptionPayload | TributeCancelledSubscriptionPayload;
  sent_at: string;
}

/**
 * Проверка подписи webhook'а от Tribute
 */
async function verifyTributeSignature(body: string, signature: string): Promise<boolean> {
  try {
    // Создаем подпись из тела запроса используя наш API ключ
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TRIBUTE_API_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const computedSignature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computedSignatureHex = Array.from(new Uint8Array(computedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Сравниваем подписи
    return computedSignatureHex === signature;
  } catch (error) {
    console.error("Error verifying Tribute signature:", error);
    return false;
  }
}

/**
 * Отправка сообщения в Telegram
 */
async function sendTelegramMessage(telegramId: number, text: string): Promise<void> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: text,
        parse_mode: "HTML"
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to send Telegram message:", result);
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

/**
 * Отправка сообщения админу
 */
async function notifyAdmin(message: string): Promise<void> {
  await sendTelegramMessage(OWNER_TELEGRAM_ID, message);
}

/**
 * Проверка дедупликации webhook'а (защита от спама, но не блокирует обновления данных)
 */
async function isWebhookAlreadyProcessed(telegramUserId: number, isTestWebhook: boolean = false): Promise<boolean> {
  // Для тестовых webhook'ов дедупликация отключена
  if (isTestWebhook) {
    console.log("🧪 Test webhook - skipping deduplication");
    return false;
  }

  // Для реальных webhook'ов — короткая дедупликация только против спама (5 минут)
  const minutesAgo = new Date();
  minutesAgo.setMinutes(minutesAgo.getMinutes() - 5);

  const { data } = await supabase
    .from("users")
    .select("tribute_webhook_processed_at")
    .eq("telegram_id", telegramUserId);

  if (!data || data.length === 0 || !data[0]?.tribute_webhook_processed_at) {
    return false;
  }

  const lastProcessed = new Date(data[0].tribute_webhook_processed_at);
  const isRecent = lastProcessed > minutesAgo;
  
  if (isRecent) {
    console.log(`⏰ Recent webhook for user ${telegramUserId} processed at ${lastProcessed.toISOString()}, current deduplication window: 5 minutes`);
  }
  
  return isRecent;
}

/**
 * Б6. Обработка webhook'а новой подписки от Tribute API
 */
export async function handleNewSubscription(payload: TributeNewSubscriptionPayload, isTestWebhook: boolean = false): Promise<Response> {
  console.log("Processing new subscription webhook:", payload);

  const { telegram_user_id } = payload;

  try {
    // Дедупликация
    if (await isWebhookAlreadyProcessed(telegram_user_id, isTestWebhook)) {
      console.log(`Webhook already processed for user ${telegram_user_id}, ignoring`);
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Находим пользователя в БД
    console.log(`🔍 Looking for user with telegram_id: ${telegram_user_id} (type: ${typeof telegram_user_id})`);
    
    let { data: users, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_user_id);
    
    let user = null;
    if (users && users.length > 0) {
      user = users[0]; // Берем первого найденного пользователя
      if (users.length > 1) {
        console.log(`⚠️ WARNING: Found ${users.length} users with telegram_id ${telegram_user_id}, using first one`);
        await notifyAdmin(`⚠️ ДУБЛИКАТЫ: Найдено ${users.length} пользователей с telegram_id ${telegram_user_id}! Используется первый.`);
      }
    }

    console.log(`📊 Database query result:`, { 
      userFound: user ? `Found user ${user.telegram_id}` : 'No user found', 
      error: findError,
      errorCode: findError?.code,
      errorMessage: findError?.message
    });

    // Если пользователь не найден, попробуем поиск с приведением типов
    if (findError || !user) {
      console.log(`🔄 Trying alternative search with type conversion...`);
      
      // Пробуем поиск со строковым и числовым значениями
      const { data: userAlt, error: findErrorAlt } = await supabase
        .from("users")
        .select("*")
        .or(`telegram_id.eq.${telegram_user_id},telegram_id.eq."${telegram_user_id}"`)
        .single();
        
      console.log(`🔍 Alternative search result:`, { 
        userFound: userAlt ? `Found user ${userAlt.telegram_id}` : 'No user found', 
        error: findErrorAlt
      });
      
      if (userAlt && !findErrorAlt) {
        user = userAlt;
        findError = null;
        console.log(`✅ Found user with alternative search!`);
      }
    }

    // Если пользователь не найден, создаем новую запись
    if (findError || !user) {
      console.log(`❌ User not found for telegram_id ${telegram_user_id}!`);
      console.log(`🔄 Attempting to create new user...`);
      console.log(`Error details:`, findError);
      
      // Отправляем детальный отчет админу
      await notifyAdmin(`🔍 DEBUG: Пользователь не найден\n\nTelegram ID: ${telegram_user_id}\nТип: ${typeof telegram_user_id}\nОшибка: ${findError?.message || 'Пользователь не существует'}\nКод ошибки: ${findError?.code || 'N/A'}\n\nСоздаю нового пользователя...`);
      
      const now = new Date().toISOString();
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          telegram_id: telegram_user_id,
          in_chat: false,
          subscription_active: false,
          club: false,
          post_today: false,
          public_remind: true,
          strikes_count: 0,
          units_count: 0,
          subscription_days_left: 0,
          pause_days: 0,
          created_at: now
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating new user:", createError);
        await notifyAdmin(`❌ Ошибка создания пользователя ${telegram_user_id}: ${createError.message}`);
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      user = newUser;
      console.log(`Successfully created new user for telegram_id ${telegram_user_id}`);
    } else {
      console.log(`✅ Found existing user for telegram_id ${telegram_user_id}`);
    }

    const now = new Date().toISOString();
    const expiresAt = payload.expires_at;
    let bonusDays = 0;
    let finalExpiresAt = expiresAt;

    // Если есть сохранённые дни подписки, добавляем их к новой подписке
    if (user.subscription_days_left > 0) {
      bonusDays = user.subscription_days_left;
      const expiresDate = new Date(expiresAt);
      expiresDate.setDate(expiresDate.getDate() + bonusDays);
      finalExpiresAt = expiresDate.toISOString();
    }

    // Обновляем данные пользователя
    const updateData: any = {
      // Данные из Tribute webhook
      subscription_id: payload.subscription_id,
      period_id: payload.period_id,
      period: payload.period,
      price: payload.price,
      amount: payload.amount,
      currency: payload.currency,
      subscription_name: payload.subscription_name,
      tribute_user_id: payload.user_id,
      channel_id: payload.channel_id,
      channel_name: payload.channel_name,
      expires_at: finalExpiresAt,
      
      // Вычисляемые поля
      subscription_started_at: now,
      subscription_cancelled_at: null,
      subscription_active: true,
      subscription_days_left: 0, // Дни использованы или не было
      tribute_webhook_processed_at: now,
      updated_at: now
    };

    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("telegram_id", telegram_user_id);

    if (updateError) {
      console.error("Error updating user subscription:", updateError);
      await notifyAdmin(`Ошибка обновления подписки для пользователя ${telegram_user_id}: ${updateError.message}`);
      return new Response(JSON.stringify({ error: "Database update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Отправляем уведомление пользователю
    if (bonusDays > 0) {
      await sendTelegramMessage(telegram_user_id, MSG_SUBSCRIPTION_RENEWED_WITH_BONUS(bonusDays));
    } else {
      await sendTelegramMessage(telegram_user_id, MSG_SUBSCRIPTION_RENEWED);
    }

    console.log(`Successfully processed new subscription for user ${telegram_user_id}`);
    return new Response(JSON.stringify({ ok: true, message: "Subscription activated" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error processing new subscription webhook:", error);
    await notifyAdmin(`Критическая ошибка обработки новой подписки для ${telegram_user_id}: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Б7. Обработка webhook'а отмены подписки от Tribute API
 */
export async function handleCancelledSubscription(payload: TributeCancelledSubscriptionPayload, isTestWebhook: boolean = false): Promise<Response> {
  console.log("Processing cancelled subscription webhook:", payload);

  const { telegram_user_id } = payload;

  try {
    // Дедупликация
    if (await isWebhookAlreadyProcessed(telegram_user_id, isTestWebhook)) {
      console.log(`Webhook already processed for user ${telegram_user_id}, ignoring`);
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Находим пользователя в БД
    let { data: users, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_user_id);
    
    let user = null;
    if (users && users.length > 0) {
      user = users[0]; // Берем первого найденного пользователя
      if (users.length > 1) {
        console.log(`⚠️ WARNING: Found ${users.length} users with telegram_id ${telegram_user_id}, using first one`);
        await notifyAdmin(`⚠️ ДУБЛИКАТЫ: Найдено ${users.length} пользователей с telegram_id ${telegram_user_id}! Используется первый.`);
      }
    }

    // Если пользователь не найден, создаем новую запись
    if (findError || !user) {
      console.log(`User not found for telegram_id ${telegram_user_id}, creating new user`);
      
      const now = new Date().toISOString();
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          telegram_id: telegram_user_id,
          in_chat: false,
          subscription_active: false,
          club: false,
          post_today: false,
          public_remind: true,
          strikes_count: 0,
          units_count: 0,
          subscription_days_left: 0,
          pause_days: 0,
          created_at: now
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating new user:", createError);
        await notifyAdmin(`❌ Ошибка создания пользователя ${telegram_user_id}: ${createError.message}`);
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      user = newUser;
      console.log(`Successfully created new user for telegram_id ${telegram_user_id}`);
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(payload.expires_at);
    const currentDate = new Date();

    // Рассчитываем неиспользованные дни
    let subscriptionDaysLeft = 0;
    if (expiresAt > currentDate) {
      const timeDiff = expiresAt.getTime() - currentDate.getTime();
      subscriptionDaysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    // Определяем, остается ли пользователь активным
    const remainsActive = user.in_chat && subscriptionDaysLeft > 0;

    // Обновляем данные пользователя
    const updateData: any = {
      subscription_cancelled_at: now,
      cancel_reason: payload.cancel_reason || "",
      expires_at: payload.expires_at,
      subscription_active: false,
      subscription_days_left: subscriptionDaysLeft,
      tribute_webhook_processed_at: now,
      updated_at: now
    };

    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("telegram_id", telegram_user_id);

    if (updateError) {
      console.error("Error updating user subscription cancellation:", updateError);
      await notifyAdmin(`Ошибка обработки отмены подписки для пользователя ${telegram_user_id}: ${updateError.message}`);
      return new Response(JSON.stringify({ error: "Database update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Отправляем уведомление пользователю если он ещё активен в чате
    if (user.in_chat) {
      const expiresAtFormatted = expiresAt.toLocaleDateString('ru-RU');
      await sendTelegramMessage(telegram_user_id, MSG_SUBSCRIPTION_CANCELLED(expiresAtFormatted, subscriptionDaysLeft));
    }

    console.log(`Successfully processed cancelled subscription for user ${telegram_user_id}`);
    return new Response(JSON.stringify({ ok: true, message: "Subscription cancelled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error processing cancelled subscription webhook:", error);
    await notifyAdmin(`Критическая ошибка обработки отмены подписки для ${telegram_user_id}: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Команда админа для синхронизации подписок с актуальным статусом
 */
export async function syncSubscriptionsCommand(): Promise<string> {
  try {
    console.log("=== SYNC SUBSCRIPTIONS COMMAND ===");

      // Получаем всех пользователей в чате (активных пользователей)
  const { data: users, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("in_chat", true);

    if (fetchError) {
      console.error("Error fetching active subscribers:", fetchError);
      return `❌ Ошибка получения пользователей: ${fetchError.message}`;
    }

    if (!users || users.length === 0) {
      return MSG_SYNC_NO_ACTIVE_USERS;
    }

    let syncedCount = 0;
    let expiredCount = 0;
    let restoredCount = 0;
    const now = new Date();

    // Проверяем каждого пользователя
    for (const user of users) {
      if (user.expires_at) {
        const expiresAt = new Date(user.expires_at);
        
        // Если подписка истекла, обновляем статус
        if (expiresAt <= now) {
          const daysLeft = Math.max(0, user.subscription_days_left || 0);
          
          const { error: updateError } = await supabase
            .from("users")
            .update({
              subscription_active: false, // Команда админа может корректировать subscription_active
              updated_at: now.toISOString()
            })
            .eq("id", user.id);

          if (updateError) {
            console.error(`Error updating expired user ${user.telegram_id}:`, updateError);
          } else {
            expiredCount++;
            
            // Уведомляем пользователя об истечении подписки
            if (user.in_chat) {
              const expiresAtFormatted = expiresAt.toLocaleDateString('ru-RU');
              await sendTelegramMessage(
                user.telegram_id, 
                MSG_SUBSCRIPTION_EXPIRED_NOTIFICATION(expiresAtFormatted, daysLeft)
              );
            }
          }
        } else {
          // Если подписка ещё действует, но subscription_active = false, исправляем
          if (!user.subscription_active && user.subscription_id) {
            const { error: updateError } = await supabase
              .from("users")
              .update({
                subscription_active: true, // Восстанавливаем активность действующей подписки
                updated_at: now.toISOString()
              })
              .eq("id", user.id);
              
            if (updateError) {
              console.error(`Error restoring user ${user.telegram_id}:`, updateError);
            } else {
              restoredCount++;
              console.log(`Restored subscription_active for user ${user.telegram_id} with valid expires_at`);
            }
          }
        }
      }
      
      syncedCount++;
    }

    const resultMessage = MSG_SYNC_COMPLETE(syncedCount, expiredCount, restoredCount);
    await notifyAdmin(`✅ Синхронизация завершена:\n📊 Проверено: ${syncedCount}\n⏰ Истекших: ${expiredCount}\n🔄 Восстановлено: ${restoredCount}`);
    
    return resultMessage;

  } catch (error) {
    console.error("Error in sync subscriptions command:", error);
    await notifyAdmin(`❌ Ошибка синхронизации подписок: ${error.message}`);
    return `❌ Ошибка синхронизации: ${error.message}`;
  }
}

/**
 * Основная функция обработки Tribute webhook'ов
 */
export async function handleTributeWebhook(req: Request): Promise<Response> {
  try {
    console.log("=== TRIBUTE WEBHOOK RECEIVED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    
    // Логируем все заголовки
    const headers = Object.fromEntries(req.headers.entries());
    console.log("Headers:", JSON.stringify(headers, null, 2));
    
    // Проверяем метод запроса
    if (req.method !== "POST") {
      console.log("❌ Invalid method:", req.method);
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Проверяем, является ли это тестовым webhook'ом
    const isTestWebhook = req.headers.get("X-Test-Webhook") === "true";
    console.log("Is test webhook:", isTestWebhook);

    // Получаем подпись из заголовка
    const signature = req.headers.get("trbt-signature");
    console.log("Signature from header:", signature);
    
    if (!signature && !isTestWebhook) {
      console.error("❌ Missing trbt-signature header");
      console.log("Available headers:", Object.keys(headers));
      await notifyAdmin(MSG_TRIBUTE_SIGNATURE_ERROR + "\nОтсутствует заголовок trbt-signature\nHeaders: " + JSON.stringify(headers));
      return new Response("Missing signature", { status: 401 });
    }

    // Читаем тело запроса
    const body = await req.text();
    console.log("Raw body length:", body.length);
    console.log("Raw body content:", body);
    
    // Проверяем подпись (пропускаем для тестовых webhook'ов)
    if (!isTestWebhook) {
      console.log("🔐 Verifying signature...");
      const isValidSignature = await verifyTributeSignature(body, signature);
      console.log("Signature valid:", isValidSignature);
      
      if (!isValidSignature) {
        console.error("❌ Invalid Tribute webhook signature");
        console.log("Expected signature calculation with TRIBUTE_API_KEY");
        await notifyAdmin(MSG_TRIBUTE_SIGNATURE_ERROR + `\nПодпись: ${signature}\nТело: ${body.substring(0, 500)}...`);
        return new Response(JSON.stringify({ 
          error: "Invalid signature",
          signature_received: signature.substring(0, 10) + "...",
          body_preview: body.substring(0, 100) + "..."
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      console.log("✅ Signature verification passed");
    } else {
      console.log("🧪 Test webhook - skipping signature verification");
    }

    // Парсим JSON
    console.log("📄 Parsing JSON body...");
    let webhookData: any;
    try {
      webhookData = JSON.parse(body);
      console.log("✅ JSON parsed successfully");
      console.log("Webhook data keys:", Object.keys(webhookData));
      console.log("Full webhook data:", JSON.stringify(webhookData, null, 2));
    } catch (error) {
      console.error("❌ Invalid JSON in webhook body:", error);
      console.error("Raw body that failed to parse:", body);
      await notifyAdmin(`❌ Ошибка парсинга JSON в Tribute webhook:\n${error.message}\nТело: ${body.substring(0, 500)}...`);
      return new Response("Invalid JSON", { status: 400 });
    }

    // Проверяем, является ли это тестовым webhook'ом
    if (webhookData.test_event) {
      console.log("🧪 Test webhook detected:", webhookData.test_event);
      await notifyAdmin(`🧪 Получен тестовый webhook от Tribute: ${webhookData.test_event}`);
      return new Response(JSON.stringify({ 
        ok: true, 
        message: "Test webhook received successfully",
        test_event: webhookData.test_event 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Проверяем структуру реального webhook'а
    console.log("🔍 Checking webhook structure...");
    const webhookEvent = webhookData as TributeWebhookEvent;
    
    if (!webhookEvent.name || !webhookEvent.payload) {
      console.error("❌ Invalid webhook structure - missing name or payload");
      console.log("Expected: {name: string, payload: object}");
      console.log("Received keys:", Object.keys(webhookData));
      console.log("Received data:", JSON.stringify(webhookData, null, 2));
      
      await notifyAdmin(`❌ Неверная структура Tribute webhook\nОжидалось: {name, payload}\nПолучено: ${Object.keys(webhookData).join(', ')}\nДанные: ${JSON.stringify(webhookData, null, 2).substring(0, 500)}...`);
      
      return new Response(JSON.stringify({ 
        error: "Invalid webhook structure",
        expected: ["name", "payload"],
        received: Object.keys(webhookData),
        data: webhookData
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("✅ Webhook structure is valid");
    console.log("🎯 Real webhook event:", webhookEvent.name);
    console.log("📦 Event payload:", JSON.stringify(webhookEvent.payload, null, 2));
    
    // Уведомляем админа о webhook'е
    if (isTestWebhook) {
      await notifyAdmin(`🧪 Получен ТЕСТОВЫЙ Tribute webhook!\nТип: ${webhookEvent.name}\nПользователь: ${webhookEvent.payload.telegram_user_id}\nВремя: ${webhookEvent.created_at || 'не указано'}`);
    } else {
      await notifyAdmin(`🎯 Получен реальный Tribute webhook!\nТип: ${webhookEvent.name}\nПользователь: ${webhookEvent.payload.telegram_user_id}\nВремя: ${webhookEvent.created_at || 'не указано'}`);
    }

    // Обрабатываем событие в зависимости от типа
    console.log("🚀 Processing webhook event...");
    switch (webhookEvent.name) {
      case "new_subscription":
        console.log("🔄 Processing new_subscription event");
        return await handleNewSubscription(webhookEvent.payload as TributeNewSubscriptionPayload, isTestWebhook);
      
      case "cancelled_subscription":
        console.log("🔄 Processing cancelled_subscription event");
        return await handleCancelledSubscription(webhookEvent.payload as TributeCancelledSubscriptionPayload, isTestWebhook);
      
      default:
        console.log(`❓ Unknown webhook event type: ${webhookEvent.name}`);
        await notifyAdmin(`❓ Неизвестный тип Tribute webhook: ${webhookEvent.name}\nДанные: ${JSON.stringify(webhookEvent, null, 2)}`);
        return new Response(JSON.stringify({ 
          ok: true, 
          message: "Event type not handled",
          event_type: webhookEvent.name,
          available_types: ["new_subscription", "cancelled_subscription"]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
    }

  } catch (error) {
    console.error("Critical error in Tribute webhook handler:", error);
    await notifyAdmin(`Критическая ошибка в обработчике Tribute webhook: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
} 