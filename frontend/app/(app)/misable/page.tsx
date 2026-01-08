// /frontend/app/(app)/misable/page.tsx
// "use client";

// import React, { useState, useEffect } from 'react';
// import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
// import { Users, Map } from 'lucide-react';
// import Cookies from 'js-cookie';
// import axios from '@/lib/axiosInstance';
// import { useAuth } from '@/context/AuthContext';
// import { useWebSocket } from '@/context/WebSocketContext';
// import { CreateModal } from '@/components/messenger/CreateModal';

// // Импорт компонентов
// import { NavigationRail } from '@/components/messenger/NavigationRail';
// import { ChatListSidebar } from '@/components/messenger/ChatListSidebar';
// import { ChatArea } from '@/components/messenger/ChatArea';
// import { ServerPage } from '@/components/messenger/ServerPage';

// // Типы
// import { Conversation, Message, Server, ViewMode } from '@/types/messenger';

// const MESSENGER_API_URL = 'http://localhost:8086/api/v1';
// const MAX_MESSAGE_LENGTH = 4096;

// export default function MessengerPage() {
//   const { user: currentUser, isLoggedIn } = useAuth();
//   const { lastJsonMessage, sendMessage } = useWebSocket();

//   // --- GLOBAL UI STATE ---
//   const [activeView, setActiveView] = useState<ViewMode>('dm');
//   const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
//   const [isSidebarVisible, setIsSidebarVisible] = useState(true);

//   // --- DATA STATE ---
//   const [serverList, setServerList] = useState<Server[]>([]);
//   const [conversations, setConversations] = useState<Conversation[]>([]);

//   // DM STATE
//   const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
//   const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
//   const [storedLastReadId, setStoredLastReadId] = useState<number>(0);

//   // MODALS
//   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
//   const [loading, setLoading] = useState(true);

//   const [hasMore, setHasMore] = useState(true);
//   const [isFetchingMore, setIsFetchingMore] = useState(false);

//   const fetchConversations = async () => { /* ... код загрузки ... */ }

//   // 1. Загрузка Данных
//   const refreshData = async () => {
//       const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//       if (!token) return;
//       try {
//           const [serversRes, chatsRes] = await Promise.all([
//               axios.get(`${MESSENGER_API_URL}/servers`, {
//                   headers: { 'Authorization': `Bearer ${token}` }
//               }),
//               axios.get(`${MESSENGER_API_URL}/conversations`, {
//                   headers: { 'Authorization': `Bearer ${token}` }
//               })
//           ]);

//           setServerList(serversRes.data || []);
//           const loadedConvs = (chatsRes.data || []).map((c: any) => ({
//               ...c,
//               unread_count: c.unread_count || 0
//           }));
//           setConversations(loadedConvs);
//       } catch (e) {
//           console.error("Data load error", e);
//       } finally {
//           setLoading(false);
//       }
//   };

//   useEffect(() => {
//       if (isLoggedIn) refreshData();
//   }, [isLoggedIn]);

//   // 2. Логика Переключения
//   const handleNavigate = (view: ViewMode, id?: number) => {
//       setActiveView(view);
//       if (view === 'server' && id) {
//           setSelectedServerId(id);
//       } else {
//           setSelectedServerId(null);
//       }
//       setIsSidebarVisible(true);
//   };

//   // 3. Загрузка Истории Чата
//   useEffect(() => {
//       if (!selectedChatId) return;
//       setActiveChatMessages([]);
//       setConversations(prev => prev.map(c => c.id === selectedChatId ? { ...c, unread_count: 0 } : c));

//       const fetchHistory = async () => {
//           const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//           try {
//               const res = await axios.get(`${MESSENGER_API_URL}/conversations/${selectedChatId}/messages`, {
//                   headers: { 'Authorization': `Bearer ${token}` }
//               });

