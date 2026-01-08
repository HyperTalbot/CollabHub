// // /components/messenger/ChatListSidebar.tsx
// import React, { useState } from 'react';
// import { Search, ChevronLeft, Users, Settings } from 'lucide-react';
// import { Conversation, User } from '@/types/messenger';

// type FolderType = 'all' | 'personal' | 'groups' | 'unread';
// const CHAT_FOLDERS: { id: FolderType; label: string }[] = [
//   { id: 'all', label: 'Все' },
//   { id: 'personal', label: 'Личные' },
//   { id: 'groups', label: 'Группы' },
//   { id: 'unread', label: 'Непрочитанные' },
// ];

// interface ChatListSidebarProps {
//   conversations: Conversation[];
//   currentUser: User | null; // Разрешаем null
//   selectedChatId: number | null;
//   onSelectChat: (id: number) => void;
//   loading: boolean;
//   onClose?: () => void;
// }

// // Хелпер даты
// const formatChatDate = (dateString?: string) => {
//     if (!dateString) return '';
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) return '';
//     const now = new Date();
//     const isCurrentYear = date.getFullYear() === now.getFullYear();
//     return date.toLocaleDateString('ru-RU', {
//         day: '2-digit', month: '2-digit', year: isCurrentYear ? undefined : 'numeric'
//     });
// };

// export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
//   conversations,
//   currentUser,
//   selectedChatId,
//   onSelectChat,
//   loading,
//   onClose
// }) => {
//   const [activeFolder, setActiveFolder] = useState<FolderType>('all');
//   const [searchQuery, setSearchQuery] = useState('');

//   // 1. Функция получения данных чата (Имя, Аватар, Тип)
//   const getChatMetadata = (conv: Conversation) => {
//       // Если currentUser еще не загружен, не ломаем верстку
//       if (!currentUser) return { isGroup: false, name: 'Загрузка...', avatarUrl: '', initials: '...' };

//       const isGroup = conv.type === 'group';
      
//       // Ищем собеседника: Тот, чей ID не совпадает с моим
//       // Если participants пустой, partner будет undefined (это причина "Неизвестного")
//       const partner = conv.participants?.find(p => Number(p.id) !== Number(currentUser.id));

//       // Определяем имя
//       let name = 'Без названия';
//       if (isGroup) {
//           name = conv.name || 'Группа';
//       } else {
//           // Если есть partner.username берем его, иначе fallback
//           name = partner?.username || 'Неизвестный'; 
//       }

//       return {
//           isGroup,
//           name,
//           avatarUrl: isGroup ? conv.avatar_url : partner?.avatar_url,
//           initials: name?.[0]?.toUpperCase() || '?'
//       };
//   };

//   // 2. Фильтрация
//   const filteredConversations = conversations.filter(conv => {
//       if (!currentUser) return false;
//       const { isGroup, name } = getChatMetadata(conv);

//       // Логика фильтров
//       if (activeFolder === 'unread' && conv.unread_count === 0) return false;
//       if (activeFolder === 'groups' && !isGroup) return false;
//       if (activeFolder === 'personal' && isGroup) return false;

//       // Поиск
//       if (searchQuery) {
//           return name.toLowerCase().includes(searchQuery.toLowerCase());
//       }
//       return true;
//   });

//   return (
//     <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

//       {/* Хедер */}
//       <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
//         <h2 className="text-lg font-bold text-black dark:text-white">Сообщения</h2>
//         {onClose && (
//             <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
//                 <ChevronLeft size={20} />
//             </button>
//         )}
//       </div>

//       {/* Папки */}
//       <div className="flex items-center px-2 pt-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
//         {CHAT_FOLDERS.map(folder => (
//             <button
//             key={folder.id}
//             onClick={() => setActiveFolder(folder.id)}
//             className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
//                 ${activeFolder === folder.id
//                   ? 'border-blue-500 text-blue-600 dark:text-blue-400'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
//           >
//             {folder.label}
//           </button>
//         ))}
//       </div>
      
