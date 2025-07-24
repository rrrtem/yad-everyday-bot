import React from 'react';
import { UI_MESSAGES } from '@/constants';
import type { User } from '@/constants';

interface UserCardProps {
  user: User;
}

export const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return UI_MESSAGES.USER_STATUS.EMPTY_VALUE;
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const formatDateWithYear = (dateString?: string | null) => {
    if (!dateString) return UI_MESSAGES.USER_STATUS.EMPTY_VALUE;
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const calculateDaysAgo = (dateString?: string | null) => {
    if (!dateString) return 0;
    
    const now = new Date();
    const targetDate = new Date(dateString);
    const diffTime = now.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const calculateDaysLeft = (expiresAt?: string | null) => {
    if (!expiresAt) return 0;
    
    const now = new Date();
    const expiryDate = new Date(expiresAt);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Не возвращаем отрицательные дни
  };

  const getSubscriptionText = () => {
    if (!user.subscription_active) {
      return 'неактивна';
    }
    
    // Если подписка активна, показываем дату окончания
    const endDate = formatDate(user.expires_at);
    const daysLeft = calculateDaysLeft(user.expires_at);
    
    if (user.expires_at) {
      return `до ${endDate} (${daysLeft} дней)`;
    } else {
      return `активна (${user.subscription_days_left || 0} дней)`;
    }
  };

  // Рассчитываем реальное количество бесплатных дней
  const getFreeDays = () => {
    // Если есть активная подписка, бесплатных дней нет
    if (user.subscription_active) {
      return 0;
    }
    // Иначе показываем subscription_days_left как бесплатные дни
    return user.subscription_days_left > 0 ? user.subscription_days_left : 0;
  };

  // Функция для определения стадии пользователя на основе доступных данных
  const getUserStage = () => {
    // 5. Нажал на кнопку у меня нет промокода и получил ссылку на оплаты
    if (user.subscription_active || user.subscription_days_left > 0) {
      return 'Получил ссылку на оплату';
    }
    
    // 4. Нажал на промокод
    if (user.promo_code) {
      return 'Нажал на промокод';
    }
    
    // 3. Увидел про цены (после выбора режима, но нет промокода и подписки)
    if (user.mode && !user.promo_code && !user.subscription_active && user.subscription_days_left <= 0) {
      return 'Увидел про цены';
    }
    
    // 2. Выбрал режим тексты
    if (user.mode) {
      return 'Выбрал режим тексты';
    }
    
    // 1. Просто нажал старт (только создан, ничего не настроено)
    return 'Просто нажал старт';
  };

  // Определяем, какую дополнительную информацию показывать
  const renderAdditionalInfo = () => {
    // Для тех, кто вышел из чата (имеет joined_at но in_chat = false)
    if (!user.in_chat && user.joined_at) {
      const leftDate = formatDate(user.left_at);
      const daysAgo = calculateDaysAgo(user.left_at);
      
      return (
        <div className="flex justify-between">
          <span className="text-gray-600">Дата выхода</span>
          <span className="text-black font-medium">
            {leftDate} ({daysAgo} дней назад)
          </span>
        </div>
      );
    }
    
    // Для тех, кто никогда не заходил в чат (joined_at = null)
    if (!user.joined_at) {
      const registrationDate = formatDateWithYear(user.created_at);
      const daysAgo = calculateDaysAgo(user.created_at);
      const stage = getUserStage();
      
      return (
        <>
          <div className="flex justify-between">
            <span className="text-gray-600">Начало общения</span>
            <span className="text-black font-medium">
              {registrationDate} ({daysAgo} дней назад)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Стадия</span>
            <span className="text-black font-medium">{stage}</span>
          </div>
        </>
      );
    }
    
    return null;
  };

  return (
    <div className="border-b border-gray-100 py-6 last:border-b-0">
      <div className="mb-4">
        <h3 className="text-xl font-medium text-black">
          {user.first_name} {user.last_name}
          {user.username && (
            <span className="text-gray-500 text-xs ml-2 font-normal">
              @{user.username}
            </span>
          )}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        {/* Показываем основные поля только для тех, кто заходил в чат */}
        {user.joined_at && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Подписка</span>
              <span className="text-black font-medium">{getSubscriptionText()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Пост сегодня</span>
              <span className="text-black font-medium">
                {user.post_today ? 'да' : 'нет'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Бесплатных дней</span>
              <span className="text-black font-medium">{getFreeDays()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Всего постов</span>
              <span className="text-black font-medium">{user.units_count}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Страйки</span>
              <span className="text-black font-medium">{user.strikes_count}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Ритм</span>
              <span className="text-black font-medium">
                {user.pace || UI_MESSAGES.USER_STATUS.EMPTY_VALUE}
              </span>
            </div>
          </>
        )}

        {/* Дополнительная информация в зависимости от статуса пользователя */}
        {renderAdditionalInfo()}
      </div>
    </div>
  );
}; 