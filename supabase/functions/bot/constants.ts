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

// Ссылки для управления и поддержки
export const TRIBUTE_BOT_LINK = "https://t.me/tribute";
export const ADMIN_CONTACT = "@rrrtem";

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
export const VALID_PROMO_CODES = ["YASSS", "FREE10"];

// Типы промокодов
export const PROMO_TYPES = {
  CLUB_DISCOUNT: "YASSS",    // Дает скидку для участников клуба
  FREE_DAYS: "FREE10"        // Дает бесплатные дни
};

// Количество бесплатных дней для промокода FREE10
export const FREE_PROMO_DAYS = 10;


// =====================================================
// СООБЩЕНИЯ: КОМАНДА /START (порядок по сценарию A1)
// =====================================================

export const MSG_WELCOME = `Привет! Я бот практики «Каждый день» от сообщества <a href="https://www.instagram.com/clarity.and.movement/">«Ясность&Движение»</a>. 

Здесь мы каждый день пишем тексты или делаем картинки, но в будущем добавятся и другие направления. 

Я буду помогать тебе участвовать в проекте: присылать напоминания о дедлайнах, следить за активностью и пропусками.
Если возникнут вопросы или что-то пойдет не так — пиши @rrrtem.`;

export const MSG_WELCOME_RETURNING = (hasSavedDays: boolean, daysLeft?: number) => {
  let message = `Мы очень рады твоему возвращению! `;
  
  if (hasSavedDays && daysLeft) {
    message += `\n\n💰 У тебя сохранено ${daysLeft} ${pluralizeDays(daysLeft)} подписки с прошлого периода!`;
  }
  message += `\n\nСначала давай настроим режим твоего участия`;
  return message;
};

export const MSG_WELCOME_ALREADY_ACTIVE = `Ты уже с нами.
Нажми  /status, чтобы посмотреть детали своего участия и возможные настройки. Если есть проблемы, пиши Артему — @rrrtem
`;

export const MSG_WAITLIST = `🔐 К сожалению, сейчас вход в практику временно ограничен.

Мы добавили тебя в список ожидания. Как только появятся свободные места, мы сразу же напишем тебе!

Твой номер в очереди: #%position%

Если есть вопросы — пиши @rrrtem`;

export const MSG_WAITLIST_OPENED = `🎉 Отличные новости! Для тебя освободилось место в практике!

Давай продолжим настройку твоего участия.`;

export const MSG_SLOTS_OPENED = (slotsCount: number) => 
`🔓 Открыто ${slotsCount} новых ${slotsCount === 1 ? 'место' : slotsCount < 5 ? 'места' : 'мест'} для участия в практике.

Теперь новые пользователи смогут регистрироваться до заполнения всех мест.`;

export const MSG_SLOTS_FILLED = `🚨 Все свободные места заполнены!

Практика переходит в режим списка ожидания. Новые пользователи будут добавляться в waitlist до открытия новых мест.`;

export const MSG_SLOTS_STATUS = (available: number, total: number) => {
  if (available === 0) {
    return `📊 Статус мест: ${total}/${total} заполнено ❌\nВсе места заняты - режим waitlist активен`;
  }
  return `📊 Статус мест: ${total - available}/${total} заполнено\nСвободно: ${available} ${available === 1 ? 'место' : available < 5 ? 'места' : 'мест'}`;
};

export const MSG_SLOTS_CLOSED = `🔒 Все слоты закрыты!

Практика переведена в режим waitlist. Новые пользователи будут добавляться в список ожидания.`;

export const MSG_LEFT_CHAT = `👋 Ты покинул чат челленджа, но твоя подписка все еще активна, чтобы ее отменить перейди в @tribute.
Ты можешь вернуться в любой момент через команду /start. `;

export const MSG_LEFT_CHAT_DAYS_SAVED = (daysLeft: number) => `👋 Ты покинул чат челленджа, но твоя подписка все еще активна, чтобы ее отменить — @tribute.

Если ты отменишь подписку сегодня, у тебя сохранится ${daysLeft} ${pluralizeDays(daysLeft)} подписки! Ты можешь вернуться в любой момент через команду /start и доиспользовать оставшееся время.
`;

export const MSG_MODE = `Выбери, что будешь делать. Этот режим можно будет изменить после.

• Тексты — эссе, наблюдения за собой или миром, дневники, посты, анонсы и любые другие жанры
• Картинки — скетчи, иллюстрации, коллажи, постеры и другой графический дизайн
`;

