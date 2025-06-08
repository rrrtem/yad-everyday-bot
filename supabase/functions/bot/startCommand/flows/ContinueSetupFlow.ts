import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "../states/SetupProcess.ts";
import { 
  MSG_CONTINUE_MODE_SELECTION,
  MSG_CONTINUE_PROMO_INPUT,
  MSG_CONTINUE_PAYMENT_PENDING,
  MSG_WELCOME,
  DEFAULT_PAYMENT_URL,
  SPECIAL_PAYMENT_URL
} from "../../constants.ts";
import { findUserByTelegramId } from "../../userHandler.ts";

/**
 * Flow для продолжения процесса настройки
 */
export class ContinueSetupFlow {
  
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, user } = context;
    const userState = user.user_state;
    
    switch (userState) {
      case "waiting_mode":
        await this.handleWaitingMode(telegramId);
        break;
        
      case "waiting_promo":
        await this.handleWaitingPromo(telegramId);
        break;
        
      case "payment_link_sent":
        await this.handlePaymentLinkSent(telegramId);
        break;
        
      default:
        // Неизвестное состояние - начинаем процесс заново
        await this.resetAndRestart(telegramId);
        break;
    }
  }
  
  private static async handleWaitingMode(telegramId: number): Promise<void> {
    await sendDirectMessage(telegramId, MSG_CONTINUE_MODE_SELECTION);
    await SetupProcess.sendModeSelection(telegramId);
  }
  
  private static async handleWaitingPromo(telegramId: number): Promise<void> {
    await sendDirectMessage(telegramId, MSG_CONTINUE_PROMO_INPUT);
    await SetupProcess.sendPromoSelection(telegramId);
  }
  
  private static async handlePaymentLinkSent(telegramId: number): Promise<void> {
    // Определяем какую ссылку на оплату показать пользователю
    const paymentLink = await this.getPaymentLinkForUser(telegramId);
    await sendDirectMessage(telegramId, MSG_CONTINUE_PAYMENT_PENDING(paymentLink));
  }
  
  private static async resetAndRestart(telegramId: number): Promise<void> {
    await this.clearUserState(telegramId);
    await sendDirectMessage(telegramId, MSG_WELCOME);
    await SetupProcess.startModeSelection(telegramId);
  }
  
  private static async getPaymentLinkForUser(telegramId: number): Promise<string> {
    try {
      const user = await findUserByTelegramId(telegramId);
      
      // Определяем ссылку на основе статуса клуба
      if (user && user.club === true) {
        return SPECIAL_PAYMENT_URL;
      } else {
        return DEFAULT_PAYMENT_URL;
      }
    } catch (error) {
      console.error("Ошибка при определении ссылки на оплату:", error);
      // Возвращаем стандартную ссылку в случае ошибки
      return DEFAULT_PAYMENT_URL;
    }
  }

  private static async clearUserState(telegramId: number): Promise<void> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    await supabase
      .from("users")
      .update({
        user_state: null,
        updated_at: now
      })
      .eq("telegram_id", telegramId);
  }
} 