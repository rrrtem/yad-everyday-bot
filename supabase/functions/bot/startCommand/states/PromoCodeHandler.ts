import { sendDirectMessage } from "../../userHandler.ts";
import { PaymentHandler } from "./PaymentHandler.ts";
import { SetupProcess } from "./SetupProcess.ts";
import { 
  MSG_PROMO_ERR,
  VALID_PROMO_CODES
} from "../../../constants.ts";

/**
 * Обработчик промокодов
 */
export class PromoCodeHandler {
  
  /**
   * Обрабатывает промокод от пользователя
   */
  static async handlePromoCode(telegramId: number, promoCode: string): Promise<void> {
    try {
      console.log(`PromoCodeHandler: пользователь ${telegramId} ввел промокод "${promoCode}"`);
      console.log(`PromoCodeHandler: валидные промокоды:`, VALID_PROMO_CODES);
      
      if (VALID_PROMO_CODES.includes(promoCode.toUpperCase())) {
        console.log(`PromoCodeHandler: промокод "${promoCode}" валидный`);
        
        // Промокод валидный
        const now = new Date().toISOString();
        
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
        
        const { error } = await supabase
          .from("users")
          .update({
            club: true,
            promo_code: promoCode.toUpperCase(),
            user_state: null, // Очищаем состояние
            updated_at: now
          })
          .eq("telegram_id", telegramId);
          
        if (error) {
          console.error(`PromoCodeHandler: ошибка обновления БД:`, error);
          await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
          return;
        }
          
        await PaymentHandler.sendClubPaymentLink(telegramId);
        console.log(`PromoCodeHandler: отправлена клубная ссылка для пользователя ${telegramId}`);
        
      } else {
        console.log(`PromoCodeHandler: промокод "${promoCode}" невалидный`);
        // Промокод невалидный - НЕ очищаем состояние, пользователь может попробовать еще раз
        await sendDirectMessage(telegramId, MSG_PROMO_ERR);
        // Не вызываем sendPromoSelection повторно, пользователь уже в состоянии ожидания
        console.log(`PromoCodeHandler: отправлено сообщение об ошибке, состояние ожидания сохранено`);
      }
      
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handlePromoCode:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Обрабатывает отсутствие промокода
   */
  static async handleNoPromo(telegramId: number): Promise<void> {
    try {
      // Очищаем состояние ожидания промокода
      const now = new Date().toISOString();
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      
      await supabase
        .from("users")
        .update({
          user_state: null,
          updated_at: now
        })
        .eq("telegram_id", telegramId);
        
      await PaymentHandler.sendStandardPaymentLink(telegramId);
      
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleNoPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Обрабатывает возврат к выбору промокода (когда пользователь нажимает "У меня есть промокод")
   */
  static async handleHavePromo(telegramId: number): Promise<void> {
    try {
      // Возвращаем пользователя к выбору промокода
      await SetupProcess.sendPromoSelection(telegramId);
      
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleHavePromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
} 