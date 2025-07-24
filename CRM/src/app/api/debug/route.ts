import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Проверяем переменные окружения
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
    };

    // Тестируем подключение к Supabase
    let connectionTest: { success: boolean; error: string | null; count?: any } = { 
      success: false, 
      error: 'Not tested' 
    };
    
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        connectionTest = { success: false, error: error.message };
      } else {
        connectionTest = { success: true, error: null, count: data };
      }
    } catch (err) {
      connectionTest = { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment_variables: envCheck,
      supabase_connection: connectionTest,
      api_status: 'working'
    });

  } catch (error) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 