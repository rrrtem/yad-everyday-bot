export const DEFAULT_MAX_LIVES = 5;
export const CHALLENGE_JOIN_LINK = "https://t.me/+-HiBq4KbXzgzNTc0"; 

// Длительность штрафа (в днях)
export const DURATION_PENALTY_DAYS = 1;
export const RESTORED_LIVES_AFTER_PENALTY = 2;

export function pluralizeLives(n: number) {
    const abs = Math.abs(n);
    if (abs === 1) return 'жизнь';
    if (abs >= 2 && abs <= 4) return 'жизни';
    return 'жизней';
  }
  

// Сообщения для бота
export const MSG_START = `Привет! Я бот проекта «Ясность&Движение / Каждый день». Я буду присылать тебе личные уведомления о челлендже: напоминания о дедлайнах, пропущенных днях, оставшихся жизнях. Если что-то не так и для обратной связи, пиши @rrrtem. Ссылка на чат → https://t.me/+-HiBq4KbXzgzNTc0`;
export const MSG_DAILY_ACCEPTED = "Текст принят! Ура и до завтра.";
export const MSG_UNKNOWN_ERROR = "Произошла неожиданная ошибка. Напиши Артему: @rrrtem";

// Сообщения для автоматических напоминаний
export const MSG_LIFE_LEFT_3 = "Ты сегодня не написал(а) текст #daily, мы списываем у тебя одну попытку. Осталось: 3 попытки. После того как все попытки закончатья, я поставлю тебя на паузу и не буду дергать.  Ты сможешь вернуться, когда это будет нужно.";
export const MSG_LIFE_LEFT_2 = "Ты сегодня не написал(а) текст #daily, мы списываем у тебя еще одну попытку. Осталось: 2 попытки";
export const MSG_LIFE_LEFT_1 = "Ты сегодня не написал(а) текст #daily, мы списываем у тебя еще одну попытку. Осталась последняя попытка!";
export const MSG_PAUSED = (link: string) => `У тебя закончились все попытки, и мы поставили тебя на паузу. Не переживай — ты можешь вернуться в любой момент по команде /comeback`;
export const MSG_MONTHLY_RESET = (lives: number) => `Вжух! Новый месяц: количество твоих попыток восстановлено до ${lives}!`;

// Сообщение для публичного напоминания в канал с динамическим временем до конца дня
export const MSG_PUBLIC_DEADLINE_REMINDER = (usernames: string[], timeLeftMsg: string) => `${usernames.map(u => '@' + u).join(', ')} ${timeLeftMsg} Присылайте ваши тексты!`;

// Сообщение для команды /get
export const MSG_GET_CHAT_ID = (chatId: number) => `ID этого чата: <code>${chatId}</code>`;

export const MSG_LIFE_DEDUCTED = (lives: number) => {
    if (lives === 4) {
      return MSG_LIFE_LEFT_3;
    } else if (lives === 3) {
      return MSG_LIFE_LEFT_2;
    } else if (lives === 2 || lives === 1) {
      return MSG_LIFE_LEFT_1;
    } else {
      return "";
    }
};
  
// ID топика (thread) для публичного напоминания (например, из https://t.me/2366470605/2 — это 2)
export const PUBLIC_REMINDER_THREAD_ID = 2;
  
export const MSG_COMEBACK_RECEIVED = "Классно, что ты решил(а) вернуться! Сейчас идёт пробный сезон, и скоро он закончится. Мы напишем тебе, когда перезапустим челлендж заново.";
  
// Telegram ID владельца бота (установить актуальный ID)
export const OWNER_TELEGRAM_ID = 149365895;
  
