import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "../states/SetupProcess.ts";
import { 
  MSG_WELCOME_RETURNING
} from "../../../constants.ts";

/**
 * Flow для возвращающихся пользователей
 */
export class ReturningUserFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, hasSavedDays, daysLeft } = context;
    
    // Все возвращающиеся пользователи проходят настройку заново
    // Просто информируем о наличии сохраненных дней
    await sendDirectMessage(telegramId, MSG_WELCOME_RETURNING(hasSavedDays, daysLeft));
    await SetupProcess.startModeSelection(telegramId);
  }
} 