import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatManager } from "./ChatManager.ts";
import { 
  MSG_STRIKE_FIRST,
  MSG_STRIKE_SECOND,
  MSG_STRIKE_THIRD,
  MSG_STRIKE_FOURTH,
  MSG_PAUSE_EXPIRED_REMOVED,
  MSG_SUBSCRIPTION_ENDING_REMINDER,
  MSG_SUBSCRIPTION_EXPIRED,
  MSG_REMOVED_SUBSCRIPTION_EXPIRED,
  AUTO_PAUSE_DAYS,
  SUBSCRIPTION_REMINDER_DAYS
} from "../../constants.ts";

export interface User {
  telegram_id: number;
  username?: string;
  in_chat: boolean;
  pace: string;
  post_today: boolean;
  strikes_count: number;
  consecutive_posts_count?: number; // Количество постов подряд без пропусков
  pause_until?: string;
  pause_started_at?: string;
  pause_days: number;
  subscription_days_left: number;
  subscription_active: boolean;
  club: boolean;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  left_at?: string;
  // Дополнительные поля для publicDeadlineReminder
  mode?: string;
  public_remind?: boolean;
}

export interface ProcessingStats {
  totalActive: number;
  postsToday: number;
  noPosts: number;
  newStrikes: Array<{username: string, strikes: number}>;
  riskyUsers: Array<{username: string, strikes: number}>;
  autoPaused: Array<{username: string}>;
  pauseCompleted: Array<{username: string}>;
  pauseExpiredRemoved: Array<{username: string}>;
  currentlyPaused: Array<{username: string, pauseUntil: string}>;
  subscriptionWarnings: Array<{username: string, daysLeft: number}>;
  subscriptionRemoved: Array<{username: string}>;
  dangerousCases: Array<{username: string, reason: string}>;
}

/**
 * Обработчик логики пользователей для крон-задач
 */
