import { UserContext } from "../UserAnalyzer.ts";
import { sendDirectMessage } from "../../userHandler.ts";
import { MSG_WAITLIST } from "../../../constants.ts";
import { SlotManager } from "./SlotManager.ts";

/**
 * Flow для пользователей, попадающих в список ожидания
 */
export class WaitlistFlow {
  
  /**
   * Добавляет пользователя в список ожидания
   */
  static async handle(context: UserContext): Promise<void> {
    const { telegramId, user } = context;
    
    try {
      // Проверяем, уже ли пользователь в waitlist
      if (user.waitlist === true && user.waitlist_position) {
        // Пользователь уже в waitlist - просто напоминаем позицию
        const message = MSG_WAITLIST.replace("%position%", user.waitlist_position.toString());
        await sendDirectMessage(telegramId, `Ты уже в списке ожидания!\n\n${message}`);
        return;
      }
      
      // Добавляем нового пользователя в waitlist
      const position = await this.addToWaitlist(telegramId);
      
      // Отправляем сообщение с позицией в очереди
      const message = MSG_WAITLIST.replace("%position%", position.toString());
      await sendDirectMessage(telegramId, message);
      
    } catch (error) {
      console.error("Ошибка при добавлении в waitlist:", error);
      await sendDirectMessage(telegramId, "Произошла ошибка. Попробуй еще раз позже.");
    }
  }
  
  /**
   * Добавляет пользователя в список ожидания и возвращает его позицию
   */
  private static async addToWaitlist(telegramId: number): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    
    // Получаем текущее максимальное значение waitlist_position
    const { data: maxPositionData } = await supabase
      .from("users")
      .select("waitlist_position")
      .eq("waitlist", true)
      .order("waitlist_position", { ascending: false })
      .limit(1);
    
    const maxPosition = maxPositionData?.[0]?.waitlist_position || 0;
    const newPosition = maxPosition + 1;
    
    // Обновляем пользователя
    const { error } = await supabase
      .from("users")
      .update({
        waitlist: true,
        waitlist_position: newPosition,
        waitlist_added_at: now,
        user_state: "in_waitlist",
        updated_at: now
      })
      .eq("telegram_id", telegramId);
    
    if (error) {
      throw error;
    }
    
    return newPosition;
  }
  
  /**
   * Проверяет, нужно ли добавить пользователя в waitlist
   */
  static async shouldAddToWaitlist(): Promise<boolean> {
    // Используем SlotManager для проверки доступных мест
    const hasSlots = await SlotManager.hasAvailableSlots();
    const shouldWaitlist = !hasSlots;
    console.log(`WaitlistFlow.shouldAddToWaitlist: hasSlots=${hasSlots}, shouldWaitlist=${shouldWaitlist}`);
    return shouldWaitlist;
  }
} 