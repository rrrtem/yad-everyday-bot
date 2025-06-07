// =====================================================
// ЧИСЛОВЫЕ ПАРАМЕТРЫ И НАСТРОЙКИ
// =====================================================

export const DEFAULT_STRIKES_COUNT = 0;
export const AUTO_PAUSE_DAYS = 7;
export const SUBSCRIPTION_REMINDER_DAYS = 3;
export const DURATION_PENALTY_DAYS = 1;
export const RESTORED_LIVES_AFTER_PENALTY = 2;

// ID топиков (thread) для публичных напоминаний
// ❗ Чтобы получить правильные ID:
// 1. Создайте топики "Тексты" и "Картинки" в групповом чате
// 2. Отправьте команду /get в каждый топик
// 3. Обновите значения ниже на актуальные ID
export const PUBLIC_REMINDER_THREAD_ID_TEXT = 2; // Топик для участников режима "тексты"  
export const PUBLIC_REMINDER_THREAD_ID_IMAGE = 855; // Топик для участников режима "картинки"

// Telegram ID владельца бота (установить актуальный ID)
export const OWNER_TELEGRAM_ID = 149365895;

// =====================================================
// TRIBUTE API НАСТРОЙКИ
// =====================================================

// Время дедупликации webhook'ов в часах
export const WEBHOOK_DEDUPLICATION_HOURS = 1;

// =====================================================
// ССЫЛКИ
// =====================================================

export const CHALLENGE_JOIN_LINK = "https://t.me/+vuamIyllbko2MjVk"; 

// Ссылки на оплату
export const DEFAULT_PAYMENT_URL = "https://t.me/tribute/app?startapp=svBt";
export const SPECIAL_PAYMENT_URL = "https://t.me/tribute/app?startapp=suXB";
export const CANCEL_PAYMENT_URL = "https://t.me/tribute";

// =====================================================
// РЕЖИМЫ И КОНФИГУРАЦИЯ УЧАСТИЯ
// =====================================================

// Доступные режимы и ритмы
export const AVAILABLE_MODES = {
  TEXT: "text",
  IMAGE: "image"
};

export const AVAILABLE_PACES = {
  DAILY: "daily", 
  WEEKLY: "weekly"
};

// Конфигурация режимов и доступных ритмов
export const MODE_PACE_CONFIG = {
  [AVAILABLE_MODES.TEXT]: [AVAILABLE_PACES.DAILY, AVAILABLE_PACES.WEEKLY],
  [AVAILABLE_MODES.IMAGE]: [AVAILABLE_PACES.DAILY]
};

// Валидные промокоды (позже можно вынести в БД)
export const VALID_PROMO_CODES = ["CLUB2024", "RETURN"];

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

export function pluralizeLives(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'жизнь';
  if (abs >= 2 && abs <= 4) return 'жизни';
  return 'жизней';
}

export function pluralizeDays(n: number) {
  const abs = Math.abs(n);
  if (abs === 1) return 'день';
  if (abs >= 2 && abs <= 4) return 'дня';
  return 'дней';
}

// =====================================================
// СООБЩЕНИЯ: СТРАЙКИ И АВТОМАТИЧЕСКАЯ ПАУЗА
// =====================================================

export const MSG_STRIKE_FIRST = "Ты пропустил один денек. Ничего страшного. Если пропустишь 3, предложу взять паузу. Как только пришлешь что-нибудь, страйк сбросится.";
export const MSG_STRIKE_SECOND = "Второй пропуск подряд. Не забывай про свой челлендж! Если будет третий пропуск, предложу взять паузу.";
export const MSG_STRIKE_THIRD = "У тебя уже 3 страйка! Ещё один пропуск, и я предложу тебе взять недельную паузу, чтобы подписка не тратилась впустую.";
export const MSG_STRIKE_FOURTH = `Четвертый пропуск подряд. Ставим тебя на паузу на ${AUTO_PAUSE_DAYS} дней. 

Подписка продолжит списываться, но мы тебя не будем дергать. Если пришлешь что-то в течение недели, страйк сбросится.

Если ничего не пришлешь, поставим подписку на паузу и удалим из чата — но ты всегда сможешь вернуться и доиспользовать оставшиеся дни подписки.

Также можем предложить перейти на более медленную скорость участия.`;

export const MSG_SUBSCRIPTION_ENDING_REMINDER = `⏰ Напоминание о подписке!

У тебя заканчиваются дни подписки. Возобнови подписку через Tribute, чтобы продолжить участие в челлендже.`;

