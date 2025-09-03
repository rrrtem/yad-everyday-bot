import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage, findUserByTelegramId } from "../../userHandler.ts";
import { OnboardingScenario } from "../../onboarding/OnboardingScenario.ts";
import { 
  MSG_WELCOME_RETURNING
} from "../../constants.ts";

/**
 * Flow для возвращающихся пользователей
 */
export class ReturningUserFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, hasSavedDays, daysLeft } = context;
    
    // Все возвращающиеся пользователи проходят настройку заново
    // Просто информируем о наличии сохраненных дней
    await sendDirectMessage(telegramId, MSG_WELCOME_RETURNING(hasSavedDays, daysLeft));
    const user = await findUserByTelegramId(telegramId);
    if (user && !user.in_chat) {
      await OnboardingScenario.runOnboarding(telegramId);
    }
  }
} 