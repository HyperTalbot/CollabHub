// /frontend/app/(app)/messenger/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { Search, Send, Hash, MessageCircleMore, UserCircle, Settings, Plus } from 'lucide-react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { useChatWebSocket, Message } from '@/hooks/useChatWebSocket';
import { useWebSocket } from '@/context/WebSocketContext'; 

const MESSENGER_API_URL = 'http://localhost:8082/api/v1';

// --- Интерфейсы ---
interface User {
  id: number;
  username: string;
}

interface Conversation {
  id: number;
  updated_at: string;
  participants: User[];
  // Новые поля для UI
  last_message_content?: string;
  last_message_at?: string;
  unread_count: number; 
}

// Заглушка серверов
const Servers = [
  { id: 'home', name: 'Личные', icon: <MessageCircleMore size={24} /> },
  { id: 'server1', name: 'Postogram Dev', icon: 'PD' },
  { id: 'server2', name: 'Friends', icon: 'FR' },
  { id: 'server3', name: 'Gaming', icon: 'GA' },
];

export default function MisablePage() {
  const { user: currentUser, isLoggedIn } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageContent, setMessageContent] = useState('');
  
  // Сообщения только для ОТКРЫТОГО чата
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
  const [storedLastReadId, setStoredLastReadId] = useState<number>(0);

  const { lastJsonMessage, sendMessage } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Загрузка списка чатов
  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    const fetchConversations = async () => {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`${MESSENGER_API_URL}/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Инициализируем unread_count нулями, если бэкенд их не прислал
        const loadedConvs = res.data.map((c: any) => ({
            ...c,
            unread_count: c.unread_count || 0
        }));
        setConversations(loadedConvs || []);
      } catch (err) {
        console.error("Failed to fetch chats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [isLoggedIn]);

  // 2. Загрузка ИСТОРИИ при выборе чата + ПОМЕТКА ПРОЧИТАННЫМ
  useEffect(() => {
    if (!selectedChatId) return;

    // Сбрасываем счетчик непрочитанных для этого чата
    setConversations(prev => prev.map(c => 
        c.id === selectedChatId ? { ...c, unread_count: 0 } : c
    ));

    const fetchData = async () => {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      if (!token) return;

      try {
        // А. Загружаем историю (как было) и курсор 
        const res = await axios.get(`${MESSENGER_API_URL}/conversations/${selectedChatId}/messages`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        setActiveChatMessages(res.data.messages || []);
        setStoredLastReadId(res.data.last_read_messages_id || 0); // Запоминаем курсор

        // Б. НОВОЕ: Отправляем запрос "Прочитано" на бэкенд (это обновит курсор в БД на будущее,
        // но на UI сейчас влияет storedLastReadId
        await axios.post(`${MESSENGER_API_URL}/conversations/${selectedChatId}/read`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

      } catch (err) {
        console.error("Failed to fetch history: ", err);
      }
    };

    fetchData();
  }, [selectedChatId]);

  // 3. ОБРАБОТКА ВХОДЯЩЕГО СООБЩЕНИЯ (Real-time)
  useEffect(() => {
    if (lastJsonMessage !== null) {
        const msg = lastJsonMessage;

        // А. Обновляем открытый чат
        if (selectedChatId === msg.conversation_id) {
            // Проверка на дубликаты (важно, так как эффект может срабатывать чаще)
            setActiveChatMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        }

        // Б. Обновляем список чатов
        setConversations(prevConvs => {
            const convIndex = prevConvs.findIndex(c => c.id === msg.conversation_id);
            if (convIndex === -1) return prevConvs;

            const updatedConv = { ...prevConvs[convIndex] };
            updatedConv.last_message_content = msg.content;
            updatedConv.last_message_at = msg.created_at;

            // Если чат НЕ открыт -> увеличиваем счетчик
            if (selectedChatId !== msg.conversation_id) {
                updatedConv.unread_count = (updatedConv.unread_count || 0) + 1;
            }

            const newConvs = [...prevConvs];
            newConvs.splice(convIndex, 1);
            return [updatedConv, ...newConvs];
        });
    }
  }, [lastJsonMessage, selectedChatId, currentUser?.id]);


  // 4. Авто-скролл
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [selectedChatId]); // Сбрасывает при смене чата (резкий прыжок)

  useEffect(() => {
    // Использует 'smooth' только когда приходит новое сообщение в уже открытый чат
    if (selectedChatId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [activeChatMessages]);

  // 5. Отправка
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedChatId) return;
    
    sendMessage(selectedChatId, messageContent);
    setMessageContent('');
  };

  const getPartner = (conv: Conversation) => {
     if (!conv || !conv.participants) return null;
     return conv.participants.find(p => p.id !== currentUser?.id) || conv.participants[0];
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-white rounded-2xl shadow-xl dark:bg-gray-800 text-center mt-4">
        <p className="text-xl text-gray-600 dark:text-gray-300">Войдите, чтобы пользоваться чатом.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-2xl shadow-xl overflow-hidden dark:bg-gray-900 mt-4 border border-gray-200 dark:border-gray-800">
      
      {/* 1. СЕРВЕРА */}
      <div className="w-18 bg-gray-100 dark:bg-gray-950 flex flex-col items-center py-4 space-y-3 border-r border-gray-200 dark:border-gray-800">
        {Servers.map(server => (
          <div 
            key={server.id}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all cursor-pointer text-gray-700 dark:text-gray-200 shadow-sm text-lg font-bold group relative"
            title={server.name}
          >
            {typeof server.icon === 'string' ? server.icon : server.icon}
          </div>
        ))}
        <div className="w-10 h-0.5 bg-gray-300 dark:bg-gray-700 rounded-full my-2"></div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-green-500 hover:text-white transition-all cursor-pointer text-green-500 shadow-sm">
          <Plus size={24} />
        </div>
      </div>

      {/* 2. СПИСОК ЧАТОВ */}
      <div className="w-72 bg-gray-50 dark:bg-gray-900 flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <h2 className="text-black dark:text-white text-lg font-bold">Личные сообщения</h2>
        </div>
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <input type="text" placeholder="Найти..." className="w-full pl-9 pr-3 py-1.5 rounded bg-gray-200 dark:bg-gray-950 text-black dark:text-white text-sm focus:outline-none" />
            <Search className="absolute left-2.5 top-2 text-gray-500" size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Нет чатов</div>
          ) : (
            conversations.map(conv => {
              const partner = getPartner(conv);
              const isSelected = selectedChatId === conv.id;
              return (
                <div 
                  key={conv.id}
                  onClick={() => setSelectedChatId(conv.id)}
                  className={`flex items-center p-2.5 rounded-md cursor-pointer transition-all ${isSelected ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {partner?.username?.[0]?.toUpperCase() || <UserCircle size={20} />}
                  </div>
                  <div className="ml-3 flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h4 className={`font-medium truncate text-sm ${isSelected ? 'text-black dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {partner?.username || `User ${partner?.id}`}
                      </h4>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {new Date(conv.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                            {conv.last_message_content || "Нет сообщений"}
                        </p>
                        {/* СЧЕТЧИК НЕПРОЧИТАННЫХ */}
                        {conv.unread_count > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm">
                              {conv.unread_count}
                            </span>
                        )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="p-2 bg-gray-100 dark:bg-gray-950 flex items-center justify-between">
            <div className="flex items-center space-x-2 p-1 rounded cursor-pointer">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
                    {currentUser?.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-black dark:text-white">{currentUser?.username}</span>
                    <span className="text-[10px] text-gray-500">#{currentUser?.id}</span>
                </div>
            </div>
            <Settings size={18} className="text-gray-500 hover:text-black dark:hover:text-white cursor-pointer mr-2" />
        </div>
      </div>
      
      {/* 3. ОКНО ЧАТА */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-700">
        {selectedChatId ? (
          <>
            <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-700 shadow-sm z-10">
              <div className="flex items-center">
                  <Hash size={24} className="text-gray-400 mr-3" />
                  <div>
                    <h3 className="font-bold text-black dark:text-white text-md">
                        {getPartner(conversations.find(c => c.id === selectedChatId)!)?.username}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">В сети</span>
                  </div>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-white dark:bg-gray-700">
              {activeChatMessages.map((msg, index) => {
                const isMe = msg.sender_id === currentUser?.id;
                
                // --- ЛОГИКА РАЗДЕЛИТЕЛЯ ---
                // Показываем разделитель, если:
                // 1. ID сообщения больше, чем сохраненный курсор прочтения.
                // 2. Это сообщение не от меня (опционально, но логично: свои новые сообщения мы и так видели).
                // 3. Предыдущее сообщение имеет ID <= курсора (или это первое сообщение в списке).
                
                const isNew = msg.id > storedLastReadId && !isMe;
                const prevMsg = index > 0 ? activeChatMessages[index - 1] : null;
                const isFirstNew = isNew && (!prevMsg || prevMsg.id <= storedLastReadId);

                return (
                  <React.Fragment key={msg.id}>
                    
                    {/* РАЗДЕЛИТЕЛЬ */}
                    {isFirstNew && (
                      <div className="flex items-center my-4">
                        <div className="flex-grow h-px bg-red-500/50"></div>
                        <span className="flex-shrink-0 mx-4 text-xs font-bold text-red-500 uppercase">
                          Новые сообщения
                        </span>
                        <div className="flex-grow h-px bg-red-500/50"></div>
                      </div>
                    )}

                    {/* САМО СООБЩЕНИЕ (Код остался прежним) */}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                          <div 
                          className={`px-4 py-2 rounded-2xl shadow-sm text-sm break-words
                              ${isMe 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-gray-100 dark:bg-gray-800 text-black dark:text-gray-100 rounded-bl-none'
                              }`}
                          >
                          {msg.content}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 mx-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white dark:bg-gray-700">
              <form className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg" onSubmit={handleSendMessage}>
                <div className="p-2 text-gray-400 cursor-pointer"><Plus size={20} /></div>
                <input 
                  type="text" 
                  placeholder="Написать сообщение..." 
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="flex-1 bg-transparent text-black dark:text-white placeholder-gray-500 focus:outline-none text-sm"
                />
                <button type="submit" disabled={!messageContent.trim()} className={`p-2 rounded ${messageContent.trim() ? 'text-blue-500' : 'text-gray-400'}`}>
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-500">
            <MessageCircleMore size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">Выберите чат</h3>
          </div>
        )}
      </div>
    </div>
  );
}