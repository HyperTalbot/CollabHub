// /components/messenger/ChatListSidebar.tsx
import React, { useState } from 'react';
import { Search, UserCircle, Settings, ChevronLeft, Users } from 'lucide-react';
import { Conversation, User } from '@/types/messenger';

type FolderType = 'all' | 'personal' | 'groups' | 'unread';
const CHAT_FOLDERS: { id: FolderType; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'personal', label: 'Личные' },
  { id: 'groups', label: 'Группы' },
  { id: 'unread', label: 'Непрочитанные' },
];

interface ChatListSidebarProps {
  conversations: Conversation[];
  currentUser: User | null;
  selectedChatId: number | null;
  onSelectChat: (id: number) => void;
  loading: boolean;
  onClose?: () => void;
}

// ИСПРАВЛЕННЫЙ хелпер даты с проверкой на валидность
const formatChatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Проверка на Invalid Date
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: isCurrentYear ? undefined : 'numeric'
    });
};

// ИСПРАВЛЕННЫЙ хелпер для инфо чата с безопасными проверками
const getChatInfo = (conv: Conversation, currentUserId?: number) => {
    const isGroup = conv.type === 'group';
    const partner = conv.participants?.find(p => p.id !== currentUserId) || conv.participants?.[0];

    // Безопасное получение имени с фолбэками
    const name = isGroup
        ? (conv.name || 'Группа')
        : (partner?.username || 'Пользователь');

    // Безопасное получение первой буквы
    const initials = name?.[0]?.toUpperCase() || '?';

    return {
        isGroup,
        name,
        initials,
        avatarUrl: isGroup ? conv.avatar_url : partner?.avatar_url, // Добавляем аватарку
    };
};

export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
  conversations,
  currentUser,
  selectedChatId,
  onSelectChat,
  loading,
  onClose
}) => {
  const [activeFolder, setActiveFolder] = useState<FolderType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv => {
      const info = getChatInfo(conv, currentUser?.id);

      if (activeFolder === 'unread' && conv.unread_count === 0) return false;
      if (activeFolder === 'groups' && !info.isGroup) return false;
      if (activeFolder === 'personal' && info.isGroup) return false;

      if (searchQuery) {
          return info.name?.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
  });

  // Логика фильтрации внутри ChatListSidebar
  const groups = conversations.filter(c => c.type === 'group');
  const dms = conversations.filter(c => c.type === 'dm' || !c.type);

  // Логика отображения имени (уже добавлена в ChatArea, добавьте в Sidebar):
  const getDisplayName = (conv: Conversation) => {
      if (conv.type === 'group') return conv.name || 'Группа без названия';
      // Для ЛС ищем партнера
      const partner = conv.participants.find(p => p.id !== currentUser?.id);
      return partner?.username || 'Неизвестный';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

      {/* Хедер */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
        <h2 className="text-lg font-bold text-black dark:text-white">Сообщения</h2>
        {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
                <ChevronLeft size={20} />
            </button>
        )}
      </div>

      {/* Папки */}
      <div className="flex items-center px-2 pt-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
        {CHAT_FOLDERS.map(folder => (
          <button
            key={folder.id}
            onClick={() => setActiveFolder(folder.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                ${activeFolder === folder.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {folder.label}
          </button>
        ))}
      </div>

      {/* Поиск */}
      <div className="p-3 bg-white dark:bg-gray-900">
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm focus:outline-none"
          />
          <Search className="absolute left-2.5 top-2 text-gray-500" size={16} />
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-white dark:bg-gray-900">
        {loading ? (
            <div className="text-center p-4 text-gray-400 text-sm">Загрузка...</div>
        ) : filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-gray-500 text-sm">Нет чатов</div>
        ) : (
            filteredConversations.map(conv => {
                const info = getChatInfo(conv, currentUser?.id);
                const isSelected = selectedChatId === conv.id;
                const hasMessage = conv.last_message_content && conv.last_message_content.length > 0;

                return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectChat(conv.id)}
                      className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-all group
                        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        {/* ИСПРАВЛЕНО: Аватар с изображением или инициалами */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm relative overflow-hidden">
                            {info.avatarUrl ? (
                                <img
                                    src={info.avatarUrl}
                                    alt={info.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback если картинка не загрузилась
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <span>{info.initials}</span>
                            )}
                        </div>

                        <div className="ml-3 flex-1 overflow-hidden">
                            <div className="flex justify-between items-center">
                                <h4 className={`font-semibold truncate text-sm flex items-center gap-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {info.isGroup && <Users size={14} className="text-gray-500" />}
                                    {info.name}
                                </h4>
                                {/* ИСПРАВЛЕНО: Безопасный вывод даты */}
                                {conv.last_message_at && (
                                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                                        {formatChatDate(conv.last_message_at)}
                                    </span>
                                )}
                            </div>

                            <div className="flex justify-between items-center mt-0.5">
                                <p className={`text-xs truncate max-w-[140px] ${isSelected ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'} ${hasMessage ? '' : 'italic opacity-70'}`}>
                                  {hasMessage ? (
                                        conv.unread_count > 0 ? (
                                            <span className="font-bold text-black dark:text-white">
                                                {conv.last_message_content}
                                            </span>
                                        ) : (
                                            <span>{conv.last_message_content}</span>
                                        )
                                    ) : (
                                        "Начните общение"
                                    )}
                                </p>

                                {conv.unread_count > 0 && (
                                    <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm">
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

      {/* Профиль (Внизу) */}
      <div className="p-2 bg-gray-50 dark:bg-gray-950 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
         <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer">
            {/* ИСПРАВЛЕНО: Аватар пользователя с фолбэком */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden">
                {currentUser?.avatar_url ? (
                    <img
                        src={currentUser.avatar_url}
                        alt={currentUser.username || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : (
                    <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
                )}
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-black dark:text-white">
                    {currentUser?.username || 'Пользователь'}
                </span>
            </div>
         </div>
         <Settings size={18} className="text-gray-500 hover:text-black dark:hover:text-white cursor-pointer mr-2" />
      </div>
    </div>
  );
};