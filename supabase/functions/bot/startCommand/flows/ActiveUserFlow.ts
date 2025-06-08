import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { MSG_WELCOME_ALREADY_ACTIVE } from "../../constants.ts";

/**
 * Flow для уже активных пользователей
 */
export class ActiveUserFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId } = context;
    
    await sendDirectMessage(telegramId, MSG_WELCOME_ALREADY_ACTIVE);
  }
} 