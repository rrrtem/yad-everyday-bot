// ========== АУТЕНТИФИКАЦИЯ ==========
export const ADMIN_CREDENTIALS = {
  LOGIN: 'admin',
  PASSWORD: 'yad2024'
} as const;

export const LOCAL_STORAGE_KEY = 'yad_crm_auth';

// ========== SUPABASE НАСТРОЙКИ ==========
export const SUPABASE_CONFIG = {
  URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string
} as const;

// ========== ФИЛЬТРЫ ПОЛЬЗОВАТЕЛЕЙ ==========
export type UserFilter = 'in_chat' | 'out_chat' | 'never_in_chat' | 'search';

export const FILTER_LABELS = {
  in_chat: 'В чате',
  out_chat: 'Вышел',
  never_in_chat: 'Никогда не был',
  search: 'Поиск'
} as const;

// ========== СОРТИРОВКА ==========
export type SortKey = 'created_at' | 'last_activity_at' | 'subscription_days_left';

export const SORT_OPTIONS = [
  { value: 'created_at' as const, label: 'Регистрация' },
  { value: 'last_activity_at' as const, label: 'Активность' },
  { value: 'subscription_days_left' as const, label: 'Дней подписки' }
] as const;

// ========== ИНТЕРФЕЙС ПОЛЬЗОВАТЕЛЯ ==========
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

// ========== СООБЩЕНИЯ UI ==========
export const UI_MESSAGES = {
  LOGIN: {
    TITLE: 'Вход в CRM',
    INVALID_CREDENTIALS: 'Неверный логин или пароль',
    LOGIN_PLACEHOLDER: 'Логин',
    PASSWORD_PLACEHOLDER: 'Пароль',
    SUBMIT_BUTTON: 'Войти'
  },
  LOADING: {
    USERS: 'Загрузка...',
    GENERAL: 'Загружается...'
  },
  EMPTY_STATES: {
    NO_USERS: 'Нет пользователей'
  },
  SEARCH: {
    PLACEHOLDER: 'Username или Telegram ID',
    BUTTON: 'Найти'
  },
  SORT: {
    LABEL: 'Сортировка:',
    ASC_SYMBOL: '↑',
    DESC_SYMBOL: '↓'
  },
  USER_STATUS: {
    IN_CHAT: 'В чате',
    OUT_CHAT: 'Вне чата',
    SUBSCRIPTION_ACTIVE: 'Подписка активна',
    CLUB_MEMBER: 'Клуб',
    IN_WAITLIST: 'Waitlist',
    YES: 'Да',
    NO: 'Нет',
    EMPTY_VALUE: '-'
  }
} as const;

// ========== ПОЛЯ ПОЛЬЗОВАТЕЛЯ ДЛЯ ОТОБРАЖЕНИЯ ==========
export const USER_FIELDS_LABELS = {
  telegram_id: 'ID',
  username: '@',
  first_name: 'Имя',
  last_name: 'Фамилия',
  created_at: 'Дата регистрации',
  joined_at: 'Дата входа',
  left_at: 'Дата выхода',
  last_activity_at: 'Последняя активность',
  mode: 'Режим',
  pace: 'Ритм',
  public_remind: 'Публичные напоминания',
  promo_code: 'Промокод',
  pause_started_at: 'Пауза',
  subscription_days_left: 'Осталось дней подписки',
  expires_at: 'Дата окончания подписки',
  strikes_count: 'Страйки',
  post_today: 'Пост сегодня',
  last_post_date: 'Последний пост',
  units_count: 'Всего постов',
  waitlist_position: 'Позиция в waitlist'
} as const;

// ========== СТИЛИ КОМПОНЕНТОВ ==========
export const STYLES = {
  TAB_ACTIVE: 'px-4 py-2 rounded-t font-medium bg-white border-x border-t border-gray-200 text-blue-600',
  TAB_INACTIVE: 'px-4 py-2 rounded-t font-medium text-gray-500 hover:text-blue-600',
  BUTTON_PRIMARY: 'bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold',
  BUTTON_SECONDARY: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600',
  INPUT: 'border rounded px-3 py-2',
  INPUT_SEARCH: 'border rounded px-2 py-1 w-64',
  CARD: 'bg-white rounded-lg shadow p-4 mb-4 flex flex-col gap-2 border border-gray-100',
  CONTAINER: 'max-w-4xl mx-auto p-4',
  LOGIN_FORM: 'max-w-xs mx-auto mt-32 bg-white p-6 rounded shadow flex flex-col gap-4'
} as const;

// ========== ЦВЕТА СТАТУСОВ ==========
export const STATUS_COLORS = {
  SUCCESS: 'text-green-600',
  ERROR: 'text-red-500',
  WARNING: 'text-yellow-600',
  INFO: 'text-blue-600',
  SECONDARY: 'text-purple-600',
  MUTED: 'text-gray-400'
} as const;

// ========== НАСТРОЙКИ ПРИЛОЖЕНИЯ ==========
export const APP_CONFIG = {
  TITLE: 'YAD Everyday CRM',
  DESCRIPTION: 'Минималистичная CRM-админка для просмотра пользователей'
} as const; // Test auto deploy
