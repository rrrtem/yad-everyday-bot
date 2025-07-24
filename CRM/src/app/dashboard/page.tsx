'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filters } from '@/components/Filters';
import { UserList } from '@/components/UserList';
import { LOCAL_STORAGE_KEY, STYLES, UI_MESSAGES, SORT_OPTIONS } from '@/constants';
import type { UserFilter, SortKey, User } from '@/constants';

export default function DashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<UserFilter>('in_chat');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterStats, setFilterStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(LOCAL_STORAGE_KEY) !== '1') {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    
    fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter
      })
    })
      .then(res => res.json())
      .then(data => {
        if (!ignore) {
          if (data.error) {
            setError(`Ошибка: ${data.message || data.error}`);
            setUsers([]);
          } else if (data.users) {
            // Новый формат API с статистикой
            setUsers(data.users);
            setFilterStats(data.stats || {});
            setError(null);
          } else if (Array.isArray(data)) {
            // Старый формат API (обратная совместимость)
            setUsers(data);
            setError(null);
          } else {
            setError('Неправильный формат ответа от сервера');
            setUsers([]);
          }
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(`Ошибка сети: ${err.message}`);
          setUsers([]);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    
    return () => { ignore = true; };
  }, [filter]);

  // Сортировка на фронте
  const sortedUsers = [...users].sort((a, b) => {
    const aVal = a[sort] ?? '';
    const bVal = b[sort] ?? '';
    if (sort === 'subscription_days_left') {
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const handleLogout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    router.replace('/login');
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Основное содержимое */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Контролы в одну строку */}
        <div className="flex items-center justify-between mb-8">
          {/* Фильтры слева */}
          <div className="flex-1">
            <Filters
              value={filter}
              onChange={tab => { 
                setFilter(tab); 
              }}
              filterStats={filterStats}
            />
          </div>
          
          {/* Сортировка и выход справа */}
          <div className="flex items-center gap-4">
            <select
              className="rounded px-3 py-2 text-sm bg-white focus:outline-none"
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <button
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            >
              <svg 
                className={`w-4 h-4 text-gray-600 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Выйти
            </button>
          </div>
        </div>
        
        {/* Блок ошибок */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}
        
        {/* Список пользователей */}
        <UserList users={sortedUsers} loading={loading} />
      </div>
    </div>
  );
} 