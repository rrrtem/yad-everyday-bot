import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByTelegramId, registerUser, sendDirectMessage } from "./userHandler.ts";
import { MSG_WELCOME_BACK } from "../constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables for newChatMemberHandler.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Обрабатывает событие входа пользователя в чат (new_chat_member)
 * Реализует логику Б4 из logic.md
 */
export async function handleNewChatMember(chatMemberUpdate: any): Promise<void> {
  console.log("handleNewChatMember вызван", JSON.stringify(chatMemberUpdate));
  
  if (!chatMemberUpdate || !chatMemberUpdate.new_chat_member) {
    console.log("handleNewChatMember: нет данных new_chat_member, выход");
    return;
  }
  
  const member = chatMemberUpdate.new_chat_member;
  const user = member.user;
  const telegramId = user.id;
  const now = new Date();
  
  // Проверяем, что пользователь действительно вошел в чат
  const isInChat = ["member", "administrator", "creator"].includes(member.status);
  if (!isInChat) {
    console.log(`handleNewChatMember: пользователь ${telegramId} не является участником чата, статус: ${member.status}`);
    return;
  }
  
  console.log(`handleNewChatMember: обрабатываем вход пользователя ${telegramId} в чат`);
  
  // Шаг 1: Проверяем, что пользователь существует в БД
  let existingUser = await findUserByTelegramId(telegramId);
  
  if (!existingUser) {
    console.log(`handleNewChatMember: пользователь ${telegramId} не найден в БД, создаём новую запись`);
    // Создаём новую запись с базовыми данными
    await registerUser(user);
    existingUser = await findUserByTelegramId(telegramId);
    
    if (!existingUser) {
      console.error(`handleNewChatMember: ошибка создания пользователя ${telegramId}`);
      return;
    }
  }
  
  console.log(`handleNewChatMember: пользователь ${telegramId} найден/создан в БД`);
  
  // Шаг 2: Обновляем статус участия
  let updateData: any = {
    // Обновляем данные из Telegram
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    username: user.username || null,
    // Статус участия в чате
    in_chat: true,
    joined_at: now.toISOString(),
    strikes_count: 0, // Сброс страйков при входе в чат
    post_today: false,
    updated_at: now.toISOString()
  };
  
  // Определяем is_active на основе подписки
  const hasActiveSubscription = existingUser.subscription_active === true;
  const hasSavedDays = (existingUser.subscription_days_left || 0) > 0;
  
  if (hasActiveSubscription || hasSavedDays) {
    updateData.is_active = true;
    console.log(`handleNewChatMember: пользователь ${telegramId} становится активным (subscription_active: ${hasActiveSubscription}, saved_days: ${existingUser.subscription_days_left})`);
  } else {
    updateData.is_active = false;
    console.log(`handleNewChatMember: пользователь ${telegramId} остается неактивным (нет подписки и сохранённых дней)`);
  }
  
  // Шаг 3: Если у пользователя были сохранённые дни подписки
  if (hasSavedDays) {
    console.log(`handleNewChatMember: у пользователя ${telegramId} есть ${existingUser.subscription_days_left} сохранённых дней`);
    
    // Рассчитываем новую дату expires_at
    const newExpiresAt = new Date(now.getTime() + existingUser.subscription_days_left * 24 * 60 * 60 * 1000);
    updateData.expires_at = newExpiresAt.toISOString();
    updateData.subscription_days_left = 0; // Используем сохранённые дни
    
    console.log(`handleNewChatMember: установлена новая дата окончания подписки: ${newExpiresAt.toISOString()}`);
    
    // Отправляем приветственное сообщение о возвращении
    await sendDirectMessage(telegramId, MSG_WELCOME_BACK);
  }
  
  // Обновляем данные в БД
  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("telegram_id", telegramId);
    
  if (error) {
    console.error(`handleNewChatMember: ошибка обновления пользователя ${telegramId}:`, error.message);
  } else {
    console.log(`handleNewChatMember: пользователь ${telegramId} (${user.first_name}) успешно обновлён - статус: в чате, активен: ${updateData.is_active}`);
  }
} 