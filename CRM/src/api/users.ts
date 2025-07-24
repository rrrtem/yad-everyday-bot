import { supabase } from './supabaseClient';

export interface User {
  telegram_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  in_chat: boolean;
  joined_at?: string | null;
  left_at?: string | null;
  mode?: string | null;
  pace?: string | null;
  subscription_active: boolean;
  subscription_days_left: number;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  strikes_count: number;
  consecutive_posts_count?: number;
  post_today: boolean;
  last_post_date?: string | null;
  units_count: number;
  pause_started_at?: string | null;
  pause_until?: string | null;
  pause_days: number;
  public_remind?: boolean;
  promo_code?: string | null;
  club?: boolean;
  waitlist?: boolean;
  waitlist_position?: number | null;
  last_activity_at?: string | null;
}

export type UserFilter = 'in_chat' | 'out_chat' | 'never_in_chat' | 'search';

export async function fetchUsers(filter: UserFilter, searchQuery?: string): Promise<User[]> {
  let query = supabase.from('users').select('*');

  switch (filter) {
    case 'in_chat':
      query = query.eq('in_chat', true);
      break;
    case 'out_chat':
      query = query.eq('in_chat', false).not('joined_at', 'is', null);
      break;
    case 'never_in_chat':
      query = query.is('joined_at', null);
      break;
    case 'search':
      if (searchQuery) {
        query = query.or(`username.ilike.%${searchQuery}%,telegram_id.eq.${searchQuery}`);
      }
      break;
    default:
      break;
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as User[];
} 