//             // Вместо простого присваивания, убедимся что массив чистый, хотя при первой загрузке дублей быть не должно.
//             // Но если приходят дубли с сокета во время загрузки, это поможет.
//             // const uniqueMessages = Array.from(new Map(
//             //     (res.data.messages || []).map((m: Message) => [m.id, m])
//             // ).values());
            
//             // setActiveChatMessages(uniqueMessages); 
//               setActiveChatMessages(res.data.messages);
//               setStoredLastReadId(Number(res.data.last_read_message_id) || 0);
              
//               await axios.post(`${MESSENGER_API_URL}/conversations/${selectedChatId}/read`, {}, {
//                   headers: { 'Authorization': `Bearer ${token}` }
//               });
//           } catch (e) { console.error(e); }
//       };
//       fetchHistory();
//   }, [selectedChatId]);

//   // 4. WebSocket Updates
//   useEffect(() => {
//       if (lastJsonMessage) {
//           const msg = lastJsonMessage;
//           if (selectedChatId === msg.conversation_id) {
//               setActiveChatMessages(prev => {
//                   if (prev.some(m => m.id === msg.id)) return prev;
//                   return [...prev, msg];
//               });
//               const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//               axios.post(`${MESSENGER_API_URL}/conversations/${selectedChatId}/read`, {}, {
//                   headers: { 'Authorization': `Bearer ${token}` }
//               }).catch(console.error);
//           }
          
//           // Обновляем список чатов
//           setConversations(prev => {
//               const idx = prev.findIndex((c: Conversation) => c.id === msg.conversation_id);
//               if (idx === -1) return prev;
              
//               const updated = { 
//                   ...prev[idx], 
//                   last_message_content: msg.content, 
//                   last_message_at: msg.created_at 
//               };
              
//               // Увеличиваем счетчик непрочитанных только если чат не открыт
//               if (selectedChatId !== msg.conversation_id) {
//                   updated.unread_count = (updated.unread_count || 0) + 1;
//               }
              
//               // Удаляем из текущей позиции
//               const newArr = [...prev];
//               newArr.splice(idx, 1);
              
//               // Вставляем в начало (самый новый чат)
//               return [updated, ...newArr];
//           });
//       }
//   }, [lastJsonMessage, selectedChatId]);

//   // 5. Отправка
//   const handleSendMessage = async (text: string, replyToId?: number) => {
//       if (!selectedChatId) return;
//       const chunks = [];
//       for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) chunks.push(text.substring(i, i + MAX_MESSAGE_LENGTH));
//       for (const chunk of chunks) {
//           // TODO: Передать replyToId в sendMessage если бэкенд поддерживает
//           sendMessage(selectedChatId, chunk);
//           await new Promise(r => setTimeout(r, 50));
//       }
//   };

//   // Подгрузка истории
//   const handleLoadMore = async () => {
//       if (!selectedChatId || !hasMore || isFetchingMore || activeChatMessages.length === 0) return;
//       setIsFetchingMore(true);
//       const oldestMessageId = activeChatMessages[0].id;
//       const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//       try {
//           const res = await axios.get(`${MESSENGER_API_URL}/conversations/${selectedChatId}/messages?before_id=${oldestMessageId}`, {
//               headers: { 'Authorization': `Bearer ${token}` }
//           });
//           const older = res.data.messages || [];
//           if (older.length < 50) setHasMore(false);
//           if (older.length > 0) {
//               setActiveChatMessages(prev => [...older, ...prev]);
//           }
//       } catch (e) {
//           console.error(e);
//       } finally {
//           setIsFetchingMore(false);
//       }
//   };

//   if (!isLoggedIn) {
//       return <div className="flex h-[calc(100vh-80px)] items-center justify-center dark:bg-gray-900 text-gray-500">Пожалуйста, войдите в систему</div>;
//   }

//   return (
//     <div className="flex h-[calc(100vh-120px)] rounded-2xl shadow-xl overflow-hidden dark:bg-gray-900 mt-4 border border-gray-200 dark:border-gray-800 bg-white">

