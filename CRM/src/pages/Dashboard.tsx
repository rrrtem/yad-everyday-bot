import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filters, FilterTab } from '../components/Filters';
import { UserList } from '../components/UserList';
import { fetchUsers, User } from '../api/users';

const sortOptions = [
  { value: 'created_at', label: 'Регистрация' },
  { value: 'last_activity_at', label: 'Активность' },
  { value: 'subscription_days_left', label: 'Дней подписки' },
];

type SortKey = 'created_at' | 'last_activity_at' | 'subscription_days_left';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>('in_chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (localStorage.getItem('yad_crm_auth') !== '1') {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetchUsers(filter, filter === 'search' ? searchQuery : undefined)
      .then(data => {
        if (!ignore) setUsers(data);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
    return () => { ignore = true; };
  }, [filter, searchQuery]);

  // Сортировка на фронте
  const sortedUsers = [...users].sort((a, b) => {
    const aVal = a[sort] ?? '';
    const bVal = b[sort] ?? '';
    if (sort === 'subscription_days_left') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <Filters
          value={filter}
          onChange={tab => { setFilter(tab); if (tab !== 'search') setSearchQuery(''); }}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-500">Сортировка:</label>
          <select
            className="border rounded px-2 py-1"
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            className="ml-2 text-blue-600 hover:underline"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
      <UserList users={sortedUsers} loading={loading} />
    </div>
  );
}; 