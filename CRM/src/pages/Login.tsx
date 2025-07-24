import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export const Login: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('yad_crm_auth') === '1') {
      navigate('/');
    }
  }, [navigate]);

  return <LoginForm onLogin={() => navigate('/')} />;
}; 