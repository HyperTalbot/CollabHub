// frontend/components/messenger/ChatHeader.tsx
import React, { useEffect, useState } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import { Conversation, Group, User, ChatPreview } from '@/types/messenger';
import { Phone, Video, Search, Settings, Pin, X, Users as UsersIcon, Circle, Reply } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChatInfoModal } from './ChatInfoModal';

interface ChatHeaderProps {
  chatId: number;
  chatType: 'dm' | 'group';
  currentUser: User | null;
  cachedChatData?: ChatPreview;
}

interface ReplySourcePreview {
  id: number;
  content: string;
  sender_username: string;
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
  cachedChatData,
}) => {
  const [title, setTitle] = useState(chatType === 'group' ? 'Группа' : 'Пользователь');
  const [avatar, setAvatar] = useState('');
  const [subtext, setSubtext] = useState(chatType === 'group' ? 'участники' : 'загрузка...');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [partnerUserId, setPartnerUserId] = useState<number | null>(null);

  // панель сообщений, на которые дан мульти-ответ 
  const [replySources, setReplySources] = useState<ReplySourcePreview[]>([]);
  const [showReplySources, setShowReplySources] = useState(false);

  // Слушаем клик по блоку ответа (несколько источников) из MessageBubble
  useEffect(() => {
    const onShow = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.sources?.length) return;
      setReplySources(d.sources);
      setShowReplySources(true);
      setShowPinned(false); // панели взаимоисключающие
    };
    window.addEventListener('show-reply-sources', onShow);
    return () => window.removeEventListener('show-reply-sources', onShow);
  }, []);

  // При переключении чата сбрасываем обе панели
  useEffect(() => {
    setShowPinned(false);
    setPinnedMessages([]);
    setShowReplySources(false);
    setReplySources([]);
  }, [chatId, chatType]);

  useEffect(() => {
    const onGroupUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (chatType === 'group' && Number(detail?.id) === Number(chatId)) {
        if (detail.name) setTitle(detail.name);
        if (detail.avatar_url !== undefined) setAvatar(detail.avatar_url || '');
      }
    };

    const onContactUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        chatType === 'dm' &&
        partnerUserId !== null &&
        Number(detail?.user_id) === Number(partnerUserId)
      ) {
        if (detail.display_name) setTitle(detail.display_name);
      }
    };

    window.addEventListener('group-updated', onGroupUpdated);
    window.addEventListener('contact-updated', onContactUpdated);

    return () => {
      window.removeEventListener('group-updated', onGroupUpdated);
      window.removeEventListener('contact-updated', onContactUpdated);
    };
  }, [chatId, chatType, partnerUserId]);

  useEffect(() => {
    if (!chatId || !currentUser) return;

    const fetchDetails = async () => {
      if (cachedChatData) {
        setTitle(cachedChatData.title || (chatType === 'group' ? 'Группа' : 'Пользователь'));
        setAvatar(cachedChatData.avatarUrl || '');
        setIsOnline(chatType === 'dm');
        
        if (chatType === 'dm') {
          setSubtext('в сети');
          const conversation = cachedChatData.originalData as Conversation;
          const p = conversation?.participants?.find(
            (pp) => Number(pp.id) !== Number(currentUser.id)
          );
          setPartnerUserId(p ? Number(p.id) : null);
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
          const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
          const partner = data.participants.find((p) => Number(p.id) !== Number(currentUser.id));
          
          if (partner && partner.username) {
            setTitle(partner.display_name || partner.username);
            setAvatar(partner.avatar_url || '');
            setPartnerUserId(Number(partner.id));
            setIsOnline(true);
            setSubtext('в сети');
          } else {
            setTitle(partner?.email?.split('@')[0] || 'Пользователь');
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
        console.error('❌ Failed to load header info', e);
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
      const params = chatType === 'dm' ? { conversation_id: chatId } : { group_id: chatId };
      const { data } = await axiosMessenger.get('/pinned', { params });
      setPinnedMessages(data.pinned_messages || []);
    } catch (e) {
      console.error('Failed to load pinned messages', e);
      toast.error('Не удалось загрузить закрепленные');
    } finally {
      setLoadingPinned(false);
    }
  };

  const togglePinned = () => {
    if (!showPinned) loadPinnedMessages();
    setShowPinned(!showPinned);
    // панели взаимоисключающие в ОБЕ стороны.
    setShowReplySources(false);
  };

  const handleInfoUpdated = (info: { kind: 'contact' | 'group'; id: number; name: string; avatar_url?: string }) => {
    if (info.kind === 'contact') {
      setTitle(info.name);
      if (info.avatar_url) setAvatar(info.avatar_url);
    } else if (info.kind === 'group') {
      setTitle(info.name);
      if (info.avatar_url) setAvatar(info.avatar_url);
      window.dispatchEvent(
        new CustomEvent('group-updated', {
          detail: { id: info.id, name: info.name, avatar_url: info.avatar_url }
        })
      );
    }
  };

  const initiateCall = async (callTypeParam: 'audio' | 'video') => {
    if (chatType === 'group') {
      toast.error('Звонки в группах пока не поддерживаются');
      return;
    }
    if (isCalling) return;

    let mediaPromise: Promise<MediaStream> | undefined;
    try {
      mediaPromise = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callTypeParam === 'video',
      });
      mediaPromise.catch(() => {});
    } catch (e) {
      console.error('getUserMedia sync call failed:', e);
      toast.error('Браузер не поддерживает доступ к медиа');
      return;
    }

    setIsCalling(true);

    try {
      let partner: any = null;
      
      if (cachedChatData) {
        const conversation = cachedChatData.originalData as Conversation;
        partner = conversation?.participants?.find(
          (p: any) => Number(p.id) !== Number(currentUser?.id)
        );
      }
      
      if (!partner) {
        const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
        partner = data.participants?.find((p: any) => Number(p.id) !== Number(currentUser?.id));
      }

      if (!partner) {
        toast.error('Не удалось определить собеседника');
        await releaseStream(mediaPromise);
        return;
      }

      console.log('🔔 Initiating call to:', partner.username || partner.id);

      const response = await axiosMessenger.post('/calls', {
        conversation_id: chatId,
        receiver_id: partner.id,
        type: callTypeParam,
      });

      console.log('✅ Call created:', response.data);

      if (response.data?.receiver_online === false) {
        toast('Собеседник не в сети — звонок, скорее всего, не пройдёт', {
          icon: '📴',
          duration: 4000,
        });
      }

      window.dispatchEvent(
        new CustomEvent('open-call-modal', {
          detail: {
            callId: response.data.id,
            partnerId: partner.id,
            partnerName: partner.username || partner.email?.split('@')[0] || 'Пользователь',
            callType: callTypeParam,
            isInitiator: true,
            mediaPromise,
          },
        })
      );
    } catch (error: any) {
      console.error('Failed to initiate call:', error);
      const serverMsg = error?.response?.data?.error;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Не удалось начать звонок');
      }
      await releaseStream(mediaPromise);
    } finally {
      setIsCalling(false);
    }
  };

  const releaseStream = async (promise?: Promise<MediaStream>) => {
    if (!promise) return;
    const stream = await promise.catch(() => null);
    stream?.getTracks().forEach((t) => t.stop());
  };

  return (
    <>
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900 shadow-sm flex-shrink-0">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => setShowInfoModal(true)}
        >
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
                loading
                  ? 'bg-gray-300 dark:bg-gray-700 animate-pulse'
                  : 'bg-gradient-to-r from-blue-400 to-indigo-500'
              }`}
            >
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
              {chatType === 'group' && <UsersIcon size={14} className="text-gray-500" />}
              <h3
                className={`font-bold leading-tight ${
                  loading ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
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
                disabled={loading || isCalling}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                title="Аудиозвонок"
              >
                <Phone size={20} />
              </button>
              <button
                onClick={() => initiateCall('video')}
                disabled={loading || isCalling}
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

      {/* ═══ ПАНЕЛЬ: сообщения, на которые дан ответ ═══ */}
      {showReplySources && (
        <div className="bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 animate-slideDown">
          <div className="px-6 py-3 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Reply size={14} className="text-blue-600 flex-shrink-0" />
                <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  Сообщения, на которые дан ответ ({replySources.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {replySources.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => {
                      // переносим чат к этому сообщению и подсвечиваем
                      window.dispatchEvent(
                        new CustomEvent('scroll-to-message', { detail: { message_id: msg.id } })
                      );
                      setShowReplySources(false);
                    }}
                    className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-blue-50 dark:hover:bg-gray-600 transition-all"
                    title="Перейти к сообщению"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        {msg.sender_username}
                      </p>
                      <p className="text-sm text-gray-900 dark:text-white line-clamp-2 break-words">
                        {msg.content || '📎 Вложение'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowReplySources(false)}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors ml-2"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

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
                      onClick={() => {
                        // переносим чат к этому сообщению и подсвечиваем (flashTarget в ChatArea)
                        window.dispatchEvent(
                          new CustomEvent('scroll-to-message', { detail: { message_id: msg.id } })
                        );
                        setShowPinned(false);
                      }}
                      className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-blue-50 dark:hover:bg-gray-600 transition-all"
                      title="Перейти к сообщению"
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
                          {msg.created_at ? new Date(msg.created_at).toLocaleDateString('ru-RU') : ''}
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

      <ChatInfoModal
        open={showInfoModal}
        chatId={chatId}
        chatType={chatType}
        currentUser={currentUser}
        onClose={() => setShowInfoModal(false)}
        onUpdated={handleInfoUpdated}
      />
    </>
  );
};




// import React, { useEffect, useState } from 'react';
// import axiosMessenger from '@/lib/axiosMessenger';
// import { Conversation, Group, User, ChatPreview } from '@/types/messenger';
// import { Phone, Video, Search, Settings, Pin, X, Users as UsersIcon, Circle } from 'lucide-react';
// import toast from 'react-hot-toast';
// import { CallModal } from './CallModal';

// interface ChatHeaderProps {
//   chatId: number;
//   chatType: 'dm' | 'group';
//   currentUser: User | null;
//   cachedChatData?: ChatPreview;
// }

// interface PinnedMessage {
//   id: number;
//   content: string;
//   sender_username: string;
//   created_at: string;
// }

// export const ChatHeader: React.FC<ChatHeaderProps> = ({
//   chatId,
//   chatType,
//   currentUser,
//   cachedChatData
// }) => {
//   const [title, setTitle] = useState(chatType === 'group' ? 'Группа' : 'Пользователь');
//   const [avatar, setAvatar] = useState('');
//   const [subtext, setSubtext] = useState(chatType === 'group' ? 'участники' : 'загрузка...');
//   const [isOnline, setIsOnline] = useState(false);
//   const [loading, setLoading] = useState(false);
  
//   const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
//   const [showPinned, setShowPinned] = useState(false);
//   const [loadingPinned, setLoadingPinned] = useState(false);

//   // НОВОЕ: Состояние для звонков
//   const [showCallModal, setShowCallModal] = useState(false);
//   const [currentCall, setCurrentCall] = useState<any>(null);

//   useEffect(() => {
//     if (!chatId || !currentUser) return;

//     const fetchDetails = async () => {
//       if (cachedChatData) {
//         console.log('💾 Using cached data:', cachedChatData);
        
//         setTitle(cachedChatData.title || (chatType === 'group' ? 'Группа' : 'Пользователь'));
//         setAvatar(cachedChatData.avatarUrl || '');
//         setIsOnline(chatType === 'dm');
        
//         if (chatType === 'dm') {
//           setSubtext('в сети');
//         } else {
//           const groupData = cachedChatData.originalData as Group;
//           setSubtext(`${groupData.members?.length || 0} участников`);
//         }
        
//         setLoading(false);
//         return;
//       }

//       setLoading(true);
//       try {
//         if (chatType === 'dm') {
//           console.log('🔍 Fetching conversation:', chatId);
//           const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
          
//           console.log('📥 Conversation data:', data);
          
//           const partner = data.participants.find(p => Number(p.id) !== Number(currentUser.id));
          
//           console.log('👤 Partner:', partner);
          
//           if (partner && partner.username) {
//             setTitle(partner.username);
//             setAvatar(partner.avatar_url || '');
//             setIsOnline(true);
//             setSubtext('в сети');
//           } else {
//             setTitle(partner?.email?.split('@')[0] || `User ${partner?.id} || 'Пользователь'`);
//             setAvatar('');
//             setSubtext('информация недоступна');
//           }
//         } else {
//           const { data } = await axiosMessenger.get<Group>(`/groups/${chatId}`);
//           setTitle(data.name || 'Группа');
//           setAvatar(data.avatar_url || '');
//           setIsOnline(false);
//           setSubtext(`${data.members?.length || 0} участников`);
//         }
//       } catch (e) {
//         console.error("❌ Failed to load header info", e);
//         setSubtext(chatType === 'group' ? 'информация недоступна' : 'оффлайн');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchDetails();
//   }, [chatId, chatType, currentUser, cachedChatData]);

//   const loadPinnedMessages = async () => {
//     setLoadingPinned(true);
//     try {
//       const params = chatType === 'dm' 
//         ? { conversation_id: chatId }
//         : { group_id: chatId };
      
//       const { data } = await axiosMessenger.get('/pinned', { params });
//       setPinnedMessages(data.pinned_messages || []);
//     } catch (e) {
//       console.error("Failed to load pinned messages", e);
//       toast.error("Не удалось загрузить закрепленные");
//     } finally {
//       setLoadingPinned(false);
//     }
//   };

//   const togglePinned = () => {
//     if (!showPinned) {
//       loadPinnedMessages();
//     }
//     setShowPinned(!showPinned);
//   };

//   // НОВОЕ: Инициация звонка
//   const initiateCall = async (callTypeParam: 'audio' | 'video') => {
//     if (chatType === 'group') {
//       toast.error("Звонки в группах пока не поддерживаются");
//       return;
//     }

//     try {
//       // ИСПРАВЛЕНО: Правильное получение собеседника
//       let partner: any = null;

//       if (cachedChatData) {
//         const conversation = cachedChatData.originalData as Conversation;
//         partner = conversation?.participants?.find(
//           (p: any) => Number(p.id) !== Number(currentUser?.id)
//         );
//       }

//       if (!partner) {
//         // Если нет в кэше, запрашиваем с сервера
//         const { data } = await axiosMessenger.get<Conversation>(`/conversations/${chatId}`);
//         partner = data.participants?.find(
//           (p: any) => Number(p.id) !== Number(currentUser?.id)
//         );
//       }

//       if (!partner) {
//         toast.error("Не удалось определить собеседника");
//         return;
//       }

//       console.log('🔔 Initiating call to:', partner);

//       // Создаем звонок на бэкенде
//       const response = await axiosMessenger.post('/calls', {
//         conversation_id: chatId,
//         receiver_id: partner.id,
//         type: callTypeParam
//       });

//       console.log('✅ Call created:', response.data);

//       setCurrentCall({
//         id: response.data.id,
//         partnerId: partner.id,
//         partnerName: partner.username || partner.email?.split('@')[0] || 'Пользователь',
//         type: callTypeParam,
//         isInitiator: true
//       });

//       setShowCallModal(true);

//     } catch (error) {
//       console.error('Failed to initiate call:', error);
//       toast.error('Не удалось начать звонок');
//     }
//   };

//   // ИСПРАВЛЕНО: Обработка входящих звонков
//   useEffect(() => {
//     const handleAcceptCall = (event: any) => {
//       const callData = event.detail;
      
//       // Получаем имя партнера из кэша
//       let partnerName = 'Собеседник';
//       if (cachedChatData) {
//         const conversation = cachedChatData.originalData as Conversation;
//         const partner = conversation?.participants?.find(
//           (p: any) => Number(p.id) === Number(callData.partnerId)
//         );
//         partnerName = partner?.username || partner?.email?.split('@')[0] || 'Собеседник';
//       }
      
//       setCurrentCall({
//         id: callData.callId,
//         partnerId: callData.partnerId,
//         partnerName: partnerName,
//         type: callData.callType,
//         isInitiator: callData.isInitiator,
//         offerSdp: callData.offerSdp // ДОБАВЛЕНО
//       });
      
//       setShowCallModal(true);
//     };

//     window.addEventListener('accept-call', handleAcceptCall);
    
//     return () => {
//       window.removeEventListener('accept-call', handleAcceptCall);
//     };
//   }, [cachedChatData]);

//   // ИСПРАВЛЕНО: Обработка закрытия модалки
//   useEffect(() => {
//     const handleCloseCallModal = () => {
//       setShowCallModal(false);
//       setCurrentCall(null);
//     };

//     window.addEventListener('close-call-modal', handleCloseCallModal);
    
//     return () => {
//       window.removeEventListener('close-call-modal', handleCloseCallModal);
//     };
//   }, []);

//   return (
//     <>
//       <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900 shadow-sm flex-shrink-0">
//         <div className="flex items-center gap-3">
//           <div className="relative">
//             <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
//               loading 
//                 ? 'bg-gray-300 dark:bg-gray-700 animate-pulse' 
//                 : 'bg-gradient-to-r from-blue-400 to-indigo-500'
//             }`}>
//               {avatar ? (
//                 <img src={avatar} alt={title} className="w-full h-full object-cover" />
//               ) : (
//                 <span className="text-lg">{title[0]?.toUpperCase() || '?'}</span>
//               )}
//             </div>
            
//             {chatType === 'dm' && isOnline && !loading && (
//               <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
//             )}
//           </div>

//           <div>
//             <div className="flex items-center gap-2">
//               {chatType === 'group' && (
//                 <UsersIcon size={14} className="text-gray-500" />
//               )}
//               <h3 className={`font-bold leading-tight ${
//                 loading 
//                   ? 'text-gray-400 dark:text-gray-600' 
//                   : 'text-gray-900 dark:text-gray-100'
//               }`}>
//                 {title}
//               </h3>
//             </div>
//             <p className="text-xs text-gray-500 flex items-center gap-1">
//               {chatType === 'dm' && isOnline && !loading && (
//                 <Circle size={6} className="fill-green-500 text-green-500" />
//               )}
//               {subtext}
//             </p>
//           </div>
//         </div>

//         <div className="flex items-center space-x-2 text-gray-500">
//           {chatType === 'dm' && (
//             <>
//               <button 
//                 onClick={() => initiateCall('audio')}
//                 disabled={loading}
//                 className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
//                 title="Аудиозвонок"
//               >
//                 <Phone size={20} />
//               </button>
//               <button 
//                 onClick={() => initiateCall('video')}
//                 disabled={loading}
//                 className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
//                 title="Видеозвонок"
//               >
//                 <Video size={20} />
//               </button>
//             </>
//           )}
          
//           <button 
//             className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
//             title="Поиск"
//           >
//             <Search size={20} />
//           </button>
          
//           <button 
//             onClick={togglePinned}
//             disabled={loading}
//             className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
//               showPinned 
//                 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
//                 : 'hover:bg-gray-100 dark:hover:bg-gray-800'
//             }`}
//             title="Закрепленные сообщения"
//           >
//             <Pin size={20} />
//           </button>
          
//           <button 
//             className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
//             title="Настройки"
//           >
//             <Settings size={20} />
//           </button>
//         </div>
//       </div>

//       {showPinned && (
//         <div className="bg-blue-50 dark:bg-gray-800 border-b border-blue-100 dark:border-gray-700 animate-slideDown">
//           <div className="px-6 py-3 flex items-start justify-between">
//             <div className="flex-1 min-w-0">
//               <div className="flex items-center gap-2 mb-2">
//                 <Pin size={14} className="text-blue-600 flex-shrink-0" />
//                 <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">
//                   Закрепленные сообщения ({pinnedMessages.length})
//                 </h4>
//               </div>
              
//               {loadingPinned ? (
//                 <div className="text-sm text-gray-500">Загрузка...</div>
//               ) : pinnedMessages.length === 0 ? (
//                 <div className="text-sm text-gray-500">Нет закрепленных сообщений</div>
//               ) : (
//                 <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
//                   {pinnedMessages.map((msg) => (
//                     <div 
//                       key={msg.id}
//                       className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
//                     >
//                       <div className="flex items-start justify-between gap-2">
//                         <div className="flex-1 min-w-0">
//                           <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
//                             {msg.sender_username}
//                           </p>
//                           <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
//                             {msg.content}
//                           </p>
//                         </div>
//                         <span className="text-[10px] text-gray-400 flex-shrink-0">
//                           {new Date(msg.created_at).toLocaleDateString('ru-RU')}
//                         </span>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
            
//             <button 
//               onClick={() => setShowPinned(false)}
//               className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors ml-2"
//             >
//               <X size={16} className="text-gray-500" />
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Модальное окно звонка */}
//       {showCallModal && currentCall && (
//         <CallModal
//           callId={currentCall.id}
//           isInitiator={currentCall.isInitiator}
//           partnerId={currentCall.partnerId}
//           partnerName={currentCall.partnerName}
//           callType={currentCall.type}
//           offerSdp={currentCall.offerSdp}
//           onClose={() => {
//             setShowCallModal(false);
//             setCurrentCall(null);
//           }}
//         />
//       )}
//     </>
//   );
// };