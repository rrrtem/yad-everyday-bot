// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { updateUserFromChatMember } from "./userHandler.ts";
import { handleDailyPost } from "./dailyPostHandler.ts";
import { handleStartCommandWrapper, handleGetCommand, handleComebackCommand, handleResetCommand, handleStatusCommand, handleOwnerCommands, handleTextMessage } from "./commandHandler.ts";
import { handleStartCallbackQuery } from "./startCommand/index.ts";
import { dailyCron, publicDeadlineReminder } from "./cronHandler.ts";
import { handleNewChatMember } from "./newChatMemberHandler.ts";
import { handleLeftChatMember } from "./leftChatMemberHandler.ts";
import { handleTributeWebhook, syncSubscriptionsCommand } from "./tributeApiHandler.ts";
import { OWNER_TELEGRAM_ID } from "../constants.ts";

// Переменные окружения и API Telegram
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Автоматическое определение WEBHOOK_URL на основе Supabase окружения
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const WEBHOOK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/bot` : null;

/**
 * Настраивает webhook для получения событий chat_member
 * Вызывается при получении GET запроса на /webhook-setup
 */
async function setupWebhook(): Promise<Response> {
  if (!WEBHOOK_URL) {
    return new Response(JSON.stringify({
      success: false,
      error: "WEBHOOK_URL not configured",
      supabase_url: SUPABASE_URL,
      auto_webhook_url: WEBHOOK_URL
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: [
          "message",
          "callback_query", 
          "chat_member"  // ← Это критически важно для событий входа/выхода!
        ]
      })
    });

    const result = await response.json();
    console.log("Webhook setup result:", result);
    
    if (result.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: "Webhook настроен успешно с поддержкой chat_member событий",
        webhook_url: WEBHOOK_URL,
        allowed_updates: ["message", "callback_query", "chat_member"],
        telegram_response: result
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.description,
        telegram_response: result
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Error setting up webhook:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Проверяет текущие настройки webhook
 */
async function getWebhookInfo(): Promise<Response> {
  try {
    const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
    const result = await response.json();
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error getting webhook info:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

console.log("Bot function started.");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Обработка GET запросов для настройки webhook
  if (req.method === "GET") {
    if (url.pathname.includes("webhook-setup")) {
      return await setupWebhook();
    } else if (url.pathname.includes("webhook-info")) {
      return await getWebhookInfo();
    } else {
      return new Response(`
        <h1>YAD Everyday Bot</h1>
        <p>Доступные эндпоинты:</p>
        <ul>
          <li><a href="./webhook-setup">./webhook-setup</a> - Настроить Telegram webhook</li>
          <li><a href="./webhook-info">./webhook-info</a> - Проверить настройки Telegram webhook</li>
        </ul>
        
        <h2>Интеграция с Tribute</h2>
        <p>URL для настройки в Tribute Dashboard:</p>
        <code>${WEBHOOK_URL || 'WEBHOOK_URL не настроен'}</code>
        <p>Tribute webhook'и обрабатываются автоматически при наличии заголовка <code>trbt-signature</code></p>
        
        <h2>Debug info</h2>
        <ul>
          <li>SUPABASE_URL: ${SUPABASE_URL || 'не настроен'}</li>
          <li>WEBHOOK_URL: ${WEBHOOK_URL || 'не настроен'}</li>
          <li>BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'настроен' : 'не настроен'}</li>
          <li>TRIBUTE_API_KEY: ${Deno.env.get("TRIBUTE_API_KEY") ? 'настроен' : 'не настроен'}</li>
        </ul>
      `, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Логируем каждый POST запрос
  const timestamp = new Date().toISOString();
  console.log(`\n=== POST REQUEST ${timestamp} ===`);
  console.log("URL:", req.url);
  
  // Логируем ключевые заголовки
  const contentType = req.headers.get("content-type");
  const userAgent = req.headers.get("user-agent");
  const tributeSignature = req.headers.get("trbt-signature");
  
  console.log("Content-Type:", contentType);
  console.log("User-Agent:", userAgent);
  console.log("Has trbt-signature:", !!tributeSignature);
  if (tributeSignature) {
    console.log("trbt-signature value:", tributeSignature);
  }
  
  // Проверяем, является ли это Tribute webhook (по наличию подписи)
  if (tributeSignature) {
    console.log("🎯 TRIBUTE WEBHOOK DETECTED - routing to tributeApiHandler");
    return await handleTributeWebhook(req);
  } else {
    console.log("📱 TELEGRAM WEBHOOK DETECTED - processing as Telegram update");
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }

  // Логируем все входящие обновления для диагностики
  console.log("=== TELEGRAM WEBHOOK RECEIVED ===");
  console.log("Full update body:", JSON.stringify(body, null, 2));
  console.log("Update type check:");
  console.log("- has message:", !!body.message);
  console.log("- has callback_query:", !!body.callback_query);
  console.log("- has chat_member:", !!body.chat_member);
  console.log("- has my_chat_member:", !!body.my_chat_member);
  console.log("========================");

  // Обработка cron-запросов
  if (body.type) {
    if (body.type === "daily") {
      return await dailyCron();
    } else if (body.type === "public_reminder") {
      return await publicDeadlineReminder();
    }
  }

  // Обработка Telegram webhook
  const update = body;
  
  try {
    if (update.message) {
      const message = update.message;
      const text = message.text || message.caption || "";
      const chatType = message.chat.type;

      console.log(`Processing message: ${text} from chat type: ${chatType}`);

      // Команды бота
      if (text === "/start") {
        await handleStartCommandWrapper(message);
      } else if (text === "/get") {
        await handleGetCommand(message);
      } else if (text === "/comeback") {
        await handleComebackCommand(message);
      } else if (text === "/reset") {
        await handleResetCommand(message);
      } else if (text === "/status") {
        await handleStatusCommand(message);
      } else if (/\B#daily\b/i.test(text)) {
        await handleDailyPost(message);
      } else if (chatType === "private" && message.from.id === OWNER_TELEGRAM_ID && (["/daily", "/remind", "/allinfo", "/tribute_test", "/sync_subscriptions", "/slots", "/test_slots", "/close_slots"].includes(text) || text.startsWith("/test_webhook ") || text.startsWith("/open"))) {
        await handleOwnerCommands(message);
      } else if (chatType === "private" && text && !text.startsWith("/")) {
        // Обрабатываем текстовые сообщения в личке (промокоды)
        await handleTextMessage(message);
      }
    }
    // Обработка callback_query (нажатия на inline кнопки)
    else if (update.callback_query) {
      console.log("Processing callback_query:", update.callback_query.data);
      await handleStartCallbackQuery(update.callback_query);
    }
    // Обработка chat_member (добавление/удаление участников)
    else if (update.chat_member) {
      console.log("=== CHAT_MEMBER EVENT DETECTED ===");
      const chatMember = update.chat_member;
      console.log("Raw chat_member data:", JSON.stringify(chatMember, null, 2));
      
      const newStatus = chatMember.new_chat_member?.status;
      const oldStatus = chatMember.old_chat_member?.status;
      const userId = chatMember.new_chat_member?.user?.id;
      const userName = chatMember.new_chat_member?.user?.first_name;
      
      console.log(`User: ${userName} (${userId})`);
      console.log(`Status change: ${oldStatus} -> ${newStatus}`);
      
      // Проверяем, вошел ли пользователь в чат (new_chat_member)
      const wasNotMember = !oldStatus || ["left", "kicked", "banned"].includes(oldStatus);
      const isNowMember = ["member", "administrator", "creator"].includes(newStatus || "");
      
      // Проверяем, покинул ли пользователь чат (left_chat_member)
      const wasMember = oldStatus && ["member", "administrator", "creator"].includes(oldStatus);
      const isNoLongerMember = ["left", "kicked", "banned"].includes(newStatus || "");
      
      console.log(`Logic check:`);
      console.log(`- wasNotMember: ${wasNotMember}, isNowMember: ${isNowMember} => join: ${wasNotMember && isNowMember}`);
      console.log(`- wasMember: ${wasMember}, isNoLongerMember: ${isNoLongerMember} => leave: ${wasMember && isNoLongerMember}`);
      
      if (wasNotMember && isNowMember) {
        // Пользователь вошел в чат - используем обработчик Б4
        console.log("=== CALLING handleNewChatMember ===");
        await handleNewChatMember(chatMember);
      } else if (wasMember && isNoLongerMember) {
        // Пользователь покинул чат - используем обработчик Б5
        console.log("=== CALLING handleLeftChatMember ===");
        await handleLeftChatMember(chatMember);
      } else {
        // Другие изменения статуса - используем старый обработчик (fallback)
        console.log("=== CALLING updateUserFromChatMember (fallback) ===");
        await updateUserFromChatMember(chatMember);
      }
      console.log("=== CHAT_MEMBER PROCESSING COMPLETE ===");
    }
    // Обработка my_chat_member (изменения статуса самого бота)
    else if (update.my_chat_member) {
      console.log("=== MY_CHAT_MEMBER EVENT (bot status change) ===");
      console.log("Bot status change:", JSON.stringify(update.my_chat_member, null, 2));
      // Это событие происходит когда меняется статус самого бота, игнорируем
    }
    else {
      console.log("Unhandled update type. Full update:", JSON.stringify(update, null, 2));
    }
  } catch (error) {
    console.error("Error processing update:", error);
    console.error("Stack trace:", error.stack);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/bot' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
