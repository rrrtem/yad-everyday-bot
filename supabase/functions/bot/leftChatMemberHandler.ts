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
  
  // Проверяем, что пользователь действительно покинул чат
  const hasLeftChat = ["left", "kicked", "banned"].includes(member.status);
  if (!hasLeftChat) {
    console.log(`handleLeftChatMember: пользователь ${telegramId} не покинул чат, статус: ${member.status}`);
    return;
  }
  
  console.log(`handleLeftChatMember: обрабатываем выход пользователя ${telegramId} из чата, статус: ${member.status}`);
  
  // Шаг 1: Находим пользователя в БД
  const existingUser = await findUserByTelegramId(telegramId);
  
  if (!existingUser) {
    console.log(`handleLeftChatMember: пользователь ${telegramId} не найден в БД, выход`);
    return;
  }
  
  console.log(`handleLeftChatMember: пользователь ${telegramId} найден в БД`);
  
  // Шаг 2: Обновляем статус участия
  let updateData: any = {
    // Обновляем данные из Telegram
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    username: user.username || null,
    // Статус выхода из чата
    in_chat: false,
    is_active: false, // Общий статус всегда false если не в чате
    left_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  
  // Шаг 3: Рассчитываем сохраненные дни
  let messageToSend = "";
  let savedDays = 0;
  
  if (existingUser.subscription_days_left > 0) {
    // Дни уже отсчитываются ежедневно - сохраняем как есть
    savedDays = existingUser.subscription_days_left;
    console.log(`handleLeftChatMember: у пользователя ${telegramId} уже есть ${savedDays} сохранённых дней`);
    messageToSend = MSG_LEFT_CHAT_DAYS_SAVED(savedDays);
  } else if (existingUser.expires_at && new Date(existingUser.expires_at) > now) {
    // Дни привязаны к expires_at - рассчитываем количество дней
    const expiresAt = new Date(existingUser.expires_at);
    savedDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    updateData.subscription_days_left = savedDays;
    console.log(`handleLeftChatMember: рассчитали ${savedDays} дней до истечения подписки для пользователя ${telegramId}`);
    messageToSend = MSG_LEFT_CHAT_DAYS_SAVED(savedDays);
  } else {
    // subscription_days_left = 0 и expires_at <= now() (или отсутствует)
    console.log(`handleLeftChatMember: у пользователя ${telegramId} нет сохранённых дней подписки`);
    messageToSend = MSG_LEFT_CHAT;
  }
  
  // Обновляем данные в БД
  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error(`handleLeftChatMember: ошибка обновления пользователя ${telegramId}:`, error.message);
  } else {
    console.log(`handleLeftChatMember: пользователь ${telegramId} (${user.first_name}) успешно обновлён - статус: покинул чат, сохранено дней: ${savedDays}`);
    
    // Отправляем соответствующее сообщение пользователю
    await sendDirectMessage(telegramId, messageToSend);
  }
} 