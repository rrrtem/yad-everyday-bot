import { sendDirectMessage } from "../../userHandler.ts";
import { ADMIN_TELEGRAM_IDS, MSG_SLOTS_FILLED } from "../../constants.ts";

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
      .from("slot_settings")
      .select("available_slots")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Ошибка получения доступных слотов:", error);
      return 0;
    }

    const slots = data.available_slots || 0;
    // console.log(`SlotManager.getAvailableSlots: Получено слотов из БД: ${slots}`);
    return slots;
  }
  
  /**
   * Получает общее количество открытых слотов
   */
  static async getTotalSlotsOpened(): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const { data, error } = await supabase
      .from("slot_settings")
      .select("total_slots_opened")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("Ошибка получения общего количества слотов:", error);
      return 0;
    }

    const totalSlots = data.total_slots_opened || 0;
    return totalSlots;
  }
  
  /**
   * Устанавливает количество доступных слотов (админская команда)
   */
  static async setAvailableSlots(slots: number, adminId: number): Promise<number> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    
    // Обновляем оба поля в одном запросе
    const { error } = await supabase
      .from("slot_settings")
      .upsert({
        id: 1,
        available_slots: slots,
        total_slots_opened: slots,
        updated_at: now,
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
    
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    
    // Только обнуляем available_slots, total_slots_opened оставляем как есть
    const { error } = await supabase
      .from("slot_settings")
      .update({
        available_slots: 0,
        updated_at: now,
        updated_by: adminId
      })
      .eq("id", 1);

    if (error) {
      console.error("Ошибка закрытия слотов:", error);
      throw error;
    }

    return 0;
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
      .from("slot_settings")
      .update({
        available_slots: newSlots,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

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
    const totalSlots = await this.getTotalSlotsOpened();
    
    // Не увеличиваем выше максимального значения
    if (currentSlots >= totalSlots) {
      console.log(`SlotManager: Не увеличиваем слоты - уже на максимуме (${currentSlots}/${totalSlots})`);
      return currentSlots;
    }
    
    const newSlots = currentSlots + 1;
    // console.log(`SlotManager: Слот освобожден, доступно мест: ${newSlots}`);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    const { error } = await supabase
      .from("slot_settings")
      .update({
        available_slots: newSlots,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

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
      console.log(`SlotManager: All slots filled, notifying admins ${ADMIN_TELEGRAM_IDS.join(', ')}`);
      // Отправляем уведомление всем админам
      for (const adminId of ADMIN_TELEGRAM_IDS) {
        try {
          await sendDirectMessage(adminId, MSG_SLOTS_FILLED);
        } catch (error) {
          console.error(`Ошибка уведомления админа ${adminId} о заполнении слотов:`, error);
        }
      }
    } catch (error) {
      console.error("Ошибка уведомления админов о заполнении слотов:", error);
    }
  }
}