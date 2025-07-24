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

// Test auto deploy with correct Root Directory - 2025-07-24
// Auto deploy test #2 - checking GitHub integration - 09:40

// ========== ФИЛЬТРЫ ==========
export type UserFilter = 'in_chat' | 'out_chat' | 'never_in_chat';

export const FILTER_LABELS = {
  in_chat: 'В чате',
  out_chat: 'Вышли', 
  never_in_chat: 'Не заходили'
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
  // Табы
  TAB_ACTIVE: 'px-6 py-3 rounded-lg font-medium bg-blue-50 border border-blue-200 text-blue-700 transition-all duration-200',
  TAB_INACTIVE: 'px-6 py-3 rounded-lg font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-all duration-200',
  
  // Кнопки
  BUTTON_PRIMARY: 'bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-all duration-200 shadow-sm hover:shadow-md',
  BUTTON_SECONDARY: 'bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 font-medium transition-all duration-200',
  BUTTON_SORT: 'bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 min-w-[120px]',
  
  // Инпуты
  INPUT: 'border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200',
  INPUT_SEARCH: 'border border-gray-200 rounded-lg px-4 py-2 w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200',
  
  // Карточки
  CARD: 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group',
  CARD_HEADER: 'flex items-start justify-between mb-4 pb-4 border-b border-gray-100',
  CARD_SECTION: 'mb-6 last:mb-0',
  CARD_SECTION_TITLE: 'text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3',
  
  // Контейнеры
  CONTAINER: 'max-w-7xl mx-auto px-6 py-8',
  CONTENT_WRAPPER: 'bg-gray-50 min-h-screen',
  DASHBOARD_HEADER: 'bg-white border-b border-gray-200 mb-8',
  DASHBOARD_TITLE: 'text-2xl font-bold text-gray-900 mb-2',
  DASHBOARD_SUBTITLE: 'text-gray-600',
  
  // Формы
  LOGIN_FORM: 'max-w-md mx-auto mt-32 bg-white p-8 rounded-xl shadow-lg border border-gray-100',
  FORM_GROUP: 'mb-6',
  FORM_LABEL: 'block text-sm font-medium text-gray-700 mb-2',
  
  // Статусы и бейджи
  BADGE_BASE: 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
  STATUS_INDICATOR: 'w-2 h-2 rounded-full mr-2',
  
  // Утилиты
  DIVIDER: 'border-t border-gray-200 my-6',
  HOVER_CARD: 'hover:bg-gray-50 transition-colors duration-150 rounded-lg p-2',
} as const;

// ========== ЦВЕТА СТАТУСОВ ==========
export const STATUS_COLORS = {
  SUCCESS: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  ERROR: 'text-red-700 bg-red-50 border-red-200',
  WARNING: 'text-amber-700 bg-amber-50 border-amber-200', 
  INFO: 'text-blue-700 bg-blue-50 border-blue-200',
  SECONDARY: 'text-purple-700 bg-purple-50 border-purple-200',
  MUTED: 'text-gray-500 bg-gray-50 border-gray-200',
  NEUTRAL: 'text-gray-700 bg-gray-100 border-gray-200'
} as const;


