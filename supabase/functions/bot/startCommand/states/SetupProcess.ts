import { 
  MSG_MODE, 
  MSG_PAYMENT_COND,
  MSG_PROMO,
  AVAILABLE_MODES
} from "../../../constants.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Управление процессом настройки пользователя
 */
export class SetupProcess {
  
  /**
   * Запускает процесс выбора режима
   */
  static async startModeSelection(telegramId: number): Promise<void> {
    await this.updateUserState(telegramId, "waiting_mode");
    await this.sendModeSelection(telegramId);
  }
  
  /**
   * Отправляет сообщение с выбором режима участия
   */
  static async sendModeSelection(telegramId: number): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 Тексты", callback_data: `mode_${AVAILABLE_MODES.TEXT}` },
          { text: "📸 Картинки", callback_data: `mode_${AVAILABLE_MODES.IMAGE}` }
        ]
      ]
    };
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: MSG_MODE,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
  }
  
  /**
   * Отправляет сообщение с выбором промокода
   */
  static async sendPromoSelection(telegramId: number): Promise<void> {
    await this.updateUserState(telegramId, "waiting_promo");
    
    const keyboard = {
      inline_keyboard: [
        [{ text: "💳 У меня нет промокода", callback_data: "no_promo" }]
      ]
    };
    
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: MSG_PROMO + "\n\n<i>Введи промокод текстом или нажми кнопку ниже.</i>",
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
  }
  
  /**
   * Отправляет объяснение оплаты
   */
  static async sendPaymentConditions(telegramId: number): Promise<void> {
    const { sendDirectMessage } = await import("../../userHandler.ts");
    await sendDirectMessage(telegramId, MSG_PAYMENT_COND);
  }
  
  /**
   * Обновляет состояние пользователя в БД
   */
  private static async updateUserState(telegramId: number, state: string): Promise<void> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    await supabase
      .from("users")
      .update({
        user_state: state,
        updated_at: now
      })
      .eq("telegram_id", telegramId);
  }
} 