export const MSG_PACE = (mode: string) => {
  if (mode === AVAILABLE_MODES.IMAGE) {
    return `📸 Для режима "Картинки" доступен только ритм <b>"Каждый день"</b>.`;
  }
  return `⏰ Выбери ритм участия:

• <b>Каждый день</b> — публикуешь пост ежедневно
• <b>Один раз в неделю</b> — публикуешь пост раз в неделю`;
};

export const MSG_PAYMENT_COND = `
Супер! Теперь про оплату:
• Стоимость участия — ₽4900 в месяц
• Для участников любого сезона <a href="https://www.instagram.com/clarity.and.movement/">«Ясность&Движение»</a> — ₽2900 в месяц
• Подписка автоматически продлевается каждый месяц, ее можно отменить в любой момент
• При отмене подписки и выхода из чата до ее конца, неиспользованные дни сохраняются на будущее
`;

export const MSG_PROMO = `Если ты у тебя есть промокод — введи его, чтобы получить специальную цену.`;

export const MSG_PROMO_ERR = `❌ Промокод не подходит. Проверь правильность написания или нажми "У меня нет промокода".`;

export const MSG_LINK_CLUB = (link: string) => `Вот твоя ссылка на оплату:
${link}
После успешной оплаты, бот автоматически добавит тебя в чат участников!
`;

export const MSG_LINK_STANDARD = (link: string) => `Вот твоя ссылка на оплату:
${link}
После успешной оплаты, бот автоматически добавит тебя в чат участников!`;

export const MSG_DIRECT_CHAT_LINK = (daysLeft: number) => `🎉 Отлично! У тебя есть сохранённые дни подписки с прошлого раза.

Доступно ${daysLeft} ${pluralizeDays(daysLeft)} участия. После того, как они закончатся, мы отправим тебе ссылку на оплату.

Переходи сразу в чат участников:
${CHALLENGE_JOIN_LINK}
`;

export const MSG_FREE_PROMO_SUCCESS = (daysLeft: number) => `🎉 Промокод успешно активирован!

Тебе начислено ${daysLeft} ${pluralizeDays(daysLeft)} бесплатного участия в практике!

Переходи сразу в чат участников:
${CHALLENGE_JOIN_LINK}
`;



// =====================================================
// СООБЩЕНИЯ: ПРОДОЛЖЕНИЕ ПРОЦЕССА НАСТРОЙКИ
// =====================================================

export const MSG_CONTINUE_MODE_SELECTION = `Ты в процессе настройки участия. Выбери что будешь делать. Чтобы начать заново — нажми /reset`;

export const MSG_CONTINUE_PACE_SELECTION = (mode: string) => `⏰ Твой режим "${mode === 'text' ? 'Тексты' : 'Картинки'}".
Теперь нужно выбрать ритм участия:`;

export const MSG_CONTINUE_PROMO_INPUT = `Ты в процессе настройки участия.
Осталось определиться с промокодом. Чтобы начать заново — нажми /reset`;

export const MSG_CONTINUE_PAYMENT_PENDING = (paymentLink: string) => `💳 Ты уже получил(а) ссылку на оплату: ${paymentLink}

Если хочешь начать все сначала — нажми /reset`;

// =====================================================
// СООБЩЕНИЯ: КОМАНДА /RESET
// =====================================================

export const MSG_RESET_SUCCESS = `Настройки сброшены! Теперь ты можешь начать процесс настройки участия заново — /start.`;

// =====================================================
// СООБЩЕНИЯ: ОБРАБОТКА ПОСТОВ #DAILY
// =====================================================

export const MSG_DAILY_ACCEPTED = (totalPosts: number, consecutivePosts: number) => {
  let message = "Текст принят! Ура и до завтра.";
  
  // Добавляем информацию о последовательных постах
  if (consecutivePosts > 0) {
    message += ` Постов подряд без пропусков: ${consecutivePosts}.`;
  }
  
  return message;
};

export const MSG_DAILY_MILESTONE = (totalPosts: number) => `🎉 Ура! У тебя круглое число - ${totalPosts} постов! Отличная работа!`;

export const MSG_DAILY_TO_GROUPCHAT = "Пост с #daily нужно отправлять в групповой чат, а не в личку боту.";
export const MSG_PAUSE_REMOVED_BY_POST = "Отлично! Ты прислал пост во время паузы, поэтому мы снимаем тебя с паузы. Добро пожаловать обратно к активному участию!";







// =====================================================
// СООБЩЕНИЯ: СТРАЙКИ И АВТОМАТИЧЕСКАЯ ПАУЗА
// =====================================================

