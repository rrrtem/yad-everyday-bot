import { ProcessingStats, User } from "./UserProcessor.ts";
import { ChatManager } from "./ChatManager.ts";
import { 
  OWNER_TELEGRAM_ID
} from "../../constants.ts";

/**
 * Централизованный компонент для отправки отчетов админу
 * Объединяет функционал отправки различных типов отчетов
 */
export class AdminReporter {
  
  /**
   * Отправка ежедневного отчета (dailyCron и allInfo) с детализацией по пользователям
   */
  static async sendDailyCronReport(stats: ProcessingStats, reportType: 'daily' | 'allinfo' = 'daily', users?: User[]): Promise<void> {
    // console.log(`📤 Отправляем ${reportType} отчет владельцу (${OWNER_TELEGRAM_ID})`);
    
    try {
      const report = users 
        ? this.formatDetailedDailyCronReport(stats, reportType, users)
        : this.formatDailyCronReport(stats, reportType);
        
      await ChatManager.sendDirectMessage(OWNER_TELEGRAM_ID, report);
      // console.log(`✅ ${reportType} отчет отправлен владельцу`);
    } catch (err) {
      console.error(`❌ Ошибка отправки ${reportType} отчета владельцу:`, err);
      throw err; // Перебрасываем ошибку для обработки выше
    }
  }

  /**
   * Отправка еженедельного отчета (weeklyCron)
   */
  static async sendWeeklyReport(stats: {
    totalWeeklyUsers: number;
    postsThisWeek: number;
    noPostsThisWeek: number;
    updatedUsers: Array<{username: string, unitsCount: number, consecutivePosts: number}>;
  }): Promise<void> {
    // console.log(`📤 Отправляем weekly отчет владельцу (${OWNER_TELEGRAM_ID})`);
    
    try {
      const report = this.formatWeeklyReport(stats);
      await ChatManager.sendDirectMessage(OWNER_TELEGRAM_ID, report);
      // console.log(`✅ Weekly отчет отправлен владельцу`);
    } catch (err) {
      console.error(`❌ Ошибка отправки weekly отчета владельцу:`, err);
      throw err;
    }
  }

  /**
   * Отправка отчета об ошибке
   */
  static async sendErrorReport(error: Error, operation: string, additionalInfo?: string): Promise<void> {
    console.log(`🚨 Sending error report to admin`);
    
    try {
      const report = this.formatErrorReport(error, operation, additionalInfo);
      await ChatManager.sendDirectMessage(OWNER_TELEGRAM_ID, report);
      // console.log(`✅ Отчет об ошибке отправлен владельцу`);
    } catch (err) {
      console.error(`❌ Критическая ошибка отправки отчета об ошибке:`, err);
      // Не перебрасываем ошибку, чтобы не создать рекурсию
    }
  }

