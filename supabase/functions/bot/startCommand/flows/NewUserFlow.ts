import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "../states/SetupProcess.ts";
import { MSG_WELCOME } from "../../../constants.ts";

/**
 * Flow для новых пользователей
 */
export class NewUserFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, isNewUser } = context;
    
    // Отправляем приветственное сообщение
    if (isNewUser) {
      await sendDirectMessage(telegramId, MSG_WELCOME);
    } else {
      // Существующий в БД, но новый для чата пользователь
      await sendDirectMessage(telegramId, MSG_WELCOME);
    }
    
    // Запускаем процесс настройки режима
    await SetupProcess.startModeSelection(telegramId);
  }
} 