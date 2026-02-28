// context/WebSocketContext.tsx (ПОЛНАЯ ВЕРСИЯ)
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import axios from '@/lib/axiosMessenger';

export interface Message {
  id: number;
  conversation_id?: number;
  group_id?: number;
  sender_id: number;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
}

interface WebSocketContextType {
  sendMessage: (payload: any, content: string) => void;
  lastJsonMessage: Message | null;
  isConnected: boolean;
  incomingCall: any | null;
  voiceSignal: any | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, user } = useAuth();

  const [lastJsonMessage, setLastJsonMessage] = useState<Message | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [voiceSignal, setVoiceSignal] = useState<any>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const connect = useCallback(() => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
    console.log('🔑 Token for WS:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    
    if (!token) {
        console.error('❌ No token found for WebSocket');
        return;
    }
    
    if (socketRef.current?.readyState === WebSocket.OPEN || 
        socketRef.current?.readyState === WebSocket.CONNECTING) {
        console.log('⚠️ WebSocket already connecting/connected');
        return;
    }

    // ИСПРАВЛЕНО: Всегда добавляем токен в URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    
    // Формируем URL с токеном
    let wsUrl: string;
    if (process.env.NEXT_PUBLIC_WS_URL) {
        // Если задан полный URL в env, используем его и добавляем токен
        wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;
    } else {
        // Иначе формируем динамически
        wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}`;
    }

    console.log('🔗 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('✅ Global WS Connected');
        setIsConnected(true);
        toast.success('Подключено к чату', { duration: 2000, position: 'bottom-right' });
    };

    socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };

    socket.onclose = (e) => {
        console.log('⚠️ Global WS Disconnected', {
            code: e.code,
            reason: e.reason || 'No reason provided',
            wasClean: e.wasClean
        });
        
        setIsConnected(false);
        socketRef.current = null;
        
        // Расшифровка кодов закрытия
        if (e.code === 1006) {
            console.error('❌ Abnormal closure - likely authentication or network issue');
            toast.error('Соединение прервано. Переподключение...', { 
                duration: 3000, 
                position: 'bottom-right' 
            });
        } else if (e.code === 1000) {
            console.log('✅ Normal closure');
        } else if (e.code === 1001) {
            console.log('⚠️ Going away');
        }
        
        // Автореконнект через 3 секунды (только если залогинен)
        if (isLoggedIn && e.code !== 1000) {
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect WebSocket...');
                connect();
            }, 3000);
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Обработка разных типов событий
            switch (data.type) {
                case 'new_message':
                    const msg = data.payload;
                    setLastJsonMessage(msg);

                    const currentUser = userRef.current;
                    
                    console.log("WS Notification Check:", { 
                        me: currentUser?.id, 
                        sender: msg.sender_id, 
                        match: Number(msg.sender_id) !== Number(currentUser?.id) 
                    });

                    if (currentUser && Number(msg.sender_id) !== Number(currentUser.id)) {
                        setTimeout(() => {
                            toast.custom((t) => (
                                <div 
                                    className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer border-l-4 border-blue-500`}
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        window.location.href = '/misable'; 
                                    }}
                                >
                                    <div className="flex-1 w-0 p-4">
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 pt-0.5">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                                                    {msg.sender_username?.[0]?.toUpperCase() || "?"}
                                                </div>
                                            </div>
                                            <div className="ml-3 flex-1 overflow-hidden">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {msg.sender_username}
                                                </p>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300 line-clamp-2 break-words">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ), { duration: 4000, position: 'top-right' });
                        }, 0);
                    }
                    break;

                case 'incoming_call':
                    setIncomingCall(data.payload);
                    
                    toast.custom((t) => (
                        <div className="bg-blue-600 text-white p-4 rounded-lg shadow-xl max-w-md">
                            <p className="font-bold text-lg mb-2">📞 Входящий звонок</p>
                            <p className="text-sm mb-3">
                                {data.payload.type === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок'}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            await axios.post(`/calls/${data.payload.call_id}/answer`, {});
                                            
                                            window.dispatchEvent(new CustomEvent('accept-call', {
                                                detail: {
                                                    callId: data.payload.call_id,
                                                    partnerId: data.payload.initiator_id,
                                                    callType: data.payload.type,
                                                    isInitiator: false
                                                }
                                            }));
                                            
                                            toast.dismiss(t.id);
                                        } catch (error) {
                                            console.error('Failed to answer call:', error);
                                            toast.error('Не удалось принять звонок');
                                        }
                                    }}
                                    className="flex-1 bg-green-500 px-4 py-2 rounded hover:bg-green-600 font-semibold">
                                    Принять
                                </button>
                                <button
                                    onClick={async () => {
                                        await axios.post(`/calls/${data.payload.call_id}/decline`);
                                        toast.dismiss(t.id);
                                    }}
                                    className="flex-1 bg-red-500 px-4 py-2 rounded hover:bg-red-600 font-semibold"
                                >
                                    Отклонить
                                </button>
                            </div>
                        </div>
                    ), { duration: 30000, position: 'top-right' });
                    break;

                case 'call_answered':
                    toast.success('Звонок принят');
                    setVoiceSignal(data.payload);
                    break;

                case 'call_declined':
                    toast.error('Звонок отклонён');
                    setIncomingCall(null);
                    
                    window.dispatchEvent(new CustomEvent('close-call-modal', {
                        detail: { reason: 'declined' }
                    }));
                    break;

                case 'call_ended':
                    toast('Звонок завершён');
                    setIncomingCall(null);
                    
                    window.dispatchEvent(new CustomEvent('close-call-modal', {
                        detail: { 
                            reason: 'ended',
                            duration: data.payload.duration 
                        }
                    }));
                    break;

                case 'ice_candidate':
                    setVoiceSignal(data.payload);
                    break;

                case 'voice_signal':
                    setVoiceSignal(data.payload);
                    break;

                case 'user_joined_voice':
                    toast('Пользователь присоединился к голосовому каналу');
                    break;

                case 'user_left_voice':
                    toast('Пользователь покинул голосовой канал');
                    break;

                case 'screen_share_started':
                    toast('Началась демонстрация экрана');
                    break;

                case 'screen_share_stopped':
                    toast('Демонстрация экрана завершена');
                    break;

                default:
                    console.log('Unknown WS event:', data.type);
            }

        } catch (e) {
            console.error("WS Parse error", e);
        }
    };

    socketRef.current = socket;
}, [isLoggedIn]);

  const sendMessage = useCallback((payload: any, content: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn("WS not open, trying to reconnect...");
      connect();
      toast.error("Соединение восстанавливается... Повторите попытку.");
    }
  }, [connect]);

  useEffect(() => {
    if (isLoggedIn) {
      connect();
    } else {
      socketRef.current?.close();
    }

    return () => {
      // В dev-режиме лучше не закрывать
      // if (socketRef.current) socketRef.current.close();
    };
  }, [isLoggedIn, connect]);

  return (
    <WebSocketContext.Provider value={{
      sendMessage,
      lastJsonMessage,
      isConnected,
      incomingCall,
      voiceSignal
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};