import * as Tabs from '@radix-ui/react-tabs';
import React, { useState } from 'react';

export type FilterTab = 'in_chat' | 'out_chat' | 'never_in_chat' | 'search';

interface FiltersProps {
  value: FilterTab;
  onChange: (tab: FilterTab) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
}

export const Filters: React.FC<FiltersProps> = ({ value, onChange, searchQuery, onSearch }) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  return (
    <Tabs.Root value={value} onValueChange={onChange} className="w-full mb-4">
      <Tabs.List className="flex gap-2 border-b border-gray-200 mb-2">
        <Tabs.Trigger value="in_chat" className={tabClass(value === 'in_chat')}>В чате</Tabs.Trigger>
        <Tabs.Trigger value="out_chat" className={tabClass(value === 'out_chat')}>Вышел</Tabs.Trigger>
        <Tabs.Trigger value="never_in_chat" className={tabClass(value === 'never_in_chat')}>Никогда не был</Tabs.Trigger>
        <Tabs.Trigger value="search" className={tabClass(value === 'search')}>Поиск</Tabs.Trigger>
      </Tabs.List>
      {value === 'search' && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            className="border rounded px-2 py-1 w-64"
            placeholder="Username или Telegram ID"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSearch(localSearch); }}
          />
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            onClick={() => onSearch(localSearch)}
          >
            Найти
          </button>
        </div>
      )}
    </Tabs.Root>
  );
};

function tabClass(active: boolean) {
  return (
    'px-4 py-2 rounded-t font-medium ' +
    (active ? 'bg-white border-x border-t border-gray-200 text-blue-600' : 'text-gray-500 hover:text-blue-600')
  );
} 