import { pluralizeDays, CHALLENGE_JOIN_LINK } from '../constants.ts';

/**
 * Интерфейс для данных пользователя
 */
interface UserStatusData {
  is_in_chat?: boolean;
  in_chat?: boolean;
  subscription_days_left: number;
  subscription_active: boolean;
  expires_at?: string;
  mode?: 'text';
  pace?: 'daily' | 'weekly';
  units_count?: number;
  strikes_count?: number;
  consecutive_posts_count?: number;
  last_post_date?: string;
  public_remind?: boolean;
  pause_until?: string;
}

/**
 * Типы состояний подписки для лучшей читаемости
 */
enum SubscriptionStatus {
  NOT_IN_CHAT = 'not_in_chat',
  USING_SAVED_DAYS = 'using_saved_days',
  ACTIVE_SUBSCRIPTION = 'active_subscription',
  MIXED_STATUS = 'mixed_status',
  UNCLEAR_STATUS = 'unclear_status'
}

/**
 * Определяет статус подписки пользователя
 */
function determineSubscriptionStatus(user: UserStatusData): SubscriptionStatus {
  const isInChat = user.is_in_chat !== false && user.in_chat !== false;
  
  if (!isInChat) {
    return SubscriptionStatus.NOT_IN_CHAT;
  }
  
  if (user.subscription_days_left > 0 && !user.subscription_active) {
    return SubscriptionStatus.USING_SAVED_DAYS;
  }
  
  if (user.subscription_active && user.subscription_days_left === 0) {
    return SubscriptionStatus.ACTIVE_SUBSCRIPTION;
  }
  
  if (user.subscription_active && user.subscription_days_left > 0) {
    return SubscriptionStatus.MIXED_STATUS;
  }
  
  return SubscriptionStatus.UNCLEAR_STATUS;
}

/**
 * Форматирует информацию о подписке в зависимости от статуса
 */
function formatSubscriptionInfo(user: UserStatusData, status: SubscriptionStatus): string {
  const now = new Date();
  
  switch (status) {
    case SubscriptionStatus.NOT_IN_CHAT:
      return formatNotInChatStatus(user, now);
      
    case SubscriptionStatus.USING_SAVED_DAYS:
      return formatSavedDaysStatus(user, now);
      
    case SubscriptionStatus.ACTIVE_SUBSCRIPTION:
      return formatActiveSubscriptionStatus(user, now);
      
    case SubscriptionStatus.MIXED_STATUS:
      return formatMixedStatus(user, now);
      
    case SubscriptionStatus.UNCLEAR_STATUS:
    default:
      return formatUnclearStatus(user);
  }
}

/**
 * Форматирует статус когда пользователь не в чате
 */
function formatNotInChatStatus(user: UserStatusData, now: Date): string {
  let message = `❌ Ты не находишься в чате участников\n`;
  
  if (user.subscription_days_left > 0) {
    const savedDaysEndDate = new Date(now);
    savedDaysEndDate.setDate(savedDaysEndDate.getDate() + user.subscription_days_left);
    message += `• У тебя есть ${user.subscription_days_left} ${pluralizeDays(user.subscription_days_left)} с прошлой подписки\n`;
    message += `• Действуют до: ${savedDaysEndDate.toLocaleDateString('ru-RU')}\n`;
  } else {
    message += `• Сохранённых дней нет\n`;
  }
  
  return message + `\n`;
}

/**
 * Форматирует статус когда используются сохранённые дни
 */
function formatSavedDaysStatus(user: UserStatusData, now: Date): string {
  const savedDaysEndDate = new Date(now);
  savedDaysEndDate.setDate(savedDaysEndDate.getDate() + user.subscription_days_left);
  
  return `💰 Используются сохранённые дни с прошлой подписки
• Осталось дней: ${user.subscription_days_left}
• Действуют до: ${savedDaysEndDate.toLocaleDateString('ru-RU')}
• Новая подписка в Tribute пока не нужна

`;
}

/**
 * Форматирует статус активной подписки
 */
function formatActiveSubscriptionStatus(user: UserStatusData, now: Date): string {
  let message = `✅ Подписка активна\n\n`;
  
  if (user.expires_at) {
    const expiresDate = new Date(user.expires_at);
    const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    message += `• Действует до: ${expiresDate.toLocaleDateString('ru-RU')}\n`;
    message += `• Осталось дней: ${Math.max(0, daysLeft)}\n`;
  }
  
  return message + `\n`;
}

/**
 * Форматирует смешанный статус (активная подписка + сохранённые дни)
 */
function formatMixedStatus(user: UserStatusData, now: Date): string {
  let message = `✅ Подписка активна + есть сохранённые дни\n\n`;
  
  if (user.expires_at) {
    const expiresDate = new Date(user.expires_at);
    const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    message += `• Активная подписка до: ${expiresDate.toLocaleDateString('ru-RU')} (${Math.max(0, daysLeft)} дней)\n`;
  }
  
  message += `• Плюс сохранённые дни: ${user.subscription_days_left} ${pluralizeDays(user.subscription_days_left)}\n`;
  
  return message + `\n`;
}