export const MSG_STRIKE_FIRST = "Ты сегодня пропустил свое дело. Ничего страшного, у всех бывает! Если пропустишь 3 раза подряд, я предложу тебе взять паузу. Чтобы сбросить страйк, просто снова начни присылать посты с тегом #daily.";
export const MSG_STRIKE_SECOND = "Второй пропуск. Все ок, в любой регулярность главное не идеальность, а навык возвращаться. Попробуй еще раз сегодня";
export const MSG_STRIKE_THIRD = "Третий пропуск. Кажется, тебе сейчас не просто. Не перижвай и если можешь возвращайся. Если нет, то на следующем пропуске я поставлю тебя на недельную паузу от напоминаний";
export const MSG_STRIKE_FOURTH = `Ставим тебя на паузу на ${AUTO_PAUSE_DAYS} дней. 

Твоя подписка все еще активна, но мы тебя не будем дергать. Если пришлешь что-то в течение недели, страйк сбросится.
Если ничего не пришлешь, то мы отменим твою подписку, сохраним оставшиеся дни и удалим из чата — но ты всегда сможешь вернуться и доиспользовать оставшиеся дни подписки.

Кроме этого, ты просто можешь перейти на более спокойный режим «Раз в неделю» — /change_pace
Отменить подписку можно здесь — @tribute `;

export const MSG_PAUSE_EXPIRED_REMOVED = `Твоя недельная пауза истекла! Мы удалили тебя из чата, но, пожалуйста, не расстраивайся.

+ Важно! Твоя подписка все еще активна. Отменить автопродление — @tribute
+ Мы сохранили оплаченные дни твоей подписки, когда ты решишь вернуться их можно будет использовать
+ Ты можешь вернуться в любой момент через /start или по invite ссылке на чат
`;


export const MSG_SUBSCRIPTION_ENDING_REMINDER = (isClubMember: boolean = false) => `
⚠️ Через 3 дня у тебя заканчиваются сохраненные дни с прошлой подписки. 

Возобнови подписку через Tribute, чтобы продолжить участие в челлендже после их окончания.

💳 Ссылка на оплату: ${isClubMember ? SPECIAL_PAYMENT_URL : DEFAULT_PAYMENT_URL}`;


export const MSG_SUBSCRIPTION_EXPIRED = (isClubMember: boolean = false) => `
🚨 У тебя закончились сохраненные дни с прошлой подписки. 

Возобнови подписку через Tribute, чтобы продолжать участвовать в челлендже:

💳 ${isClubMember ? SPECIAL_PAYMENT_URL : DEFAULT_PAYMENT_URL}`;


export const MSG_REMOVED_SUBSCRIPTION_EXPIRED = `❌ У тебя закончились сохраненные дни подписки, и мы не получили новую оплату через Tribute.

Мы удалили тебя из чата, но ты можешь вернуться в любой момент, возобновив подписку через /start или по invite ссылке на чат.

💳 Управление подпиской: @tribute`;

// =====================================================
// СООБЩЕНИЯ: КОМАНДА /PAUSE
// =====================================================

export const MSG_PAUSE_REQUEST = `⏸️ Ты хочешь взять паузу?

В течение паузы:
• Не будут начисляться страйки за пропуски
• Мы не будем тебя дергать напоминаниями
• Это как каникулы от челленджа

Укажи количество дней паузы (просто пришли число):`;

export const MSG_PAUSE_INVALID_NUMBER = `❌ Пожалуйста, пришли число дней для паузы.

Например: 7 (для недельной паузы)`;

export const MSG_PAUSE_TOO_LONG = `❌ Слишком долгая пауза. Максимум можно взять 30 дней.

Пришли число от 1 до 30:`;

export const MSG_PAUSE_SET = (days: number, endDate: string) => 
`⏸️ Отлично! Ты на паузе на ${days} ${pluralizeDays(days)}.

Пауза продлится до ${endDate}.

В течение этого времени страйки начисляться не будут. Если пришлешь пост с #daily — пауза снимется автоматически.

Хорошего отдыха! 🌟`;

export const MSG_PAUSE_ALREADY_ON = (endDate: string) => 
`⏸️ Ты уже на паузе до ${endDate}.

Если хочешь изменить срок паузы, сначала сними текущую командой /unpause`;

export const MSG_UNPAUSE_SUCCESS = `✅ Пауза снята! Добро пожаловать обратно к активному участию.

Теперь снова будут начисляться страйки за пропуски и приходить напоминания.`;