  /**
   * Форматирование детализированного ежедневного отчета с никами пользователей
   */
  private static formatDetailedDailyCronReport(stats: ProcessingStats, reportType: 'daily' | 'allinfo', users: User[]): string {
    const reportTypeText = reportType === 'allinfo' ? 'AllInfo' : 'DailyCron';
    let report = ``;
    
    const now = new Date();
    
    // Анализируем пользователей по категориям
    const activeUsers = users.filter(u => u.in_chat && u.pace === "daily");
    const weeklyUsers = users.filter(u => u.in_chat && u.pace === "weekly");
    const allActiveUsers = users.filter(u => u.in_chat);
    
    // Анализ подписок
    const usersWithActiveSubscription = allActiveUsers.filter(u => u.subscription_active);
    const usersOnSavedDays = allActiveUsers.filter(u => !u.subscription_active && u.subscription_days_left > 0);
    
    const usersWithPosts = activeUsers.filter(u => u.post_today);
    const usersWithoutPosts = activeUsers.filter(u => !u.post_today && (!u.pause_until || new Date(u.pause_until) <= now));
    
    // Общая статистика
    report += `• Активных участников (daily): ${activeUsers.length}\n`;
    report += `• Активных участников (weekly): ${weeklyUsers.length}\n`;
    report += `• С активной подпиской: ${usersWithActiveSubscription.length}\n`;
    report += `• На сохраненных днях: ${usersOnSavedDays.length}\n\n`;

    
    // Детализация: кто прислал посты
    if (usersWithPosts.length > 0) {
      report += `✅ Прислали пост сегодня (${usersWithPosts.length}):\n`;
      const usernames = usersWithPosts.map(u => u.username || `ID${u.telegram_id}`).sort();
      // Разбиваем на строки по 3-4 пользователя для читабельности
      for (let i = 0; i < usernames.length; i += 4) {
        const chunk = usernames.slice(i, i + 4);
        report += `   ${chunk.map(name => `@${name}`).join(', ')}\n`;
      }
      report += `\n`;
    }
    
    // Детализация: кто не прислал посты
    if (usersWithoutPosts.length > 0) {
      report += `❌ Не прислали пост (${usersWithoutPosts.length}):\n`;
      const usernames = usersWithoutPosts.map(u => u.username || `ID${u.telegram_id}`).sort();
      for (let i = 0; i < usernames.length; i += 4) {
        const chunk = usernames.slice(i, i + 4);
        report += `   ${chunk.map(name => `@${name}`).join(', ')}\n`;
      }
      report += `\n`;
    }
    
    // Критические ситуации с подписками (меньше 3 дней)
    const criticalSubscriptions = users.filter(u => 
      u.in_chat && 
      !u.subscription_active && 
      u.subscription_days_left > 0 && 
      u.subscription_days_left <= 3
    );
    
    if (criticalSubscriptions.length > 0) {
      report += `🚨 Критично: подписка заканчивается ≤3 дней (${criticalSubscriptions.length}):\n`;
      criticalSubscriptions.forEach(u => {
        const username = u.username || `ID${u.telegram_id}`;
        report += `   @${username} — ${u.subscription_days_left} дн.\n`;
      });
      report += `\n`;
    }
    
    // Пользователи с 3 страйками (на грани исключения)
    const dangerousUsers = users.filter(u => u.in_chat && u.strikes_count === 3);
    if (dangerousUsers.length > 0) {
      report += `⚠️ На грани исключения (3 страйка) — ${dangerousUsers.length}:\n`;
      dangerousUsers.forEach(u => {
        const username = u.username || `ID${u.telegram_id}`;
        report += `   @${username}\n`;
      });
      report += `\n`;
    }
    
    // Новые пользователи без подписки (≤7 дней в системе)
    const newUsersWithoutSub = users.filter(u => {
      if (!u.in_chat || u.subscription_active || u.subscription_days_left > 0 || !u.created_at) {
        return false;
      }
      const daysSinceCreated = Math.floor((now.getTime() - new Date(u.created_at).getTime()) / (24 * 60 * 60 * 1000));
      return daysSinceCreated <= 7;
    });
    
    if (newUsersWithoutSub.length > 0) {
      report += `🆕 Новые пользователи без подписки (≤7 дней) — ${newUsersWithoutSub.length}:\n`;
      newUsersWithoutSub.forEach(u => {
        const username = u.username || `ID${u.telegram_id}`;
        const daysSinceCreated = u.created_at 
          ? Math.floor((now.getTime() - new Date(u.created_at).getTime()) / (24 * 60 * 60 * 1000))
          : '?';
        report += `   @${username} (${daysSinceCreated} дн.)\n`;
      });
      report += `\n`;
    }
    
    // Пользователи на паузе
    const pausedUsers = users.filter(u => u.pause_until && new Date(u.pause_until) > now);
    if (pausedUsers.length > 0) {
      report += `😴 На паузе сейчас (${pausedUsers.length}):\n`;
      pausedUsers.forEach(u => {
        const username = u.username || `ID${u.telegram_id}`;
        const pauseEndDate = new Date(u.pause_until!).toLocaleDateString('ru-RU');
        report += `   @${username} (до ${pauseEndDate})\n`;
      });
      report += `\n`;
    }
    
    // Изменения за сегодня (детализация с никами)
    report += this.getDailyCronChangesText(stats);
    
    // Дополнительная информация
    report += `• Тип отчета: ${reportTypeText}\n`;
    
    if (reportType === 'allinfo') {
      report += `• Отчет запрошен вручную (без изменения данных)\n`;
    }
    
    const totalChanges = stats.newStrikes.length + stats.autoPaused.length + 
                        stats.pauseExpiredRemoved.length + stats.subscriptionRemoved.length;
    
    if (totalChanges > 0) {
      report += `• Всего изменений: ${totalChanges}\n`;
    } else {
      report += `• Никаких критических изменений\n`;
    }
    

    
    return report;
  }

  /**
   * Форматирование ежедневного отчета с дополнительной информацией (старая версия)
   */
  private static formatDailyCronReport(stats: ProcessingStats, reportType: 'daily' | 'allinfo'): string {
    // Используем приватную функцию форматирования
    let report = this.formatBasicDailyCronReport(stats);
    
    // Добавляем информацию о типе отчета в заголовок
    const reportTypeText = reportType === 'allinfo' ? 'AllInfo' : 'DailyCron';
    report = report.replace('📊 Ежедневный отчет dailyCron:', `📊 ${reportTypeText} отчет:`);
    
    // Добавляем дополнительную статистику в конец
  
    report += `\n• Тип отчета: ${reportTypeText}`;
    
    if (reportType === 'allinfo') {
      report += `\n• Отчет запрошен вручную (без изменения данных)`;
    }
    
    // Добавляем краткую сводку для быстрого анализа
    const totalChanges = stats.newStrikes.length + stats.autoPaused.length + 
                        stats.pauseExpiredRemoved.length + stats.subscriptionRemoved.length;
    
    if (totalChanges > 0) {
      report += `\n• ⚡ Всего изменений: ${totalChanges}`;
    } else {
      report += `\n• ✅ Никаких критических изменений`;
    }
    
    return report;
  }

