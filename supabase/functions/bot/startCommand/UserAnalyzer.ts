import { findUserByTelegramId, registerUser, updateExistingUser } from "../userHandler.ts";
import clubData from "./club.json" assert { type: "json" };

export type FlowType = 'new_user' | 'active_user' | 'continue_setup' | 'returning_user' | 'in_waitlist';

export interface UserContext {
  telegramId: number;
  user: any;
  telegramUserData: any;
  flowType: FlowType;
  isNewUser: boolean;
  isReturningUser: boolean;
  hasSavedDays: boolean;
  daysLeft: number;
  autoTriggered?: boolean; // Запущен автоматически от текстового сообщения
  originalMessage?: string; // Оригинальное сообщение пользователя
}

/**
 * Анализирует пользователя и определяет какой Flow нужно запустить
 */
export class UserAnalyzer {
  
  async analyze(telegramId: number, telegramUserData: any, autoTriggered: boolean = false, originalMessage?: string): Promise<UserContext> {
    // Шаг 1: Регистрация/актуализация пользователя
    let user = await findUserByTelegramId(telegramId);
    let isNewUser = false;
    let isReturningUser = false;
    
    if (!user) {
      // Новый пользователь - регистрируем
      isNewUser = true;
      await registerUser(telegramUserData);
      user = await findUserByTelegramId(telegramId);
    } else {
      // Существующий пользователь - актуализируем данные
      await updateExistingUser(telegramId, telegramUserData);
      user = await findUserByTelegramId(telegramId);
      
      // Определяем, возвращающийся ли это пользователь (уже был в чате)
      isReturningUser = user.joined_at !== null;
    }
    
    // Шаг 1.5: Проверяем участие в клубе по username
    await this.checkAndSetClubMembership(telegramId, telegramUserData);
    // Обновляем данные пользователя после возможного изменения статуса клуба
    user = await findUserByTelegramId(telegramId);
    
    // Шаг 2: Определяем тип Flow
    const flowType = this.determineFlowType(user, isNewUser, isReturningUser);
    
    // Шаг 3: Дополнительная информация
    const hasSavedDays = this.hasUnusedSubscriptionDays(user);
    const daysLeft = user.subscription_days_left || 0;
    
    return {
      telegramId,
      user,
      telegramUserData,
      flowType,
      isNewUser,
      isReturningUser,
      hasSavedDays,
      daysLeft,
      autoTriggered,
      originalMessage
    };
  }
  
  /**
   * Проверяет, является ли пользователь участником клуба по username и обновляет статус в БД
   */
  private async checkAndSetClubMembership(telegramId: number, telegramUserData: any): Promise<void> {
    const username = telegramUserData.username;
    
    if (!username) {
      // console.log(`UserAnalyzer: у пользователя ${telegramId} нет username, пропускаем проверку клуба`);
      return;
    }

    const isClubMember = this.isUserInClub(username);
    // console.log(`UserAnalyzer: проверка клуба для @${username}: ${isClubMember ? 'найден' : 'не найден'}`);

    if (isClubMember) {
      await this.setClubMembership(telegramId, true);
      // console.log(`UserAnalyzer: автоматически проставлен club=true для пользователя ${telegramId} (@${username})`);
    }
  }
  
  /**
   * Проверяет, есть ли username в списке участников клуба
   */
  private isUserInClub(username: string): boolean {
    return clubData.club_members.includes(username.toLowerCase());
  }
  
  /**
   * Устанавливает статус участия в клубе в БД
   */
  private async setClubMembership(telegramId: number, clubStatus: boolean): Promise<void> {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({
        club: clubStatus,
        updated_at: now
      })
      .eq("telegram_id", telegramId);
      
    if (error) {
      console.error("UserAnalyzer: ошибка при обновлении статуса клуба:", error);
    }
  }
  
  private determineFlowType(user: any, isNewUser: boolean, isReturningUser: boolean): FlowType {
    // 1. Активный пользователь
    if (user.in_chat === true) {
      return 'active_user';
    }
    
    // 2. Пользователь в списке ожидания
    if (user.waitlist === true || user.user_state === 'in_waitlist') {
      return 'in_waitlist';
    }
    
    // 3. Пользователь в процессе настройки
    if (user.user_state) {
      return 'continue_setup';
    }
    
    // 4. Возвращающийся пользователь (уже был в чате)
    if (isReturningUser) {
      return 'returning_user';
    }
    
    // 5. Новый пользователь (включая существующих в БД, но новых для чата)
    return 'new_user';
  }
  
  private hasUnusedSubscriptionDays(user: any): boolean {
    if (!user.subscription_days_left) return false;
    return user.subscription_days_left > 0;
  }
} 