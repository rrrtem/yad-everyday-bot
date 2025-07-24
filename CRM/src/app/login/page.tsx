'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { LOCAL_STORAGE_KEY } from '@/constants';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(LOCAL_STORAGE_KEY) === '1') {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleLogin = () => {
    router.replace('/dashboard');
  };

  return <LoginForm onLogin={handleLogin} />;
} 