  /**
   * Форматирование еженедельного отчета
   */
  private static formatWeeklyReport(stats: {
    totalWeeklyUsers: number;
    postsThisWeek: number;
    noPostsThisWeek: number;
    updatedUsers: Array<{username: string, unitsCount: number, consecutivePosts: number}>;
  }): string {
    let report = "📊 Еженедельный отчет WeeklyCron:\n\n";
    
    report += `👥 Weekly статистика:\n`;
    report += `• Активных weekly участников: ${stats.totalWeeklyUsers}\n`;
    report += `• Прислали пост за неделю: ${stats.postsThisWeek}\n`;
    report += `• Не прислали пост за неделю: ${stats.noPostsThisWeek}\n\n`;
    
    if (stats.updatedUsers.length > 0) {
      report += `✅ Обновленные пользователи:\n`;
      stats.updatedUsers.forEach(user => {
        report += `• @${user.username} — всего постов: ${user.unitsCount}, подряд: ${user.consecutivePosts}\n`;
      });
      report += `\n`;
    }
    
    // Добавляем процентную статистику
    if (stats.totalWeeklyUsers > 0) {
      const successRate = Math.round((stats.postsThisWeek / stats.totalWeeklyUsers) * 100);
      report += `📈 Статистика активности: ${successRate}% участников прислали пост\n\n`;
    }
    
    report += `✅ Weekly отчет завершен в ${new Date().toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC`;
    
    return report;
  }

  /**
   * Форматирование отчета об ошибке
   */
  private static formatErrorReport(error: Error, operation: string, additionalInfo?: string): string {
    let report = `🚨 КРИТИЧЕСКАЯ ОШИБКА в ${operation}:\n\n`;
    
    report += `❌ Ошибка: ${error.message}\n`;
    report += `📍 Операция: ${operation}\n`;
    report += `🕐 Время: ${new Date().toISOString()}\n`;
    
    if (additionalInfo) {
      report += `📋 Дополнительно: ${additionalInfo}\n`;
    }
    
    if (error.stack) {
      // Берем только первые 3 строки стека для краткости
      const stackLines = error.stack.split('\n').slice(0, 4);
      report += `\n🔍 Стек вызовов:\n${stackLines.join('\n')}`;
    }
    
    report += `\n\n⚠️ Требуется ручная проверка системы!`;
    
    return report;
  }