//       {/* Поиск */}
//       <div className="p-3 bg-white dark:bg-gray-900">
//         <div className="relative">
//           <input
//             type="text"
//             placeholder="Поиск чатов..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="w-full pl-9 pr-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm focus:outline-none"
//           />
//           <Search className="absolute left-2.5 top-2 text-gray-500" size={16} />
//         </div>
//       </div>

//       {/* Список */}
//       <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-white dark:bg-gray-900">
//         {loading ? (
//             <div className="text-center p-4 text-gray-400 text-sm">Загрузка...</div>
//         ) : filteredConversations.length === 0 ? (
//             <div className="text-center p-8 text-gray-500 text-sm">Нет чатов</div>
//         ) : (
//             filteredConversations.map(conv => {
//                 const { name, avatarUrl, initials, isGroup } = getChatMetadata(conv);
//                 const isSelected = selectedChatId === conv.id;
                
//                 // Проверка на наличие сообщения (убираем trim, если контент null)
//                 const hasMessage = conv.last_message_content && conv.last_message_content.length > 0;
                
//                 // Проверяем, мое ли это сообщение
//                 const isLastMsgMine = Number(conv.last_message_sender_id) === Number(currentUser?.id);

//                 let previewText = "Начните общение";
//                 if (hasMessage) {`
//                     previewText = isLastMsgMine 
//                         ? Вы: ${conv.last_message_content} 
//                         : conv.last_message_content || '';
//                 `}

//                 return (
//                     <div
//                       key={conv.id}
//                       onClick={() => onSelectChat(conv.id)}
//                       className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-all group
//                         ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
//                     >
//                         {/* Аватар */}
//                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm relative overflow-hidden">
//                             {avatarUrl ? (
//                                 <img
//                                     src={avatarUrl}
//                                     alt={name}
//                                     className="w-full h-full object-cover"
//                                     onError={(e) => { e.currentTarget.style.display = 'none'; }}
//                                 />
//                             ) : (
//                                 <span>{initials}</span>
//                             )}
//                         </div>

//                         <div className="ml-3 flex-1 overflow-hidden">
//                             <div className="flex justify-between items-center">
//                                 <h4 className={`font-semibold truncate text-sm flex items-center gap-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
//                                     {isGroup && <Users size={14} className="text-gray-500" />}
//                                     {name}
//                                 </h4>
//                                 {conv.last_message_at && (
//                                   <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
//                                         {formatChatDate(conv.last_message_at)}
//                                     </span>
//                                 )}
//                             </div>
                            
//                             <div className="flex justify-between items-center mt-0.5">
//                                 <p className={`text-xs truncate max-w-[140px] ${isSelected ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'} ${hasMessage ? '' : 'italic opacity-70'}`}>
//                                     {conv.unread_count > 0 ? (
//                                         <span className="font-bold text-black dark:text-white">{previewText}</span>
//                                     ) : (
//                                         <span>{previewText}</span>
//                                     )}
//                                 </p>

//                                 {conv.unread_count > 0 && (
//                                     <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm">
//                                         {conv.unread_count}
//                                     </span>
//                                 )}
//                             </div>
//                         </div>
//                     </div>
//                 );
//             })
//         )}
//       </div>
//       {/* Профиль (Внизу) */}
//       <div className="p-2 bg-gray-50 dark:bg-gray-950 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
//          <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer">
//             {/* Аватар пользователя */}
//             <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden">
//                 {currentUser?.avatar_url ? (
//                     <img
//                         src={currentUser.avatar_url}
//                         alt={currentUser.username || 'User'}
//                         className="w-full h-full object-cover"
//                         onError={(e) => {
//                             e.currentTarget.style.display = 'none';
//                         }}
//                     />
//                 ) : (
//                     <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
//                 )}
//             </div>
//             <div className="flex flex-col">
//                 <span className="text-xs font-bold text-black dark:text-white">
//                     {currentUser?.username || 'Пользователь'}
//                 </span>
//             </div>
//          </div>
//          <Settings size={18} className="text-gray-500 hover:text-black dark:hover:text-white cursor-pointer mr-2" />
//       </div>
//     </div>
//   );
// };




