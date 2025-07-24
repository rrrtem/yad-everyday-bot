import React from 'react';
import { UserCard } from './UserCard';
import { UI_MESSAGES } from '@/constants';
import type { User } from '@/constants';

interface UserListProps {
  users: User[];
  loading?: boolean;
}

export const UserList: React.FC<UserListProps> = ({ users, loading }) => {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Загрузка...
      </div>
    );
  }
  
  if (!users.length) {
    return (
      <div className="text-center py-16 text-gray-500">
        {UI_MESSAGES.EMPTY_STATES.NO_USERS}
      </div>
    );
  }
  
  return (
    <div>
      {users.map(user => (
        <UserCard key={user.telegram_id} user={user} />
      ))}
    </div>
  );
}; 