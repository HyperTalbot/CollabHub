// /app/(app)/layout.tsx
"use client"; // Нужен для кнопки "Выход"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from "js-cookie";
// import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/layout/AppHeader';
import { ThemeProvider } from "@/context/ThemeContext";

const PANEL1_HEIGHT = 72; // (h-16 + p-2 + space-y-2)
const PANEL2_HEIGHT = 56; // (h-12 + p-0 + space-y-2)
const BASE_PADDING = 32; // p-4 (32px)

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [panel1Visible, setPanel1Visible] = useState(true);
  const [panel2Visible, setPanel2Visible] = useState(true);

  const calculatePadding = () => {
    let pt = BASE_PADDING;
    if (panel1Visible) pt += PANEL1_HEIGHT;
    if (panel2Visible) pt += PANEL2_HEIGHT;
    return pt;
  };

  const router = useRouter();
  // const { clearAuthData } = useAuth();

  const handleLogout = () => {
    // Очищаем токен и данные пользователя
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    Cookies.remove('authToken');
    // clearAuthData();
    
    // Перенаправляем на страницу входа
    router.push('/login');
  };

  return (
    // <ThemeProvider>
      <div className="min-h-screen bg-gray-50">
        {/* ===== Шапка (Header) ===== */}
        <AppHeader
          panel1Visible={panel1Visible}
          setPanel1Visible={setPanel1Visible}
          setPanel2Visible={setPanel2Visible}
          panel2Visible={panel2Visible}
        />

        {/* ===== Основной контент страницы ===== */}
        <main 
          className="container mx-auto p-4 transition-all duration-300"
          style={{ paddingTop: `${calculatePadding()}px` }}>
          {children} 
        </main>
        
        {/* ===== (Опционально) Боковая панель (Sidebar) ===== */}
        {/* Можно добавить <aside>...</aside> и использовать flex/grid 
          для компоновки Sidebar + Main 
        */}
      </div>
    // </ThemeProvider>
  );
}