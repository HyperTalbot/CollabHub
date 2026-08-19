// /frontend/hooks/useChatWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: string;
}

export const useChatWebSocket = () => {
  const socketRef = useRef<WebSocket | null>(null);
  // Мы отдаем последнее пришедшее сообщение, а не весь массив.
  // Массив будет копить сама страница MessengerPage.
  const [lastJsonMessage, setLastJsonMessage] = useState<Message | null>(null);

  const connect = useCallback(() => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
    if (!token) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `ws://localhost:8086/ws?token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WS Connected');
    };

    socket.onmessage = (event) => {
      try {
        const newMessage: Message = JSON.parse(event.data);
        setLastJsonMessage(newMessage); // Обновляем состояние последнего сообщения
      } catch (e) {
        console.error("WS Parse error:", e);
      }
    };

    socket.onclose = () => {
      console.log('⚠️ WS Disconnected');
      socketRef.current = null;
    };

    socketRef.current = socket;
  }, []);

  const sendMessage = (conversationId: number, content: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        conversation_id: conversationId,
        content: content
      };
      socketRef.current.send(JSON.stringify(payload));
    } else {
      toast.error("Нет соединения. Переподключение...");
      connect();
    }
  };

  useEffect(() => {
    connect();
    return () => {
      // Не закрываем сокет при размонтировании в dev-режиме, 
      // чтобы избежать "мигания" соединения, но в проде это стоит раскомментировать.
      // if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  return { lastJsonMessage, sendMessage };
};