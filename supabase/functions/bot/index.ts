// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { updateUserFromChatMember } from "./userHandler.ts";
import { handleDailyPost } from "./postHandler.ts";
import { handleStartCommand, handleGetCommand, handleComebackCommand, handleOwnerCommands } from "./commandHandler.ts";
import { dailyCron, monthlyReset, publicDeadlineReminder } from "./cronHandler.ts";
import { OWNER_TELEGRAM_ID } from "../constants.ts";

// Переменные окружения и API Telegram остаются здесь, так как они общие
// const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
// const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
// Supabase клиент будет инициализироваться в каждом обработчике по необходимости или передан

console.log("Bot function started.");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }

  // Обработка cron-запросов
  if (body.type) {
    if (body.type === "daily") {
      return await dailyCron();
    } else if (body.type === "monthly") {
      return await monthlyReset();
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

      // Команды бота
      if (text === "/start") {
        await handleStartCommand(message);
      } else if (text === "/get") {
        await handleGetCommand(message);
      } else if (text === "/comeback") {
        await handleComebackCommand(message);
      } else if (/\B#daily\b/i.test(text)) {
        await handleDailyPost(message);
      } else if (chatType === "private" && message.from.id === OWNER_TELEGRAM_ID && ["/daily", "/remind", "/month"].includes(text)) {
        await handleOwnerCommands(message);
      }
    }
    // Обработка chat_member (добавление/удаление участников)
    else if (update.chat_member) {
      await updateUserFromChatMember(update.chat_member);
    }
    // Другие типы обновлений (можно добавить обработку callback_query, если потребуется)
  } catch (error) {
    console.error("Error processing update:", error);
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
