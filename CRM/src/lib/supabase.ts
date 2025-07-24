import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/constants';

// Клиент для фронтенда (с ограничениями RLS)
export const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

// Клиент для сервера/админки (service_role обходит RLS)  
export const supabaseAdmin = createClient(
  SUPABASE_CONFIG.URL, 
  SUPABASE_CONFIG.SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    // Важно: убираем дополнительные заголовки, так как service_role key
    // уже содержит всю необходимую информацию для обхода RLS
  }
);

// Функция для проверки что service_role key правильно настроен
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection test passed. Total users:', data);
    return { success: true, count: data };
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return { success: false, error: 'Connection failed' };
  }
} 