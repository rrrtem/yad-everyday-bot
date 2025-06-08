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
    
    console.log(`\n=== PUBLIC REMINDER STARTED ===`);
    console.log(`🕐 Время запуска: ${now.toISOString()}`);
    console.log(`🌐 UTC: ${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}`);
    
    try {
      // Вычисляем время до конца дня
      const { diffHours, diffMinutes, timeLeftMsg } = ReportGenerator.calculateTimeUntilEndOfDay(now);
      console.log(`⏰ До конца дня (04:00 UTC): ${diffHours}ч ${diffMinutes}мин`);

      // Получаем пользователей, которым нужно напомнить
      console.log(`📊 Получаем данные пользователей из БД...`);
      const users = await this.getUsersForReminder();
      console.log(`✅ Загружено ${users.length} записей пользователей`);
      
      // Диагностика пользователей
      this.logUserDiagnostics(users);
      
      console.log(`💬 Текст напоминания: "${timeLeftMsg}"`);

      // Отправляем напоминания
      const { sent: sentReminders, usernames: allUsernames } = await ReportGenerator.sendPublicReminders(users, timeLeftMsg);

      // Финальная статистика
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`\n=== PUBLIC REMINDER COMPLETED ===`);
      console.log(`⏱️ Время выполнения: ${executionTime}ms`);
      console.log(`📊 Результат: отправлено ${sentReminders} напоминаний в ${sentReminders} тредов`);
      console.log(`👥 Всего пользователей в напоминаниях: ${allUsernames.length}`);
      console.log(`🏁 Public reminder завершен в ${new Date().toISOString()}`);

      if (sentReminders === 0) {
        console.log(`ℹ️ Все участники уже прислали посты или не требуют напоминаний`);
        return new Response(JSON.stringify({ 
          message: "Все участники уже прислали посты или не требуют напоминаний",
          executionTime 
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ 
        message: "Публичные напоминания отправлены", 
        usernames: allUsernames, 
        timeLeftMsg,
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

  /**
   * Диагностика пользователей
   */
  private logUserDiagnostics(users: User[]): void {
    const activeDailyUsers = users.filter(u => u.in_chat && u.pace === "daily");
    console.log(`🔍 Активных пользователей с pace="daily": ${activeDailyUsers.length}`);
    
    if (activeDailyUsers.length > 0) {
      console.log(`   📋 Список: ${activeDailyUsers.map(u => `${u.username}(${u.pace})`).join(', ')}`);
    }
    
    // Детальная диагностика фильтрации
    console.log(`\n🔎 ДЕТАЛЬНАЯ ДИАГНОСТИКА:`);
    for (const user of activeDailyUsers.slice(0, 5)) { // Показываем первых 5 для примера
      console.log(`👤 ${user.username}:`);
      console.log(`   - mode: "${user.mode}" (trimmed: "${user.mode?.trim()}")`);
      console.log(`   - post_today: ${user.post_today}`);
      console.log(`   - public_remind: ${user.public_remind}`);
      console.log(`   - pause_until: ${user.pause_until}`);
      console.log(`   - username: ${user.username ? 'есть' : 'НЕТ'}`);
    }
  }
} 