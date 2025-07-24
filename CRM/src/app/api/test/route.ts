import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    env_check: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'
    },
    timestamp: new Date().toISOString()
  });
}

export async function POST() {
  return NextResponse.json({ message: 'POST works', timestamp: new Date().toISOString() });
} 