// /components/messenger/ChatHeader.tsx
// import React from 'react';
// import { MessageCircleMore, Pin, Search, Settings, Users, Phone, Video } from 'lucide-react';
// import { Conversation, Message, User } from '@/types/messenger'; // Убедись, что типы обновлены для групп
// import { getChatMetadata } from '@/utils/chatUtils';

// interface ChatHeaderProps {
//     activeChat: Conversation;
//     currentUser: User;
//     isSidebarOpen: boolean;
//     onToggleSidebar: () => void;
//     pinnedCount: number;
//     showPinnedList: boolean;
//     onTogglePinnedList: () => void;
// }

// export const ChatHeader: React.FC<ChatHeaderProps> = ({
//     activeChat,
//     currentUser,
//     isSidebarOpen,
//     onToggleSidebar,
//     pinnedCount,
//     showPinnedList,
//     onTogglePinnedList
// }) => {
//     // Логика определения имени и аватара (перенесена из ChatArea)
//     const isGroup = activeChat.type === 'group';
//     // Примечание: currentUser нужно прокинуть в пропсы или использовать хук useAuth внутри
//     // Для простоты предположим, что activeChat уже содержит готовое name и avatar_url
//     // Если нет, логику partner вычисляем тут или передаем готовые данные
    
//     const chatName = activeChat.name || "Чат"; 
//     const avatarUrl = activeChat.avatar_url;

//     // Вычисляем данные для отображения
//     const { name, avatar, isOnline } = getChatMetadata(activeChat, currentUser.id);

//     const getInitials = (name: string) => {
//         const parts = (name || '').trim().split(/\s+/);
//         if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() || '?';
//         return (parts[0].charAt(0) + parts[1]?.charAt(0)).toUpperCase();
//     };

//     return (
//         <div className="h-16 px-6 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 shadow-sm z-10 flex-none">
//             <div className="flex items-center gap-4">
//                 {!isSidebarOpen && (
//                     <button 
//                         onClick={onToggleSidebar} 
//                         className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
//                     >
//                         <MessageCircleMore size={20} className="text-gray-600 dark:text-gray-300" />
//                     </button>
//                 )}
                
//                 <div className="relative">
//                     <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg overflow-hidden">
//                         {avatarUrl ? (
//                             <img src={avatarUrl} alt={chatName} className="w-full h-full object-cover" />
//                         ) : (
//                             <span>{getInitials(chatName)}</span>
//                         )}
//                     </div>
//                     {/* Статус онлайн (для ЛС) */}
//                     {/* {!isGroup && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>} */}
//                      {/* Показываем статус только если это ЛС */}
//                     {activeChat.type !== 'group' && (
//                         <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
//                     )}
//                 </div>

//                 <div>
//                     <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
//                         {/* Иконка группы, если группа */}
//                         {activeChat.type === 'group' && <Users size={16} className="text-gray-400" />}
//                         {name} {/* <-- ИСПОЛЬЗУЕМ ВЫЧИСЛЕННОЕ ИМЯ */}
//                     </h3>
//                     <span className="text-xs text-gray-500 dark:text-gray-400">
//                         {isGroup ? `${activeChat.participants?.length || 0} участников` : 'В сети'}
//                     </span>
//                 </div>
//             </div>

//             <div className="flex items-center gap-2">
//                 {pinnedCount > 0 && (
//                     <button 
//                         onClick={onTogglePinnedList}
//                         className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${showPinnedList ? 'bg-blue-200 dark:bg-blue-900' : 'bg-blue-100 dark:bg-blue-900/30'} text-blue-600 dark:text-blue-400`}
//                     >
//                         <Pin size={16} />
//                         <span className="text-sm font-medium">{pinnedCount}</span>
//                     </button>
//                 )}
//                 <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all group">
//                     <Phone size={20} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
//                 </button>
//                 <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all group">
//                     <Search size={20} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
//                 </button>
//                 <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all group">
//                     <Settings size={20} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
//                 </button>
//             </div>
//         </div>
//     );
// };


// components/messenger/ChatHeader.tsx
import React, { useEffect, useState } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import { Conversation, Group, User, ChatPreview } from '@/types/messenger';
import { Phone, Video, Search, Settings, Pin, X, Users as UsersIcon, Circle } from 'lucide-react';
import toast from 'react-hot-toast';
import { CallModal } from './CallModal';