//       {/* 1. ЛЕВАЯ ПАНЕЛЬ (Servers) */}
//       <NavigationRail
//           servers={serverList}
//           activeView={activeView}
//           selectedServerId={selectedServerId}
//           onNavigate={(view, id) => {
//               if (view === 'friends' || view === 'map') {
//                   setActiveView(view);
//                   setSelectedServerId(null);
//                   setIsSidebarVisible(false);
//               } else {
//                   handleNavigate(view, id);
//               }
//           }}
//           onCreateClick={() => setIsCreateModalOpen(true)}
//       />

//       {/* RESIZABLE GROUP */}
//       <PanelGroup direction="horizontal" autoSaveId="messenger-layout">

//         {/* 2. СРЕДНЯЯ ПАНЕЛЬ (Sidebar) */}
//         {isSidebarVisible && (
//             <>
//                 <Panel
//                     defaultSize={25}
//                     minSize={20}
//                     maxSize={40}
//                     order={1}
//                     id="sidebar-panel"
//                     className="min-w-[250px] bg-gray-50 dark:bg-gray-900"
//                 >
//                     {/* ХАМЕЛЕОН: ЛС или СЕРВЕР */}
//                     {activeView === 'dm' ? (
//                         <ChatListSidebar
//                             conversations={conversations}
//                             currentUser={currentUser}
//                             selectedChatId={selectedChatId}
//                             onSelectChat={setSelectedChatId}
//                             loading={loading}
//                             onClose={() => setIsSidebarVisible(false)}
//                             onRefreshConversations={fetchConversations}
//                         />
//                     ) : activeView === 'server' && selectedServerId ? (
//                         <ServerPage
//                             serverId={selectedServerId}
//                             currentUser={currentUser}
//                             serverName={serverList.find(s => s.id === selectedServerId)?.name || 'Сервер'}
//                             onClose={() => setIsSidebarVisible(false)}
//                         />
//                     ) : null}
//                 </Panel>

//                 <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors cursor-col-resize z-20" />
//             </>
//         )}

//         {/* 3. ПРАВАЯ ПАНЕЛЬ (Чат) */}
//         <Panel minSize={30} order={2} id="chat-panel">
//            {activeView === 'dm' || activeView === 'server' ? (
//                 <ChatArea
//                     activeChat={conversations.find((c: Conversation) => c.id === selectedChatId) || null}
//                     messages={activeChatMessages}
//                     currentUser={currentUser}
//                     storedLastReadId={storedLastReadId}
//                     onSendMessage={handleSendMessage}
//                     isSidebarOpen={isSidebarVisible}
//                     onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
//                     onLoadMore={handleLoadMore}
//                     hasMore={hasMore}
//                     isLoadingMessages={true}
//                 />
//             ) : activeView === 'friends' ? (
//                 <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
//                     <Users size={64} className="text-blue-500 mb-4" />
//                     <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Список друзей</h2>
//                     <p className="text-gray-500 dark:text-gray-400 mt-2">Здесь будут ваши друзья</p>
//                 </div>
//             ) : (
//                 <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
//                     <Map size={64} className="text-green-500 mb-4" />
//                     <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Карта мира</h2>
//                     <p className="text-gray-500 dark:text-gray-400 mt-2">Здесь будет интерактивная карта</p>
//                 </div>
//             )}
//         </Panel>

//       </PanelGroup>

//       <CreateModal
//           isOpen={isCreateModalOpen}
//           onClose={() => setIsCreateModalOpen(false)}
//           onCreated={refreshData}
//       />
//     </div>
//   );
// }



// frontend/app/(app)/misable/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Users, Map, MessageCircleMore } from 'lucide-react';
import Cookies from 'js-cookie';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import { CreateModal } from '@/components/messenger/CreateModal';

