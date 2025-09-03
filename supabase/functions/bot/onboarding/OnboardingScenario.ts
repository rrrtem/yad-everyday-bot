import { sendDirectMessage, sendMediaGroup, findUserByTelegramId, sendPhotoWithCaption } from "../userHandler.ts";
import { setWaitingPromoState, clearUserState } from "../commandHandler.ts";
import { CHALLENGE_JOIN_LINK, DEFAULT_PAYMENT_URL, SPECIAL_PAYMENT_URL } from "../constants.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessageWithButtons(telegramId: number, text: string, keyboard: any): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard
      })
    });
  } catch (error) {
    await sendDirectMessage(telegramId, text);
  }
}

// Публичные URL картинок альбома
const ONB_IMAGES = [
  "https://raw.githubusercontent.com/rrrtem/yad-everyday-bot/refs/heads/main/CRM/public/n1.jpg",
  "https://raw.githubusercontent.com/rrrtem/yad-everyday-bot/refs/heads/main/CRM/public/n2.jpg",
  "https://raw.githubusercontent.com/rrrtem/yad-everyday-bot/refs/heads/main/CRM/public/n3.jpg"
];

export class OnboardingScenario {
  static async runOnboarding(telegramId: number): Promise<void> {
    await this.showBlock1(telegramId);
  }

  private static async showBlock1(telegramId: number): Promise<void> {
    // Обложка перед первым сообщением
    await sendPhotoWithCaption(
      telegramId,
      "https://raw.githubusercontent.com/rrrtem/yad-everyday-bot/refs/heads/main/CRM/public/cover.jpg",
      ""
    );
    await delay(300);
    const m1 = "Привет! Я бот практики «Каждый день» от сообщества <a href=\"https://www.instagram.com/clarity.and.movement/\">«Ясность&Движение»</a>. По любым вопросам, пишите Артему — @rrrtem.";
    const m2 = "Если каждый день делать какое-то дело, обязательно произойдёт что-то классное. Чтобы поддержать нас всех в этом процессе, мы придумали практику, которая помогает выстроить творческую рутину.";
    const m3 = "Пока у нас доступно одно направление — мы пишем тексты. Эссе, наблюдения за собой или миром, дневники, посты, анонсы, сценарии к рилсами и любые другие жанры.";
    const m4 = "Практика открыта для всех. Совершенно не обязательно быть писателем, чтобы писать тексты, ждём с любым уровнем. А еще вы продвигаем подход без невроза и верм, что важнее уметь возвращаться, а не стремиться к недостижимому идеалу.";

    await sendDirectMessage(telegramId, m1);
    await delay(450);
    await sendDirectMessage(telegramId, m2);
    await delay(450);
    await sendDirectMessage(telegramId, m3);
    await delay(450);
    await sendMessageWithButtons(telegramId, m4, {
      inline_keyboard: [[{ text: "Дальше", callback_data: "onb_next_1" }]]
    });
  }

  private static async showBlock2(telegramId: number): Promise<void> {
    const m2 = "Кроме этого каждый месяц зовём классного гостя, который делает практику со всеми\nи делится своим опытом.";
    const m3 = "Ближайший гость — <a href=\"https://www.instagram.com/p/DOG3T2vgi3R/?img_index=1\">Наташа Подлыжняк</a>. Писательница, основательница школы текстов «Мне есть что сказать», хозяйка ирландской терьерки Пеппер. С 7 по 21 сентября Наташа будет писать наблюдения за жизнью и работать над романом про женскую дружбу. А еще делиться своими лайфхаками про творческий процесс.";
    await sendDirectMessage(telegramId, m2);
    await delay(450);

    // Альбом из 3 фото (после первого текста). Если URL невалидны, отправим текст-заглушку
    const looksValid = ONB_IMAGES.every(u => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")));
    if (looksValid) {
      const media = ONB_IMAGES.map(url => ({ type: "photo", media: url }));
      await sendMediaGroup(telegramId, media);
    } else {
      await sendDirectMessage(telegramId, "[Альбом с фото будет здесь]");
    }

    // Текст про гостя
    await sendDirectMessage(telegramId, m3);

    // Кнопка после описания
    await sendMessageWithButtons(telegramId, "Подробнее об оплате:", {
      inline_keyboard: [[{ text: "узнать про оплату", callback_data: "onb_to_payment" }]]
    });
  }

  private static async showBlock3(telegramId: number): Promise<void> {
    const text = "Если у тебя есть промокод, отправь его в чат.";
    const keyboard = {
      inline_keyboard: [
        [
          { text: "Нет промокода", callback_data: "onb_no_promo" }
        ],
        [
          { text: "Начать заново", callback_data: "onb_restart" }
        ]
      ]
    };
    await sendMessageWithButtons(telegramId, text, keyboard);
  }

  private static async showBlock4(telegramId: number): Promise<void> {
    const user = await findUserByTelegramId(telegramId);
    const hasFreeDays = (user?.subscription_days_left || 0) > 0;
    const isClub = user?.club === true;

    let header = "";
    if (hasFreeDays) {
      header = `Отлично, тебе начислено ${user!.subscription_days_left} дней участия. Переходи в чат → ${CHALLENGE_JOIN_LINK}`;
    } else if (isClub) {
      header = "Для участников сообщества «Ясность&Движентие». Участие в практие стоит ₽2900 за месяц.";
    } else {
      header = "Участие в практие стоит ₽4900 за месяц. Пробная неделя — ₽745.";
    }

    const note = "Мы хотим чтобы практика приносила пользу. Поэтому когда вы выходите из чата и отменяете подписку, мы сохраняем все оставшиеся оплаченные дни и даём возможность использовать их в будущем.";

    await sendDirectMessage(telegramId, header);
    await delay(350);

    const keyboardRows: any[] = [];
    if (hasFreeDays) {
      keyboardRows.push([{ text: "Войти в чат", url: CHALLENGE_JOIN_LINK }]);
      keyboardRows.push([{ text: "Ввести промокод", callback_data: "onb_enter_promo" }]);
      // Без кнопки НАЧАТЬ ЗАНОВО, если есть ВОЙТИ В ЧАТ
    } else {
      const payUrl = isClub ? SPECIAL_PAYMENT_URL : DEFAULT_PAYMENT_URL;
      keyboardRows.push([{ text: "Оплатить участие", url: payUrl }]);
      keyboardRows.push([{ text: "Ввести промокод", callback_data: "onb_enter_promo" }]);
      keyboardRows.push([{ text: "Начать заново", callback_data: "onb_restart" }]);
    }

    await sendMessageWithButtons(telegramId, note, { inline_keyboard: keyboardRows });
  }

  static async handleCallback(callbackQuery: any): Promise<void> {
    if (!callbackQuery || !callbackQuery.from || !callbackQuery.data) return;
    const telegramId = callbackQuery.from.id;
    const data = callbackQuery.data as string;

    try {
      if (data === "onb_next_1") {
        await this.showBlock2(telegramId);
      } else if (data === "onb_to_payment") {
        await this.showBlock3(telegramId);
      } else if (data === "onb_no_promo") {
        // Переход сразу к оплате (ветка без промокода)
        await clearUserState(telegramId);
        await this.showBlock4(telegramId);
      } else if (data === "onb_enter_promo") {
        await setWaitingPromoState(telegramId);
        await sendDirectMessage(telegramId, "Введи промокод сообщением в чате.");
      } else if (data === "onb_restart") {
        await clearUserState(telegramId);
        await this.runOnboarding(telegramId);
      }
    } finally {
      try {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQuery.id })
        });
      } catch (_) {}
    }
  }
}