export const MSG_UNPAUSE_NOT_ON_PAUSE = `ℹ️ Ты не на паузе. Команда /unpause используется только для снятия активной паузы.`;

// =====================================================
// СООБЩЕНИЯ: КОМАНДА /CHANGE_MODE
// =====================================================

export const MSG_CHANGE_MODE_SELECTION = `Выбери новый режим участия:

• **Тексты** — эссе, наблюдения за собой или миром, дневники, посты, анонсы и любые другие жанры
• **Картинки** — скетчи, иллюстрации, коллажи, постеры и другой графический дизайн

Твой текущий режим будет изменён после выбора.`;

export const MSG_CHANGE_MODE_SUCCESS = (newMode: string, threadInfo?: string) => {
  const modeText = newMode === 'text' ? 'тексты' : 'картинки';
  let message = `Отлично! Теперь ты делаешь ${modeText}.`;
  
  if (threadInfo) {
    message += `\n\n${threadInfo}`;
  }
  
  return message;
};

export const MSG_CHANGE_MODE_SAME = (currentMode: string) => 
`ℹ️ Ты уже участвуешь в режиме **${currentMode === 'text' ? 'Тексты' : 'Картинки'}**.

Если хочешь изменить ритм участия, используй команду /change_pace`;

export const MSG_CHANGE_MODE_NOT_ACTIVE = `❌ Команда доступна только активным участникам.

Чтобы начать участие, используй команду /start`;

// =====================================================
// СООБЩЕНИЯ: КОМАНДА /CHANGE_PACE
// =====================================================

export const MSG_CHANGE_PACE_CURRENT_DAILY = `Челлендж заточен на регулярность, но мы понимаем, что иногда важно менять свой ритм.

Сейчас ты участвуешь в режиме "Каждый день". Можешь переключиться на режим, в котором мы будем ждать твоих обновлений раз в неделю.`;

export const MSG_CHANGE_PACE_CURRENT_WEEKLY = `Челлендж заточен на регулярность, но мы понимаем, что иногда важно менять свой ритм.

Сейчас ты участвуешь в режиме "Раз в неделю". Можешь вернуться к ежедневному ритму.`;

export const MSG_CHANGE_PACE_SUCCESS_TO_WEEKLY = `Супер! Теперь твой ритм изменился на "Раз в неделю".

Мы будем ждать твои посты раз в неделю.`;

export const MSG_CHANGE_PACE_SUCCESS_TO_DAILY = `Супер! Теперь твой ритм изменился на "Каждый день".

Мы будем ждать твои посты ежедневно.`;

export const MSG_CHANGE_PACE_NOT_ACTIVE = `❌ Команда доступна только активным участникам.

Чтобы начать участие, используй команду /start`;

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

export const MSG_SUBSCRIPTION_RENEWED = `Твоя подписка активирована!🎉 Чат — ${CHALLENGE_JOIN_LINK} `;

export const MSG_SUBSCRIPTION_RENEWED_WITH_BONUS = (bonusDays: number) => `🎉 Подписка активирована!

Отлично! Твоя новая подписка активирована, и к ней добавлено ${bonusDays} ${pluralizeDays(bonusDays)} с предыдущего периода.

Добро пожаловать обратно в челлендж! ${CHALLENGE_JOIN_LINK}`;

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

// =====================================================
// СООБЩЕНИЯ: СТАТУС ПОЛЬЗОВАТЕЛЯ ПРИ ВХОДЕ В ЧАТ
// =====================================================

