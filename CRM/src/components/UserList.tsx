import React from 'react';
import { User } from '../api/users';
import { UserCard } from './UserCard';

interface UserListProps {
  users: User[];
  loading?: boolean;
}

export const UserList: React.FC<UserListProps> = ({ users, loading }) => {
  if (loading) return <div className="text-center py-8 text-gray-400">Загрузка...</div>;
  if (!users.length) return <div className="text-center py-8 text-gray-400">Нет пользователей</div>;
  return (
    <div className="flex flex-col gap-4">
      {users.map(user => (
        <UserCard key={user.telegram_id} user={user} />
      ))}
    </div>
  );
}; 