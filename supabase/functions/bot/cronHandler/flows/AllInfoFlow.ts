import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UserProcessor, ProcessingStats } from "../helpers/UserProcessor.ts";
import { ReportGenerator } from "../helpers/ReportGenerator.ts";
import { AdminReporter } from "../helpers/AdminReporter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for AllInfoFlow.");
}

/**
 * Функция allInfo - отправка детального отчета админу
 * Может быть вызвана отдельно через команду /allinfo
 */
export class AllInfoFlow {
  private supabase: SupabaseClient;
  private userProcessor: UserProcessor;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.userProcessor = new UserProcessor(this.supabase);
  }

  /**
   * Основная функция отправки детального отчета
   */
  async execute(): Promise<Response> {
    const now = new Date();
    const startTime = Date.now();
    
    console.log(`ℹ️ AllInfo started at ${now.toISOString()}`);
    
    try {
      // Получаем всех пользователей без обработки
      const users = await this.userProcessor.getAllUsers();
      console.log(`📊 Loaded ${users.length} users for analysis`);
      
      // Анализируем статистику
      const stats = this.analyzeUsersStats(users, now);

      // Отправляем отчет владельцу
      await AdminReporter.sendDailyCronReport(stats, 'allinfo', users);

      // Финальная статистика
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`✅ AllInfo completed in ${executionTime}ms`);

      return new Response(JSON.stringify({
        message: "allInfo завершён",
        executionTime,
        stats
      }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА в allInfo:", error);
      return new Response(`Ошибка allInfo: ${error.message}`, { status: 500 });
    }
  }

  /**
   * Анализ статистики пользователей без изменения данных
   */
  private analyzeUsersStats(users: any[], now: Date): ProcessingStats {
    const stats: ProcessingStats = {
      totalActive: 0,
      postsToday: 0,
      noPosts: 0,
      newStrikes: [],
      riskyUsers: [],
      autoPaused: [],
      pauseCompleted: [],
      pauseExpiredRemoved: [],
      currentlyPaused: [],
      subscriptionWarnings: [],
      subscriptionRemoved: [],
      dangerousCases: []
    };

    console.log(`🔍 Анализируем данные пользователей...`);
    
    for (const user of users) {
      const username = user.username || String(user.telegram_id);
      
      // Активные пользователи
      if (user.in_chat) {
        stats.totalActive++;
        
        if (user.post_today) {
          stats.postsToday++;
        } else {
          stats.noPosts++;
        }
      }
      
      // Пользователи с риском
      if (user.strikes_count === 3 && user.in_chat) {
        stats.riskyUsers.push({username, strikes: user.strikes_count});
      }
      
      // Пользователи на паузе
      if (user.pause_until && new Date(user.pause_until) > now) {
        const pauseEnd = new Date(user.pause_until);
        stats.currentlyPaused.push({
          username,
          pauseUntil: pauseEnd.toLocaleDateString('ru-RU')
        });
      }
      
      // Предупреждения о подписке
      if (user.subscription_days_left <= 3 && user.subscription_days_left > 0) {
        stats.subscriptionWarnings.push({username, daysLeft: user.subscription_days_left});
      }
      
      // Опасные случаи
      if (user.strikes_count === 3 && user.in_chat) {
        stats.dangerousCases.push({
          username,
          reason: "3 страйка - на грани исключения"
        });
      }
      
      if (user.subscription_days_left <= 3 && user.subscription_days_left > 0 && user.strikes_count > 0) {
        stats.dangerousCases.push({
          username,
          reason: `Подписка истекает через ${user.subscription_days_left} дн. + ${user.strikes_count} страйк(а)`
        });
      }
      
      if (user.in_chat && (!user.subscription_active && user.subscription_days_left === 0) && user.created_at) {
        const createdDate = new Date(user.created_at);
        const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceCreated <= 7) {
          stats.dangerousCases.push({
            username,
            reason: `Новый пользователь в чате без активной подписки (${daysSinceCreated} дн.)`
          });
        }
      }
      
      if (user.in_chat && user.subscription_active === false && user.subscription_days_left === 0) {
        stats.dangerousCases.push({
          username,
          reason: "В чате без активной подписки и без сохраненных дней"
        });
      }
    }

    return stats;
  }
} 