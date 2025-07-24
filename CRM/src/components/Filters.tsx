import * as Tabs from '@radix-ui/react-tabs';
import React from 'react';
import { 
  FILTER_LABELS
} from '@/constants';
import type { UserFilter } from '@/constants';

interface FiltersProps {
  value: UserFilter;
  onChange: (tab: UserFilter) => void;
  filterStats?: Record<string, number>;
}

export const Filters: React.FC<FiltersProps> = ({ value, onChange, filterStats = {} }) => {
  const handleValueChange = (value: string) => {
    onChange(value as UserFilter);
  };

  const getFilterLabel = (filterKey: string, baseLabel: string) => {
    const count = filterStats[filterKey];
    return count !== undefined ? `${baseLabel} (${count})` : baseLabel;
  };

  return (
    <Tabs.Root value={value} onValueChange={handleValueChange} className="w-full">
      <Tabs.List className="flex gap-6">
        <Tabs.Trigger value="in_chat" className={simpleTabClass(value === 'in_chat')}>
          {getFilterLabel('in_chat', FILTER_LABELS.in_chat)}
        </Tabs.Trigger>
        <Tabs.Trigger value="out_chat" className={simpleTabClass(value === 'out_chat')}>
          {getFilterLabel('out_chat', FILTER_LABELS.out_chat)}
        </Tabs.Trigger>
        <Tabs.Trigger value="never_in_chat" className={simpleTabClass(value === 'never_in_chat')}>
          {getFilterLabel('never_in_chat', FILTER_LABELS.never_in_chat)}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  );
};

function simpleTabClass(active: boolean) {
  return active 
    ? 'text-black font-medium border-b-2 border-black pb-1 text-sm'
    : 'text-gray-500 font-medium pb-1 text-sm hover:text-gray-700';
} 