  /**
   * Получение текста детализации изменений daily cron с никами
   */
  private static getDailyCronChangesText(stats: ProcessingStats): string {
    let result = '';
    let hasChanges = false;
    
    // Новые страйки с никами
    if (stats.newStrikes.length > 0) {
      result += `⚠️ Получили новые страйки (${stats.newStrikes.length}):\n`;
      stats.newStrikes.forEach(user => {
        result += `   @${user.username} — ${user.strikes} страйк\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Автопаузы с никами
    if (stats.autoPaused.length > 0) {
      result += `⏸️ Ушли на автопаузу (${stats.autoPaused.length}):\n`;
      stats.autoPaused.forEach(user => {
        result += `   @${user.username}\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Завершили паузу с никами
    if (stats.pauseCompleted.length > 0) {
      result += `▶️ Завершили паузу (${stats.pauseCompleted.length}):\n`;
      stats.pauseCompleted.forEach(user => {
        result += `   @${user.username}\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Удалены после истечения паузы с никами
    if (stats.pauseExpiredRemoved.length > 0) {
      result += `❌ Удалены после истечения паузы (${stats.pauseExpiredRemoved.length}):\n`;
      stats.pauseExpiredRemoved.forEach(user => {
        result += `   @${user.username}\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Удалены из-за окончания подписки с никами
    if (stats.subscriptionRemoved.length > 0) {
      result += `🚫 Удалены (подписка истекла) — ${stats.subscriptionRemoved.length}:\n`;
      stats.subscriptionRemoved.forEach(user => {
        result += `   @${user.username}\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Предупреждения о подписке с никами
    if (stats.subscriptionWarnings.length > 0) {
      result += `💳 Получили предупреждения о подписке (${stats.subscriptionWarnings.length}):\n`;
      stats.subscriptionWarnings.forEach(user => {
        result += `   @${user.username} — ${user.daysLeft} дн. осталось\n`;
      });
      result += `\n`;
      hasChanges = true;
    }
    
    // Если никаких изменений не было
    if (!hasChanges) {
      result += `✅ Сегодня никаких критических изменений не было\n\n`;
    }
    
    return result;
  }

  /**
   * Базовое форматирование ежедневного отчета (перенесено из constants.ts)
   */
  private static formatBasicDailyCronReport(stats: ProcessingStats): string {
    let report = "📊 Ежедневный отчет dailyCron:\n\n";
    
    // Общая статистика
    report += `👥 Общая статистика:\n`;
    report += `• Активных участников: ${stats.totalActive}\n`;
    report += `• Прислали пост сегодня: ${stats.postsToday}\n`;
    report += `• Не прислали пост: ${stats.noPosts}\n\n`;
    
    // Страйки и риски
    if (stats.newStrikes.length > 0) {
      report += `⚠️ Новые страйки:\n`;
      stats.newStrikes.forEach((user: any) => {
        report += `• @${user.username} — ${user.strikes} страйк(а)\n`;
      });
      report += `\n`;
    }
    
    if (stats.riskyUsers.length > 0) {
      report += `🚨 На грани исключения (3 страйка):\n`;
      stats.riskyUsers.forEach((user: any) => {
        report += `• @${user.username}\n`;
      });
      report += `\n`;
    }
    
    if (stats.autoPaused.length > 0) {
      report += `⏸️ Автоматически ушли на паузу:\n`;
      stats.autoPaused.forEach((user: any) => {
        report += `• @${user.username}\n`;
      });
      report += `\n`;
    }
    
    // Паузы
    if (stats.pauseCompleted.length > 0) {
      report += `✅ Завершили паузу:\n`;
      stats.pauseCompleted.forEach((user: any) => {
        report += `• @${user.username}\n`;
      });
      report += `\n`;
    }
    
    if (stats.pauseExpiredRemoved.length > 0) {
      report += `❌ Удалены после истечения паузы:\n`;
      stats.pauseExpiredRemoved.forEach((user: any) => {
        report += `• @${user.username}\n`;
      });
      report += `\n`;
    }
    
    if (stats.currentlyPaused.length > 0) {
      report += `😴 Сейчас на паузе:\n`;
      stats.currentlyPaused.forEach((user: any) => {
        report += `• @${user.username} (до ${user.pauseUntil})\n`;
      });
      report += `\n`;
    }
    
    // Подписки
    if (stats.subscriptionWarnings.length > 0) {
      report += `💳 Предупреждения о подписке:\n`;
      stats.subscriptionWarnings.forEach((user: any) => {
        report += `• @${user.username} — ${user.daysLeft} дней осталось\n`;
      });
      report += `\n`;
    }
    
    if (stats.subscriptionRemoved.length > 0) {
      report += `🚫 Удалены из-за окончания подписки:\n`;
      stats.subscriptionRemoved.forEach((user: any) => {
        report += `• @${user.username}\n`;
      });
      report += `\n`;
    }
    
    // Опасные случаи
    if (stats.dangerousCases.length > 0) {
      report += `🔴 ТРЕБУЮТ ВНИМАНИЯ:\n`;
      stats.dangerousCases.forEach((user: any) => {
        report += `• @${user.username} — ${user.reason}\n`;
      });
      report += `\n`;
    }
    
    report += `✅ Отчет завершен в ${new Date().toLocaleString('ru-RU', { timeZone: 'UTC' })} UTC`;
    
    return report;
  }

  /**
   * Получение текста стандартной статистики (краткие данные) - для старого формата
   */
  private static getStandardStatsText(stats: ProcessingStats): string {
    let result = '';
    
    // Добавляем только самые важные изменения кратко
    if (stats.newStrikes.length > 0) {
      result += `⚠️ Новые страйки: ${stats.newStrikes.length}\n`;
    }
    
    if (stats.autoPaused.length > 0) {
      result += `⏸️ Автопаузы: ${stats.autoPaused.length}\n`;
    }
    
    if (stats.pauseExpiredRemoved.length > 0) {
      result += `❌ Удалены после паузы: ${stats.pauseExpiredRemoved.length}\n`;
    }
    
    if (stats.subscriptionRemoved.length > 0) {
      result += `🚫 Удалены (подписка): ${stats.subscriptionRemoved.length}\n`;
    }
    
    return result;
  }

  /**
   * Отправка краткой статистики (для тестирования)
   */
  static async sendQuickStats(message: string): Promise<void> {
    try {
      const report = `📊 Быстрая статистика:\n\n${message}\n\n🕐 ${new Date().toISOString()}`;
      await ChatManager.sendDirectMessage(OWNER_TELEGRAM_ID, report);
      console.log(`✅ Быстрая статистика отправлена`);
    } catch (err) {
      console.error(`❌ Ошибка отправки быстрой статистики:`, err);
    }
  }
} 