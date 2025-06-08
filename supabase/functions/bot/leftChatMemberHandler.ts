import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, sendDirectMessage } from "./userHandler.ts";
import { MSG_LEFT_CHAT, MSG_LEFT_CHAT_DAYS_SAVED } from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for leftChatMemberHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Обрабатывает событие выхода пользователя из чата (left_chat_member)
 * Реализует логику Б5 из logic.md
 * ТОЛЬКО для добровольного выхода пользователя. Удаления ботом обрабатываются в cronHandler.
 */
export async function handleLeftChatMember(chatMemberUpdate: any): Promise<void> {
  console.log("handleLeftChatMember вызван", JSON.stringify(chatMemberUpdate));
  
  if (!chatMemberUpdate || !chatMemberUpdate.new_chat_member) {
    console.log("handleLeftChatMember: нет данных new_chat_member, выход");
    return;
  }
  
  const member = chatMemberUpdate.new_chat_member;
  const user = member.user;
  const telegramId = user.id;
  const now = new Date();
  
  // Обрабатываем ТОЛЬКО добровольный выход (left), НЕ kicked/banned
  if (member.status !== "left") {
    console.log(`handleLeftChatMember: пользователь ${telegramId} не вышел добровольно, статус: ${member.status}. Пропускаем - обработается в cronHandler`);
    return;
  }
  
  console.log(`handleLeftChatMember: обрабатываем добровольный выход пользователя ${telegramId} из чата`);
  
  // Шаг 1: Находим пользователя в БД
  const existingUser = await findUserByTelegramId(telegramId);
  
  if (!existingUser) {
    console.log(`handleLeftChatMember: пользователь ${telegramId} не найден в БД, выход`);
    return;
  }
  
  console.log(`handleLeftChatMember: пользователь ${telegramId} найден в БД`);
  
  // Шаг 2: Рассчитываем сохраненные дни
  let savedDays = 0;
  let updateData: any = {
    // Обновляем данные из Telegram
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    username: user.username || null,
    // Статус выхода из чата
    in_chat: false,
    left_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  
  // Рассчитываем сохраненные дни
  if (existingUser.subscription_days_left > 0) {
    savedDays = existingUser.subscription_days_left;
    console.log(`handleLeftChatMember: у пользователя ${telegramId} уже есть ${savedDays} сохранённых дней`);
  } else if (existingUser.expires_at && new Date(existingUser.expires_at) > now) {
    const expiresAt = new Date(existingUser.expires_at);
    savedDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    updateData.subscription_days_left = savedDays;
    console.log(`handleLeftChatMember: рассчитали ${savedDays} дней до истечения подписки для пользователя ${telegramId}`);
  }
  
  // Шаг 3: Определяем сообщение для добровольного выхода
  let messageToSend = "";
  if (savedDays > 0) {
    messageToSend = MSG_LEFT_CHAT_DAYS_SAVED(savedDays);
    console.log(`handleLeftChatMember: пользователь ${telegramId} вышел сам, есть сохраненные дни: ${savedDays}`);
  } else {
    messageToSend = MSG_LEFT_CHAT;
    console.log(`handleLeftChatMember: пользователь ${telegramId} вышел сам, нет сохраненных дней`);
  }
  
  // Обновляем данные в БД
  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error(`handleLeftChatMember: ошибка обновления пользователя ${telegramId}:`, error.message);
  } else {
    console.log(`handleLeftChatMember: пользователь ${telegramId} (${user.first_name}) успешно обновлён - добровольный выход, сохранено дней: ${savedDays}`);
    
    // Увеличиваем количество доступных слотов после выхода пользователя
    try {
      const { SlotManager } = await import("./startCommand/flows/SlotManager.ts");
      const availableSlots = await SlotManager.increaseAvailableSlots();
      console.log(`handleLeftChatMember: слот освобожден пользователем ${telegramId}, доступно мест: ${availableSlots}`);
    } catch (slotError) {
      console.error(`handleLeftChatMember: ошибка увеличения слотов:`, slotError);
      // Не критичная ошибка, не прерываем выполнение
    }
    
    // Отправляем соответствующее сообщение пользователю
    await sendDirectMessage(telegramId, messageToSend);
  }
} 