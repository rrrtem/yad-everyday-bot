import { ModeSelectionHandler } from "./ModeSelectionHandler.ts";
import { PromoCodeHandler } from "./PromoCodeHandler.ts";
import { PaymentHandler } from "./PaymentHandler.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { MSG_RESET_SUCCESS } from "../../constants.ts";

/**
 * Централизованные обработчики состояний
 */
export class StateHandlers {
  
  static async handleModeSelection(telegramId: number, mode: string): Promise<void> {
    await ModeSelectionHandler.handle(telegramId, mode);
  }
  
  static async handlePromoCode(telegramId: number, promoCode: string): Promise<void> {
    await PromoCodeHandler.handlePromoCode(telegramId, promoCode);
  }
  
  static async handleNoPromo(telegramId: number): Promise<void> {
    await PromoCodeHandler.handleNoPromo(telegramId);
  }
  
  static async handleHavePromo(telegramId: number): Promise<void> {
    await PromoCodeHandler.handleHavePromo(telegramId);
  }
  
  static async handleReset(telegramId: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      
      // Сбрасываем поля процесса регистрации (как в commandHandler.ts)
      const { error } = await supabase
        .from("users")
        .update({
          user_state: null,
          mode: null,
          pace: null,
          promo_code: null,
          updated_at: now
        })
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error("Ошибка при сбросе настроек пользователя из StateHandlers:", error);
        await sendDirectMessage(telegramId, "Произошла ошибка при сбросе настроек. Попробуй еще раз или напиши @rrrtem");
        return;
      }
      
      // Отправляем подтверждение
      await sendDirectMessage(telegramId, MSG_RESET_SUCCESS);
      
    } catch (error) {
      console.error("Ошибка в StateHandlers.handleReset:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка при сбросе настроек. Попробуй еще раз или напиши @rrrtem");
    }
  }
}

// Экспорт функций для удобства импорта
export const handleModeSelection = StateHandlers.handleModeSelection;
export const handlePromoCode = StateHandlers.handlePromoCode;
export const handleNoPromo = StateHandlers.handleNoPromo;
export const handleHavePromo = StateHandlers.handleHavePromo;
export const handleReset = StateHandlers.handleReset; 