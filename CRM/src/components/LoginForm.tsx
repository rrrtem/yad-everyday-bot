import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: () => void;
}

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'yad2024'; // Можно вынести в .env, но для демо — в коде

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      localStorage.setItem('yad_crm_auth', '1');
      onLogin();
    } else {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xs mx-auto mt-32 bg-white p-6 rounded shadow flex flex-col gap-4">
      <h2 className="text-xl font-bold mb-2">Вход в CRM</h2>
      <input
        type="text"
        placeholder="Логин"
        className="border rounded px-3 py-2"
        value={login}
        onChange={e => setLogin(e.target.value)}
        autoFocus
      />
      <input
        type="password"
        placeholder="Пароль"
        className="border rounded px-3 py-2"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <button type="submit" className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-semibold">Войти</button>
    </form>
  );
}; 