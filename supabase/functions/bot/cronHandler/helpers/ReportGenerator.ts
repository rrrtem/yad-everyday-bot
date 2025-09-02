import { ChatManager } from "./ChatManager.ts";
import { ProcessingStats, User } from "./UserProcessor.ts";
import { 
  PUBLIC_REMINDER_THREAD_ID_TEXT
} from "../../constants.ts";

/**
 * Генератор отчетов для крон-задач
 */
export class ReportGenerator {


  /**
   * Отправляет публичные напоминания пользователям
   */
  static async sendPublicReminders(users: User[]): Promise<{sent: number, usernames: string[]}> {
    console.log(`📤 Отправляем публичное напоминание...`);
    
    // Фильтруем пользователей для напоминания
    const now = new Date();
    const usersToRemind = users.filter(user => 
      user.in_chat && 
      user.pace === "daily" && 
      user.public_remind !== false && // по умолчанию true
      !user.post_today && // не прислали пост сегодня
      user.username && // есть username для тега
      (!user.pause_until || new Date(user.pause_until) <= now) // не на паузе
    );
    
    console.log(`📊 Найдено ${usersToRemind.length} пользователей для напоминания`);
    
    if (usersToRemind.length === 0) {
      console.log(`ℹ️ Нет пользователей для напоминания`);
      return { sent: 0, usernames: [] };
    }
    
    // Создаем сообщение с тегами
    const usernames = usersToRemind.map(user => user.username!);
    const text = `${usernames.map(u => '@' + u).join(' ')} Ждем ваш текст!`;
    
    console.log(`💬 Отправляем: "${text}"`);
    
    const success = await ChatManager.sendGroupMessage(text, PUBLIC_REMINDER_THREAD_ID_TEXT);
    if (success) {
      console.log(`✅ Напоминание отправлено для ${usernames.length} пользователей`);
      return { sent: 1, usernames };
    } else {
      console.log(`❌ Ошибка отправки напоминания`);
      return { sent: 0, usernames: [] };
    }
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