// // /components/messenger/ChatListSidebar.tsx
// import React, { useEffect, useState } from 'react';
// import axios from '@/lib/axiosInstance'; // Ваш настроенный axios
// import { ChatPreview, Conversation, Group, User } from '@/types/messenger';
// import { Search, Users, User as UserIcon } from 'lucide-react';
// import toast from 'react-hot-toast';

// // --- КОНСТАНТЫ URL ---
// // Поменяйте порты/пути в соответствии с вашим API Gateway или сервисами
// const AUTH_API_URL = 'http://localhost:8080/api/v1'; // Порт Auth Service
// const MESSENGER_API_URL = 'http://localhost:8086/api/v1'; // Порт Messenger Service

// type FolderType = 'all' | 'personal' | 'groups' | 'unread';
// const CHAT_FOLDERS: { id: FolderType; label: string }[] = [
//   { id: 'all', label: 'Все' },
//   { id: 'personal', label: 'Личные' },
//   { id: 'groups', label: 'Группы' },
//   { id: 'unread', label: 'Непрочитанные' },
// ];

// interface ChatListSidebarProps {
//   currentUser: User | null;
//   selectedChatId: number | null;
//   selectedChatType: 'dm' | 'group' | null; // Важно знать тип выбранного чата
//   onSelectChat: (id: number, type: 'dm' | 'group') => void;
// }

// // Интерфейс для результатов глобального поиска
// interface GlobalUser {
//     id: number;
//     username: string;
//     avatar_url?: string;
// }

// // Хелпер даты
// const formatChatDate = (dateString?: string) => {
//     if (!dateString) return '';
//     const date = new Date(dateString);
//     if (isNaN(date.getTime())) return '';
//     const now = new Date();
//     const isCurrentYear = date.getFullYear() === now.getFullYear();
//     return date.toLocaleDateString('ru-RU', {
//         day: '2-digit', month: '2-digit', year: isCurrentYear ? undefined : 'numeric'
//     });
// };

// export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
//   conversations,
//   currentUser,
//   selectedChatId,
//   onSelectChat,
//   onRefreshConversations,
//   loading,
//   onClose
// }) => {
//   const [activeFolder, setActiveFolder] = useState<FolderType>('all');
//   const [searchQuery, setSearchQuery] = useState('');
  
//   // Состояние для глобального поиска
//   const [globalUsers, setGlobalUsers] = useState<GlobalUser[]>([]);
//   const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

//   // --- 1. Логика локального фильтра ---
//   const getChatMetadata = (conv: Conversation) => {
//       if (!currentUser) return { isGroup: false, name: '...', avatarUrl: '', initials: '?' };

//       const isGroup = conv.type === 'group';
//       const partner = conv.participants?.find(p => Number(p.id) !== Number(currentUser.id));

//       let name = 'Без названия';
//       if (isGroup) {
//           name = conv.name || 'Группа';
//       } else {
//           name = partner?.username || 'Неизвестный';
//       }

//       return {
//           isGroup,
//           name,
//           avatarUrl: isGroup ? conv.avatar_url : partner?.avatar_url,
//           initials: name?.[0]?.toUpperCase() || '?'
//       };
//   };

//   const filteredConversations = conversations.filter(conv => {
//       if (!currentUser) return false;
//       const { isGroup, name } = getChatMetadata(conv);

//       if (activeFolder === 'unread' && conv.unread_count === 0) return false;
//       if (activeFolder === 'groups' && !isGroup) return false;
//       if (activeFolder === 'personal' && isGroup) return false;

//       if (searchQuery) {
//           return name.toLowerCase().includes(searchQuery.toLowerCase());
//       }
//       return true;
//   });

//   // --- 2. Логика глобального поиска (Debounce) ---
//   useEffect(() => {
//       // Ищем только если есть запрос и он длиннее 1 символа
//       if (!searchQuery || searchQuery.length < 2) {
//           setGlobalUsers([]);
//           return;
//       }

