/**
 * Утилиты для работы с Telegram API
 */

/**
 * Функция для удаления пользователя из чата БЕЗ бана (чтобы он мог вернуться по ссылке)
 * Использует двухэтапный процесс: сначала банит, затем разбанивает
 */
export async function removeUserFromChatWithoutBan(userId: number, groupChatId: string, telegramBotToken: string): Promise<void> {
  const TELEGRAM_API = `https://api.telegram.org/bot${telegramBotToken}`;
  
  try {
    // console.log(`🚀 Начинаю процесс удаления пользователя ${userId} из чата без постоянного бана`);
    
    // Шаг 1: Кикаем пользователя из чата (временный бан)
    const kickResponse = await fetch(`${TELEGRAM_API}/banChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
        revoke_messages: false
      })
    });
    
    if (!kickResponse.ok) {
      const kickErrorText = await kickResponse.text();
      console.error(`❌ Ошибка кика пользователя ${userId}: ${kickResponse.status} - ${kickErrorText}`);
      throw new Error(`Failed to kick user: ${kickResponse.status} - ${kickErrorText}`);
    }
    
    // console.log(`✅ Шаг 1: Пользователь ${userId} временно забанен (кикнут из чата)`);
    
    // Ждем немного перед разбаном
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Шаг 2: Разбаниваем пользователя (снимаем ограничения)
    const unbanResponse = await fetch(`${TELEGRAM_API}/unbanChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
        only_if_banned: true
      })
    });
    
    if (!unbanResponse.ok) {
      const unbanErrorText = await unbanResponse.text();
      console.error(`⚠️ Ошибка разбана пользователя ${userId} с первой попытки: ${unbanResponse.status} - ${unbanErrorText}`);
      
      // Повторная попытка разбана (иногда требуется)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const retryUnbanResponse = await fetch(`${TELEGRAM_API}/unbanChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: groupChatId,
          user_id: userId,
          only_if_banned: false // Пробуем без условия
        })
      });
      
      if (!retryUnbanResponse.ok) {
        const retryErrorText = await retryUnbanResponse.text();
        console.error(`❌ Критическая ошибка: не удалось разбанить пользователя ${userId} даже после повторной попытки: ${retryUnbanResponse.status} - ${retryErrorText}`);
        console.error(`🚨 ВНИМАНИЕ: Пользователь ${userId} может быть постоянно забанен и не сможет вернуться по ссылке!`);
      } else {
        // console.log(`✅ Шаг 2 (повторная попытка): Пользователь ${userId} разбанен (может вернуться по invite ссылке)`);
      }
    } else {
      // console.log(`✅ Шаг 2: Пользователь ${userId} разбанен (может вернуться по invite ссылке)`);
    }
    
    console.log(`✅ User ${userId} removed from chat without permanent ban`);
  } catch (err) {
    console.error(`❌ Ошибка удаления пользователя ${userId} без бана:`, err);
    throw err;
  }
} 