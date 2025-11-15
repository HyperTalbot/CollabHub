// // /frontend/context/ThemeContext.tsx
// "use client";

// import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// type Theme = 'light' | 'dark';

// interface ThemeContextType {
//   theme: Theme;
//   toggleTheme: () => void;
//   setTheme: (theme: Theme) => void;
// }

// const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// export function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const [theme, setThemeState] = useState<Theme>('light');

//   // Устанавливает класс на <html> и сохраняет в localStorage
//   const applyTheme = useCallback((newTheme: Theme) => {
//     localStorage.setItem('theme', newTheme);
//     document.documentElement.classList.remove('light', 'dark');
//     document.documentElement.classList.add(newTheme);
//     setThemeState(newTheme);
//   }, []);

//   // Инициализация темы при первой загрузке
//   useEffect(() => {
//     const savedTheme = localStorage.getItem('theme') as Theme | null;
//     if (savedTheme) {
//       applyTheme(savedTheme);
//     } else {
//       // Использование системных настроек по умолчанию
//       const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
//       applyTheme(prefersDark ? 'dark' : 'light');
//     }
//   }, [applyTheme]);

//   // Функция для переключения
//   const toggleTheme = () => {
//     const newTheme = theme === 'light' ? 'dark' : 'light';
//     applyTheme(newTheme);
//   };
  
//   // Функция для установки (если нужно)
//   const setTheme = (newTheme: Theme) => applyTheme(newTheme);

//   return (
//     <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
//       {children}
//     </ThemeContext.Provider>
//   );
// }

// export function useTheme() {
//   const context = useContext(ThemeContext);
//   if (context === undefined) {
//     throw new Error('useTheme must be used within a ThemeProvider');
//   }
//   return context;
// }