//       // Задержка 500мс перед запросом
//       const timeoutId = setTimeout(async () => {
//           setIsSearchingGlobal(true);
//           try {
//               // ЗАПРОС К AUTH-SERVICE
//               // Предполагаем, что ваш роут выглядит так: GET /users/search?q=...
//               // Если у вас другой путь в auth-service, поправьте здесь
//               const res = await axios.get(`${AUTH_API_URL}/users/search`, {
//                   params: { q: searchQuery }
//               });
              
//               // Фильтруем себя из результатов
//               const users = (res.data || []).filter((u: GlobalUser) => Number(u.id) !== Number(currentUser?.id));
              
//               // Фильтруем тех, с кем УЖЕ есть чат (они будут в filteredConversations)
//               // Чтобы не дублировать
//               const existingPartnerIds = new Set();
//               conversations.forEach(c => {
//                  if (c.type === 'dm') {
//                      const p = c.participants?.find(p => p.id !== currentUser?.id);
//                      if (p) existingPartnerIds.add(Number(p.id));
//                  }
//               });

//               const newUsers = users.filter((u: GlobalUser) => !existingPartnerIds.has(Number(u.id)));
              
//               setGlobalUsers(newUsers);
//           } catch (error) {
//               console.error("Global search failed:", error);
//           } finally {
//               setIsSearchingGlobal(false);
//           }
//       }, 500);

//       return () => clearTimeout(timeoutId);
//   }, [searchQuery, currentUser, conversations]);

//   // --- 3. Начало нового чата (StartChat) ---
//   const handleStartNewChat = async (targetUserId: number) => {
//       try {
//           // Вызываем startChat в messenger-service
//           const res = await axios.post(`${MESSENGER_API_URL}/conversations`, {
//               target_user_id: targetUserId
//           });

//           const newChat = res.data;
          
//           // Очищаем поиск
//           setSearchQuery('');
//           setGlobalUsers([]);

//           // Если родитель передал функцию обновления списка - вызываем
//           if (onRefreshConversations) {
//               // Небольшая задержка, чтобы БД успела (опционально)
//               // В идеале onSelectChat должен сработать после обновления списка
//               await onRefreshConversations();
//           }

//           // Выбираем этот чат
//           onSelectChat(newChat.id);
//       } catch (error) {
//           console.error("Failed to start chat:", error);
//           toast.error("Не удалось начать чат");
//       }
//   };

//   return (
//     <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

//       {/* Хедер */}
//       <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
//         <h2 className="text-lg font-bold text-black dark:text-white">Сообщения</h2>
//         {onClose && (
//             <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
//                 <ChevronLeft size={20} />
//             </button>
//         )}
//       </div>

//       {/* Папки */}
//       <div className="flex items-center px-2 pt-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
//         {CHAT_FOLDERS.map(folder => (
//           <button
//             key={folder.id}
//             onClick={() => setActiveFolder(folder.id)}
//             className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
//                 ${activeFolder === folder.id
//                   ? 'border-blue-500 text-blue-600 dark:text-blue-400'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
//           >
//             {folder.label}
//           </button>
//         ))}
//       </div>
      
//       {/* Поиск */}
//       <div className="p-3 bg-white dark:bg-gray-900">
//         <div className="relative">
//           <input
//             type="text"
//             placeholder="Поиск людей и чатов..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="w-full pl-9 pr-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm focus:outline-none"
//           />
//           <Search className="absolute left-2.5 top-2 text-gray-500" size={16} />
//         </div>
//       </div>

//       {/* Список */}
//       <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-white dark:bg-gray-900">
        
//         {/* Секция 1: Локальные чаты (фильтрованные) */}
//         {filteredConversations.map(conv => {
//             const { name, avatarUrl, initials, isGroup } = getChatMetadata(conv);
//             const isSelected = selectedChatId === conv.id;
//             const hasMessage = conv.last_message_content && conv.last_message_content.length > 0;
//             const isLastMsgMine = Number(conv.last_message_sender_id) === Number(currentUser?.id);

