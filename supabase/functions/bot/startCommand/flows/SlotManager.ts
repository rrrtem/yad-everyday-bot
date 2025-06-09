import { sendDirectMessage } from "../../userHandler.ts";
import { OWNER_TELEGRAM_ID, MSG_SLOTS_FILLED } from "../../constants.ts";

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
    
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "available_slots")
      .single();

    if (error || !data) {
      console.error("Ошибка получения доступных слотов:", error);
      return 0;
    }

    const slots = parseInt(data.value, 10) || 0;
    // console.log(`SlotManager.getAvailableSlots: Получено слотов из БД: ${slots}`);
    return slots;
  }
  
  /**
   * Устанавливает количество доступных слотов (админская команда)
   */
  static async setAvailableSlots(slots: number, adminId: number): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const { error } = await supabase
      .from("settings")
      .upsert({
        key: "available_slots",
        value: slots.toString(),
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });

    if (error) {
      console.error("Ошибка установки слотов:", error);
      throw error;
    }

    console.log(`SlotManager: Set ${slots} available slots by admin ${adminId}`);
    return slots;
  }
  
  /**
   * Закрывает все слоты (устанавливает в 0)
   */
  static async closeAllSlots(adminId: number): Promise<number> {
    console.log(`SlotManager: Closing all slots by admin ${adminId}`);
    return await this.setAvailableSlots(0, adminId);
  }
  
  /**
   * Уменьшает количество доступных слотов на 1 (при регистрации нового пользователя)
   */
  static async decreaseAvailableSlots(): Promise<number> {
    const currentSlots = await this.getAvailableSlots();
    
    if (currentSlots <= 0) {
      throw new Error("Нет доступных слотов для уменьшения");
    }

    const newSlots = currentSlots - 1;
    // console.log(`SlotManager: Слот занят, осталось мест: ${newSlots}`);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const { error } = await supabase
      .from("settings")
      .update({
        value: newSlots.toString(),
        updated_at: new Date().toISOString()
      })
      .eq("key", "available_slots");

    if (error) {
      console.error("Ошибка уменьшения слотов:", error);
      throw error;
    }

    // Проверяем, не заполнились ли все места
    if (newSlots === 0) {
      await this.notifyAdminSlotsFilled();
    }

    return newSlots;
  }
  
  /**
   * Увеличивает количество доступных слотов на 1 (при удалении пользователя)
   */
  static async increaseAvailableSlots(): Promise<number> {
    const currentSlots = await this.getAvailableSlots();
    const newSlots = currentSlots + 1;
    // console.log(`SlotManager: Слот освобожден, доступно мест: ${newSlots}`);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const { error } = await supabase
      .from("settings")
      .update({
        value: newSlots.toString(),
        updated_at: new Date().toISOString()
      })
      .eq("key", "available_slots");

    if (error) {
      console.error("Ошибка увеличения слотов:", error);
      throw error;
    }

    return newSlots;
  }
  
  /**
   * Проверяет, есть ли доступные слоты
   */
  static async hasAvailableSlots(): Promise<boolean> {
    const slots = await this.getAvailableSlots();
    const hasSlots = slots > 0;
    // console.log(`SlotManager.hasAvailableSlots: slots=${slots}, hasSlots=${hasSlots}`);
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
      console.log(`SlotManager: All slots filled, notifying admin ${OWNER_TELEGRAM_ID}`);
      await sendDirectMessage(OWNER_TELEGRAM_ID, MSG_SLOTS_FILLED);
    } catch (error) {
      console.error("Ошибка уведомления админа о заполнении слотов:", error);
    }
  }
}