export const MSG_CHAT_MEMBER_STATUS = (user: any) => {
  const now = new Date();
  let statusMessage = `Все важное про участие в практике\n\n`;

  // Информация о подписке - проверяем разные состояния

  // Состояние 4: Пользователь не в чате
  if (user.is_in_chat === false || user.in_chat === false) {
    statusMessage += `❌ Ты не находишься в чате участников\n`;
    if (user.subscription_days_left > 0) {
      // Вычисляем до какой даты действуют сохранённые дни
      const savedDaysEndDate = new Date(now);
      savedDaysEndDate.setDate(savedDaysEndDate.getDate() + user.subscription_days_left);
      statusMessage += `• У тебя есть ${user.subscription_days_left} ${pluralizeDays(user.subscription_days_left)} с прошлой подписки\n`;
      statusMessage += `• Действуют до: ${savedDaysEndDate.toLocaleDateString('ru-RU')}\n`;
    } else {
      statusMessage += `• Сохранённых дней нет\n`;
    }
    statusMessage += `\n`;
  }
  // Состояние 1: Есть сохранённые дни, активной подписки нет
  else if (user.subscription_days_left > 0 && !user.subscription_active) {
    // Вычисляем до какой даты действуют сохранённые дни
    const savedDaysEndDate = new Date(now);
    savedDaysEndDate.setDate(savedDaysEndDate.getDate() + user.subscription_days_left);
    
    statusMessage += `💰 Используются сохранённые дни с прошлой подписки\n`;
    statusMessage += `• Осталось дней: ${user.subscription_days_left}\n`;
    statusMessage += `• Действуют до: ${savedDaysEndDate.toLocaleDateString('ru-RU')}\n`;
    statusMessage += `• Новая подписка в Tribute пока не нужна\n\n`;
  }
  // Состояние 2: Есть активная подписка, сохранённых дней нет
  else if (user.subscription_active && user.subscription_days_left === 0) {
    statusMessage += `✅ Подписка активна\n`;
    if (user.expires_at) {
      const expiresDate = new Date(user.expires_at);
      const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      statusMessage += `• Действует до: ${expiresDate.toLocaleDateString('ru-RU')}\n`;
      statusMessage += `• Осталось дней: ${daysLeft > 0 ? daysLeft : 0}\n`;
    }
    statusMessage += `\n`;
  }
  // Смешанное состояние: и подписка активна, и есть сохранённые дни
  else if (user.subscription_active && user.subscription_days_left > 0) {
    statusMessage += `✅ Подписка активна + есть сохранённые дни\n`;
    if (user.expires_at) {
      const expiresDate = new Date(user.expires_at);
      const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      statusMessage += `• Активная подписка до: ${expiresDate.toLocaleDateString('ru-RU')} (${daysLeft > 0 ? daysLeft : 0} дней)\n`;
    }
    statusMessage += `• Плюс сохранённые дни: ${user.subscription_days_left} ${pluralizeDays(user.subscription_days_left)}\n`;
    statusMessage += `\n`;
  }
  // Состояние 3: Непонятное состояние - нет ни подписки, ни сохранённых дней
  else {
    statusMessage += `❓ Статус подписки неопределён\n`;
    statusMessage += `• Активной подписки: ${user.subscription_active ? 'да' : 'нет'}\n`;
    statusMessage += `• Сохранённых дней: ${user.subscription_days_left || 0}\n`;
    statusMessage += `• Возможно, данные ещё не обновились\n\n`;
  }
  statusMessage += `\n`;

  
  // Статус активности
  statusMessage += `• Режим: ${user.mode === 'text' ? 'Тексты' : user.mode === 'image' ? 'Картинки' : '❓ Не выбран'}\n`;
  statusMessage += `• Ритм: ${user.pace === 'daily' ? 'Каждый день' : user.pace === 'weekly' ? 'Раз в неделю' : '❓ Не выбран'}\n`;
  

  // Активность в челлендже (показываем только если есть посты)
  if (user.units_count > 0) {
    statusMessage += `• Всего постов: ${user.units_count}\n`;
    statusMessage += `• Пропусков подряд: ${user.strikes_count || 0}\n`;
    if (user.last_post_date) {
      const lastPostDate = new Date(user.last_post_date);
      statusMessage += `• Последний пост: ${lastPostDate.toLocaleDateString('ru-RU')}\n`;
    }
    statusMessage += `\n`;
  }
  
  return statusMessage;
};

// =====================================================
// CALLBACK DATA ДЛЯ КНОПОК
// =====================================================

// Callback data для кнопок оплаты
export const CALLBACK_PAYMENT_CLUB = "payment_club";
export const CALLBACK_PAYMENT_STANDARD = "payment_standard";

// Callback data для кнопок входа в чат
export const CALLBACK_JOIN_CHAT = "join_chat";

// Callback data для промокодов (уже есть в коде)
export const CALLBACK_NO_PROMO = "no_promo";
export const CALLBACK_HAVE_PROMO = "have_promo";

// Callback data для кнопок статуса
export const CALLBACK_TRIBUTE_BOT = "tribute_bot";
export const CALLBACK_ADMIN_CONTACT = "admin_contact";

// Callback data для кнопок смены режима
export const CALLBACK_CHANGE_MODE_TEXT = "change_mode:text";
export const CALLBACK_CHANGE_MODE_IMAGE = "change_mode:image"; 

// Callback data для кнопок смены ритма
export const CALLBACK_CHANGE_PACE_DAILY = "change_pace:daily";
export const CALLBACK_CHANGE_PACE_WEEKLY = "change_pace:weekly"; 




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
