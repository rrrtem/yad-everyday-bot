import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UserProcessor } from "../helpers/UserProcessor.ts";
import { ReportGenerator } from "../helpers/ReportGenerator.ts";
import { AdminReporter } from "../helpers/AdminReporter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for DailyCronFlow.");
}

/**
 * Ежедневная проверка (dailyCron) - реализует логику Б2 из logic.md
 * Запускается в 04:00 UTC каждый день
 */
export class DailyCronFlow {
  private supabase: SupabaseClient;
  private userProcessor: UserProcessor;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.userProcessor = new UserProcessor(this.supabase);
  }

  /**
   * Основная функция ежедневного крона
   */
  async execute(): Promise<Response> {
    const now = new Date();
    const startTime = Date.now();
    
    console.log(`🤖 Daily cron started at ${now.toISOString()}`);
    
    try {
      // Получаем всех пользователей
      // console.log(`📊 Получаем данные пользователей из БД...`);
      const users = await this.userProcessor.getAllUsers();
      console.log(`📊 Loaded ${users.length} users from DB`);
      
      // Предварительная статистика
      // ReportGenerator.logPreStats(users, now);
      
      // Создаем статистику
      const stats = this.userProcessor.createInitialStats();

      // 1. Проверка активных пользователей с ежедневным ритмом (страйки)
      await this.userProcessor.processStrikesForDailyUsers(users, now, stats);

      // 2. Проверка пользователей на паузе
      await this.userProcessor.processPausedUsers(users, now, stats);

      // 3. Обработка подписок (subscription_days_left)
      const usersToRemove = await this.userProcessor.processSubscriptions(users, now, stats);

      // 4. Удаление пользователей с истекшей подпиской
      await this.userProcessor.removeExpiredUsers(users, usersToRemove, now, stats);

      // 5. Сброс ежедневных флагов
      await this.userProcessor.resetDailyFlags();

      // 6. Анализ опасных случаев
      this.userProcessor.analyzeDangerousCases(users, now, stats);

      // 7. Отправка отчета владельцу
      await AdminReporter.sendDailyCronReport(stats, 'daily', users);

      // Финальная статистика
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // ReportGenerator.logFinalStats(stats, executionTime, "daily cron");
      console.log(`✅ Daily cron completed in ${executionTime}ms`);

      return new Response(JSON.stringify({
        message: "dailyCron завершён",
        executionTime,
        stats
      }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА в dailyCron:", error);
      return new Response(`Ошибка dailyCron: ${error.message}`, { status: 500 });
    }
  }
} 