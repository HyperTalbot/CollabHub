// /frontend/context/WebSocketContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: string;
}

interface WebSocketContextType {
  sendMessage: (conversationId: number, content: string) => void;
  lastJsonMessage: Message | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, user } = useAuth();
  
  const [lastJsonMessage, setLastJsonMessage] = useState<Message | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  
  // 1. Храним user в ref, чтобы onmessage всегда видел актуальные данные
  const userRef = useRef(user);
  
  // Обновляем ref при изменении user
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const connect = useCallback(() => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
    // Не подключаемся, если нет токена
    if (!token) return;
    
    // Не подключаемся, если уже есть активное или устанавливающееся соединение
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
        return;
    }

    const wsUrl = `ws://localhost:8082/ws?token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ Global WS Connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        setLastJsonMessage(msg);

        // 2. Читаем пользователя из REF (всегда свежий)
        const currentUser = userRef.current;

        // --- ГЛОБАЛЬНЫЕ УВЕДОМЛЕНИЯ ---
        // Показываем, только если у нас есть данные юзера и отправитель - не мы
        if (currentUser && msg.sender_id !== currentUser.id) {
            
            // setTimeout выносит вызов из цикла рендеринга, предотвращая ошибки React
            setTimeout(() => {
                toast.custom((t) => (
                    <div 
                        className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer border-l-4 border-blue-500`}
                        onClick={() => {
                            toast.dismiss(t.id);
                            // Используем window.location для надежного перехода, или router.push если доступен
                            window.location.href = '/messenger'; 
                        }}
                    >
                      <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 pt-0.5">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                               {msg.sender_username?.[0]?.toUpperCase() || "?"}
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {msg.sender_username}
                            </p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300 line-clamp-2">
															{msg.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                ), { duration: 4000, position: 'top-right' });
            }, 0);
        }

      } catch (e) {
        console.error("WS Parse error", e);
      }
    };

    socket.onclose = (e) => {
      console.log('⚠️ Global WS Disconnected', e.code);
      setIsConnected(false);
      socketRef.current = null;
      
      // Можно добавить авто-реконнект, если токен есть
      // if (token) setTimeout(connect, 3000); 
    };

    socketRef.current = socket;
  }, []); // Зависимости пусты, так как мы используем Refs

  // Отправка сообщения
  const sendMessage = useCallback((conversationId: number, content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const payload = { conversation_id: conversationId, content };
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // Пытаемся переподключиться, если соединение упало
      console.warn("WS not open, trying to reconnect...");
      connect(); 
      toast.error("Соединение восстанавливается... Повторите попытку.");
    }
  }, [connect]);

  // Инициализация
  useEffect(() => {
    if (isLoggedIn) {
        connect();
    } else {
        socketRef.current?.close();
    }
    // При размонтировании провайдера (закрытии вкладки/приложения)
    return () => {
       // В dev-режиме лучше не закрывать, чтобы не дергать сокет, но в проде можно:
       // if (socketRef.current) socketRef.current.close();
    };
  }, [isLoggedIn, connect]);

  return (
    <WebSocketContext.Provider value={{ sendMessage, lastJsonMessage, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};