export const MSG_SUBSCRIPTION_EXPIRED = `⏰ Подписка истекла!

Твоя подписка истекла. Возобнови её через Tribute или используй команду /comeback для возвращения с сохранёнными днями.`;

export const MSG_REMOVED_SUBSCRIPTION_EXPIRED = `Твоя подписка истекла, и мы удалили тебя из чата.

Ты можешь вернуться в любой момент, возобновив подписку через /start или команду /comeback.`;

export const MSG_PAUSE_EXPIRED_REMOVED = `Твоя недельная пауза истекла, и ты так и не прислал ни одного поста. 

Мы поставили твою подписку на паузу и удалили тебя из чата, чтобы не тратить оплаченное время впустую.

Ты можешь вернуться в любой момент командой /comeback и доиспользовать оставшиеся дни подписки.`;

// =====================================================
// ОТЧЕТЫ И СТАТИСТИКА
// =====================================================

export const MSG_DAILY_CRON_REPORT = (stats: any) => {
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
};

// =====================================================
// СООБЩЕНИЯ: КОМАНДА /START (порядок по сценарию A1)
// =====================================================

export const MSG_WELCOME = `👋 Привет! Я бот проекта «Ясность&Движение / Каждый день». 
Я буду помогать тебе участвовать в челлендже: присылать напоминания о дедлайнах, следить за активностью и количеством жизней.
Если возникнут вопросы или что-то пойдет не так — пиши @rrrtem.

Давайте настроим твое участие! 🚀`;

export const MSG_WELCOME_BACK = `🎉 Добро пожаловать обратно!

Ты вернулся в чат, и у тебя есть сохранённые дни подписки. Твоя подписка автоматически возобновлена.

Продолжай свой челлендж! 💪`;

export const MSG_LEFT_CHAT = `👋 Ты покинул чат челленджа.

Ты можешь вернуться в любой момент через команду /start, если у тебя есть активная подписка.`;

export const MSG_LEFT_CHAT_DAYS_SAVED = (daysLeft: number) => `👋 Ты покинул чат челленджа.

💰 У тебя сохранено ${daysLeft} ${pluralizeDays(daysLeft)} подписки! Ты можешь вернуться в любой момент через команду /comeback и доиспользовать оставшееся время.

Твои дни подписки "заморожены" и не тратятся, пока ты не в чате.`;

export const MSG_MODE = `📝 Выбери режим участия:

• **Тексты** — пиши тексты каждый день или раз в неделю
• **Картинки** — делись фотографиями каждый день

Что тебе ближе?`;

export const MSG_PACE = (mode: string) => {
  if (mode === AVAILABLE_MODES.IMAGE) {
    return `📸 Для режима "Картинки" доступен только ритм **"Каждый день"**.`;
  }
  return `⏰ Выбери ритм участия:

• **Каждый день** — публикуешь пост ежедневно
• **Один раз в неделю** — публикуешь пост раз в неделю

Какой ритм тебе подходит?`;
};

export const MSG_PAYMENT_COND = `💰 **Как устроена оплата:**

Участие в проекте стоит **4900₽ в месяц**. Это подписка — она автоматически продлевается каждый месяц.

• Оплата проходит через безопасный сервис Tribute
• Можно отменить подписку в любой момент  
• После оплаты ты сразу получишь доступ к чату участников

Готов(а) к оплате?`;

export const MSG_PROMO = `🎫 **Есть промокод?**

Если ты участвовал(а) в прошлых сезонах или у тебя есть промокод от нас — введи его, чтобы получить скидку.

Если промокода нет — просто нажми кнопку ниже.`;

export const MSG_PROMO_ERR = `❌ Промокод не подходит. Проверь правильность написания или нажми "У меня нет промокода".`;

export const MSG_LINK_CLUB = (link: string) => `🎉 Отлично! Ты участник клуба.

Переходи по ссылке для оформления подписки со скидкой:
${link}`;

export const MSG_LINK_STANDARD = (link: string) => `💳 Переходи по ссылке для оформления подписки:
${link}

После успешной оплаты ты автоматически будешь добавлен(а) в чат участников!`;

export const MSG_COMEBACK_RECEIVED = `Классно, что ты решил(а) вернуться! Сейчас идёт пробный сезон, и скоро он закончится. Мы напишем тебе, когда перезапустим челлендж заново.
У тебя остались неиспользованные дни с прошлой подписки. Присоединиться к чату участников:
${CHALLENGE_JOIN_LINK}`;

// =====================================================
// СООБЩЕНИЯ: ОБРАБОТКА ПОСТОВ #DAILY
// =====================================================

