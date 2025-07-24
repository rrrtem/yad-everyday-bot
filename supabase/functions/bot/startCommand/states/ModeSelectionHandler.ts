import { sendDirectMessage } from "../../userHandler.ts";
import { SetupProcess } from "./SetupProcess.ts";
import { PaymentHandler } from "./PaymentHandler.ts";
import { AVAILABLE_PACES } from "../../constants.ts";

/**
 * Обработчик выбора режима пользователя
 */
export class ModeSelectionHandler {
  
  static async handle(telegramId: number, mode: string): Promise<void> {
    try {
      // Сохраняем выбранный режим и автоматически назначаем daily ритм
      const now = new Date().toISOString();
      
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
      
      // Фиксируем этап выбора режима
      await SetupProcess.updateUserState(telegramId, 'waiting_mode');

      const { error } = await supabase
        .from("users")
        .update({
          mode: mode,
          mode_changed_at: now,
          pace: AVAILABLE_PACES.DAILY, // Автоматически назначаем daily
          pace_changed_at: now,
          user_state: null, // Очищаем состояние сразу
          updated_at: now
        })
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error("Ошибка сохранения режима:", error);
        await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
        return;
      }
      
      // Отправляем объяснение оплаты
      await SetupProcess.sendPaymentConditions(telegramId);
      
      // Проверяем статус клуба и отправляем соответствующую ссылку на оплату
      await PaymentHandler.checkStatusAndSendPayment(telegramId);
      
    } catch (error) {
      console.error("Ошибка в ModeSelectionHandler:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз.");
    }
  }
} 