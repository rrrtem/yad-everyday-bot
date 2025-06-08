import { findUserByTelegramId, registerUser, updateExistingUser } from "../userHandler.ts";
import { NewUserFlow } from "./flows/NewUserFlow.ts";
import { ReturningUserFlow } from "./flows/ReturningUserFlow.ts";
import { ContinueSetupFlow } from "./flows/ContinueSetupFlow.ts";
import { ActiveUserFlow } from "./flows/ActiveUserFlow.ts";
import { WaitlistFlow } from "./flows/WaitlistFlow.ts";
import { UserAnalyzer } from "./UserAnalyzer.ts";

/**
 * Главный обработчик команды /start
 * Определяет тип пользователя и делегирует обработку соответствующему Flow
 */
export async function handleStartCommand(message: any): Promise<void> {
  const telegramId = message.from.id;
  
  // Шаг 1: Анализ пользователя
  const analyzer = new UserAnalyzer();
  const userContext = await analyzer.analyze(telegramId, message.from);
  
  // Шаг 2: Делегирование обработки соответствующему Flow
  switch (userContext.flowType) {
    case 'new_user':
      await NewUserFlow.handle(userContext);
      break;
      
    case 'active_user':
      await ActiveUserFlow.handle(userContext);
      break;
      
    case 'continue_setup':
      await ContinueSetupFlow.handle(userContext);
      break;
      
    case 'returning_user':
      await ReturningUserFlow.handle(userContext);
      break;
      
    case 'in_waitlist':
      await WaitlistFlow.handle(userContext);
      break;
      
    default:
      console.error(`Unknown flow type: ${userContext.flowType}`);
      break;
  }
}

/**
 * Обработчик callback query от inline кнопок
 */
export async function handleStartCallbackQuery(callbackQuery: any): Promise<void> {
  const data = callbackQuery.data;
  const telegramId = callbackQuery.from.id;
  
  // Импортируем обработчики состояний
  const { StateHandlers } = await import("./states/index.ts");
  
  if (data.startsWith("mode_")) {
    await StateHandlers.handleModeSelection(telegramId, data.replace("mode_", ""));
  } else if (data === "no_promo") {
    await StateHandlers.handleNoPromo(telegramId);
  } else if (data === "have_promo") {
    await StateHandlers.handleHavePromo(telegramId);
  }
  
  // Отвечаем на callback query
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQuery.id
    })
  });
}

// Дополнительные экспорты для удобства импорта
export { handleModeSelection, handlePromoCode, handleNoPromo, handleHavePromo } from "./states/index.ts"; 