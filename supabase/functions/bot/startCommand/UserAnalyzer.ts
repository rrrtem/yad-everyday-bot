import { findUserByTelegramId, registerUser, updateExistingUser } from "../userHandler.ts";

export type FlowType = 'new_user' | 'active_user' | 'continue_setup' | 'returning_user';

export interface UserContext {
  telegramId: number;
  user: any;
  telegramUserData: any;
  flowType: FlowType;
  isNewUser: boolean;
  isReturningUser: boolean;
  hasSavedDays: boolean;
  daysLeft: number;
}

/**
 * Анализирует пользователя и определяет какой Flow нужно запустить
 */
export class UserAnalyzer {
  
  async analyze(telegramId: number, telegramUserData: any): Promise<UserContext> {
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
      daysLeft
    };
  }
  
  private determineFlowType(user: any, isNewUser: boolean, isReturningUser: boolean): FlowType {
    // 1. Активный пользователь
    if (user.in_chat === true) {
      return 'active_user';
    }
    
    // 2. Пользователь в процессе настройки
    if (user.user_state) {
      return 'continue_setup';
    }
    
    // 3. Возвращающийся пользователь (уже был в чате)
    if (isReturningUser) {
      return 'returning_user';
    }
    
    // 4. Новый пользователь (включая существующих в БД, но новых для чата)
    return 'new_user';
  }
  
  private hasUnusedSubscriptionDays(user: any): boolean {
    if (!user.subscription_days_left) return false;
    return user.subscription_days_left > 0;
  }
} 