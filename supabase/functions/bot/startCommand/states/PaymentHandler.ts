import { sendDirectMessage, findUserByTelegramId } from "../../userHandler.ts";
import { SetupProcess } from "./SetupProcess.ts";
import { SlotManager } from "../flows/SlotManager.ts";
import { 
  MSG_DIRECT_CHAT_LINK,
  MSG_LINK_CLUB,
  MSG_LINK_STANDARD,
  SPECIAL_PAYMENT_URL,
  DEFAULT_PAYMENT_URL,
  CHALLENGE_JOIN_LINK,
  CALLBACK_PAYMENT_CLUB,
  CALLBACK_PAYMENT_STANDARD,
  CALLBACK_JOIN_CHAT,
  CALLBACK_RESET,
  BUTTON_TEXT_RESET
} from "../../constants.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Обработчик платежей и проверки статуса клуба
 */
export class PaymentHandler {
  
  /**
   * Проверяет статус клуба и отправляет соответствующую ссылку на оплату
   */
  static async checkStatusAndSendPayment(telegramId: number): Promise<void> {
    try {
      const user = await findUserByTelegramId(telegramId);
      
      // Проверяем сохраненные дни подписки
      if (await this.hasUnusedSubscriptionDays(user)) {
        const daysLeft = user.subscription_days_left || 0;
        await this.sendDirectChatLinkWithButton(telegramId, daysLeft);
        // Очищаем состояние, так как процесс завершен
        await this.clearUserState(telegramId);
        return;
      }
      
      // Затем проверяем статус клуба
      if (user.club === true) {
        // Пользователь в клубе - отправляем специальную ссылку
        await this.sendClubPaymentLink(telegramId);
      } else {
        // Обычный пользователь - спрашиваем про промокод
        await SetupProcess.sendPromoSelection(telegramId);
      }
      
    } catch (error) {
      console.error("Ошибка в PaymentHandler.checkStatusAndSendPayment:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Отправляет сообщение о прямом входе в чат с кнопкой
   */
  static async sendDirectChatLinkWithButton(telegramId: number, daysLeft: number): Promise<void> {
    try {
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
          text: MSG_DIRECT_CHAT_LINK(daysLeft),
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
    } catch (error) {
      console.error("Ошибка в PaymentHandler.sendDirectChatLinkWithButton:", error);
      await sendDirectMessage(telegramId, MSG_DIRECT_CHAT_LINK(daysLeft));
    }
  }
  
  /**
   * Отправляет стандартную ссылку на оплату с кнопками
   */
  static async sendStandardPaymentLink(telegramId: number): Promise<void> {
    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: "💳 Перейти к оплате", url: DEFAULT_PAYMENT_URL }],
          [{ text: "🎫 У меня есть промокод", callback_data: "have_promo" }],
          [{ text: BUTTON_TEXT_RESET, callback_data: CALLBACK_RESET }]
        ]
      };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: MSG_LINK_STANDARD(DEFAULT_PAYMENT_URL),
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
      
      // Фиксируем этап отправки ссылки на оплату
      await this.recordPaymentLinkSent(telegramId);
    } catch (error) {
      console.error("Ошибка в PaymentHandler.sendStandardPaymentLink:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
  
  /**
   * Отправляет клубную ссылку на оплату с кнопкой
   */
  static async sendClubPaymentLink(telegramId: number): Promise<void> {
    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: "💳 Перейти к оплате (спец. цена)", url: SPECIAL_PAYMENT_URL }],
          [{ text: "🎫 У меня есть промокод", callback_data: "have_promo" }],
          [{ text: BUTTON_TEXT_RESET, callback_data: CALLBACK_RESET }]
        ]
      };
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: MSG_LINK_CLUB(SPECIAL_PAYMENT_URL),
          parse_mode: "HTML",
          reply_markup: keyboard
        })
      });
      
      // Фиксируем этап отправки ссылки на оплату (клуб)
      await this.recordPaymentLinkSent(telegramId);
    } catch (error) {
      console.error("Ошибка в PaymentHandler.sendClubPaymentLink:", error);
      await sendDirectMessage(telegramId, MSG_LINK_CLUB(SPECIAL_PAYMENT_URL));
    }
  }
  
  /**
   * Проверяет, есть ли у пользователя неиспользованные дни подписки
   */
  private static async hasUnusedSubscriptionDays(user: any): Promise<boolean> {
    if (!user.subscription_days_left) return false;
    return user.subscription_days_left > 0;
  }
  
  /**
   * Записывает дату отправки ссылки на оплату
   */
  private static async recordPaymentLinkSent(telegramId: number): Promise<void> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    await supabase
      .from("users")
      .update({
        payment_link_sent: now,
        user_state: "payment_link_sent",
        updated_at: now
      })
      .eq("telegram_id", telegramId);
      
    // УБИРАЕМ уменьшение слотов отсюда - это должно происходить 
    // при реальном входе в чат после оплаты
    // await SlotManager.decreaseAvailableSlots();
  }
  
  /**
   * Очищает состояние пользователя
   */
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