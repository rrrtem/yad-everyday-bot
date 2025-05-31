import { sendDirectMessage, findUserByTelegramId, registerUser } from "./userHandler.ts";
import { MSG_START, MSG_GET_CHAT_ID, MSG_COMEBACK_RECEIVED, OWNER_TELEGRAM_ID } from "../constants.ts";
import { dailyCron, monthlyReset, publicDeadlineReminder } from "./cronHandler.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Обрабатывает команду /start
 */
export async function handleStartCommand(message: any): Promise<void> {
  let user = await findUserByTelegramId(message.from.id);
  if (!user) {
    await registerUser(message.from);
  }
  await sendDirectMessage(message.from.id, MSG_START);
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