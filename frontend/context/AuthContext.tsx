// /frontend/context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from "next/navigation";

// Тип для данных пользователя
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  avatar_url: string;
  // Добавьте остальные поля, которые возвращает ваш Go-сервис
}

// Тип для состояния контекста
interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  logout: () => void;
  setAuthData: (token: string, userData: User) => void;
  // clearAuthData: () => void;
}

// Создаем контекст
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Хук для быстрого использования контекста
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Компонент-провайдер
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // Состояние для первоначальной загрузки

  // Проверка состояния при монтировании компонента (при перезагрузке страницы)
  useEffect(() => {
    const token = Cookies.get('authToken');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData) as User);
        setIsLoggedIn(true);
      } catch (e) {
        console.error("Failed to parse user data from localStorage", e);
        // Если данные повреждены, очищаем всё
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Функция для сохранения данных (после логина)
  const setAuthData = (token: string, userData: User) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Сохраняем в Cookies, чтобы Middleware видел токен
    Cookies.set('authToken', token, { expires: 1, secure: process.env.NODE_ENV === 'production' });

    setUser(userData);
    setIsLoggedIn(true);
  };

  // Функция для выхода
  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    Cookies.remove('authToken');
    
    setUser(null);
    setIsLoggedIn(false);

    // Редирект страницу логину
    router.push('/login');
  };
  
  // Если мы еще проверяем, залогинен ли пользователь, показываем загрузку
  if (loading) {
      return <div>Загрузка...</div>; 
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, logout, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
};