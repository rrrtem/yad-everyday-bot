import { findUserByTelegramId } from "../userHandler.ts";
import {
  MENU_CMD_START,
  MENU_CMD_STATUS,
  MENU_CMD_CHANGE_MODE,
  MENU_CMD_CHANGE_PACE,
  MENU_CMD_PAUSE,
  MENU_CMD_TRIBUTE,
  MENU_CMD_REMINDER_ENABLE,
  MENU_CMD_REMINDER_DISABLE,
  MENU_CMD_REMINDER_GENERIC
} from "../constants.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Менеджер динамического меню бота
 */
export class BotMenuManager {
  
  /**
   * Обновляет меню для конкретного пользователя
   * Теперь устанавливает персонализированные команды в зависимости от состояния пользователя
   */
  static async updateUserMenu(telegramId: number): Promise<void> {
    try {
      const user = await findUserByTelegramId(telegramId);
      console.log(`BotMenuManager: User ${telegramId} state:`, {
        found: !!user,
        in_chat: user?.in_chat,
        subscription_active: user?.subscription_active,
        subscription_days_left: user?.subscription_days_left,
        public_remind: user?.public_remind
      });
      
      if (!user) {
        console.log(`BotMenuManager: User ${telegramId} not found, setting default commands`);
        await this.setDefaultCommands();
        return;
      }
      
      // Генерируем команды для пользователя
      const commands = this.generateCommandsForUser(user);
      
      // Устанавливаем команды для пользователя
      await this.setUserCommands(telegramId, commands);
      
    } catch (error) {
      console.error(`BotMenuManager: Failed to update menu for user ${telegramId}:`, error);
      // Fallback к стандартным командам
      await this.setDefaultCommands();
    }
  }
  
  /**
   * Генерирует список команд для пользователя в зависимости от его состояния
   */
  private static generateCommandsForUser(user: any): Array<{ command: string; description: string }> {
    const commands: Array<{ command: string; description: string }> = [];
    
    // Если пользователь НЕ в чате - показываем только "Начать участие"
    if (!user.in_chat) {
      commands.push({ command: "start", description: MENU_CMD_START });
      return commands;
    }
    
    // Если пользователь В чате - показываем все команды кроме "start"
    commands.push(
      { command: "status", description: MENU_CMD_STATUS },
      { command: "change_mode", description: MENU_CMD_CHANGE_MODE },
      { command: "change_pace", description: MENU_CMD_CHANGE_PACE },
      { command: "pause", description: MENU_CMD_PAUSE }
    );
    
    // Динамическая команда напоминаний - зависит от состояния public_remind
    if (user.public_remind) {
      commands.push({ command: "reminder", description: MENU_CMD_REMINDER_DISABLE });
    } else {
      commands.push({ command: "reminder", description: MENU_CMD_REMINDER_ENABLE });
    }
    
    // Всегда добавляем подписку
    commands.push({ command: "tribute", description: MENU_CMD_TRIBUTE });
    
    return commands;
  }
  
  /**
   * Устанавливает команды для конкретного пользователя
   */
  private static async setUserCommands(telegramId: number, commands: Array<{ command: string; description: string }>): Promise<void> {
    try {
      console.log(`BotMenuManager: Setting ${commands.length} commands for user ${telegramId}`);
      
      // Используем персональный scope для чата с пользователем
      const payload = {
        commands,
        scope: {
          type: "chat",
          chat_id: telegramId
        }
      };
      
      console.log(`BotMenuManager: Commands for user ${telegramId}:`, commands.map(c => `/${c.command} - ${c.description}`));
      
      const response = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error(`BotMenuManager: Error setting user commands for ${telegramId}:`, result);
      } else {
        console.log(`BotMenuManager: Successfully set personalized commands for user ${telegramId}`);
      }
    } catch (error) {
      console.error(`BotMenuManager: Failed to set user commands for ${telegramId}:`, error);
    }
  }
  
  /**
   * Устанавливает универсальные команды для всех пользователей (fallback)
   * Используется как запасной вариант
   */
  static async setDefaultCommands(): Promise<void> {
    try {
      const commands = [
        { command: "start", description: MENU_CMD_START },
        { command: "status", description: MENU_CMD_STATUS },
        { command: "change_mode", description: MENU_CMD_CHANGE_MODE },
        { command: "change_pace", description: MENU_CMD_CHANGE_PACE },
        { command: "pause", description: MENU_CMD_PAUSE },
        { command: "reminder", description: MENU_CMD_REMINDER_GENERIC },
        { command: "tribute", description: MENU_CMD_TRIBUTE }
      ];
      
      const response = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error setting default commands:`, error);
      } else {
        console.log("Default commands set successfully");
      }
    } catch (error) {
      console.error(`Failed to set default commands:`, error);
    }
  }
  
  /**
   * Удаляет персонализированные команды для пользователя (возвращает к глобальным)
   */
  static async clearUserCommands(telegramId: number): Promise<void> {
    try {
      const response = await fetch(`${TELEGRAM_API}/deleteMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: {
            type: "chat",
            chat_id: telegramId
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error clearing user commands:`, error);
      } else {
        // console.log(`Commands cleared for user ${telegramId}`);
      }
    } catch (error) {
      console.error(`Failed to clear user commands:`, error);
    }
  }
  
  /**
   * Принудительно очищает все команды бота (для сброса кэша)
   */
  static async clearAllCommands(): Promise<void> {
    try {
      // console.log("Очистка всех команд бота...");
      
      const response = await fetch(`${TELEGRAM_API}/deleteMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error(`Error clearing all commands:`, result);
      } else {
        // console.log(`All commands cleared successfully:`, result);
      }
    } catch (error) {
      console.error(`Failed to clear all commands:`, error);
    }
  }
} 