import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, registerUser, sendDirectMessage } from "./userHandler.ts";
import { MSG_DAILY_ACCEPTED, MSG_DAILY_MILESTONE, MSG_PAUSE_REMOVED_BY_POST, MSG_DAILY_TO_GROUPCHAT } from "./constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for dailyPostHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Обрабатывает сообщение с тегом #daily
 * Реализует логику Б1 из logic.md
 */
export async function handleDailyPost(message: any): Promise<void> {
  console.log("handleDailyPost called", JSON.stringify(message));
  
  // Базовые проверки
  if (!message || !message.from || !message.chat) {
    console.log("handleDailyPost: недостаточно данных в сообщении");
    return;
  }

  const text = message.text || message.caption || "";
  if (!/\B#daily\b/i.test(text)) {
    console.log("handleDailyPost: тег #daily не найден");
    return;
  }

  // Если сообщение с #daily пришло в личку - отправляем предупреждение
  if (message.chat.type === "private") {
    console.log("handleDailyPost: #daily в личке, отправляем предупреждение");
    await sendDirectMessage(message.from.id, MSG_DAILY_TO_GROUPCHAT);
    return;
  }

  const telegramId = message.from.id;
  const today = new Date();
  const todayDate = today.toLocaleDateString("sv-SE", { timeZone: "UTC" }); // YYYY-MM-DD
  const now = today.toISOString();

  console.log(`handleDailyPost: обрабатываем #daily для пользователя ${telegramId}, дата: ${todayDate}`);

  // Найти пользователя
  let user = await findUserByTelegramId(telegramId);
  console.log("handleDailyPost: результат поиска пользователя:", user ? "найден" : "не найден");
  
  if (!user) {
    // Пользователь не найден — создаём новую запись с начальными значениями
    console.log("handleDailyPost: пользователь не найден, регистрируем нового");
    await registerUser(message.from);
    
    // Для нового пользователя сразу устанавливаем первый пост
    const { error } = await supabase
      .from("users")
      .update({
        post_today: true,
        last_post_date: todayDate,
        units_count: 1,
        consecutive_posts_count: 1,
        updated_at: now,
        last_activity_at: now
      })
      .eq("telegram_id", telegramId);
      
    if (error) {
      console.error("handleDailyPost: ошибка при обновлении нового пользователя:", error.message);
    } else {
      console.log("handleDailyPost: новый пользователь обновлен успешно");
      const dailyMessage = MSG_DAILY_ACCEPTED(1, 1);
      await sendDirectMessage(telegramId, dailyMessage);
      
      // Проверяем на круглое число (для первого поста это 10, 20, 30...)
      if (1 % 10 === 0) {
        await sendDirectMessage(telegramId, MSG_DAILY_MILESTONE(1));
      }
    }
    return;
  }

  // Пользователь найден - обрабатываем пост
  console.log(`handleDailyPost: пользователь найден, post_today = ${user.post_today}`);
  
  // Вычисляем новое количество постов
  const newUnitsCount = (user.units_count || 0) + 1;
  
  // Увеличиваем units_count при каждом принятом посте с #daily
  let updateData: any = {
    units_count: newUnitsCount,
    last_post_date: todayDate,
    updated_at: now,
    last_activity_at: now
  };

  if (user.post_today === true) {
    // Уже был пост сегодня - last_post_date обновляется, units_count увеличивается, но сообщение не отправляется
    console.log("handleDailyPost: уже был пост сегодня, только обновляем данные");
    
    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("telegram_id", telegramId);
      
    if (error) {
      console.error("handleDailyPost: ошибка при обновлении повторного поста:", error.message);
    } else {
      console.log("handleDailyPost: повторный пост учтен успешно");
    }
  } else {
    // Первый пост за день - post_today = false
    console.log("handleDailyPost: первый пост за день");
    
    updateData.post_today = true;
    updateData.strikes_count = 0; // Сброс страйков при любом посте
    
    // Увеличиваем consecutive_posts_count
    const newConsecutivePosts = (user.consecutive_posts_count || 0) + 1;
    updateData.consecutive_posts_count = newConsecutivePosts;
    
    // Проверяем, был ли пользователь на паузе
    if (user.pause_until && new Date(user.pause_until) > new Date()) {
      // Пользователь был на паузе - снимаем с паузы
      console.log("handleDailyPost: снимаем пользователя с паузы");
      updateData.pause_started_at = null;
      updateData.pause_until = null;
      updateData.pause_days = 0;
      
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error("handleDailyPost: ошибка при снятии с паузы:", error.message);
      } else {
        console.log("handleDailyPost: пользователь снят с паузы успешно");
        await sendDirectMessage(telegramId, MSG_PAUSE_REMOVED_BY_POST);
        
        // Отправляем также обычное сообщение о принятии поста
        const dailyMessage = MSG_DAILY_ACCEPTED(newUnitsCount, newConsecutivePosts);
        await sendDirectMessage(telegramId, dailyMessage);
        
        // Проверяем на круглое число
        if (newUnitsCount % 10 === 0) {
          await sendDirectMessage(telegramId, MSG_DAILY_MILESTONE(newUnitsCount));
        }
      }
    } else {
      // Обычный первый пост за день
      console.log("handleDailyPost: обычный первый пост за день");
      
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("telegram_id", telegramId);
        
      if (error) {
        console.error("handleDailyPost: ошибка при обновлении первого поста:", error.message);
      } else {
        console.log("handleDailyPost: первый пост учтен успешно");
        const dailyMessage = MSG_DAILY_ACCEPTED(newUnitsCount, newConsecutivePosts);
        await sendDirectMessage(telegramId, dailyMessage);
        
        // Проверяем на круглое число
        if (newUnitsCount % 10 === 0) {
          await sendDirectMessage(telegramId, MSG_DAILY_MILESTONE(newUnitsCount));
        }
      }
    }
  }
} 