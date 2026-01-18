// components/messenger/ChatArea.tsx
import React, { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { MessageCircleMore } from 'lucide-react';
import { Message, User } from '@/types/messenger';
import { MessageBubble } from './MessageBubble';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import toast from 'react-hot-toast';

interface ChatAreaProps {
  chatId: number | null;        // Изменено с activeChat
  chatType: 'dm' | 'group' | null; // Добавлено
  messages: Message[];
  currentUser: User | null;
  storedLastReadId: number;
  onSendMessage: (text: string, replyToId?: number, attachments?: File[]) => void;
  onPinMessage?: (msgId: number) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMessages: boolean;
}

// Вспомогательные функции даты
const isSameDay = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.toDateString() === date2.toDateString();
};

const formatDateSeparator = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  chatId,
  chatType,
  messages,
  currentUser,
  onSendMessage,
  onPinMessage,
  isSidebarOpen,
  onToggleSidebar,
  onLoadMore,
  hasMore,
  isLoadingMessages
}) => {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showPinnedList, setShowPinnedList] = useState(false);

  // Контекстное меню
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{x: number, y: number} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [prevHeight, setPrevHeight] = useState(0);

  // Фильтр дубликатов и сортировка
  const uniqueMessages = useMemo(() => {
      const seen = new Set();
      return messages.filter(msg => {
          if (seen.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
      }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  // Закрепленные
  const currentChatPinned = useMemo(() => uniqueMessages.filter(m => m.is_pinned), [uniqueMessages]);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickGlobal = () => {
        setActiveMenuId(null);
        setMenuCoords(null);
    };
    window.addEventListener('click', handleClickGlobal);
    return () => window.removeEventListener('click', handleClickGlobal);
  }, []);

  // Скролл вниз при загрузке новых сообщений (инициализация)
  useLayoutEffect(() => {
    // Если сообщений мало или это первая загрузка, скроллим вниз
    if (uniqueMessages.length > 0 && prevHeight === 0) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 0);
    }
  }, [chatId, uniqueMessages.length, prevHeight]);

  // Сохранение позиции скролла при подгрузке истории вверх
  useLayoutEffect(() => {
      if (prevHeight > 0 && scrollContainerRef.current) {
          const newHeight = scrollContainerRef.current.scrollHeight;
          const diff = newHeight - prevHeight;
          scrollContainerRef.current.scrollTop = diff;
          setPrevHeight(0);
      }
  }, [uniqueMessages.length, prevHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight } = e.currentTarget;
      if (scrollTop < 50 && hasMore && !isLoadingMessages) {
          setPrevHeight(scrollHeight);
          onLoadMore();
      }
  };

  // Обертка для отправки, которая сбрасывает стейт ответа
  // ИСПРАВЛЕНИЕ: Правильная сигнатура обертки
  const onSendWrapper = (text: string, replyToId?: number, files?: File[]) => {
    onSendMessage(text, replyToId, files);
    setReplyingTo(null);
    setEditingMessage(null);
  };

  // Контекстное меню
  const handleOpenContextMenu = (e: React.MouseEvent, msgId: number) => {
      e.preventDefault();
      e.stopPropagation();
      let x = e.pageX;
      let y = e.pageY;
      // Простая проверка границ
      if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
      
      setActiveMenuId(msgId);
      setMenuCoords({ x, y });
  };

  // --- RENDER ---
  if (!chatId || !chatType) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative">
            {!isSidebarOpen && (
                <button onClick={onToggleSidebar} className="absolute top-4 left-4 p-3 bg-white shadow-md rounded-xl">
                    <MessageCircleMore size={20} />
                </button>
            )}
            <div className="text-center text-gray-500">
                <MessageCircleMore size={48} className="mx-auto mb-4 opacity-50" />
                <p>Выберите чат для начала общения</p>
            </div>
        </div>
      );
  }

  if (!currentUser) return null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-t from-blue-50 via-gray-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 relative overflow-hidden">
        
        {/* HEADER (Уже не внутри ChatArea, но если нужно вставить сюда): */}
        {/* В вашей архитектуре page.tsx header был над ChatArea, но можно и внутри: */}
        {/* <ChatHeader chatId={chatId} chatType={chatType} currentUser={currentUser} /> */}
        {/* Так как в page.tsx Header вынесен, здесь мы его не рендерим, или оставляем как часть области чата */}
        
        {/* PINNED MESSAGES (Banner) */}
        {showPinnedList && currentChatPinned.length > 0 && (
            <div className="bg-blue-50 dark:bg-gray-800 p-2 border-b border-blue-100 dark:border-gray-700 max-h-32 overflow-y-auto z-10">
                {currentChatPinned.map(m => (
                    <div key={m.id} className="text-sm p-2 bg-white dark:bg-gray-700 rounded mb-1 cursor-pointer shadow-sm">
                        <span className="font-bold text-blue-600 mr-2">Закреплено:</span>
                        {m.content}
                    </div>
                ))}
            </div>
        )}

        {/* MESSAGES LIST */}
        <div
            className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar"
            ref={scrollContainerRef}
            onScroll={handleScroll}
        >
            {isLoadingMessages && uniqueMessages.length === 0 && <div className="text-center p-4 text-gray-400">Загрузка...</div>}
            {isLoadingMessages && hasMore && uniqueMessages.length > 0 && <div className="text-center py-2 text-xs text-gray-400">Подгрузка истории...</div>}

            {uniqueMessages.map((msg, index) => {
                const isMe = Number(msg.sender_id) === Number(currentUser.id);
                const prevMsg = index > 0 ? uniqueMessages[index - 1] : null;
                const showDate = !prevMsg || !isSameDay(msg.created_at, prevMsg.created_at);

                return (
                    <React.Fragment key={msg.id}>
                        {showDate && (
                            <div className="flex justify-center my-4 sticky top-0 z-0">
                                <span className="bg-gray-200 dark:bg-gray-700 text-xs px-3 py-1 rounded-full text-gray-600 dark:text-gray-300 bg-opacity-80 backdrop-blur-sm shadow-sm">
                                    {formatDateSeparator(msg.created_at)}
                                </span>
                            </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] md:max-w-[70%] ${!isMe && chatType === 'group' ? 'ml-0' : ''}`}>
                                <MessageBubble
                                    msg={msg} 
                                    isMe={isMe}
                                    senderName={(!isMe && chatType === 'group') ? msg.sender_username : undefined}
                                    senderAvatar={(!isMe && chatType === 'group') ? msg.sender_avatar : undefined}
                                    time={new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    menuPosition={activeMenuId === msg.id ? menuCoords : null}
                                    onContextMenu={handleOpenContextMenu}
                                    closeMenu={() => setActiveMenuId(null)}
                                    onReply={(m) => setReplyingTo(m)}
                                    onPin={(m) => onPinMessage && onPinMessage(m.id)}
                                    onEdit={(m) => { setEditingMessage(m); }} // ChatInput подхватит это через пропс
                                    onDelete={(id) => console.log('delete', id)}
                                    onForward={(m) => console.log('forward', m)}
                                    replyToMessage={uniqueMessages.find(rm => rm.id === msg.reply_to_id) || null}
                                />
                             </div>
                        </div>
                    </React.Fragment>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

			{/* INPUT AREA */}
			<ChatInput
				onSendMessage={onSendWrapper}
				replyingTo={replyingTo}
				editingMessage={editingMessage}
				onCancelReply={() => { 
					setReplyingTo(null); 
					setEditingMessage(null); 
				}}
			/>
    </div>
  );
};