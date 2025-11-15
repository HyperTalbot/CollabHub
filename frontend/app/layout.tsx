// /frontend/app/layout.tsx (в корне)

import { AuthProvider } from '@/context/AuthContext'; // <-- Создайте алиас или используйте полный путь
import './globals.css'; // Ваш файл стилей Tailwind

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        {/* Обертываем все приложение в AuthProvider */}
        <AuthProvider> 
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}