//             let previewText = "Начните общение";
//             if (hasMessage) {`
//                 previewText = isLastMsgMine 
//                     ? Вы: ${conv.last_message_content} 
//                     : conv.last_message_content || '';
//             `}

//             return (
//                 <div
//                     key={conv.id}
//                     onClick={() => onSelectChat(conv.id)}
//                     className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-all group
//                     ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
//                 >
//                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm relative overflow-hidden">
//                         {avatarUrl ? (
//                             <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
//                         ) : (
//                             <span>{initials}</span>
//                         )}
//                     </div>
//                     <div className="ml-3 flex-1 overflow-hidden">
//                         <div className="flex justify-between items-center">
//                             <h4 className={`font-semibold truncate text-sm flex items-center gap-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
//                                 {isGroup && <Users size={14} className="text-gray-500" />}
//                                 {name}
//                             </h4>
//                             {conv.last_message_at && (
//                                 <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
//                                     {formatChatDate(conv.last_message_at)}
//                                 </span>
//                             )}
//                         </div>
//                         <div className="flex justify-between items-center mt-0.5">
//                             <p className={`text-xs truncate max-w-[140px] ${isSelected ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'} ${hasMessage ? '' : 'italic opacity-70'}`}>
//                                 {conv.unread_count > 0 ? (
//                                     <span className="font-bold text-black dark:text-white">{previewText}</span>
//                                 ) : (
//                                     <span>{previewText}</span>
//                                 )}
//                             </p>
//                             {conv.unread_count > 0 && (
//                                 <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm">
//                                     {conv.unread_count}
//                                 </span>
//                             )}
//                         </div>
//                     </div>
//                 </div>
//             );
//         })}

//         {/* Секция 2: Глобальный поиск */}
//         {searchQuery.length >= 2 && (
//             <div className="mt-4">
//                 <div className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Глобальный поиск
//                 </div>
//                 {isSearchingGlobal ? (
//                     <div className="text-center p-2 text-xs text-gray-400">Поиск...</div>
//                 ) : globalUsers.length === 0 ? (
//                      // Если и в локальных пусто, и в глобальных пусто
//                      filteredConversations.length === 0 && (
//                         <div className="text-center p-2 text-xs text-gray-400">Никого не найдено</div>
//                      )
//                 ) : (
//                     globalUsers.map(user => (
//                         <div
//                             key={user.id}
//                             onClick={() => handleStartNewChat(user.id)}
//                             className="flex items-center p-2.5 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
//                         >
//                             <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
//                                 {user.avatar_url ? (
//                                     <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover rounded-full" />
//                                 ) : (
//                                     <UserPlus size={18} />
//                                 )}
//                             </div>
//                             <div className="ml-3 flex-1">
//                                 <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
//                                     {user.username}
//                                 </h4>
//                                 <p className="text-xs text-blue-500">Нажать чтобы написать</p>
//                             </div>
//                         </div>
//                     ))
//                 )}
//             </div>
//         )}

//         {loading && <div className="text-center p-4 text-gray-400 text-sm">Загрузка...</div>}
//       </div>

//       {/* Профиль */}
//       <div className="p-2 bg-gray-50 dark:bg-gray-950 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
//          <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer">
//             <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden">
//                 {currentUser?.avatar_url ? (
//                     <img
//                         src={currentUser.avatar_url}
//                         alt={currentUser.username || 'User'}
//                         className="w-full h-full object-cover"
//                         onError={(e) => { e.currentTarget.style.display = 'none'; }}
//                     />
//                 ) : (
//                     <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
//                 )}
//             </div>
//             <div className="flex flex-col">
//                 <span className="text-xs font-bold text-black dark:text-white">
//                     {currentUser?.username || 'Пользователь'}
//                 </span>
//             </div>
//          </div>
//          <Settings size={18} className="text-gray-500 hover:text-black dark:hover:text-white cursor-pointer mr-2" />
//       </div>
//     </div>
//   );
// };



// /components/messenger/ChatListSidebar.tsx
import React, { useEffect, useState } from 'react';
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