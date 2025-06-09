import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "../states/SetupProcess.ts";
import { MSG_WELCOME, MSG_NEW_USER_AUTO_START } from "../../constants.ts";
import { WaitlistFlow } from "./WaitlistFlow.ts";
import { registerUser } from "../../userHandler.ts";

/**
 * Flow для новых пользователей
 */
export class NewUserFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, autoTriggered, originalMessage } = context;
    
    if (autoTriggered && originalMessage) {
      // console.log(`NewUserFlow: Пользователь ${telegramId} написал "${originalMessage}" - автозапуск /start`);
      
      // Отправляем сообщение о автозапуске перед приветствием
      await sendDirectMessage(telegramId, MSG_NEW_USER_AUTO_START);
    } else {
      // Отправляем обычное приветствие для новых пользователей
      await sendDirectMessage(telegramId, MSG_WELCOME);
    }

    // Проверяем и создаем пользователя
    await registerUser(context.telegramUserData);

    // Проверяем, нужно ли добавлять в waitlist
    const shouldWaitlist = await WaitlistFlow.shouldAddToWaitlist();
    // console.log(`NewUserFlow: shouldWaitlist=${shouldWaitlist}`);
    
    if (shouldWaitlist) {
      // console.log(`NewUserFlow: Добавляем пользователя ${telegramId} в waitlist`);
      await WaitlistFlow.handle(context);
    } else {
      // console.log(`NewUserFlow: Есть свободные места, запускаем настройку для пользователя ${telegramId}`);
      await SetupProcess.startModeSelection(telegramId);
    }
  }
} 