import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ReportGenerator } from "../helpers/ReportGenerator.ts";
import { AdminReporter } from "../helpers/AdminReporter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for WeeklyCronFlow.");
}

interface WeeklyStats {
  totalWeeklyUsers: number;
  postsThisWeek: number;
  noPostsThisWeek: number;
  updatedUsers: Array<{username: string, unitsCount: number, consecutivePosts: number}>;
}

/**
 * Еженедельная проверка (weeklyCron) для пользователей с pace=weekly
 * Упрощенная версия daily проверки - только подсчет постов
 */
export class WeeklyCronFlow {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * Основная функция еженедельного крона
   */
  async execute(): Promise<Response> {
    const now = new Date();
    const startTime = Date.now();
    
    console.log(`\n=== WEEKLY CRON STARTED ===`);
    console.log(`🕐 Время запуска: ${now.toISOString()}`);
    console.log(`🌐 UTC: ${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}`);
    console.log(`📅 Дата: ${now.toDateString()}`);
    
    try {
      // Создаем статистику
      const stats: WeeklyStats = {
        totalWeeklyUsers: 0,
        postsThisWeek: 0,
        noPostsThisWeek: 0,
        updatedUsers: []
      };

      // 1. Получаем пользователей с weekly ритмом
      console.log(`📊 Получаем weekly пользователей из БД...`);
      const weeklyUsers = await this.getWeeklyUsers();
      console.log(`✅ Загружено ${weeklyUsers.length} weekly пользователей`);
      
      // 2. Обрабатываем каждого weekly пользователя
      await this.processWeeklyUsers(weeklyUsers, now, stats);

      // 3. Сброс флагов post_today для weekly пользователей
      await this.resetWeeklyFlags();

      // 4. Отправка отчета админу
      await AdminReporter.sendWeeklyReport(stats);

      // Финальная статистика
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.logFinalStats(stats, executionTime);

      return new Response(JSON.stringify({
        message: "weeklyCron завершён",
        executionTime,
        stats
      }), { status: 200, headers: { "Content-Type": "application/json" } });

    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА в weeklyCron:", error);
      return new Response(`Ошибка weeklyCron: ${error.message}`, { status: 500 });
    }
  }

  /**
   * Получение weekly пользователей с применением фильтров
   */
  private async getWeeklyUsers(): Promise<any[]> {
    const { data: users, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("pace", "weekly")
      .eq("in_chat", true);
      
    if (error) {
      throw new Error(`Ошибка получения weekly пользователей: ${error.message}`);
    }
    
    return users || [];
  }

  /**
   * Обработка weekly пользователей
   */
  private async processWeeklyUsers(users: any[], now: Date, stats: WeeklyStats): Promise<void> {
    console.log(`🔍 ФАЗА 1: Обработка weekly пользователей`);

    for (const user of users) {
      const username = user.username || String(user.telegram_id);
      
      // Применяем те же фильтры что и в daily
      if (!this.shouldProcessWeeklyUser(user, now)) {
        console.log(`⏭️ Пропускаем ${username} (не прошел фильтры)`);
        continue;
      }

      stats.totalWeeklyUsers++;
      
      if (user.post_today) {
        stats.postsThisWeek++;
        await this.updateUserWeeklyStats(user, now, stats);
        console.log(`✅ ${username}: засчитан weekly пост`);
      } else {
        stats.noPostsThisWeek++;
        console.log(`❌ ${username}: нет поста за неделю`);
      }
    }
  }

  /**
   * Проверка фильтров для weekly пользователя (аналогично daily)
   */
  private shouldProcessWeeklyUser(user: any, now: Date): boolean {
    // Проверка на паузу
    if (user.pause_until && new Date(user.pause_until) > now) {
      return false;
    }
    
    // Можно добавить дополнительные фильтры по аналогии с daily
    // Например, проверка public_remind если нужно
    
    return true;
  }

  /**
   * Обновление статистики пользователя при наличии поста
   */
  private async updateUserWeeklyStats(user: any, now: Date, stats: WeeklyStats): Promise<void> {
    const newUnitsCount = (user.units_count || 0) + 1;
    const newConsecutivePosts = (user.consecutive_posts_count || 0) + 1;
    
    const updateData = {
      units_count: newUnitsCount,
      consecutive_posts_count: newConsecutivePosts,
      strikes_count: 0, // Сброс страйков при weekly посте
      last_post_date: now.toISOString().split('T')[0], // YYYY-MM-DD
      updated_at: now.toISOString()
    };

    const { error } = await this.supabase
      .from("users")
      .update(updateData)
      .eq("telegram_id", user.telegram_id);
      
    if (error) {
      console.error(`❌ Ошибка обновления weekly статистики для ${user.username || user.telegram_id}:`, error.message);
    } else {
      stats.updatedUsers.push({
        username: user.username || String(user.telegram_id),
        unitsCount: newUnitsCount,
        consecutivePosts: newConsecutivePosts
      });
    }
  }

  /**
   * Сброс флагов post_today для weekly пользователей
   */
  private async resetWeeklyFlags(): Promise<void> {
    console.log(`🔍 ФАЗА 2: Сброс флагов post_today для weekly пользователей`);
    
    const { error } = await this.supabase
      .from("users")
      .update({ post_today: false })
      .eq("pace", "weekly")
      .eq("post_today", true);
      
    if (error) {
      console.error(`❌ Ошибка сброса post_today для weekly:`, error);
    } else {
      console.log(`✅ Сброшены флаги post_today для weekly пользователей`);
    }
  }

  /**
   * Логирование финальной статистики
   */
  private logFinalStats(stats: WeeklyStats, executionTime: number): void {
    console.log(`✅ Weekly cron completed: ${stats.totalWeeklyUsers} weekly users, ${stats.postsThisWeek} posted, updated ${stats.updatedUsers.length} users in ${executionTime}ms`);
  }
} 