interface ChatHeaderProps {
  chatId: number;
  chatType: 'dm' | 'group';
  currentUser: User | null;
  cachedChatData?: ChatPreview;
}

interface PinnedMessage {
  id: number;
  content: string;
  sender_username: string;
  created_at: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chatId,
  chatType,
  currentUser,
  cachedChatData
}) => {
  const [title, setTitle] = useState(chatType === 'group' ? 'Группа' : 'Пользователь');
  const [avatar, setAvatar] = useState('');
  const [subtext, setSubtext] = useState(chatType === 'group' ? 'участники' : 'загрузка...');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingPinned, setLoadingPinned] = useState(false);

  // НОВОЕ: Состояние для звонков
  const [showCallModal, setShowCallModal] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);

  useEffect(() => {
    if (!chatId || !currentUser) return;

    const fetchDetails = async () => {
      if (cachedChatData) {
        console.log('💾 Using cached data:', cachedChatData);
        
        setTitle(cachedChatData.title || (chatType === 'group' ? 'Группа' : 'Пользователь'));
        setAvatar(cachedChatData.avatarUrl || '');
        setIsOnline(chatType === 'dm');
        
        if (chatType === 'dm') {
          setSubtext('в сети');
        } else {
          const groupData = cachedChatData.originalData as Group;
          setSubtext(`${groupData.members?.length || 0} участников`);
        }
        
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (chatType === 'dm') {
          console.log('🔍 Fetching conversation:', chatId);
          const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
          
          console.log('📥 Conversation data:', data);
          
          const partner = data.participants.find(p => Number(p.id) !== Number(currentUser.id));
          
          console.log('👤 Partner:', partner);
          
          if (partner && partner.username) {
            setTitle(partner.username);
            setAvatar(partner.avatar_url || '');
            setIsOnline(true);
            setSubtext('в сети');
          } else {
            setTitle(partner?.email?.split('@')[0] || `User ${partner?.id} || 'Пользователь'`);
            setAvatar('');
            setSubtext('информация недоступна');
          }
        } else {
          const { data } = await axiosMessenger.get<Group>(`/groups/${chatId}`);
          setTitle(data.name || 'Группа');
          setAvatar(data.avatar_url || '');
          setIsOnline(false);
          setSubtext(`${data.members?.length || 0} участников`);
        }
      } catch (e) {
        console.error("❌ Failed to load header info", e);
        setSubtext(chatType === 'group' ? 'информация недоступна' : 'оффлайн');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [chatId, chatType, currentUser, cachedChatData]);

  const loadPinnedMessages = async () => {
    setLoadingPinned(true);
    try {
      const params = chatType === 'dm' 
        ? { conversation_id: chatId }
        : { group_id: chatId };
      
      const { data } = await axiosMessenger.get('/pinned', { params });
      setPinnedMessages(data.pinned_messages || []);
    } catch (e) {
      console.error("Failed to load pinned messages", e);
      toast.error("Не удалось загрузить закрепленные");
    } finally {
      setLoadingPinned(false);
    }
  };

  const togglePinned = () => {
    if (!showPinned) {
      loadPinnedMessages();
    }
    setShowPinned(!showPinned);
  };

  // НОВОЕ: Инициация звонка
  const initiateCall = async (callTypeParam: 'audio' | 'video') => {
    if (chatType === 'group') {
      toast.error("Звонки в группах пока не поддерживаются");
      return;
    }

    try {
      // ИСПРАВЛЕНО: Правильное получение собеседника
      let partner: any = null;

      if (cachedChatData) {
        const conversation = cachedChatData.originalData as Conversation;
        partner = conversation?.participants?.find(
          (p: any) => Number(p.id) !== Number(currentUser?.id)
        );
      }

      if (!partner) {
        // Если нет в кэше, запрашиваем с сервера
        const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
        partner = data.participants?.find(
          (p: any) => Number(p.id) !== Number(currentUser?.id)
        );
      }

      if (!partner) {
        toast.error("Не удалось определить собеседника");
        return;
      }

      console.log('🔔 Initiating call to:', partner);

      // Создаем звонок на бэкенде
      const response = await axiosMessenger.post('/calls', {
        conversation_id: chatId,
        receiver_id: partner.id,
        type: callTypeParam
      });

      console.log('✅ Call created:', response.data);

      setCurrentCall({
        id: response.data.id,
        partnerId: partner.id,
        partnerName: partner.username || partner.email?.split('@')[0] || 'Пользователь',
        type: callTypeParam,
        isInitiator: true
      });

      setShowCallModal(true);

    } catch (error) {
      console.error('Failed to initiate call:', error);
      toast.error('Не удалось начать звонок');
    }
  };

  // ИСПРАВЛЕНО: Обработка входящих звонков
  useEffect(() => {
    const handleAcceptCall = (event: any) => {
      const callData = event.detail;
      
      // Получаем имя партнера из кэша
      let partnerName = 'Собеседник';
      if (cachedChatData) {
        const conversation = cachedChatData.originalData as Conversation;
        const partner = conversation?.participants?.find(
          (p: any) => Number(p.id) === Number(callData.partnerId)
        );
        partnerName = partner?.username || partner?.email?.split('@')[0] || 'Собеседник';
      }
      
      setCurrentCall({
        id: callData.callId,
        partnerId: callData.partnerId,
        partnerName: partnerName,
        type: callData.callType,
        isInitiator: callData.isInitiator,
        offerSdp: callData.offerSdp // ДОБАВЛЕНО
      });
      
      setShowCallModal(true);
    };

    window.addEventListener('accept-call', handleAcceptCall);
    
    return () => {
      window.removeEventListener('accept-call', handleAcceptCall);
    };
  }, [cachedChatData]);

  // ИСПРАВЛЕНО: Обработка закрытия модалки
  useEffect(() => {
    const handleCloseCallModal = () => {
      setShowCallModal(false);
      setCurrentCall(null);
    };

    window.addEventListener('close-call-modal', handleCloseCallModal);
    
    return () => {
      window.removeEventListener('close-call-modal', handleCloseCallModal);
    };
  }, []);

  return (
    <>
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
              loading 
                ? 'bg-gray-300 dark:bg-gray-700 animate-pulse' 
                : 'bg-gradient-to-r from-blue-400 to-indigo-500'
            }`}>
              {avatar ? (
                <img src={avatar} alt={title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{title[0]?.toUpperCase() || '?'}</span>
              )}
            </div>
            
            {chatType === 'dm' && isOnline && !loading && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              {chatType === 'group' && (
                <UsersIcon size={14} className="text-gray-500" />
              )}
              <h3 className={`font-bold leading-tight ${
                loading 
                  ? 'text-gray-400 dark:text-gray-600' 
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {title}
              </h3>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {chatType === 'dm' && isOnline && !loading && (
                <Circle size={6} className="fill-green-500 text-green-500" />
              )}
              {subtext}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-gray-500">
          {chatType === 'dm' && (
            <>
              <button 
                onClick={() => initiateCall('audio')}
                disabled={loading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                title="Аудиозвонок"
              >
                <Phone size={20} />
              </button>
              <button 
                onClick={() => initiateCall('video')}
                disabled={loading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                title="Видеозвонок"
              >
                <Video size={20} />
              </button>
            </>
          )}
          
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Поиск"
          >
            <Search size={20} />
          </button>
          
          <button 
            onClick={togglePinned}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              showPinned 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Закрепленные сообщения"
          >
            <Pin size={20} />
          </button>
          
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Настройки"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {showPinned && (
        <div className="bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 animate-slideDown">
          <div className="px-6 py-3 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Pin size={14} className="text-blue-600 flex-shrink-0" />
                <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  Закрепленные сообщения ({pinnedMessages.length})
                </h4>
              </div>
              
              {loadingPinned ? (
                <div className="text-sm text-gray-500">Загрузка...</div>
              ) : pinnedMessages.length === 0 ? (
                <div className="text-sm text-gray-500">Нет закрепленных сообщений</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {pinnedMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            {msg.sender_username}
                          </p>
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                            {msg.content}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {new Date(msg.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowPinned(false)}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors ml-2"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно звонка */}
      {showCallModal && currentCall && (
        <CallModal
          callId={currentCall.id}
          isInitiator={currentCall.isInitiator}
          partnerId={currentCall.partnerId}
          partnerName={currentCall.partnerName}
          callType={currentCall.type}
          offerSdp={currentCall.offerSdp}
          onClose={() => {
            setShowCallModal(false);
            setCurrentCall(null);
          }}
        />
      )}
    </>
  );
};