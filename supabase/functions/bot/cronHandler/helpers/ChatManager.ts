import { removeUserFromChatWithoutBan } from "../../constants.ts";
import { sendDirectMessage } from "../../userHandler.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_GROUP_CHAT_ID = Deno.env.get("TELEGRAM_GROUP_CHAT_ID");

if (!TELEGRAM_GROUP_CHAT_ID) {
  throw new Error("TELEGRAM_GROUP_CHAT_ID is not set in environment variables!");
}

/**
 * Менеджер для работы с чатом - удаление пользователей и отправка сообщений
 */
export class ChatManager {
  /**
   * Удаление пользователя из чата без бана
   */
  static async removeUserFromChat(userId: number): Promise<void> {
    await removeUserFromChatWithoutBan(userId, TELEGRAM_GROUP_CHAT_ID, TELEGRAM_BOT_TOKEN);
  }

  /**
   * Отправка личного сообщения пользователю
   */
  static async sendDirectMessage(userId: number, message: string): Promise<void> {
    await sendDirectMessage(userId, message);
  }

  /**
   * Отправка сообщения в группу (в определенный тред)
   */
  static async sendGroupMessage(text: string, threadId?: number): Promise<boolean> {
    try {
      const requestBody: any = {
        chat_id: TELEGRAM_GROUP_CHAT_ID,
        text,
      };

      if (threadId) {
        requestBody.message_thread_id = threadId;
      }

      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        return true;
      } else {
        const errorData = await response.text();
        console.error(`❌ Ошибка отправки сообщения в группу: ${response.status} - ${errorData}`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Исключение при отправке сообщения в группу:`, err);
      return false;
    }
  }
} 