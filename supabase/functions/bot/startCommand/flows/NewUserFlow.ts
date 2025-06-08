import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "../states/SetupProcess.ts";
import { MSG_WELCOME } from "../../constants.ts";
import { WaitlistFlow } from "./WaitlistFlow.ts";

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
    
    // Проверяем, есть ли свободные места
    const shouldWaitlist = await WaitlistFlow.shouldAddToWaitlist();
    console.log(`NewUserFlow: shouldWaitlist=${shouldWaitlist}`);
    
    if (shouldWaitlist) {
      // Нет свободных мест - добавляем в waitlist
      console.log(`NewUserFlow: Добавляем пользователя ${telegramId} в waitlist`);
      await WaitlistFlow.handle(context);
    } else {
      // Есть свободные места - запускаем процесс настройки режима
      console.log(`NewUserFlow: Есть свободные места, запускаем настройку для пользователя ${telegramId}`);
      await SetupProcess.startModeSelection(telegramId);
    }
  }
} 