import { NavigationRail } from '@/components/messenger/NavigationRail';
import { ChatListSidebar } from '@/components/messenger/ChatListSidebar';
import { ChatArea } from '@/components/messenger/ChatArea';
import { ChatHeader } from '@/components/messenger/ChatHeader';
import { ServerPage } from '@/components/messenger/ServerPage';

import { Conversation, Message, Server, ViewMode, Group, ChatPreview } from '@/types/messenger';

const MESSENGER_API_URL = 'http://localhost:8086/api/v1';
const MAX_MESSAGE_LENGTH = 4096;

export default function MessengerPage() {
  const { user: currentUser, isLoggedIn } = useAuth();
  const { lastJsonMessage, sendMessage } = useWebSocket();

  const [activeView, setActiveView] = useState<ViewMode>('dm');
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [serverList, setServerList] = useState<Server[]>([]);
  const [chatList, setChatList] = useState<ChatPreview[]>([]);

  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [selectedChatType, setSelectedChatType] = useState<'dm' | 'group' | null>(null);
  
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
  const [storedLastReadId, setStoredLastReadId] = useState<number>(0);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const refreshData = async () => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    if (!token) return;
    
    try {
      const [serversRes, chatsRes, groupsRes] = await Promise.allSettled([
        axios.get(`${MESSENGER_API_URL}/servers`),
        axios.get(`${MESSENGER_API_URL}/conversations`),
        axios.get(`${MESSENGER_API_URL}/groups`)
      ]);

      if (serversRes.status === 'fulfilled') {
        setServerList(serversRes.value.data || []);
      }

      let mergedChats: ChatPreview[] = [];

      if (chatsRes.status === 'fulfilled') {
        const dms: Conversation[] = chatsRes.value.data || [];
        mergedChats = mergedChats.concat(dms.map(c => {
          const partner = c.participants?.find(p => p.id !== currentUser?.id);
          return {
            id: c.id,
            type: 'dm',
            title: partner?.username || 'Неизвестный',
            avatarUrl: partner?.avatar_url,
            lastMessage: c.last_message_content,
            lastMessageDate: c.last_message_at,
            unreadCount: c.unread_count || 0,
            originalData: c
          };
        }));
      }

      if (groupsRes.status === 'fulfilled') {
        const groups: Group[] = groupsRes.value.data || [];
        mergedChats = mergedChats.concat(groups.map(g => ({
          id: g.id,
          type: 'group',
          title: g.name,
          avatarUrl: g.avatar_url,
          lastMessage: g.last_message_content,
          lastMessageDate: g.last_message_at,
          unreadCount: g.unread_count || 0,
          originalData: g
        })));
      }

      mergedChats.sort((a, b) => {
        const tA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
        const tB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
        return tB - tA;
      });

      setChatList(mergedChats);
    } catch (e) {
      console.error("Data load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentUser) refreshData();
  }, [isLoggedIn, currentUser]);

  const handleNavigate = (view: ViewMode, id?: number) => {
    setActiveView(view);
    if (view === 'server' && id) {
      setSelectedServerId(id);
    } else {
      setSelectedServerId(null);
    }
    setIsSidebarVisible(true);
  };

  const handleSelectChat = (id: number, type: 'dm' | 'group') => {
    setSelectedChatId(id);
    setSelectedChatType(type);
    setChatList(prev => prev.map(c => 
      (c.id === id && c.type === type) ? { ...c, unreadCount: 0 } : c
    ));
  };

  useEffect(() => {
    if (!selectedChatId || !selectedChatType) return;
    
    setActiveChatMessages([]);
    setHasMore(true);

    const fetchHistory = async () => {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      const endpoint = selectedChatType === 'dm' 
        ? `/conversations/${selectedChatId}/messages`
        : `/groups/${selectedChatId}/messages`;

      try {
        const res = await axios.get(`${MESSENGER_API_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        setActiveChatMessages(res.data.messages || []);
        setStoredLastReadId(Number(res.data.last_read_message_id) || 0);
        
        const readEndpoint = selectedChatType === 'dm'
          ? `/conversations/${selectedChatId}/read`
          : `/groups/${selectedChatId}/read`;
          
        await axios.post(`${MESSENGER_API_URL}${readEndpoint}`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) { 
        console.error(e); 
      }
    };
    
    fetchHistory();
  }, [selectedChatId, selectedChatType]);

  useEffect(() => {
    if (!lastJsonMessage) return;
    
    const msgPayload = (lastJsonMessage as any).payload || lastJsonMessage;

    const msgChatId = msgPayload.conversation_id || msgPayload.group_id;
    const msgType = msgPayload.group_id ? 'group' : 'dm';

    console.log('📨 New message received:', msgPayload);

    // Обновляем сообщения в активном чате
    if (selectedChatId === msgChatId && selectedChatType === msgType) {
      setActiveChatMessages(prev => {
        if (prev.some(m => m.id === msgPayload.id)) return prev;
        return [...prev, msgPayload];
      });
    }

    // ИСПРАВЛЕНО: Обновляем список чатов ВСЕГДА
    setChatList(prev => {
      const idx = prev.findIndex(c => c.id === msgChatId && c.type === msgType);
      
      if (idx === -1) {
        console.log('⚠️ Chat not found in list, refreshing...');
        // Если чат не найден, обновляем весь список
        refreshData();
        return prev;
      }

      const existing = prev[idx];
      const updated: ChatPreview = {
        ...existing,
        lastMessage: msgPayload.content,
        lastMessageDate: msgPayload.created_at,
        unreadCount: (selectedChatId === msgChatId && selectedChatType === msgType)
          ? 0
          : (existing.unreadCount + 1)
      };

      const newArr = [...prev];
      newArr.splice(idx, 1);
      return [updated, ...newArr];
    });
  }, [lastJsonMessage, selectedChatId, selectedChatType]);


  const handleSendMessage = async (text: string, replyToId?: number, files?: File[]) => {
    if (!selectedChatId || !selectedChatType) return;
    
    // Если есть файлы - отправляем через API
    if (files && files.length > 0) {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedChatType === 'dm') formData.append('conversation_id', selectedChatId.toString());
        if (selectedChatType === 'group') formData.append('group_id', selectedChatId.toString());

        try {
          await axios.post(`${MESSENGER_API_URL}/messages/attachment`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (error) {
          console.error('File upload error:', error);
        }
      }
      return;
    }

    // Разбиваем текст на чанки
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
      chunks.push(text.substring(i, i + MAX_MESSAGE_LENGTH));
    }

    for (const chunk of chunks) {
      const payload: any = { content: chunk };
      if (replyToId) payload.reply_to_id = replyToId;
      if (selectedChatType === 'dm') payload.conversation_id = selectedChatId;
      if (selectedChatType === 'group') payload.group_id = selectedChatId;
      
      sendMessage(payload, chunk);
      await new Promise(r => setTimeout(r, 50));
    }
  };

  const handleCreated = async () => {
    await refreshData();
    setTimeout(() => {
      if (chatList.length > 0) {
        const newChat = chatList[0];
        if (newChat.type === 'group') {
          handleSelectChat(newChat.id, 'group');
        }
      }
    }, 300);
  };

  const handleLoadMore = async () => {
    if (!selectedChatId || !hasMore || isFetchingMore || activeChatMessages.length === 0) return;
    setIsFetchingMore(true);
    
    const oldestMessageId = activeChatMessages[0].id;
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    const endpoint = selectedChatType === 'dm' 
      ? `/conversations/${selectedChatId}/messages`
      : `/groups/${selectedChatId}/messages`;

    try {
      const res = await axios.get(`${MESSENGER_API_URL}${endpoint}?before_id=${oldestMessageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const older = res.data.messages || [];
      if (older.length < 50) setHasMore(false);
      if (older.length > 0) {
        setActiveChatMessages(prev => [...older, ...prev]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center dark:bg-gray-900 text-gray-500">
        Пожалуйста, войдите в систему
      </div>
    );
  }

  const currentChatPreview = chatList.find(c => c.id === selectedChatId && c.type === selectedChatType);

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-2xl shadow-xl overflow-hidden dark:bg-gray-900 mt-4 border border-gray-200 dark:border-gray-800 bg-white">
      
      <NavigationRail
        servers={serverList}
        activeView={activeView}
        selectedServerId={selectedServerId}
        onNavigate={(view, id) => {
          if (view === 'friends' || view === 'map') {
            setActiveView(view);
            setSelectedServerId(null);
            setIsSidebarVisible(false);
          } else {
            handleNavigate(view, id);
          }
        }}
        onCreateClick={() => setIsCreateModalOpen(true)}
      />

      <PanelGroup direction="horizontal" autoSaveId="messenger-layout">
        
        {isSidebarVisible && (
          <>
            <Panel
              defaultSize={25}
              minSize={15}
              maxSize={35}
              order={1}
              id="sidebar-panel"
              className="min-w-[280px] bg-gray-50 dark:bg-gray-900"
            >
              {activeView === 'dm' ? (
                <ChatListSidebar
                  currentUser={currentUser}
                  selectedChatId={selectedChatId}
                  selectedChatType={selectedChatType}
                  onSelectChat={handleSelectChat}
                />
              ) : activeView === 'server' && selectedServerId ? (
                <ServerPage
                    serverId={selectedServerId}
                    currentUser={currentUser}
                    serverName={serverList.find(s => s.id === selectedServerId)?.name || 'Сервер'}
                    onClose={() => {
                    setActiveView('dm');
                    setIsSidebarVisible(true);
                    }}
                />
              ) : null}
            </Panel>

            <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors cursor-col-resize z-20" />
          </>
        )}

        <Panel minSize={30} order={2} id="chat-panel">
        <div className="h-full flex flex-col bg-white dark:bg-gray-800">

            {activeView === 'dm' && selectedChatId && selectedChatType && (
            <ChatHeader
                chatId={selectedChatId}
                chatType={selectedChatType}
                currentUser={currentUser}
                cachedChatData={currentChatPreview}
            />
            )}

            {activeView === 'dm' ? (
            selectedChatId && selectedChatType ? (
                <ChatArea
                chatId={selectedChatId}
                chatType={selectedChatType}
                messages={activeChatMessages}
                currentUser={currentUser}
                storedLastReadId={storedLastReadId}
                onSendMessage={handleSendMessage}
                isSidebarOpen={isSidebarVisible}
                onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                isLoadingMessages={isFetchingMore}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative">
                {!isSidebarVisible && (
                    <button
                    onClick={() => setIsSidebarVisible(true)}
                    className="absolute top-4 left-4 p-3 bg-white shadow-md rounded-xl"
                    >
                    <MessageCircleMore size={20} />
                    </button>
                )}
                <div className="text-center text-gray-500">
                    <MessageCircleMore size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Выберите чат для начала общения</p>
                </div>
                </div>
            )
            ) : activeView === 'server' && selectedServerId ? (
            // ИСПРАВЛЕНО: Убрана двойная отрисовка ServerPage
            null // ServerPage уже отрисован в боковой панели
            ) : activeView === 'friends' ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
                <Users size={64} className="text-blue-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Список друзей</h2>
                <p className="text-gray-500 mt-2">Скоро здесь появится список ваших друзей</p>
            </div>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
                <Map size={64} className="text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Карта мира</h2>
                <p className="text-gray-500 mt-2">Интерактивная карта пользователей</p>
            </div>
            )}
        </div>
        </Panel>

      </PanelGroup>

      <CreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}