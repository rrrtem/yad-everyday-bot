import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WEBHOOK_DEDUPLICATION_HOURS,
  MSG_SUBSCRIPTION_RENEWED,
  MSG_SUBSCRIPTION_RENEWED_WITH_BONUS,
  MSG_SUBSCRIPTION_CANCELLED,
  MSG_TRIBUTE_WEBHOOK_ERROR,
  MSG_TRIBUTE_SIGNATURE_ERROR,
  OWNER_TELEGRAM_ID,
  pluralizeDays
} from "../constants.ts";

// Инициализация Supabase клиента
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
 * Проверка дедупликации webhook'а
 */
async function isWebhookAlreadyProcessed(telegramUserId: number): Promise<boolean> {
  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - WEBHOOK_DEDUPLICATION_HOURS);

  const { data } = await supabase
    .from("users")
    .select("tribute_webhook_processed_at")
    .eq("telegram_id", telegramUserId)
    .single();

  if (!data?.tribute_webhook_processed_at) {
    return false;
  }

  const lastProcessed = new Date(data.tribute_webhook_processed_at);
  return lastProcessed > hoursAgo;
}

/**
 * Б6. Обработка webhook'а новой подписки от Tribute API
 */
export async function handleNewSubscription(payload: TributeNewSubscriptionPayload): Promise<Response> {
  console.log("Processing new subscription webhook:", payload);

  const { telegram_user_id } = payload;

  try {
    // Дедупликация
    if (await isWebhookAlreadyProcessed(telegram_user_id)) {
      console.log(`Webhook already processed for user ${telegram_user_id}, ignoring`);
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Находим пользователя в БД
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_user_id)
      .single();

    if (findError || !user) {
      console.error("User not found for telegram_user_id:", telegram_user_id);
      await notifyAdmin(`${MSG_TRIBUTE_WEBHOOK_ERROR}\nTelegram ID: ${telegram_user_id}`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
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
export async function handleCancelledSubscription(payload: TributeCancelledSubscriptionPayload): Promise<Response> {
  console.log("Processing cancelled subscription webhook:", payload);

  const { telegram_user_id } = payload;

  try {
    // Дедупликация
    if (await isWebhookAlreadyProcessed(telegram_user_id)) {
      console.log(`Webhook already processed for user ${telegram_user_id}, ignoring`);
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Находим пользователя в БД
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_user_id)
      .single();

    if (findError || !user) {
      console.error("User not found for telegram_user_id:", telegram_user_id);
      await notifyAdmin(`${MSG_TRIBUTE_WEBHOOK_ERROR}\nTelegram ID: ${telegram_user_id}`);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
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
      is_active: remainsActive,
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
 * Основная функция обработки Tribute webhook'ов
 */
export async function handleTributeWebhook(req: Request): Promise<Response> {
  try {
    console.log("=== TRIBUTE WEBHOOK RECEIVED ===");
    
    // Проверяем метод запроса
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Получаем подпись из заголовка
    const signature = req.headers.get("trbt-signature");
    if (!signature) {
      console.error("Missing trbt-signature header");
      await notifyAdmin(MSG_TRIBUTE_SIGNATURE_ERROR + "\nОтсутствует заголовок trbt-signature");
      return new Response("Missing signature", { status: 401 });
    }

    // Читаем тело запроса
    const body = await req.text();
    console.log("Webhook body:", body);
    
    // Проверяем подпись
    const isValidSignature = await verifyTributeSignature(body, signature);
    if (!isValidSignature) {
      console.error("Invalid Tribute webhook signature");
      await notifyAdmin(MSG_TRIBUTE_SIGNATURE_ERROR + `\nПодпись: ${signature}\nТело: ${body}`);
      return new Response(JSON.stringify({ 
        error: "Invalid signature",
        signature_received: signature.substring(0, 10) + "..."
      }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Парсим JSON
    let webhookData: any;
    try {
      webhookData = JSON.parse(body);
      console.log("Parsed webhook data:", JSON.stringify(webhookData, null, 2));
    } catch (error) {
      console.error("Invalid JSON in webhook body:", error);
      console.error("Raw body:", body);
      return new Response("Invalid JSON", { status: 400 });
    }

    // Проверяем, является ли это тестовым webhook'ом
    if (webhookData.test_event) {
      console.log("Test webhook detected:", webhookData.test_event);
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
    const webhookEvent = webhookData as TributeWebhookEvent;
    if (!webhookEvent.name || !webhookEvent.payload) {
      console.error("Invalid webhook structure - missing name or payload");
      return new Response(JSON.stringify({ 
        error: "Invalid webhook structure",
        received: Object.keys(webhookData)
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("Real webhook event:", webhookEvent.name);
    console.log("Event payload:", JSON.stringify(webhookEvent.payload, null, 2));

    // Обрабатываем событие в зависимости от типа
    switch (webhookEvent.name) {
      case "new_subscription":
        return await handleNewSubscription(webhookEvent.payload as TributeNewSubscriptionPayload);
      
      case "cancelled_subscription":
        return await handleCancelledSubscription(webhookEvent.payload as TributeCancelledSubscriptionPayload);
      
      default:
        console.log(`Unknown webhook event type: ${webhookEvent.name}`);
        return new Response(JSON.stringify({ 
          ok: true, 
          message: "Event type not handled",
          event_type: webhookEvent.name
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