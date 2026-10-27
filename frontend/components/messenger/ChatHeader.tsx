// frontend/components/messenger/ChatHeader.tsx
import React, { useEffect, useState } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import { Conversation, Group, User, ChatPreview } from '@/types/messenger';
import { Phone, Video, Search, Settings, Pin, X, Users as UsersIcon, Circle, Hash, Reply } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChatInfoModal } from './ChatInfoModal';
import { resolveMediaUrl } from '@/lib/mediaUrl';

interface ChatHeaderProps {
  chatId: number;
  chatType: 'dm' | 'group' | 'channel';
  currentUser: User | null;
  cachedChatData?: ChatPreview;
  channelName?: string;         // имя канала (channel-режим)
  onToggleMembers?: () => void; // кнопка «Участники сервера» (channel-режим)
  membersVisible?: boolean;
}

interface PinnedMessage {
  id: number;
  content: string;
  sender_username: string;
  created_at: string;
}

interface ReplySourcePreview {
  id: number;
  content: string;
  sender_username: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chatId,
  chatType,
  currentUser,
  cachedChatData,
  channelName,
  onToggleMembers,
  membersVisible,
}) => {
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState('');
  const [subtext, setSubtext] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingPinned, setLoadingPinned] = useState(false);

  const [replySources, setReplySources] = useState<ReplySourcePreview[]>([]);
  const [showReplySources, setShowReplySources] = useState(false);

  const [isCalling, setIsCalling] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [partnerUserId, setPartnerUserId] = useState<number | null>(null);

  // ─── Сброс панелей при переключении чата ───
  useEffect(() => {
    setShowPinned(false);
    setPinnedMessages([]);
    setShowReplySources(false);
    setReplySources([]);
  }, [chatId, chatType]);

  // ─── Панель мульти-ответов: клик по блоку ответа в MessageBubble ───
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

  // ─── Live-обновление имени группы / контакта ───
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
      if (chatType === 'dm' && partnerUserId !== null && Number(detail?.user_id) === Number(partnerUserId)) {
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

  // ─── Загрузка данных шапки ───
  useEffect(() => {
    if (!chatId || !currentUser) return;

    const fetchDetails = async () => {
      // КАНАЛ: всё из пропсов, без API
      if (chatType === 'channel') {
        setTitle(channelName || 'Канал');
        setAvatar('');
        setIsOnline(false);
        setSubtext('текстовый канал');
        setLoading(false);
        return;
      }

      if (cachedChatData) {
        setTitle(cachedChatData.title || (chatType === 'group' ? 'Группа' : 'Пользователь'));
        setAvatar(cachedChatData.avatarUrl || '');
        setIsOnline(chatType === 'dm');
        if (chatType === 'dm') {
          setSubtext('в сети');
          const conversation = cachedChatData.originalData as Conversation;
          const p = conversation?.participants?.find((pp) => Number(pp.id) !== Number(currentUser.id));
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
          if (partner) {
            setTitle(partner.display_name || partner.username);
            setAvatar(partner.avatar_url || '');
            setPartnerUserId(Number(partner.id));
            setIsOnline(true);
            setSubtext('в сети');
          } else {
            setTitle('Пользователь');
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
  }, [chatId, chatType, currentUser, cachedChatData, channelName]);

  // ─── Закреплённые сообщения (индивидуально для каждого чата/канала) ───
  const loadPinnedMessages = async () => {
    setLoadingPinned(true);
    try {
      const params =
        chatType === 'dm' ? { conversation_id: chatId }
        : chatType === 'group' ? { group_id: chatId }
        : { channel_id: chatId };
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
    setShowReplySources(false);
  };

  const scrollToMessage = (messageId: number) => {
    window.dispatchEvent(new CustomEvent('scroll-to-message', { detail: { message_id: messageId } }));
  };

  // ─── Звонки (только DM) ───
  const releaseStream = async (promise?: Promise<MediaStream>) => {
    if (!promise) return;
    const stream = await promise.catch(() => null);
    stream?.getTracks().forEach((t) => t.stop());
  };

  const initiateCall = async (callTypeParam: 'audio' | 'video') => {
    if (chatType !== 'dm' || isCalling) return;

    let mediaPromise: Promise<MediaStream> | undefined;
    try {
      mediaPromise = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callTypeParam === 'video',
      });
      mediaPromise.catch(() => {});
    } catch (e) {
      console.error('getUserMedia failed:', e);
      toast.error('Браузер не поддерживает доступ к медиа');
      return;
    }

    setIsCalling(true);
    try {
      let partner: any = null;
      if (cachedChatData) {
        const conversation = cachedChatData.originalData as Conversation;
        partner = conversation?.participants?.find((p: any) => Number(p.id) !== Number(currentUser?.id));
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

      const response = await axiosMessenger.post('/calls', {
        conversation_id: chatId,
        receiver_id: partner.id,
        type: callTypeParam,
      });

      if (response.data?.receiver_online === false) {
        toast('Собеседник не в сети — звонок, скорее всего, не пройдёт', { icon: '📴', duration: 4000 });
      }

      window.dispatchEvent(
        new CustomEvent('open-call-modal', {
          detail: {
            callId: response.data.id,
            partnerId: partner.id,
            partnerName: partner.display_name || partner.username || 'Пользователь',
            callType: callTypeParam,
            isInitiator: true,
            mediaPromise,
          },
        })
      );
    } catch (error: any) {
      console.error('Failed to initiate call:', error);
      toast.error(error?.response?.data?.error || 'Не удалось начать звонок');
      await releaseStream(mediaPromise);
    } finally {
      setIsCalling(false);
    }
  };

  const handleInfoUpdated = (info: { kind: 'contact' | 'group'; id: number; name: string; avatar_url?: string }) => {
    if (info.kind === 'contact') {
      setTitle(info.name);
      if (info.avatar_url) setAvatar(info.avatar_url);
    } else if (info.kind === 'group') {
      setTitle(info.name);
      if (info.avatar_url) setAvatar(info.avatar_url);
    }
  };

  return (
    <>
      {/* ═══════════ ШАПКА ═══════════ */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900 shadow-sm flex-shrink-0">
        {/* ХИТБОКС: клик → модалка информации (работает и для канала) */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors min-w-0"
          onClick={() => setShowInfoModal(true)}
          title="Открыть информацию"
        >
          {chatType === 'channel' ? (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 flex-shrink-0">
              <Hash size={18} />
            </div>
          ) : (
            <div className="relative flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
                  loading ? 'bg-gray-300 dark:bg-gray-700 animate-pulse' : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                }`}
              >
                {avatar ? (
                  <img src={resolveMediaUrl(avatar)} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{title?.[0]?.toUpperCase() || '?'}</span>
                )}
              </div>
              {chatType === 'dm' && isOnline && !loading && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
              )}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {chatType === 'group' && <UsersIcon size={14} className="text-gray-500 flex-shrink-0" />}
              {chatType === 'channel' && <Hash size={14} className="text-gray-500 flex-shrink-0" />}
              <h3
                className={`font-bold leading-tight truncate ${
                  loading ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {chatType === 'channel' ? title : title}
              </h3>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
              {chatType === 'dm' && isOnline && !loading && (
                <Circle size={6} className="fill-green-500 text-green-500 flex-shrink-0" />
              )}
              {subtext}
            </p>
          </div>
        </div>

        {/* КНОПКИ — ЕДИНСТВЕННЫЙ НАБОР (без дублей) */}
        <div className="flex items-center space-x-2 text-gray-500 flex-shrink-0">
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

          {chatType === 'channel' && onToggleMembers && (
            <button
              onClick={onToggleMembers}
              className={`p-2 rounded-lg transition-colors ${
                membersVisible
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
              }`}
              title="Участники сервера"
            >
              <UsersIcon size={20} />
            </button>
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
              showPinned ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Закрепленные сообщения"
          >
            <Pin size={20} />
          </button>

          {chatType !== 'channel' && (
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Настройки"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ═══════════ ПАНЕЛЬ: СООБЩЕНИЯ, НА КОТОРЫЕ ДАН ОТВЕТ (не закрывается при клике) ═══════════ */}
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
                    onClick={() => scrollToMessage(msg.id)}
                    className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-blue-50 dark:hover:bg-gray-600 transition-all"
                    title="Перейти к сообщению"
                  >
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {msg.sender_username}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-2 break-words">
                      {msg.content || '📎 Вложение'}
                    </p>
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

      {/* ═══════════ ПАНЕЛЬ: ЗАКРЕПЛЁННЫЕ (клик → к сообщению, панель закрывается) ═══════════ */}
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
                        scrollToMessage(msg.id);
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
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2 break-words">
                            {msg.content || '📎 Вложение'}
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

      {/* ═══════════ МОДАЛКА ИНФОРМАЦИИ (dm / group / channel) ═══════════ */}
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