// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { updateUserFromChatMember, sendDirectMessage, findUserByTelegramId, registerUser } from "./userHandler.ts";
import { handleDailyPost } from "./postHandler.ts";
import { MSG_START, MSG_GET_CHAT_ID, MSG_COMEBACK_RECEIVED, OWNER_TELEGRAM_ID } from "../constants.ts";
import { dailyCron, monthlyReset, publicDeadlineReminder } from "../cron/cron.ts";

// Переменные окружения и API Telegram остаются здесь, так как они общие
// const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
// const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
// Supabase клиент будет инициализироваться в каждом обработчике по необходимости или передан

console.log("Bot function started.");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let update;
  try {
    update = await req.json();
  } catch (e) {
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }

  try {
    if (update.message) {
      const message = update.message;
      const text = message.text || message.caption || "";
      const chatType = message.chat.type;

      // Сообщения с тегом #daily
      if (text === "/start") {
        let user = await findUserByTelegramId(message.from.id);
        if (!user) {
          await registerUser(message.from);
        }
        await sendDirectMessage(message.from.id, MSG_START);
      }
      // Команда /get — прислать ID чата
      if (text === "/get") {
        // Отправляем ID чата в ответ на команду
        const chatId = message.chat.id;
        // Используем Telegram API напрямую, чтобы поддержать parse_mode: HTML
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
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
      // Команда /comeback — ответить сообщением о пробном сезоне
      if (text === "/comeback") {
        await sendDirectMessage(message.from.id, MSG_COMEBACK_RECEIVED);
      }
      if (/\B#daily\b/i.test(text)) {
        await handleDailyPost(message);
      }
      // Команды для владельца бота
      if (chatType === "private" && message.from.id === OWNER_TELEGRAM_ID) {
        if (text === "/daily") {
          const res = await dailyCron();
          let report = "Статистика dailyCron:\n";
          try {
            const data = await res.json();
            if (data.livesDeductedUsers?.length) {
              report += `\nСписали жизни (${data.livesDeductedUsers.length}):\n` + data.livesDeductedUsers.map(u => `@${u.username} — ${u.lives} жизней`).join("\n") + "\n";
            }
            if (data.penaltiesStartedUsers?.length) {
              report += `\nНазначили штрафы (${data.penaltiesStartedUsers.length}):\n` + data.penaltiesStartedUsers.map(u => `@${u}`).join(", ") + "\n";
            }
            if (data.kickedUsers?.length) {
              report += `\nУдалены из чата (${data.kickedUsers.length}):\n` + data.kickedUsers.map(u => `@${u}`).join(", ") + "\n";
            }
            report += `\nВсего: списано жизней — ${data.livesDeducted}, штрафов — ${data.penaltiesStarted}, удалено — ${data.kicked}`;
          } catch {
            report += `\nОшибка разбора статистики. Код: ${res.status}`;
          }
          await sendDirectMessage(message.from.id, report);
        } else if (text === "/remind") {
          const res = await publicDeadlineReminder();
          let report = "Статистика publicReminder:\n";
          try {
            const data = await res.json();
            if (data.usernames?.length) {
              report += `\nНапомнили (${data.usernames.length}):\n` + data.usernames.map(u => `@${u}`).join(", ") + "\n";
            }
            if (data.timeLeftMsg) {
              report += `\n${data.timeLeftMsg}`;
            }
          } catch {
            report += `\nОшибка разбора статистики. Код: ${res.status}`;
          }
          await sendDirectMessage(message.from.id, report);
        } else if (text === "/month") {
          const res = await monthlyReset();
          let report = "Статистика monthlyReset:\n";
          try {
            const data = await res.json();
            if (data.resetUsers?.length) {
              report += `\nСбросили жизни (${data.resetUsers.length}):\n` + data.resetUsers.map(u => `@${u.username} — ${u.lives} жизней`).join("\n") + "\n";
            }
          } catch {
            report += `\nОшибка разбора статистики. Код: ${res.status}`;
          }
          await sendDirectMessage(message.from.id, report);
        }
      }
      // Другие сообщения (можно добавить обработку скриншотов и др.)
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
