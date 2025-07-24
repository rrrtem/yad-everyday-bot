import { sendDirectMessage } from "../../userHandler.ts";
import { PaymentHandler } from "./PaymentHandler.ts";
import { SetupProcess } from "./SetupProcess.ts";
import { 
  MSG_PROMO_ERR,
  VALID_PROMO_CODES,
  PROMO_TYPES,
  FREE_PROMO_DAYS,
  MSG_FREE_PROMO_SUCCESS,
  CHALLENGE_JOIN_LINK,
  CALLBACK_RESET,
  BUTTON_TEXT_RESET
} from "../../constants.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Обработчик промокодов
 */
export class PromoCodeHandler {
  
  /**
   * Обрабатывает промокод от пользователя
   * Проверка промокодов происходит без учета регистра - можно вводить в любом регистре
   */
  static async handlePromoCode(telegramId: number, promoCode: string): Promise<void> {
    // console.log(`PromoCodeHandler: пользователь ${telegramId} ввел промокод "${promoCode}"`);
    // console.log(`PromoCodeHandler: валидные промокоды:`, VALID_PROMO_CODES);
    
    if (VALID_PROMO_CODES.includes(promoCode)) {
      // console.log(`PromoCodeHandler: промокод "${promoCode}" валидный`);
      
      if (promoCode === PROMO_TYPES.CLUB_DISCOUNT) {
        await this.handleClubDiscountPromo(telegramId, promoCode);
      } else if (promoCode === PROMO_TYPES.FREE_DAYS) {
        await this.handleFreeDaysPromo(telegramId, promoCode);
      } else if (promoCode === PROMO_TYPES.TRY_DAYS) {
        await this.handleTryDaysPromo(telegramId, promoCode);
      } else if (promoCode === PROMO_TYPES.TEN_DAYS) {
        await this.handleTenDaysPromo(telegramId, promoCode);
      } else if (promoCode === PROMO_TYPES.HUNDRED_DAYS) {
        await this.handleHundredDaysPromo(telegramId, promoCode);
      } else {
        // Неизвестный тип промокода (shouldn't happen if constants are correct)
        await sendDirectMessage(telegramId, MSG_PROMO_ERR);
        await this.sendPromoErrorWithResetButton(telegramId);
      }
    } else {
      // console.log(`PromoCodeHandler: промокод "${promoCode}" невалидный`);
      await this.sendPromoErrorWithResetButton(telegramId);
      await setWaitingPromoState(telegramId);
      // console.log(`PromoCodeHandler: отправлено сообщение об ошибке, состояние ожидания сохранено`);
    }

    try {
      await clearUserState(telegramId);
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
  
  /**
   * Обрабатывает промокод YASSS - дает скидку для участников клуба
   */
  private static async handleClubDiscountPromo(telegramId: number, promoCode: string): Promise<void> {
    try {
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
        console.error(`PromoCodeHandler: ошибка обновления БД для клубного промокода:`, error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
        
      await PaymentHandler.sendClubPaymentLink(telegramId);
      // console.log(`PromoCodeHandler: отправлена клубная ссылка для пользователя ${telegramId}`);
      
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleClubDiscountPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Обрабатывает промокод FREE10 - дает бесплатные дни подписки
   */
  private static async handleFreeDaysPromo(telegramId: number, promoCode: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      
      // Начисляем бесплатные дни подписки
      const { error } = await supabase
        .from("users")
        .update({
          subscription_days_left: FREE_PROMO_DAYS,
          promo_code: promoCode.toUpperCase(),
          user_state: null, // Очищаем состояние
          updated_at: now
        })
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error(`PromoCodeHandler: ошибка обновления БД для промокода бесплатных дней:`, error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
      
      // Отправляем специальное сообщение для промокода FREE10 с кнопкой входа в чат
      await this.sendFreePromoSuccessMessage(telegramId, FREE_PROMO_DAYS);
      // console.log(`PromoCodeHandler: начислено ${FREE_PROMO_DAYS} бесплатных дней и отправлена прямая ссылка для пользователя ${telegramId}`);
      
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleFreeDaysPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Обрабатывает промокод TRY - даёт 3 бесплатных дня подписки
   */
  private static async handleTryDaysPromo(telegramId: number, promoCode: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      const { TRY_PROMO_DAYS } = await import("../../constants.ts");
      // Начисляем бесплатные дни подписки
      const { error } = await supabase
        .from("users")
        .update({
          subscription_days_left: TRY_PROMO_DAYS,
          promo_code: promoCode.toUpperCase(),
          user_state: null, // Очищаем состояние
          updated_at: now
        })
        .eq("telegram_id", telegramId);
      if (error) {
        console.error(`PromoCodeHandler: ошибка обновления БД для TRY промокода:`, error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
      // Отправляем специальное сообщение для TRY с кнопкой входа в чат
      await this.sendFreePromoSuccessMessage(telegramId, TRY_PROMO_DAYS);
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleTryDaysPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Обрабатывает промокод TEN - даёт 10 бесплатных дней подписки
   */
  private static async handleTenDaysPromo(telegramId: number, promoCode: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      const { TEN_PROMO_DAYS } = await import("../../constants.ts");
      // Начисляем бесплатные дни подписки
      const { error } = await supabase
        .from("users")
        .update({
          subscription_days_left: TEN_PROMO_DAYS,
          promo_code: promoCode.toUpperCase(),
          user_state: null, // Очищаем состояние
          updated_at: now
        })
        .eq("telegram_id", telegramId);
      if (error) {
        console.error(`PromoCodeHandler: ошибка обновления БД для TEN промокода:`, error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
      // Отправляем специальное сообщение для TEN с кнопкой входа в чат
      await this.sendFreePromoSuccessMessage(telegramId, TEN_PROMO_DAYS);
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleTenDaysPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }

  /**
   * Обрабатывает промокод DOYOUKNOWWHOIAM - даёт 100 бесплатных дней подписки
   */
  private static async handleHundredDaysPromo(telegramId: number, promoCode: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      const { HUNDRED_PROMO_DAYS } = await import("../../constants.ts");
      // Начисляем бесплатные дни подписки
      const { error } = await supabase
        .from("users")
        .update({
          subscription_days_left: HUNDRED_PROMO_DAYS,
          promo_code: promoCode.toUpperCase(),
          user_state: null, // Очищаем состояние
          updated_at: now
        })
        .eq("telegram_id", telegramId);
      if (error) {
        console.error(`PromoCodeHandler: ошибка обновления БД для HUNDRED промокода:`, error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
      // Отправляем специальное сообщение для HUNDRED с кнопкой входа в чат
      await this.sendFreePromoSuccessMessage(telegramId, HUNDRED_PROMO_DAYS);
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.handleHundredDaysPromo:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Отправляет специальное сообщение об успешной активации промокода FREE10
   */
  private static async sendFreePromoSuccessMessage(telegramId: number, daysLeft: number): Promise<void> {
    try {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: "🚀 Войти в чат участников", url: CHALLENGE_JOIN_LINK }]
        ]
      };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: MSG_FREE_PROMO_SUCCESS(daysLeft),
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.sendFreePromoSuccessMessage:", error);
      // Fallback - отправляем обычное сообщение
      await sendDirectMessage(telegramId, MSG_FREE_PROMO_SUCCESS(daysLeft));
    }
  }

  /**
   * Отправляет сообщение об ошибке промокода с кнопкой "начать заново"
   */
  private static async sendPromoErrorWithResetButton(telegramId: number): Promise<void> {
    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: BUTTON_TEXT_RESET, callback_data: CALLBACK_RESET }]
        ]
      };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: MSG_PROMO_ERR,
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
    } catch (error) {
      console.error("Ошибка в PromoCodeHandler.sendPromoErrorWithResetButton:", error);
      // Fallback - отправляем обычное сообщение
      await sendDirectMessage(telegramId, MSG_PROMO_ERR);
    }
  }
} 