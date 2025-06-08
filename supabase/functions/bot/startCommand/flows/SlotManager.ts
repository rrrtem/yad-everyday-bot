import { sendDirectMessage } from "../../userHandler.ts";
import { OWNER_TELEGRAM_ID, MSG_SLOTS_FILLED } from "../../../constants.ts";

/**
 * Менеджер для управления системой динамических слотов
 */
export class SlotManager {
  
  /**
   * Получает количество доступных слотов
   */
  static async getAvailableSlots(): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    try {
      const { data, error } = await supabase.rpc('get_available_slots');
      
      if (error) {
        console.error("SlotManager.getAvailableSlots: Ошибка вызова функции get_available_slots:", error);
        console.error("Возможно, функция get_available_slots не создана в БД или таблица slot_settings не существует");
        // Fallback: если функции нет, считаем что слотов нет (waitlist режим)
        return 0;
      }
      
      const slots = data || 0;
      console.log(`SlotManager.getAvailableSlots: Получено слотов из БД: ${slots}`);
      return slots;
    } catch (error) {
      console.error("SlotManager.getAvailableSlots: Критическая ошибка:", error);
      // Fallback: в случае ошибки считаем что слотов нет
      return 0;
    }
  }
  
  /**
   * Устанавливает количество доступных слотов
   */
  static async setAvailableSlots(slots: number, adminId: number): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const { data } = await supabase.rpc('set_available_slots', {
      new_slots: slots,
      admin_id: adminId
    });
    
    console.log(`SlotManager: Установлено ${slots} доступных мест админом ${adminId}`);
    return data || 0;
  }
  
  /**
   * Закрывает все слоты (устанавливает в 0)
   */
  static async closeAllSlots(adminId: number): Promise<number> {
    console.log(`SlotManager: Закрытие всех слотов админом ${adminId}`);
    return await this.setAvailableSlots(0, adminId);
  }
  
  /**
   * Уменьшает количество доступных слотов на 1 при регистрации нового пользователя
   * Возвращает новое количество доступных слотов
   */
  static async decreaseAvailableSlots(): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const { data } = await supabase.rpc('decrease_available_slots');
    const newSlots = data || 0;
    
    console.log(`SlotManager: Слот занят, осталось мест: ${newSlots}`);
    
    // Если места закончились - уведомляем админа
    if (newSlots === 0) {
      await this.notifyAdminSlotsFilled();
    }
    
    return newSlots;
  }
  
  /**
   * Увеличивает количество доступных слотов на 1 при выходе пользователя из чата
   * Возвращает новое количество доступных слотов
   */
  static async increaseAvailableSlots(): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    try {
      const { data, error } = await supabase.rpc('increase_available_slots');
      
      if (error) {
        console.error("SlotManager.increaseAvailableSlots: Ошибка вызова функции increase_available_slots:", error);
        // Возвращаем текущее значение при ошибке
        return await this.getAvailableSlots();
      }
      
      const newSlots = data || 0;
      console.log(`SlotManager: Слот освобожден, доступно мест: ${newSlots}`);
      return newSlots;
    } catch (error) {
      console.error("SlotManager.increaseAvailableSlots: Критическая ошибка:", error);
      return await this.getAvailableSlots();
    }
  }
  
  /**
   * Проверяет, есть ли доступные слоты
   */
  static async hasAvailableSlots(): Promise<boolean> {
    const slots = await this.getAvailableSlots();
    const hasSlots = slots > 0;
    console.log(`SlotManager.hasAvailableSlots: slots=${slots}, hasSlots=${hasSlots}`);
    return hasSlots;
  }
  
  /**
   * Получает статистику слотов
   */
  static async getSlotStats(): Promise<{available: number, total: number}> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const { data } = await supabase
      .from('slot_settings')
      .select('available_slots, total_slots_opened')
      .eq('id', 1)
      .single();
    
    return {
      available: data?.available_slots || 0,
      total: data?.total_slots_opened || 0
    };
  }
  
  /**
   * Уведомляет админа о заполнении всех мест
   */
  private static async notifyAdminSlotsFilled(): Promise<void> {
    try {
      console.log(`SlotManager: Все места заполнены, уведомляем админа ${OWNER_TELEGRAM_ID}`);
      await sendDirectMessage(OWNER_TELEGRAM_ID, MSG_SLOTS_FILLED);
    } catch (error) {
      console.error("Ошибка уведомления админа о заполнении слотов:", error);
    }
  }
}