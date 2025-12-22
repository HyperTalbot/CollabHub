// /frontend/app/layout.tsx (в корне)

import { AuthProvider } from '@/context/AuthContext'; // <-- Создайте алиас или используйте полный путь
import './globals.css'; // Ваш файл стилей Tailwind
import { ThemeProvider } from '@/context/ThemeContext';
// import { Toaster } from "react-hot-toast";
// import { WebSocketProvider } from "@/context/WebSocketContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
      </head>
      <body>
        <ThemeProvider>
          {/* Обертываем все приложение в AuthProvider */}
          <AuthProvider> 
            {/* <WebSocketProvider> */}
              {children}
              {/* <Toaster 
                position='top-center'
                reverseOrder={false}
                toastOptions={{ style: {
                  borderRadius: '12px',
                  background: '#333',
                  color: '#fff',
                }}}
              />
            </WebSocketProvider> */}
          </AuthProvider>
        </ThemeProvider> 
      </body>
    </html>
  );
}