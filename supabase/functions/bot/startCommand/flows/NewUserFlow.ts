import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { OnboardingScenario } from "../../onboarding/OnboardingScenario.ts";
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

    // Уведомляем администраторов о новом пользователе
    const { ADMIN_TELEGRAM_IDS } = await import("../../constants.ts");
    const username = context.telegramUserData.username ? `@${context.telegramUserData.username}` : "без ника";
    const notifyMsg = `Новый пользователь: ${username} (id: ${telegramId})`;
    for (const adminId of ADMIN_TELEGRAM_IDS) {
      try {
        await sendDirectMessage(adminId, notifyMsg);
      } catch (e) {
        console.error(`Ошибка отправки уведомления админу ${adminId}:`, e);
      }
    }

    // Проверяем, нужно ли добавлять в waitlist
    const shouldWaitlist = await WaitlistFlow.shouldAddToWaitlist();
    // console.log(`NewUserFlow: shouldWaitlist=${shouldWaitlist}`);
    
    if (shouldWaitlist) {
      // console.log(`NewUserFlow: Добавляем пользователя ${telegramId} в waitlist`);
      await WaitlistFlow.handle(context);
    } else {
      // console.log(`NewUserFlow: Есть свободные места, запускаем новый сценарий онбординга для пользователя ${telegramId}`);
      await OnboardingScenario.runOnboarding(telegramId);
    }
  }
} 