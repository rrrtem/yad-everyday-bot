import { ChatManager } from "./ChatManager.ts";
import { ProcessingStats, User } from "./UserProcessor.ts";
import { 
  MSG_PUBLIC_DEADLINE_REMINDER,
  PUBLIC_REMINDER_THREAD_ID_TEXT
} from "../../constants.ts";

/**
 * Генератор отчетов для крон-задач
 */
export class ReportGenerator {


  /**
   * Отправляет публичные напоминания пользователям (упрощённая версия)
   */
  static async sendPublicReminders(users: User[]): Promise<{sent: number, usernames: string[]}> {
    console.log(`📤 Отправляем публичное напоминание...`);
    const text = 'Ждем ваш текст!';
    const success = await ChatManager.sendGroupMessage(text, PUBLIC_REMINDER_THREAD_ID_TEXT);
    if (success) {
      console.log(`✅ Напоминание отправлено`);
      return { sent: 1, usernames: [] };
    } else {
      console.log(`❌ Ошибка отправки напоминания`);
      return { sent: 0, usernames: [] };
    }
  }

  /**
   * Вычисление времени до конца дня
   */
  static calculateTimeUntilEndOfDay(now: Date): {diffHours: number, diffMinutes: number, timeLeftMsg: string} {
    // Конец дня — 04:00 следующего дня по UTC (время запуска dailyCron)
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(4, 0, 0, 0);
    
    // Если текущее время уже после 04:00, то конец дня — завтра в 04:00
    if (now.getUTCHours() >= 4) {
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
    }
    
    const diffMs = endOfDay.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeLeftMsg = "";
    if (diffHours > 0) {
      timeLeftMsg = `Ждем ваш текст!`;
    } else {
      timeLeftMsg = `До конца дня осталось меньше часа! (${diffMinutes} минут)`;
    }

    return { diffHours, diffMinutes, timeLeftMsg };
  }

  /**
   * Склонение слова "час"
   */
  private static pluralizeHours(n: number): string {
    const abs = Math.abs(n);
    if (abs === 1) return 'час';
    if (abs >= 2 && abs <= 4) return 'часа';
    return 'часов';
  }

  /**
   * Вывод финальной статистики в консоль
   */
  static logFinalStats(stats: ProcessingStats, executionTime: number, operation: string): void {
    // console.log(`\n=== ${operation.toUpperCase()} COMPLETED ===`);
    // console.log(`⏱️ Время выполнения: ${executionTime}ms`);
    // console.log(`📊 Итоговая статистика:`);
    // console.log(`   - Активных пользователей: ${stats.totalActive}`);
    // console.log(`   - Отправили посты: ${stats.postsToday}`);
    // console.log(`   - Не отправили: ${stats.noPosts}`);
    // console.log(`   - Новых страйков: ${stats.newStrikes.length}`);
    // console.log(`   - Автопауз: ${stats.autoPaused.length}`);
    // console.log(`   - Удалений: ${stats.pauseExpiredRemoved.length + stats.subscriptionRemoved.length}`);
    // console.log(`   - На паузе: ${stats.currentlyPaused.length}`);
    // console.log(`   - Опасных случаев: ${stats.dangerousCases.length}`);
    // console.log(`🏁 ${operation} завершен успешно в ${new Date().toISOString()}`);
    console.log(`✅ ${operation} completed in ${executionTime}ms - ${stats.totalActive} active, ${stats.newStrikes.length} strikes, ${stats.autoPaused.length} paused`);
  }

  /**
   * Вывод предварительной статистики в консоль
   */
  static logPreStats(users: User[], now: Date): void {
    const activeUsers = users.filter(u => u.in_chat);
    const dailyUsers = activeUsers.filter(u => u.pace === "daily");
    const weeklyUsers = activeUsers.filter(u => u.pace === "weekly");
    const pausedUsers = users.filter(u => u.pause_until && new Date(u.pause_until) > now);
    
    // console.log(`📈 Предварительная статистика:`);
    // console.log(`   - Всего активных: ${activeUsers.length}`);
    // console.log(`   - Ежедневный ритм: ${dailyUsers.length}`);
    // console.log(`   - Еженедельный ритм: ${weeklyUsers.length}`);
    // console.log(`   - На паузе: ${pausedUsers.length}`);
    console.log(`📈 Pre-stats: ${activeUsers.length} active (${dailyUsers.length} daily, ${weeklyUsers.length} weekly), ${pausedUsers.length} paused`);
  }
} 