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
    console.log(`🔄 Удаляем пользователя ${userId} из чата ${groupChatId}...`);
    
    // Шаг 1: Банируем пользователя (это удаляет его из чата)
    const banResponse = await fetch(`${TELEGRAM_API}/banChatMember`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
        revoke_messages: false // Не удаляем его сообщения
      })
    });
    
    if (!banResponse.ok) {
      const banErrorText = await banResponse.text();
      throw new Error(`Ошибка бана пользователя: ${banResponse.status} - ${banErrorText}`);
    }
    
    console.log(`✅ Шаг 1: Пользователь ${userId} забанен (удален из чата)`);
    
    // Шаг 2: Разбанируем пользователя (чтобы он мог вернуться по ссылке)
    // Небольшая задержка перед разбаном для надежности
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const unbanResponse = await fetch(`${TELEGRAM_API}/unbanChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId,
        user_id: userId,
        only_if_banned: true // Разбанить только если действительно забанен
      })
    });
    
    if (!unbanResponse.ok) {
      const unbanErrorText = await unbanResponse.text();
      console.warn(`⚠️ Первая попытка разбана пользователя ${userId} не удалась: ${unbanResponse.status} - ${unbanErrorText}`);
      
      // Повторная попытка разбана без флага only_if_banned
      console.log(`🔄 Повторная попытка разбана пользователя ${userId}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retryUnbanResponse = await fetch(`${TELEGRAM_API}/unbanChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: groupChatId,
          user_id: userId
          // Убираем only_if_banned для повторной попытки
        })
      });
      
      if (!retryUnbanResponse.ok) {
        const retryErrorText = await retryUnbanResponse.text();
        console.error(`❌ Критическая ошибка: не удалось разбанить пользователя ${userId} даже после повторной попытки: ${retryUnbanResponse.status} - ${retryErrorText}`);
        console.error(`🚨 ВНИМАНИЕ: Пользователь ${userId} может быть постоянно забанен и не сможет вернуться по ссылке!`);
      } else {
        console.log(`✅ Шаг 2 (повторная попытка): Пользователь ${userId} разбанен (может вернуться по invite ссылке)`);
      }
    } else {
      console.log(`✅ Шаг 2: Пользователь ${userId} разбанен (может вернуться по invite ссылке)`);
    }
    
    console.log(`🎯 Пользователь ${userId} успешно удален из чата БЕЗ постоянного бана`);
  } catch (err) {
    console.error(`❌ Ошибка удаления пользователя ${userId} без бана:`, err);
    throw err;
  }
} 