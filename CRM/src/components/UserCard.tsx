import React from 'react';
import { User } from '../api/users';

interface UserCardProps {
  user: User;
}

export const UserCard: React.FC<UserCardProps> = ({ user }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-col gap-2 border border-gray-100">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span>ID: {user.telegram_id}</span>
        {user.username && <span className="text-gray-400">@{user.username}</span>}
      </div>
      <div className="text-sm text-gray-700">
        <span>{user.first_name} {user.last_name}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs mt-2">
        <span className={user.in_chat ? 'text-green-600' : 'text-red-500'}>
          {user.in_chat ? 'В чате' : 'Вне чата'}
        </span>
        {user.subscription_active && <span className="text-blue-600">Подписка активна</span>}
        {user.club && <span className="text-purple-600">Клуб</span>}
        {user.waitlist && <span className="text-yellow-600">Waitlist</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
        <span>Дата регистрации: <b>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</b></span>
        <span>Дата входа: <b>{user.joined_at ? new Date(user.joined_at).toLocaleDateString() : '-'}</b></span>
        <span>Дата выхода: <b>{user.left_at ? new Date(user.left_at).toLocaleDateString() : '-'}</b></span>
        <span>Последняя активность: <b>{user.last_activity_at ? new Date(user.last_activity_at).toLocaleDateString() : '-'}</b></span>
        <span>Режим: <b>{user.mode || '-'}</b></span>
        <span>Ритм: <b>{user.pace || '-'}</b></span>
        <span>Публичные напоминания: <b>{user.public_remind ? 'Да' : 'Нет'}</b></span>
        <span>Промокод: <b>{user.promo_code || '-'}</b></span>
        <span>Пауза: <b>{user.pause_started_at ? `${user.pause_days} дн. до ${user.pause_until ? new Date(user.pause_until).toLocaleDateString() : '-'}` : '-'}</b></span>
        <span>Осталось дней подписки: <b>{user.subscription_days_left}</b></span>
        <span>Дата окончания подписки: <b>{user.expires_at ? new Date(user.expires_at).toLocaleDateString() : '-'}</b></span>
        <span>Страйки: <b>{user.strikes_count}</b></span>
        <span>Пост сегодня: <b>{user.post_today ? 'Да' : 'Нет'}</b></span>
        <span>Последний пост: <b>{user.last_post_date ? new Date(user.last_post_date).toLocaleDateString() : '-'}</b></span>
        <span>Всего постов: <b>{user.units_count}</b></span>
        <span>Позиция в waitlist: <b>{user.waitlist_position ?? '-'}</b></span>
      </div>
    </div>
  );
}; 