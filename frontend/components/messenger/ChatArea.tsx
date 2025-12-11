// /components/messenger/ChatArea.tsx
import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Plus, Hash, MessageCircleMore, Search, Settings, Users } from 'lucide-react';
import { Message, Conversation, User } from '@/types/messenger';
import { MessageBubble } from './MessageBubble';

const MAX_MESSAGE_LENGTH = 4096;

interface ChatAreaProps {
  activeChat: Conversation | null;
  messages: Message[];
  currentUser: User | null;
  storedLastReadId: number;
  onSendMessage: (text: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLoadMore: () => void; // <-- НОВЫЙ ПРОП
  hasMore: boolean;       // <-- НОВЫЙ ПРОП (чтобы показать спиннер)
}

// Хелперы дат (оставляем те же)
const isSameDay = (d1: string, d2: string) => {
    const date1 = new Date(d1); const date2 = new Date(d2);
    return date1.toDateString() === date2.toDateString();
};
const formatDateSeparator = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChat,
  messages,
  currentUser,
  storedLastReadId,
  onSendMessage,
  isSidebarOpen,
  onToggleSidebar,
  onLoadMore,
  hasMore
}) => {
  const [messageContent, setMessageContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Для восстановления скролла
  const [prevHeight, setPrevHeight] = useState(0);

  // Скролл ВНИЗ при открытии чата или новом сообщении (если мы внизу)
  useLayoutEffect(() => {
    // Если это первая загрузка (или смена чата) - прыгаем вниз
    // Но если мы подгрузили историю (prevHeight > 0), не прыгаем
    if (messages.length > 0 && prevHeight === 0) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 0);
    }
  }, [activeChat?.id, messages.length]); // Следим за id чата

  // Восстановление позиции скролла после подгрузки
  useLayoutEffect(() => {
      if (prevHeight > 0 && scrollContainerRef.current) {
          const newHeight = scrollContainerRef.current.scrollHeight;
          const diff = newHeight - prevHeight;
          scrollContainerRef.current.scrollTop = diff;
          setPrevHeight(0); // Сброс
      }
  }, [messages.length]);


  // Обработчик скролла (Бесконечная прокрутка)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight } = e.currentTarget;
      if (scrollTop < 50 && hasMore) {
          setPrevHeight(scrollHeight); // Запоминаем высоту перед загрузкой
          onLoadMore();
      }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageContent.trim()) return;
    onSendMessage(messageContent);
    setMessageContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeChat) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-700 text-gray-400">
            {!isSidebarOpen && (
                <button onClick={onToggleSidebar} className="absolute top-4 left-4 p-2 bg-gray-200 dark:bg-gray-800 rounded">
                    Меню
                </button>
            )}
            <MessageCircleMore size={48} className="opacity-50 mb-2" />
            <p>Выберите чат</p>
        </div>
      );
  }

  const isGroup = activeChat.type === 'group';
  const partner = activeChat.participants?.find(p => p.id !== currentUser?.id) || activeChat.participants?.[0];
  const chatName = isGroup ? activeChat.name : partner?.username;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-700 relative w-full overflow-hidden"> {/* overflow-hidden важен */}
    
    {/* Хедер */}
        <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm z-10 bg-white dark:bg-gray-700 flex-none">
            <div className="flex items-center">
                {!isSidebarOpen && (
                    <button onClick={onToggleSidebar} className="mr-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500">
                        <MessageCircleMore size={20} />
                    </button>
                )}
                {isGroup ? <Users size={20} className="text-gray-400 mr-3" /> : <Hash size={20} className="text-gray-400 mr-3" />}
                <div>
                    <h3 className="font-bold text-black dark:text-white text-md">{chatName}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> В сети
                    </span>
                </div>
            </div>
            <div className="flex items-center space-x-3 text-gray-400">
                <Search size={20} className="cursor-pointer hover:text-gray-600" />
                <Settings size={20} className="cursor-pointer hover:text-gray-600" />
            </div>
        </div>

        {/* Сообщения */}
        <div 
            className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar bg-[#f5f7fb] dark:bg-[#2f3136]"
            ref={scrollContainerRef}
            onScroll={handleScroll}
        >
            {hasMore && <div className="text-center py-2 text-xs text-gray-400">Загрузка истории...</div>}

            {messages.map((msg, index) => {
                const isMe = Number(msg.sender_id) === Number(currentUser?.id);
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const isUnread = Number(msg.id) > storedLastReadId;
                const showUnreadDivider = isUnread && !isMe && (!prevMsg || Number(prevMsg.id) <= storedLastReadId);
                const showDateDivider = !prevMsg || !isSameDay(msg.created_at, prevMsg.created_at);

                return (
                    <React.Fragment key={msg.id}>
                        {showDateDivider && (
                            <div className="flex items-center justify-center my-4">
                                <div className="bg-gray-200/80 dark:bg-gray-600/80 text-gray-600 dark:text-gray-300 text-[11px] font-medium px-3 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                                    {formatDateSeparator(msg.created_at)}
                                </div>
                            </div>
                        )}
                        {showUnreadDivider && (
                            <div className="flex items-center my-4 justify-center sticky top-2 z-10">
                                <div className="bg-red-100 dark:bg-red-900/50 text-red-500 text-[10px] font-bold px-3 py-0.5 rounded-full border border-red-200 dark:border-red-800 shadow-sm">НОВЫЕ СООБЩЕНИЯ</div>
                            </div>
                        )}
                        {/* ИСПОЛЬЗУЕМ НОВЫЙ КОМПОНЕНТ */}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <MessageBubble 
                                msg={msg} 
                                isMe={isMe} 
                                time={new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            />
                        </div>
                    </React.Fragment>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
        
        {/* Ввод - ФИКС РАЗМЕРА */}
        <div className="p-4 bg-white dark:bg-gray-700 border-t border-gray-200 dark:border-gray-800 flex-none w-full">
            <form className="flex items-end space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl w-full" onSubmit={handleSend}>
                <div className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer mb-0.5 flex-shrink-0"><Plus size={20} /></div>
                
                <div className="flex-1 min-w-0 relative">
                    <TextareaAutosize 
                        minRows={1} maxRows={10} 
                        placeholder="Написать сообщение..." 
                        value={messageContent} onChange={(e) => setMessageContent(e.target.value)} 
                        onKeyDown={handleKeyDown} 
                        style={{ width: '100%' }} // <--- ВАЖНЫЙ ФИКС: Явная ширина
                        className="w-full bg-transparent text-black dark:text-white placeholder-gray-500 focus:outline-none text-sm resize-none py-2 custom-scrollbar max-h-[200px]" 
                    />
                </div>

                <button type="submit" disabled={!messageContent.trim()} className={`p-2 rounded-lg mb-0.5 flex-shrink-0 transition-all ${messageContent.trim() ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' : 'text-gray-400 bg-transparent'}`}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    </div>
  );
};


// // ... imports
// import { MessageBubble } from './MessageBubble'; // Импорт нового компонента

// // ...

// export const ChatArea: React.FC<ChatAreaProps> = ({ ... }) => {
//   // ... (логика скролла и стейты) ...

//   return (
//     <div className="flex flex-col h-full bg-white dark:bg-gray-700 relative w-full overflow-hidden">
        
//         {/* Хедер (без изменений) */}
//         {/* ... */}

//         {/* Сообщения */}
//         <div className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar bg-[#f5f7fb] dark:bg-[#2f3136]" ref={scrollContainerRef} onScroll={handleScroll}>
//             {hasMore && <div className="text-center py-2 text-xs text-gray-400">Загрузка истории...</div>}

//             {messages.map((msg, index) => {
//                 const isMe = Number(msg.sender_id) === Number(currentUser?.id);
//                 // ... (логика разделителей осталась) ...

//                 return (
//                     <React.Fragment key={msg.id}>
//                         {showDateDivider && ( /* ... */ )}
//                         {showUnreadDivider && ( /* ... */ )}
                        
//                         {/* ИСПОЛЬЗУЕМ НОВЫЙ КОМПОНЕНТ */}
//                         <div className={flex ${isMe ? 'justify-end' : 'justify-start'}}>
//                             <MessageBubble 
//                                 msg={msg} 
//                                 isMe={isMe} 
//                                 time={new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
//                             />
//                         </div>
//                     </React.Fragment>
//                 );
//             })}
//             <div ref={messagesEndRef} />
//         </div>

//         {/* Ввод - ФИКС РАЗМЕРА */}
//         <div className="p-4 bg-white dark:bg-gray-700 border-t border-gray-200 dark:border-gray-800 flex-none w-full">
//             <form className="flex items-end space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl w-full" onSubmit={handleSend}>
//                 <div className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer mb-0.5 flex-shrink-0"><Plus size={20} /></div>
                
//                 <div className="flex-1 min-w-0 relative">
//                     <TextareaAutosize 
//                         minRows={1} maxRows={10} 
//                         placeholder="Написать сообщение..." 
//                         value={messageContent} onChange={(e) => setMessageContent(e.target.value)} 
//                         onKeyDown={handleKeyDown} 
//                         style={{ width: '100%' }} // <--- ВАЖНЫЙ ФИКС: Явная ширина
//                         className="w-full bg-transparent text-black dark:text-white placeholder-gray-500 focus:outline-none text-sm resize-none py-2 custom-scrollbar max-h-[200px]" 
//                     />
//                 </div>

//                 <button type="submit" disabled={!messageContent.trim()} className={p-2 rounded-lg mb-0.5 flex-shrink-0 transition-all ${messageContent.trim() ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' : 'text-gray-400 bg-transparent'}}>
//                     <Send size={18} />
//                 </button>
//             </form>
//         </div>
//     </div>
//   );
// };