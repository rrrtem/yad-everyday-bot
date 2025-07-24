import React, { useState } from 'react';
import { 
  ADMIN_CREDENTIALS, 
  LOCAL_STORAGE_KEY, 
  UI_MESSAGES, 
  STYLES
} from '@/constants';

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Небольшая задержка для демонстрации загрузки
    await new Promise(resolve => setTimeout(resolve, 800));

    if (login === ADMIN_CREDENTIALS.LOGIN && password === ADMIN_CREDENTIALS.PASSWORD) {
      localStorage.setItem(LOCAL_STORAGE_KEY, '1');
      onLogin();
    } else {
      setError(UI_MESSAGES.LOGIN.INVALID_CREDENTIALS);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Иконка */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-6">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-gray-900 mb-2">Вход в CRM</h1>
          <p className="text-sm text-gray-500">Введите данные для доступа</p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder={UI_MESSAGES.LOGIN.LOGIN_PLACEHOLDER}
              className="w-full px-0 py-3 text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 placeholder-gray-400"
              value={login}
              onChange={e => setLogin(e.target.value)}
              autoFocus
              required
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={UI_MESSAGES.LOGIN.PASSWORD_PLACEHOLDER}
              className="w-full px-0 py-3 pr-8 text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 placeholder-gray-400"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-0 top-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Ошибка */}
          {error && (
            <div className="text-center">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Кнопка входа */}
          <button 
            type="submit" 
            className={`w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-none hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Вход в систему...
              </div>
            ) : (
              UI_MESSAGES.LOGIN.SUBMIT_BUTTON
            )}
          </button>
        </form>
      </div>
    </div>
  );
}; 