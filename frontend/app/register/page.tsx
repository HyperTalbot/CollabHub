// /app/register/page.tsx
"use client"; // Важно: используем React Hooks, поэтому это клиентский компонент.

import React, { useState } from 'react';
// import axios from 'axios';
import OriginalAxios from 'axios';
import axios from "@/lib/axiosInstance";
import { useRouter } from 'next/navigation';

// Наш локальный адрес бэкенда. 
// В продакшене это будет домен, например, process.env.NEXT_PUBLIC_API_URL
// const API_BASE_URL = 'http://localhost:8080/api/v1/auth/'; 
const API_BASE_URL = "https://collabhub.cloudpub.ru/api/v1/auth/"

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}register`, {
        // Ключи в JSON должны строго соответствовать gin-тегам в RegisterInput!
        username,
        email,
        password,
      });

      if (response.status === 201) {
        setSuccess('Регистрация успешна! Перенаправляем на страницу входа...');
        // После успешной регистрации перенаправляем на страницу входа
        setTimeout(() => {
          router.push('/login'); 
        }, 1500);
      }
    } catch (err) {
      if (OriginalAxios.isAxiosError(err) && err.response) {
        // Обработка ошибок бэкенда (409 Conflict, 400 Bad Request)
        const status = err.response.status;
        if (status === 409) {
            setError('Пользователь с таким email уже зарегистрирован.');
        } else if (status === 400) {
            setError('Проверьте введенные данные (email, длина пароля).');
        } else {
            setError('Ошибка сервера при регистрации. Попробуйте позже.');
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
        <h1 className="text-2xl text-black font-bold mb-6 text-center">Регистрация в CollabHub</h1>
        
        {/* Отображение сообщений об ошибке/успехе */}
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && <p className="text-green-500 text-center mb-4">{success}</p>}

        {/* Поле Username */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Имя пользователя</label>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </div>

        {/* Поле Email */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Поле Password */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">Пароль (мин. 6 символов)</label>
          <input
            type="password"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
            value={password}

            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        
        {/* Кнопка отправки */}
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
          Зарегистрироваться
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Уже есть аккаунт? <a onClick={() => router.push('/login')} className="text-blue-500 hover:text-blue-700 cursor-pointer">Войти</a>
        </p>
      </form>
    </div>
  );
}