import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ReportGenerator } from "../helpers/ReportGenerator.ts";
import { User } from "../helpers/UserProcessor.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for PublicReminderFlow.");
}

/**
 * Публичное напоминание в 20:00 UTC (publicDeadlineReminder)
 * Реализует логику Б3 из logic.md
 */
export class PublicReminderFlow {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * Основная функция публичного напоминания
   */
  async execute(): Promise<Response> {
    const now = new Date();
    const startTime = Date.now();
    
    console.log(`🔔 Public reminder started at ${now.toISOString()}`);
    
    try {
      // Получаем пользователей, которым нужно напомнить
      const users = await this.getUsersForReminder();
      console.log(`📊 Loaded ${users.length} user records`);
      
      // Отправляем напоминания
      const { sent: sentReminders, usernames: allUsernames } = await ReportGenerator.sendPublicReminders(users);

      // Финальная статистика
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`✅ Public reminder completed: ${sentReminders} threads, ${allUsernames.length} users in ${executionTime}ms`);

      if (sentReminders === 0) {
        return new Response(JSON.stringify({ 
          message: "Все участники уже прислали посты или не требуют напоминаний",
          executionTime 
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ 
        message: "Публичные напоминания отправлены", 
        usernames: allUsernames, 
        sentToThreads: sentReminders,
        executionTime
      }), { status: 200 });

    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА в publicDeadlineReminder:", error);
      return new Response(`Ошибка publicDeadlineReminder: ${error.message}`, { status: 500 });
    }
  }

  /**
   * Получение пользователей для напоминания
   */
  private async getUsersForReminder(): Promise<User[]> {
    const usersRes = await this.supabase
      .from("users")
      .select("username, mode, pace, in_chat, pause_until, public_remind, post_today");
      
    if (usersRes.error) {
      throw new Error(`Ошибка получения пользователей: ${usersRes.error.message}`);
    }
    
    return usersRes.data || [];
  }


} 