export class UserProcessor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Получение всех пользователей из БД
   */
  async getAllUsers(): Promise<User[]> {
    const usersRes = await this.supabase
      .from("users")
      .select("*");
      
    if (usersRes.error) {
      throw new Error(`Ошибка получения пользователей: ${usersRes.error.message}`);
    }
    
    return usersRes.data || [];
  }

  /**
   * Обработка страйков для активных пользователей с ежедневным ритмом
   */
  async processStrikesForDailyUsers(users: User[], now: Date, stats: ProcessingStats): Promise<void> {
    console.log(`🔍 ФАЗА 1: Проверка активных пользователей с ежедневным ритмом`);

    for (const user of users) {
      if (user.in_chat && user.pace === "daily") {
        stats.totalActive++;
        
        if (user.post_today) {
          stats.postsToday++;
        } else {
          stats.noPosts++;
          
          // Проверяем, не на паузе ли пользователь
          if (user.pause_until && new Date(user.pause_until) > now) {
            continue; // Пропускаем пользователей на паузе
          }
          
          await this.processUserStrike(user, now, stats);
        }
      }
    }
  }

  /**
   * Обработка страйка для конкретного пользователя
   */
  private async processUserStrike(user: User, now: Date, stats: ProcessingStats): Promise<void> {
    const newStrikes = (user.strikes_count || 0) + 1;
    let messageToSend = "";
    let updateData: any = {
      strikes_count: newStrikes,
      consecutive_posts_count: 0, // Сброс последовательных постов при страйке
      updated_at: now.toISOString()
    };
    
    switch (newStrikes) {
      case 1:
        messageToSend = MSG_STRIKE_FIRST;
        break;
      case 2:
        messageToSend = MSG_STRIKE_SECOND;
        break;
      case 3:
        messageToSend = MSG_STRIKE_THIRD;
        stats.riskyUsers.push({username: user.username || String(user.telegram_id), strikes: newStrikes});
        break;
      case 4:
        messageToSend = MSG_STRIKE_FOURTH;
        updateData.pause_started_at = now.toISOString();
        updateData.pause_until = new Date(now.getTime() + AUTO_PAUSE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        updateData.pause_days = AUTO_PAUSE_DAYS;
        stats.autoPaused.push({username: user.username || String(user.telegram_id)});
        break;
    }
    
    if (newStrikes <= 4) {
      await this.supabase
        .from("users")
        .update(updateData)
        .eq("telegram_id", user.telegram_id);
        
      await ChatManager.sendDirectMessage(user.telegram_id, messageToSend);
      
      if (newStrikes < 4) {
        stats.newStrikes.push({username: user.username || String(user.telegram_id), strikes: newStrikes});
      }
    }
  }

  /**
   * Обработка пользователей на паузе
   */
  async processPausedUsers(users: User[], now: Date, stats: ProcessingStats): Promise<void> {
    console.log(`🔍 ФАЗА 2: Проверка пользователей на паузе`);
    
    for (const user of users) {
      if (user.pause_until) {
        const pauseEnd = new Date(user.pause_until);
        if (pauseEnd <= now) {
          await this.processPauseExpired(user, now, stats);
        } else {
          // Все еще на паузе
          stats.currentlyPaused.push({
            username: user.username || String(user.telegram_id),
            pauseUntil: pauseEnd.toLocaleDateString('ru-RU')
          });
        }
      }
    }
  }

  /**
   * Обработка истечения паузы
   */
  private async processPauseExpired(user: User, now: Date, stats: ProcessingStats): Promise<void> {
    console.log(`⏰ Пауза истекла для ${user.username || user.telegram_id}, strikes: ${user.strikes_count}`);
    
    if (user.strikes_count === 4) {
      console.log(`🚨 Удаляем пользователя ${user.username || user.telegram_id} из чата (4 страйка)`);
      
      try {
        await ChatManager.removeUserFromChat(user.telegram_id);
      } catch (err) {
        console.error(`❌ Ошибка удаления пользователя ${user.username || user.telegram_id}:`, err);
      }
      
      await this.supabase
        .from("users")
        .update({
          in_chat: false,
          strikes_count: 0,
          pause_started_at: null,
          pause_until: null,
          pause_days: 0,
          left_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq("telegram_id", user.telegram_id);
        
      await ChatManager.sendDirectMessage(user.telegram_id, MSG_PAUSE_EXPIRED_REMOVED);
      stats.pauseExpiredRemoved.push({username: user.username || String(user.telegram_id)});
    } else {
      console.log(`✅ Снимаем с паузы ${user.username || user.telegram_id} (был пост во время паузы)`);
      
      await this.supabase
        .from("users")
        .update({
          pause_started_at: null,
          pause_until: null,
          pause_days: 0,
          updated_at: now.toISOString()
        })
        .eq("telegram_id", user.telegram_id);
        
      stats.pauseCompleted.push({username: user.username || String(user.telegram_id)});
    }
  }

  /**
   * Обработка подписок (subscription_days_left)
   */
  async processSubscriptions(users: User[], now: Date, stats: ProcessingStats): Promise<number[]> {
    console.log(`🔍 ФАЗА 3: Обработка subscription_days_left`);
    const usersToRemove: number[] = [];
    
    for (const user of users) {
      const hasNoActiveSubscription = !user.subscription_active;
      
      if (user.subscription_days_left > 0 && user.in_chat && hasNoActiveSubscription) {
        await this.processUserSubscription(user, now, stats, usersToRemove);
      } else if (user.in_chat && hasNoActiveSubscription && user.subscription_days_left === 0) {
        console.log(`🚨 ДЫРКА В ЛОГИКЕ: ${user.username || user.telegram_id} в чате БЕЗ подписки И БЕЗ сохраненных дней`);
        
        await this.supabase
          .from("users")
          .update({
            expires_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq("telegram_id", user.telegram_id);
          
        usersToRemove.push(user.telegram_id);
      }
    }
    
    return usersToRemove;
  }

  /**
   * Обработка подписки конкретного пользователя
   */
  private async processUserSubscription(user: User, now: Date, stats: ProcessingStats, usersToRemove: number[]): Promise<void> {
    const newDaysLeft = user.subscription_days_left - 1;
    console.log(`📉 ОБРАБОТКА ${user.username || user.telegram_id}: ${user.subscription_days_left} -> ${newDaysLeft} дней`);
    
    if (newDaysLeft === SUBSCRIPTION_REMINDER_DAYS) {
      console.log(`⚠️ Отправляем напоминание ${user.username || user.telegram_id} (${newDaysLeft} дней осталось)`);
      const isClubMember = user.club || false;
      await ChatManager.sendDirectMessage(user.telegram_id, MSG_SUBSCRIPTION_ENDING_REMINDER(isClubMember));
      stats.subscriptionWarnings.push({username: user.username || String(user.telegram_id), daysLeft: newDaysLeft});
      
    } else if (newDaysLeft === 1) {
      console.log(`🚨 Последний день подписки у ${user.username || user.telegram_id}`);
      const isClubMember = user.club || false;
      await ChatManager.sendDirectMessage(user.telegram_id, MSG_SUBSCRIPTION_EXPIRED(isClubMember));
      stats.subscriptionWarnings.push({username: user.username || String(user.telegram_id), daysLeft: newDaysLeft});
      
    } else if (newDaysLeft === 0) {
      console.log(`🚨 Подписка закончилась у ${user.username || user.telegram_id} - добавляем в список для удаления`);
      
      await this.supabase
        .from("users")
        .update({
          expires_at: now.toISOString(),
          subscription_days_left: 0,
          updated_at: now.toISOString()
        })
        .eq("telegram_id", user.telegram_id);
        
      usersToRemove.push(user.telegram_id);
      return; // Не обновляем days_left, так как уже установили 0
    }
    
    // Обновляем количество дней
    await this.supabase
      .from("users")
      .update({
        subscription_days_left: newDaysLeft,
        updated_at: now.toISOString()
      })
      .eq("telegram_id", user.telegram_id);
  }

  /**
   * Удаление пользователей с истекшей подпиской
   */
  async removeExpiredUsers(users: User[], usersToRemove: number[], now: Date, stats: ProcessingStats): Promise<void> {
    console.log(`🔍 ФАЗА 4: Удаление пользователей с истекшей подпиской`);
    
    for (const telegramId of usersToRemove) {
      const user = users.find(u => u.telegram_id === telegramId);
      if (!user) continue;
      
      console.log(`🚨 Удаляем ${user.username || user.telegram_id} (подписка истекла)`);
      
      try {
        await ChatManager.removeUserFromChat(user.telegram_id);
      } catch (err) {
        console.error(`❌ Ошибка удаления пользователя ${user.username || user.telegram_id}:`, err);
      }
      
      await this.supabase
        .from("users")
        .update({
          in_chat: false,
          updated_at: now.toISOString()
        })
        .eq("telegram_id", user.telegram_id);
        
      await ChatManager.sendDirectMessage(user.telegram_id, MSG_REMOVED_SUBSCRIPTION_EXPIRED);
      stats.subscriptionRemoved.push({username: user.username || String(user.telegram_id)});
    }
  }

  /**
   * Сброс ежедневных флагов post_today
   */
  async resetDailyFlags(): Promise<void> {
    console.log(`🔍 ФАЗА 5: Сброс флагов post_today`);
    
    const resetResult = await this.supabase
      .from("users")
      .update({ post_today: false })
      .neq("post_today", false);
      
    if (resetResult.error) {
      console.error(`❌ Ошибка сброса post_today:`, resetResult.error);
    } else {
      console.log(`✅ Сброшены флаги post_today`);
    }
  }

  /**
   * Анализ опасных случаев для админа
   */
  analyzeDangerousCases(users: User[], now: Date, stats: ProcessingStats): void {
    console.log(`🔍 ФАЗА 6: Анализ опасных случаев`);
    
    for (const user of users) {
      const username = user.username || String(user.telegram_id);
      
      // Участники с 3 страйками
      if (user.strikes_count === 3 && user.in_chat) {
        stats.dangerousCases.push({
          username,
          reason: "3 страйка - на грани постановки на паузу"
        });
      }
      
      // Новые неактивные пользователи (в чате, но без подписки)
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
    }
  }

  /**
   * Создание начальной статистики
   */
  createInitialStats(): ProcessingStats {
    return {
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
  }
} 