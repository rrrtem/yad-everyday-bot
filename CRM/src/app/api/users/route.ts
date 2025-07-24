import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, testSupabaseConnection } from '@/lib/supabase';
import type { UserFilter, User } from '@/constants';

export async function GET() {
  // Диагностический endpoint для проверки подключения
  const testResult = await testSupabaseConnection();
  return NextResponse.json({
    message: 'Users API endpoint',
    connection_test: testResult,
    service_role_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const { filter }: { filter: UserFilter } = await request.json();

    console.log(`API call - Filter: ${filter}`);

    // Используем supabaseAdmin который должен обходить RLS через service_role
    let query = supabaseAdmin
      .from('users')
      .select('*');

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
      default:
        break;
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      return NextResponse.json({ 
        error: 'Database query failed',
        message: error.message,
        details: error.details,
        hint: error.hint,
        filter: filter,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Получаем статистику для всех фильтров
    try {
      const [allUsersResult, inChatResult, outChatResult, neverInChatResult] = await Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('in_chat', true),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('in_chat', false).not('joined_at', 'is', null),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).is('joined_at', null)
      ]);

      const stats = {
        in_chat: inChatResult.count || 0,
        out_chat: outChatResult.count || 0,
        never_in_chat: neverInChatResult.count || 0
      };

      console.log('Filter stats:', stats);

      console.log(`Successfully fetched ${data?.length || 0} users for filter: ${filter}`);
      
      return NextResponse.json({
        users: data as User[],
        count: data?.length || 0,
        stats: stats,
        filter: filter,
        timestamp: new Date().toISOString()
      });

    } catch (statsError) {
      console.error('Error fetching stats:', statsError);
      // Возвращаем данные без статистики в случае ошибки
      return NextResponse.json({
        users: data as User[],
        count: data?.length || 0,
        stats: {},
        filter: filter,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 