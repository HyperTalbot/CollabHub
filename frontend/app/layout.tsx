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
        <link
          rel='preload'
          as='image'
          href='https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop'
        />
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