export const MSG_DAILY_ACCEPTED = "Текст принят! Ура и до завтра.";
export const MSG_DAILY_TO_GROUPCHAT = "Пост с #daily нужно отправлять в групповой чат, а не в личку боту.";
export const MSG_PAUSE_REMOVED_BY_POST = "Отлично! Ты прислал пост во время паузы, поэтому мы снимаем тебя с паузы. Добро пожаловать обратно к активному участию!";

// =====================================================
// СООБЩЕНИЯ: АВТОМАТИЧЕСКИЕ НАПОМИНАНИЯ И ШТРАФЫ
// =====================================================

// Сообщение для публичного напоминания в канал с динамическим временем до конца дня
export const MSG_PUBLIC_DEADLINE_REMINDER = (usernames: string[], timeLeftMsg: string) => `${usernames.map(u => '@' + u).join(', ')} ${timeLeftMsg}`;

// =====================================================
// СООБЩЕНИЯ: СЛУЖЕБНЫЕ И УТИЛИТЫ
// =====================================================

export const MSG_GET_CHAT_ID = (chatId: number) => `ID этого чата: <code>${chatId}</code>`;

export const MSG_UNKNOWN_ERROR = "Произошла неожиданная ошибка. Напиши Артему: @rrrtem";

// =====================================================
// УСТАРЕВШИЕ СООБЩЕНИЯ (для совместимости)
// =====================================================

export const MSG_START = `Привет! Я бот проекта «Ясность&Движение / Каждый день». Я буду присылать тебе личные уведомления о челлендже: напоминания о дедлайнах, пропущенных днях, оставшихся жизнях. Если что-то не так и для обратной связи, пиши @rrrtem. Участие в проекте стоит 4900 в месяц. Учавствовать → https://t.me/tribute/app?startapp=suXB`;

// =====================================================
// СООБЩЕНИЯ: TRIBUTE API WEBHOOK'И (Б6, Б7)
// =====================================================

export const MSG_SUBSCRIPTION_RENEWED = `🎉 Подписка активирована!

Добро пожаловать в челлендж! Теперь ты можешь участвовать и присылать свои посты.

Твоя подписка действует до указанной даты. Удачи! 💪`;

export const MSG_SUBSCRIPTION_RENEWED_WITH_BONUS = (bonusDays: number) => `🎉 Подписка активирована!

Отлично! Твоя новая подписка активирована, и к ней добавлено ${bonusDays} ${pluralizeDays(bonusDays)} с предыдущего периода.

Добро пожаловать обратно в челлендж! 💪`;

export const MSG_SUBSCRIPTION_CANCELLED = (expiresAt: string, daysLeft: number) => `⏸️ Подписка отменена

Твоя подписка в Tribute отменена. Доступ к чату сохранится до ${expiresAt}.

${daysLeft > 0 ? `У тебя сохранено ${daysLeft} ${pluralizeDays(daysLeft)} подписки. После окончания доступа ты сможешь вернуться командой /comeback и доиспользовать оставшиеся дни.` : ''}

Ты всегда можешь возобновить участие через /start или Tribute.`;

export const MSG_TRIBUTE_WEBHOOK_ERROR = `🚨 Ошибка обработки webhook Tribute

Получен некорректный webhook от Tribute API. Обратитесь в поддержку.

Детали: не найден пользователь с telegram_user_id`;

export const MSG_TRIBUTE_SIGNATURE_ERROR = `🚨 Ошибка проверки подписи Tribute

Получен webhook с некорректной подписью. Возможна попытка подмены данных.`;

// =====================================================
// СООБЩЕНИЯ: КОМАНДЫ СИНХРОНИЗАЦИИ
// =====================================================

export const MSG_SYNC_NO_ACTIVE_USERS = `ℹ️ Активных пользователей для синхронизации не найдено`;

export const MSG_SYNC_COMPLETE = (checkedCount: number, expiredCount: number, restoredCount: number) => 
`✅ Синхронизация завершена!
📊 Проверено пользователей: ${checkedCount}
⏰ Истекших подписок: ${expiredCount}
🔄 Восстановлено подписок: ${restoredCount}`;

export const MSG_SUBSCRIPTION_EXPIRED_NOTIFICATION = (expiresAt: string, daysLeft: number) => 
`🔔 Ваша подписка истекла ${expiresAt}. ${daysLeft > 0 ? `У вас осталось ${daysLeft} ${pluralizeDays(daysLeft)} доступа.` : 'Доступ к премиум контенту приостановлен.'}`;