/**
 * Форматирует неопределённый статус
 */
function formatUnclearStatus(user: UserStatusData): string {
  return `❓ Статус подписки неопределён\n\n
• Активной подписки: ${user.subscription_active ? 'да' : 'нет'}
• Сохранённых дней: ${user.subscription_days_left || 0}
• Возможно, данные ещё не обновились

`;
}

/**
 * Форматирует информацию о режиме и ритме участия
 */
function formatParticipationInfo(user: UserStatusData): string {
  const mode = user.mode === 'text' ? 'Тексты' : '❓ Не выбран';
  const pace = user.pace === 'daily' ? 'Каждый день' : user.pace === 'weekly' ? 'Раз в неделю' : '❓ Не выбран';
  
  return `📝 **Режим:** ${mode}\n⏰ **Ритм:** ${pace}`;
}

/**
 * Форматирует статистику активности (только если есть посты)
 */
function formatActivityStats(user: UserStatusData): string {
  if (!user.units_count || user.units_count === 0) {
    return '';
  }
  
  let message = `• Всего постов: ${user.units_count}\n`;
  message += `• Пропусков подряд: ${user.strikes_count || 0}\n`;
  message += `• Дней без пропусков: ${user.consecutive_posts_count || 0}\n\n`;
  message += `\n`;
  message += `Ссылка на чат: ${CHALLENGE_JOIN_LINK}`;

  return message + `\n`;
}

/**
 * Главная функция генерации статусного сообщения
 * @param user - данные пользователя
 * @returns отформатированное сообщение о статусе
 */
export function generateUserStatusMessage(user: UserStatusData): string {
  let statusMessage = `Все важное про участие в практике\n\n`;
  
  // Определяем статус подписки
  const subscriptionStatus = determineSubscriptionStatus(user);
  
  // Добавляем информацию о подписке
  statusMessage += formatSubscriptionInfo(user, subscriptionStatus);
  statusMessage += `\n`;
  
  // Добавляем информацию о режиме и ритме
  statusMessage += formatParticipationInfo(user);
  
  // Добавляем статистику активности (если есть)
  const activityStats = formatActivityStats(user);
  if (activityStats) {
    statusMessage += activityStats;
  }
  
  return statusMessage;
}

/**
 * Экспорт типов для использования в других модулях
 */
export type { UserStatusData };
export { SubscriptionStatus };

/**
 * Генерирует клавиатуру с кнопками для статусного сообщения
 * @param user - данные пользователя для адаптации кнопок под его состояние
 * @returns объект клавиатуры для Telegram API
 */
export async function generateStatusKeyboard(user: UserStatusData): Promise<any> {
  const { 
    TRIBUTE_BOT_LINK, 
    ADMIN_CONTACT,
    CALLBACK_TOGGLE_PUBLIC_REMINDER
  } = await import('../constants.ts');

  const keyboard: any[] = [];

  // Ряд 1: Управление подпиской (полная ширина)
  keyboard.push([
    { text: "👀 Подписка", url: TRIBUTE_BOT_LINK }
  ]);

  // Ряд 2: Поддержка (полная ширина)
  keyboard.push([
    { text: "🦉 Поддержка", url: `https://t.me/${ADMIN_CONTACT.replace('@', '')}` }
  ]);

  // Только для активных пользователей - добавляем кнопки управления
  if (isUserActive(user)) {
    // Ряд 3: Изменить режим (полная ширина)
    keyboard.push([
      { text: "🌗Режим", callback_data: "change_mode" }
    ]);
    
    // Ряд 4: Изменить ритм (полная ширина)  
    keyboard.push([
      { text: "💨 Ритм", callback_data: "change_pace" }
    ]);
    
    // Ряд 5: Каникулы (полная ширина)
    keyboard.push([
      { text: "😴 Каникулы", callback_data: "pause" }
    ]);
    
    // Ряд 6: Напоминания (полная ширина) - адаптивный текст
    const reminderButtonText = user.public_remind !== false 
      ? "🔕 Отключить напоминания" 
      : "🔔 Включить напоминания";
    
    keyboard.push([
      { text: reminderButtonText, callback_data: CALLBACK_TOGGLE_PUBLIC_REMINDER }
    ]);
  }

  return { inline_keyboard: keyboard };
}

/**
 * Проверяет, активен ли пользователь (может ли управлять настройками)
 */
function isUserActive(user: UserStatusData): boolean {
  const isInChat = user.is_in_chat !== false && user.in_chat !== false;
  const hasSubscription = user.subscription_active || user.subscription_days_left > 0;
  return isInChat && hasSubscription;
}

/**
 * Проверяет, находится ли пользователь на паузе
 */
function isUserOnPause(user: UserStatusData): boolean {
  if (!user.pause_until) return false;
  const pauseEnd = new Date(user.pause_until);
  return pauseEnd > new Date();
} 