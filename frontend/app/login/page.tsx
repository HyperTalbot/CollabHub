// /app/login/page.tsx
"use client";

import React, { useState } from 'react';
// import axios from 'axios';
import OriginalAxios from 'axios';
import axios from '@/lib/axiosInstance';
import { useRouter } from 'next/navigation';
import Cookies from "js-cookie";
import { useAuth } from '@/context/AuthContext';

// Тот же адрес бэкенда
const API_BASE_URL = 'http://localhost:8080/api/v1/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { setAuthData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        email,
        password,
      });

      // === ЭТО САМОЕ ВАЖНОЕ ===
      if (response.status === 200 && response.data.token) {
        // 1. Получаем токен из ответа
        const token = response.data.token;
        
        // 2. Сохраняем токен в localStorage браузера
        // Теперь пользователь будет "помнить" свой вход
        localStorage.setItem('authToken', token);

        // 3. (Опционально) Сохраняем данные пользователя
        localStorage.setItem('user', JSON.stringify(response.data.user));

        Cookies.set('authToken', token, { expires: 1, secure: process.env.NODE_ENV === 'production' })

        setAuthData(response.data.token, response.data.user);

        // 4. Перенаправляем на главную страницу
        router.push('/homepage'); // Или '/dashboard'
      }
      // === КОНЕЦ ВАЖНОГО БЛОКА ===

    } catch (err) {
      if (OriginalAxios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        
        // Ошибка 401 (Unauthorized) - наш бэкенд ее возвращает
        if (status === 401) {
          setError('Неверный email или пароль.');
        } else {
          setError('Ошибка сервера при входе. Попробуйте позже.');
        }
      } else {
        setError('Не удалось подключиться к серверу (Go-сервис запущен?).');
      }
      console.error(err);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="p-8 bg-white shadow-md rounded-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-black">Вход в CollabHub</h1>
        
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className="mb-4">
          <label className="block text-black text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-black text-sm font-bold mb-2">Пароль</label>
          <input
            type="password"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
          Войти
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Нет аккаунта? <a onClick={() => router.push('/register')} className="text-blue-500 hover:text-blue-700 cursor-pointer">Зарегистрироваться</a>
        </p>
      </form>
    </div>
  );
}