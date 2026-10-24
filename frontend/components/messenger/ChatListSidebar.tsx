// /components/messenger/ChatListSidebar.tsx
import React, { useEffect, useState, useRef } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import { ChatPreview, Conversation, Group, User } from '@/types/messenger';
import { Search, Settings, Users, Circle } from 'lucide-react';

interface ChatListSidebarProps {
  currentUser: User | null;
  selectedChatId: number | null;
  selectedChatType: 'dm' | 'group' | null;
  onSelectChat: (id: number, type: 'dm' | 'group') => void;
}

export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
  currentUser,
  selectedChatId,
  selectedChatType,
  onSelectChat,
}) => {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // ref, чтобы WS-слушатель всегда видел актуальный список без переподключения
  const chatsRef = useRef<ChatPreview[]>([]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);

    console.log('🔍 Current User:', currentUser);

    try {
      const [resConvs, resGroups] = await Promise.all([
        axiosMessenger.get<Conversation[]>('/conversations'),
        axiosMessenger.get<Group[]>('/groups')
      ]);

      console.log('📥 Conversations from API:', resConvs.data);
      console.log('📥 Groups from API:', resGroups.data);

      // Преобразуем ЛС
      const dmChats: ChatPreview[] = resConvs.data.map((c) => {
        // const partner = c.participants.find((p) => Number(p.id) !== Number(currentUser.id));
        // const name = partner?.username || 'Неизвестный';

        console.log('🔄 Processing conversation:', c.id, 'Participants:', c.participants);
        
        const partner = c.participants?.find((p) => Number(p.id) !== Number(currentUser.id));
        
        console.log('👤 Partner found:', partner);
        
        const name = partner?.username || partner?.email?.split('@')[0] || `User_${partner?.id}` || 'Неизвестный';
        
        console.log('📝 Final name:', name);

        return {
          id: c.id,
          type: 'dm',
          title: name,
          avatarUrl: partner?.avatar_url || '',
          lastMessage: c.last_message_content,
          lastMessageDate: c.last_message_at,
          unreadCount: c.unread_count || 0,
          originalData: c
        };
      });

      // Преобразуем Группы
      const groupChats: ChatPreview[] = resGroups.data.map((g) => ({
        id: g.id,
        type: 'group',
        title: g.name,
        avatarUrl: g.avatar_url,
        lastMessage: g.last_message_content,
        lastMessageDate: g.last_message_at,
        unreadCount: g.unread_count || 0,
        originalData: g
      }));

      const allChats = [...dmChats, ...groupChats].sort((a, b) => {
        const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
        const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
        return dateB - dateA;
      });

      console.log('✅ Final dmChats:', dmChats);

      setChats(allChats);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // ═══ НОВОЕ: мгновенно гасим бейдж непрочитанных у выбранного чата ═══
  // (page.tsx при открытии чата помечает сообщения прочитанными на бэкенде)
  useEffect(() => {
    if (!selectedChatId || !selectedChatType) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId && c.type === selectedChatType && c.unreadCount !== 0
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
  }, [selectedChatId, selectedChatType]);



  // ═══ НОВОЕ: пользователь покинул группу или был удалён → перезагрузка списка ═══
  const onGroupLeft = () => { fetchData(); };

  // ═══ LIVE-ОБНОВЛЕНИЕ СПИСКА ЧАТОВ ═══
  useEffect(() => {
    const sortChats = (list: ChatPreview[]) =>
      [...list].sort((a, b) => {
        const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
        const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
        return dateB - dateA;
      });

    // Новое сообщение → обновляем превью, дату, unread и поднимаем чат наверх
    const onNewMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (!msg) return;

      const type: 'dm' | 'group' = msg.conversation_id ? 'dm' : 'group';
      const id = Number(msg.conversation_id || msg.group_id);
      if (!id) return;

      // Чата ещё нет в списке (новый DM / добавили в группу) → полная перезагрузка
      const exists = chatsRef.current.some((c) => c.type === type && c.id === id);
      if (!exists) {
        fetchData();
        return;
      }

      const isSelected = selectedChatId === id && selectedChatType === type;
      const isMine = currentUser && Number(msg.sender_id) === Number(currentUser.id);
      const preview = msg.attachment_url ? '📎 Вложение' : (msg.content || '');

      setChats((prev) =>
        sortChats(
          prev.map((c) =>
            c.type === type && c.id === id
              ? {
                  ...c,
                  lastMessage: isMine ? `Вы: ${preview}` : preview,
                  lastMessageDate: msg.created_at || new Date().toISOString(),
                  unreadCount: isSelected || isMine ? 0 : (c.unreadCount || 0) + 1,
                }
              : c
          )
        )
      );
    };

    // Добавили в группу / переименовали группу / изменили аватар → перезагрузка
    const onGroupUpdated = () => { fetchData(); };

    // Переименовали контакт → обновляем заголовок DM-чата
    const onContactUpdated = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (!d.user_id || !d.display_name) return;
      setChats((prev) =>
        prev.map((c) => {
          if (c.type !== 'dm') return c;
          const conv = c.originalData as Conversation;
          const partner = conv?.participants?.find((p) => Number(p.id) === Number(d.user_id));
          return partner ? { ...c, title: d.display_name } : c;
        })
      );
    };

  // ═══ НОВОЕ: пользователь реально увидел сообщения (трекер в ChatArea) ═══
  const onChatRead = (e: Event) => {
    const d = (e as CustomEvent).detail || {};
    const id = Number(d.chat_id);
    const type = d.chat_type;
    if (!id) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === id && c.type === type && c.unreadCount !== 0
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
  };

    window.addEventListener('ws-new-message', onNewMessage);
    window.addEventListener('group-updated', onGroupUpdated);
    window.addEventListener('group-left', onGroupLeft);
    window.addEventListener('contact-updated', onContactUpdated);
    window.addEventListener('chat-read', onChatRead);
    return () => {
      window.removeEventListener('ws-new-message', onNewMessage);
      window.removeEventListener('group-updated', onGroupUpdated);
      window.removeEventListener('group-left', onGroupLeft);
      window.removeEventListener('contact-updated', onContactUpdated);
      window.removeEventListener('chat-read', onChatRead);
    };
  }, [selectedChatId, selectedChatType, currentUser]);

  // Фильтрация
  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Форматирование времени
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  useEffect(() => {
  console.log('=== CHAT LIST DEBUG ===');
  console.log('Current User:', currentUser);
  console.log('Chats:', chats);
  chats.forEach((chat, idx) => {
    console.log(`Chat ${idx}:`, {
      id: chat.id,
      type: chat.type,
      title: chat.title,
      originalData: chat.originalData
    });
  });
}, [chats, currentUser]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Поиск */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 transition-all"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        </div>
      </div>
      
      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="text-center p-8 text-gray-500">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-2 text-sm">Загрузка...</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p className="text-sm">
              {searchTerm ? 'Ничего не найдено' : 'Нет чатов'}
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = selectedChatId === chat.id && selectedChatType === chat.type;
            const isGroup = chat.type === 'group';
            
            return (
              <div
                key={`${chat.type}-${chat.id}`}
                onClick={() => onSelectChat(chat.id, chat.type)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors relative
                  ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
              >
                {/* Аватар */}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold overflow-hidden shadow-sm ${
                    isGroup 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    {chat.avatarUrl ? (
                      <img 
                        src={chat.avatarUrl} 
                        alt={chat.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : isGroup ? (
                      <Users size={20} />
                    ) : (
                      <span className="text-lg">{chat.title[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  
                  {/* Индикатор онлайн (только для ЛС) */}
                  {!isGroup && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                  )}
                </div>

                {/* Информация о чате */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isGroup && (
                        <Users size={12} className="text-purple-500 flex-shrink-0" />
                      )}
                      <h4 className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">
                        {chat.title}
                      </h4>
                    </div>
                    
                    {chat.lastMessageDate && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                        {formatTime(chat.lastMessageDate)}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
                      {chat.lastMessage || (
                        <span className="italic opacity-70">Нет сообщений</span>
                      )}
                    </p>

                    {chat.unreadCount > 0 && (
                      <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0 shadow-sm">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Профиль пользователя */}
      <div className="p-3 bg-gray-50 dark:bg-gray-950 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors flex-1 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden flex-shrink-0">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.username || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-50 dark:border-gray-950"></div>
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
              {currentUser?.username || 'Пользователь'}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Circle size={6} className="fill-green-500 text-green-500" />
              В сети
            </span>
          </div>
        </div>
        
        <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0">
          <Settings size={18} className="text-gray-500 hover:text-black dark:hover:text-white" />
        </button>
      </div>
    </div>
  );
};