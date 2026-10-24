// frontend/components/messenger/ChatArea.tsx
import React, { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import { MessageCircleMore, X, Reply, Forward, Copy, Pin, Trash2, ArrowDown } from 'lucide-react';
import { Message, User } from '@/types/messenger';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ForwardModal } from './ForwardModal';
import { ChatInfoModal } from './ChatInfoModal';
import toast from 'react-hot-toast';

interface ChatAreaProps {
  chatId: number | null;
  chatType: 'dm' | 'group' | null;
  messages: Message[];
  currentUser: User | null;
  storedLastReadId: number;
  onSendMessage: (text: string, replyToId?: number, attachments?: File[], replyToIds?: number[]) => void;
  onPinMessage?: (msgId: number) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMessages: boolean;
  onForwardMessage?: (
    message: Message | Message[],
    targets: { id: number; type: 'dm' | 'group' }[],
    comment?: string,
    showSender?: boolean
  ) => void;
  onEditMessage?: (messageId: number, newContent: string) => void;
  onDeleteMessage?: (messageId: number, deleteForBoth: boolean) => void;
  // ИЗМЕНЕНО: передаём id/тип чата, чтобы flush при переключении чата
  // пометил прочитанным ИМЕННО тот чат, где сообщения были увидены
  onMarkRead?: (messageId: number, chatId: number, chatType: 'dm' | 'group') => void;
}

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
  storedLastReadId,
  onSendMessage,
  onPinMessage,
  isSidebarOpen,
  onToggleSidebar,
  onLoadMore,
  hasMore,
  isLoadingMessages,
  onForwardMessage,
  onEditMessage,
  onDeleteMessage,
  onMarkRead,
}) => {
  const [replyingTo, setReplyingTo] = useState<Message | Message[] | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showPinnedList, setShowPinnedList] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);

  // Пересылка
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardMessages, setForwardMessages] = useState<Message[] | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // ═══ МУЛЬТИВЫБОР ═══
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const uniqueMessages = useMemo(() => {
    const seen = new Set<number>();
    return messages.filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  // ═══ ТРЕКЕР ПРОЧУТКОВ: какие сообщения пользователь реально видел ═══
  const seenIdsRef = useRef<Set<number>>(new Set());
  const lastMarkedReadRef = useRef<number>(0);
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // НОВОЕ: ссылка на doMark для форсированной пометки из handleScroll
  const markSeenRef = useRef<() => void>(() => {});
  const onMarkReadRef = useRef(onMarkRead);
  useEffect(() => { onMarkReadRef.current = onMarkRead; }, [onMarkRead]);
  const uniqueRef = useRef<Message[]>([]);
  useEffect(() => { uniqueRef.current = uniqueMessages; }, [uniqueMessages]);
  const chatRef = useRef<{ id: number | null; type: string | null }>({ id: null, type: null });
  useEffect(() => { chatRef.current = { id: chatId, type: chatType }; }, [chatId, chatType]);

  // Разделитель «Новые сообщения»
  const [unreadAnchorId, setUnreadAnchorId] = useState<number | null>(null);
  const anchorResolvedChatRef = useRef<number | null>(null);

  // ═══ НОВОЕ: кнопка «Вниз» ═══
  const [showScrollDown, setShowScrollDown] = useState(false);

  // пользователя удалили из этой группы
  const [removedFromGroup, setRemovedFromGroup] = useState(false);

  // запоминание позиции скролла для каждого чата
  // key: `${chatType}_${chatId}` → якорное сообщение + его смещение от верха контейнера
  const scrollPositionsRef = useRef<Record<string, { anchorId: number; offset: number } | null>>({});
  const bottomScrolledForRef = useRef<string | null>(null);
  const chatKey = chatId && chatType ? `${chatType}_${chatId}` : null;
  // Флаг: при ТЕКУЩЕМ входе в чат позиция уже восстановлена
  // (чтобы авто-скролл к плашке её не перезаписывал)
  const restoredForEntryRef = useRef<string | null>(null);

  // Флаг «пользователь реально крутил колесо/палец» — программный scrollIntoView
  // не должен гасить плашку «Новые сообщения»
  const userInteractedRef = useRef(false);

  // Модалка информации о ПОЛЬЗОВАТЕЛЕ (клик по аватару/имени в группе)
  const [infoUserId, setInfoUserId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [prevHeight, setPrevHeight] = useState(0);

  const currentChatPinned = useMemo(() => uniqueMessages.filter((m) => m.is_pinned), [uniqueMessages]);

  useEffect(() => {
    const handleClickGlobal = () => {
      setActiveMenuId(null);
      setMenuCoords(null);
    };
    window.addEventListener('click', handleClickGlobal);
    return () => window.removeEventListener('click', handleClickGlobal);
  }, []);

  // Сообщения действительно принадлежат текущему чату?
  // Защита от «транзиентного» рендера: при переключении чата старые сообщения
  // на долю секунды остаются в props, а chatId уже новый.
  const messagesBelong = useMemo(() => {
    if (uniqueMessages.length === 0 || !chatId) return false;
    const first: any = uniqueMessages[0];
    return chatType === 'dm'
      ? Number(first.conversation_id) === Number(chatId)
      : Number(first.group_id) === Number(chatId);
  }, [uniqueMessages, chatId, chatType]);

  // СБРОС состояния при переключении чатов
  // Без этого плашка «не всегда появлялась»: anchorResolvedChatRef мог
  // остаться от прошлого чата, если промежуточный чат не успел зарезолвиться.
  useEffect(() => {
    anchorResolvedChatRef.current = null;
    restoredForEntryRef.current = null;
    bottomScrolledForRef.current = null;
    userInteractedRef.current = false;
    setUnreadAnchorId(null);
    // НОВОЕ: сброс трекера и режима выделения
    seenIdsRef.current = new Set();
    lastMarkedReadRef.current = 0;
    setSelectionMode(false);
    setSelectedIds([]);
  }, [chatId, chatType]);

  // Определяем первое непрочитанное сообщение ОДИН РАЗ при загрузке истории чата
  useEffect(() => {
    if (!chatId) return;
    if (anchorResolvedChatRef.current === chatId) return;
    if (!messagesBelong || uniqueMessages.length === 0) return;

    anchorResolvedChatRef.current = chatId;
    const firstUnread = uniqueMessages.find(
      (m) =>
        m.id > storedLastReadId &&
        Number(m.sender_id) !== Number(currentUser?.id) &&
        !m.is_system_message // системные плашки не считаются «новыми сообщениями»
    );
    setUnreadAnchorId(firstUnread ? firstUnread.id : null);
    userInteractedRef.current = false;
  }, [chatId, messagesBelong, uniqueMessages, storedLastReadId, currentUser]);

  // ═══ ТРЕКЕР ВИДИМОСТИ: IntersectionObserver на сообщениях ═══
  // Как только сообщение реально попало в область просмотра — оно считается
  // прочитанным (как вы и предложили, но без новой колонки: last_read_message_id
  // двигается вперёд с точностью до сообщения)
  useEffect(() => {
    if (!chatId || !messagesBelong || uniqueMessages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const doMark = () => {
      markTimerRef.current = null;
      const msgs = uniqueRef.current;
      if (msgs.length === 0) return;
      const latestId = msgs[msgs.length - 1].id;
      let maxSeen = 0;
      seenIdsRef.current.forEach((id) => {
        if (id <= latestId && id > maxSeen) maxSeen = id;
      });
      const chat = chatRef.current;
      if (maxSeen > 0 && maxSeen > lastMarkedReadRef.current && chat.id && chat.type) {
        lastMarkedReadRef.current = maxSeen;
        onMarkReadRef.current?.(maxSeen, chat.id, chat.type as 'dm' | 'group');
      }
      // Увидел ВСЁ новое → гасим плашку и бейдж в сайдбаре
      if (maxSeen >= latestId) {
        setUnreadAnchorId(null);
        window.dispatchEvent(new CustomEvent('chat-read', {
          detail: { chat_id: chat.id, chat_type: chat.type },
        }));
      }
    };

    const scheduleMark = () => {
      if (markTimerRef.current) clearTimeout(markTimerRef.current);
      markTimerRef.current = setTimeout(doMark, 400);
    };

    markSeenRef.current = doMark;

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const en of entries) {
          if (en.isIntersecting) {
            const id = Number((en.target as HTMLElement).dataset.messageId);
            if (id && !seenIdsRef.current.has(id)) {
              seenIdsRef.current.add(id);
              changed = true;
            }
          }
        }
        if (changed) scheduleMark();
      },
      // ФИКС: 0.5 не достигалось для высоких сообщений (длинный текст/фото)
      // → они никогда не помечались прочитанными
      { root: container, threshold: 0.25 }
    );

    container.querySelectorAll('[data-message-id]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      // ═══ КЛЮЧЕВОЙ ФИКС: не выбрасываем отложенную пометку, а ОТПРАВЛЯЕМ её.
      // Раньше cleanup убивал pending-таймер при переключении чата →
      // POST /read терялся → last_read в БД оставался старым →
      // плашка «Новые сообщения» появлялась при каждом входе.
      // cleanup выполняется ДО обновления chatRef, поэтому doMark
      // отправит пометку для правильного (старого) чата.
      if (markTimerRef.current) {
        clearTimeout(markTimerRef.current);
        doMark();
      }
      markSeenRef.current = () => {};
    };
  }, [chatId, messagesBelong, uniqueMessages.length]);

  // Скроллим к разделителю — ТОЛЬКО если не восстанавливали сохранённую позицию
  useEffect(() => {
    if (unreadAnchorId === null) return;
    if (chatKey && restoredForEntryRef.current === chatKey) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${unreadAnchorId}"]`);
      el?.scrollIntoView({ behavior: 'auto', block: 'center' });
    }, 60);
    return () => clearTimeout(t);
  }, [unreadAnchorId, chatKey]);


  // ═══ Восстановление позиции скролла ИЛИ скролл вниз при первом входе ═══
  useLayoutEffect(() => {
    if (!chatKey || !messagesBelong || uniqueMessages.length === 0 || prevHeight > 0) return;

    const container = scrollContainerRef.current;

    // 1. Есть сохранённая позиция — восстанавливаем по якорному сообщению
    if (chatKey in scrollPositionsRef.current && container) {
      const saved = scrollPositionsRef.current[chatKey];
      if (saved) {
        const restore = () => {
          const el = container.querySelector(`[data-message-id="${saved.anchorId}"]`);
          if (!el) return false;
          const cRect = container.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          container.scrollTop += (eRect.top - cRect.top) - saved.offset;
          return true;
        };
        if (restore()) {
          restoredForEntryRef.current = chatKey;
          // Повторяем через 250мс: картинки/видео могут загрузиться позже
          // и сместить контент (из-за этого раньше «кидало вверх»)
          const t = setTimeout(restore, 250);
          return () => clearTimeout(t);
        }
      }
      // Якорь не найден — удаляем и падаем на скролл вниз
      delete scrollPositionsRef.current[chatKey];
    }

    // 2. Первый вход в чат — скролл вниз один раз
    if (bottomScrolledForRef.current === chatKey) return;
    bottomScrolledForRef.current = chatKey;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
  }, [chatKey, messagesBelong, uniqueMessages.length, prevHeight]);

  // ═══ НОВОЕ: клик по закреплённому сообщению в ChatHeader → скролл + подсветка ═══
  useEffect(() => {
    const onScrollToMessage = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.message_id);
      if (id) flashTarget(id);
    };
    window.addEventListener('scroll-to-message', onScrollToMessage);
    return () => window.removeEventListener('scroll-to-message', onScrollToMessage);
  }, [hasMore, isLoadingMessages]);

  // ═══ НОВОЕ: сброс флага «удалён из группы» при смене чата ═══
  useEffect(() => {
    setRemovedFromGroup(false);
  }, [chatId, chatType]);

  // ═══ НОВОЕ: WS-событие «вас удалили из группы» ═══
  useEffect(() => {
    const onRemoved = (e: Event) => {
      const gid = Number((e as CustomEvent).detail?.group_id);
      if (chatType === 'group' && Number(chatId) === gid) {
        setRemovedFromGroup(true);
      }
    };
    window.addEventListener('removed-from-group', onRemoved);
    return () => window.removeEventListener('removed-from-group', onRemoved);
  }, [chatId, chatType]);

  // ═══ НОВОЕ: сохранение позиции — первое видимое сообщение + offset ═══
  const saveScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container || !chatKey || !messagesBelong) return;
    const containerRect = container.getBoundingClientRect();
    const elems = container.querySelectorAll('[data-message-id]');
    for (const el of Array.from(elems)) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > containerRect.top + 1) {
        scrollPositionsRef.current[chatKey] = {
          anchorId: Number((el as HTMLElement).dataset.messageId),
          offset: rect.top - containerRect.top,
        };
        return;
      }
    }
    scrollPositionsRef.current[chatKey] = null;
  };

  // useLayoutEffect(() => {
  //   if (uniqueMessages.length > 0 && prevHeight === 0) {
  //     setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
  //   }
  // }, [chatId, uniqueMessages.length, prevHeight]);

  useLayoutEffect(() => {
    if (prevHeight > 0 && scrollContainerRef.current) {
      const newHeight = scrollContainerRef.current.scrollHeight;
      const diff = newHeight - prevHeight;
      scrollContainerRef.current.scrollTop = diff;
      setPrevHeight(0);
    }
  }, [uniqueMessages.length, prevHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      saveScrollPosition();

      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollDown(distanceToBottom > 300);

      if (scrollTop < 50 && hasMore && !isLoadingMessages) {
          setPrevHeight(scrollHeight);
          onLoadMore();
      }

      // ═══ СТРАХОВКА: пользователь сам докрутил до низа → всё прочитано.
      // Работает даже если IntersectionObserver не сработал (высокие
      // сообщения, быстрый скролл). Программный автоскролл не считается
      // (userInteractedRef), поэтому плашка при входе не гаснет мгновенно.
      if (userInteractedRef.current && distanceToBottom < 100) {
          const msgs = uniqueRef.current;
          if (msgs.length > 0) {
              seenIdsRef.current.add(msgs[msgs.length - 1].id);
          }
          if (markTimerRef.current) {
              clearTimeout(markTimerRef.current);
              markTimerRef.current = null;
          }
          markSeenRef.current();
      }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ═══ НОВОЕ: восстановление позиции скролла ИЛИ скролл вниз при первом входе ═══
  useLayoutEffect(() => {
    if (!chatKey || !messagesBelong || uniqueMessages.length === 0 || prevHeight > 0) return;

    const container = scrollContainerRef.current;

    // 1. Есть сохранённая позиция для этого чата — восстанавливаем
    if (chatKey in scrollPositionsRef.current && container) {
      const saved = scrollPositionsRef.current[chatKey];
      if (saved) {
        const el = container.querySelector(`[data-message-id="${saved.anchorId}"]`);
        if (el) {
          const cRect = container.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          container.scrollTop += (eRect.top - cRect.top) - saved.offset;
          return;
        }
      }
      // Восстановить не удалось (сообщение не загружено) — скатываемся вниз
      delete scrollPositionsRef.current[chatKey];
    }

    // 2. Первый вход в чат — скролл вниз один раз
    if (bottomScrolledForRef.current === chatKey) return;
    bottomScrolledForRef.current = chatKey;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
  }, [chatKey, messagesBelong, uniqueMessages.length, prevHeight]);

  // ═══ НОВОЕ: кнопка «Удалить группу» (после удаления из группы) ═══
  const handleRemoveGroupFromList = () => {
    window.dispatchEvent(new CustomEvent('group-left', { detail: { group_id: chatId } }));
  };

  const handleOpenContextMenu = (e: React.MouseEvent, msgId: number) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.pageX;
    let y = e.pageY;
    if (x + 210 > window.innerWidth) x = window.innerWidth - 220;
    if (y + 300 > window.innerHeight) y = Math.max(10, window.innerHeight - 310);

    setActiveMenuId(msgId);
    setMenuCoords({ x, y });
  };

  const handleForward = (msg: Message) => {
    setForwardMessages([msg]);
    setShowForwardModal(true);
  };

  const handleForwardConfirm = (
    targets: { id: number; type: 'dm' | 'group' }[],
    comment?: string,
    showSender?: boolean
  ) => {
    if (forwardMessages && forwardMessages.length > 0 && onForwardMessage) {
      onForwardMessage(
        forwardMessages.length === 1 ? forwardMessages[0] : forwardMessages,
        targets, comment, showSender
      );
    }
    setShowForwardModal(false);
    setForwardMessages(null);
  };

  const onSendWrapper = (text: string, replyToId?: number, files?: File[], replyToIds?: number[]) => {
    onSendMessage(text, replyToId, files, replyToIds);
    setReplyingTo(null);
    setEditingMessage(null);
    setUnreadAnchorId(null); // отправил сообщение → точно всё увидел
  };

  // ═══ МУЛЬТИВЫБОР: действия ═══
  const enterSelection = (msg: Message) => {
    setSelectionMode(true);
    setSelectedIds([msg.id]);
  };
  const toggleSelect = (msgId: number) => {
    setSelectedIds((prev) =>
      prev.includes(msgId) ? prev.filter((x) => x !== msgId) : [...prev, msgId]
    );
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const selectedMessages = useMemo(
    () => uniqueMessages.filter((m) => selectedIds.includes(m.id)),
    [uniqueMessages, selectedIds]
  );

  const handleCopySelected = () => {
    const text = selectedMessages.map((m) => m.content).filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success(`Скопировано сообщений: ${selectedMessages.length}`);
    exitSelection();
  };

  const handleDeleteSelected = () => {
    if (!window.confirm(`Удалить выбранные сообщения (${selectedIds.length})?`)) return;
    selectedIds.forEach((id) => onDeleteMessage?.(id, true));
    toast.success('Сообщения удалены');
    exitSelection();
  };

  const handlePinSelected = () => {
    selectedIds.forEach((id) => onPinMessage?.(id));
    toast.success(`Закреплено сообщений: ${selectedIds.length}`);
    exitSelection();
  };

  const handleForwardSelected = () => {
    if (selectedMessages.length === 0) return;
    setForwardMessages(selectedMessages);
    setShowForwardModal(true);
    exitSelection();
  };

  const handleReplySelected = () => {
    setReplyingTo(selectedMessages.length === 1 ? selectedMessages[0] : selectedMessages);
    exitSelection();
  };

  // Источник(и) для блока «Ответ»: поддержка reply_to_id и reply_to_ids
  const getReplySources = (m: Message) => {
    const ids: number[] = [];
    if (Array.isArray(m.reply_to_ids)) {
      ids.push(...m.reply_to_ids.map(Number));
    } else if (typeof m.reply_to_ids === 'string' && m.reply_to_ids.trim()) {
      ids.push(...m.reply_to_ids.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean));
    }
    if (m.reply_to_id && !ids.includes(m.reply_to_id)) ids.push(m.reply_to_id);
    if (ids.length === 0) return [];

    return ids
      .map((id) => {
        const found = uniqueMessages.find((x) => x.id === id);
        if (found) {
          return {
            id: found.id,
            content: found.content,
            sender_id: found.sender_id,
            sender_username: found.sender_username || found.sender?.username,
            attachment_type: found.attachment_type,
          };
        }
        const pv = (m.reply_previews || []).find((p) => p.id === id);
        if (pv) return pv;
        if (m.reply_preview && m.reply_preview.id === id) return m.reply_preview;
        return null;
      })
      .filter(Boolean) as any[];
  };

  // Клик по аватару/имени отправителя → модалка пользователя (type=user)
  const handleSenderClick = (senderId: number) => {
    if (Number(senderId) === Number(currentUser?.id)) return; // себя не открываем
    setInfoUserId(senderId);
  };

  // ═══ Клик по блоку ответа → скролл к оригиналу + подсветка миганием ═══
  const flashTarget = (targetId: number, attempt = 0) => {
    const wrapper = document.querySelector(`[data-message-id="${targetId}"]`);
    if (!wrapper) {
      // Оригинал ещё не загружен (старая история) — подгружаем и пробуем ещё раз
      if (attempt === 0 && hasMore && !isLoadingMessages) {
        onLoadMore();
        setTimeout(() => flashTarget(targetId, 1), 900);
      }
      return;
    }
    const bubble = (wrapper.querySelector('.msg-bubble') as HTMLElement) || (wrapper as HTMLElement);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // перезапуск анимации мигания (2 вспышки за 1.6с)
    bubble.classList.remove('message-flash');
    void bubble.offsetWidth; // reflow для рестарта animation
    bubble.classList.add('message-flash');
    window.setTimeout(() => bubble.classList.remove('message-flash'), 2000);
  };

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
    <div className="flex flex-col h-full bg-gradient-to-br from-[#1d4ed8] via-[#1e3a8a] to-[#172554] dark:from-[#172554] dark:via-[#0c1a3d] dark:to-[#020617] relative overflow-hidden">

      {/* ═══ ПАНЕЛЬ МУЛЬТИВЫБОРА ═══ */}
      {selectionMode && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md px-4 py-3 flex items-center gap-3 animate-fadeIn">
          <button onClick={exitSelection} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Отмена">
            <X size={20} />
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            Выбрано: {selectedIds.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={handleReplySelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Ответить">
              <Reply size={18} />
            </button>
            <button onClick={handleForwardSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Переслать">
              <Forward size={18} />
            </button>
            <button onClick={handleCopySelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Скопировать">
              <Copy size={18} />
            </button>
            <button onClick={handlePinSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Закрепить">
              <Pin size={18} />
            </button>
            <button onClick={handleDeleteSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 disabled:opacity-40" title="Удалить">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Анимация подсветки сообщения при переходе по ответу */}
      <style>{`
        @keyframes messageFlash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
          20%, 60% { box-shadow: 0 0 0 4px rgba(59,130,246,0.6); }
          40%, 80% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        .message-flash { animation: messageFlash 1.6s ease-in-out; border-radius: 1rem; }
      `}</style>

      {/* Закрепленные */}
      {showPinnedList && currentChatPinned.length > 0 && (
        <div className="bg-blue-50 dark:bg-gray-800 p-2 border-b border-blue-100 dark:border-gray-700 max-h-32 overflow-y-auto z-10">
          {currentChatPinned.map((m) => (
            <div key={m.id} className="text-sm p-2 bg-white dark:bg-gray-700 rounded mb-1 cursor-pointer shadow-sm">
              <span className="font-bold text-blue-600 mr-2">Закреплено:</span>
              {m.content}
            </div>
          ))}
        </div>
      )}

      {/* Список сообщений */}
      <div
        className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={() => { userInteractedRef.current = true; }}
        onTouchMove={() => { userInteractedRef.current = true; }}
      >
        {isLoadingMessages && uniqueMessages.length === 0 && (
          <div className="text-center p-4 text-gray-400">Загрузка...</div>
        )}
        {isLoadingMessages && hasMore && uniqueMessages.length > 0 && (
          <div className="text-center py-2 text-xs text-gray-400">Подгрузка истории...</div>
        )}

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

              {/* ═══ РАЗДЕЛИТЕЛЬ «НОВЫЕ СООБЩЕНИЯ» ═══ */}
              {unreadAnchorId === msg.id && (
                <div className="flex items-center justify-center gap-3 my-3 select-none">
                  <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
                    <span className="bg-gray-300/90 dark:bg-gray-600/90 text-gray-700 dark:text-gray-100 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm backdrop-blur-sm whitespace-nowrap">
                      Новые сообщения
                    </span>
                  <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600"></div>
                </div>
              )}

              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`} data-message-id={msg.id}>
                <div className={`max-w-[85%] md:max-w-[70%] ${selectionMode ? 'w-full max-w-full flex' : ''} ${isMe && selectionMode ? 'justify-end' : ''}`}>
                  <MessageBubble
                    msg={msg}
                    isMe={isMe}
                    senderName={!isMe && chatType === 'group' ? (msg.sender_username || msg.sender?.display_name || msg.sender?.username) : undefined}
                    senderAvatar={!isMe && chatType === 'group' ? (msg.sender_avatar || msg.sender?.avatar_url) : undefined}
                    senderId={!isMe ? msg.sender_id : undefined}
                    currentUserId={Number(currentUser.id)}
                    time={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    menuPosition={!selectionMode && activeMenuId === msg.id ? menuCoords : null}
                    onContextMenu={handleOpenContextMenu}
                    closeMenu={() => { setActiveMenuId(null); setMenuCoords(null); }}
                    onReply={(m) => setReplyingTo(m)}
                    onPin={(m) => onPinMessage && onPinMessage(m.id)}
                    onEdit={(m) => setEditingMessage(m)}
                    onDelete={(id, forBoth) => onDeleteMessage?.(id, forBoth)}
                    onForward={handleForward}
                    replySources={getReplySources(msg)}
                    onSenderClick={chatType === 'group' ? handleSenderClick : undefined}
                    onReplyClick={flashTarget}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.includes(msg.id)}
                    onToggleSelect={toggleSelect}
                    onEnterSelection={enterSelection}
                  />
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ═══ НОВОЕ: плашка «Вас удалили из этой группы» ═══ */}
        {removedFromGroup && (
          <div className="flex justify-center py-2 flex-none">
            <span className="bg-gray-300/90 dark:bg-gray-600/90 text-gray-700 dark:text-gray-100 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
              Вас удалили из этой группы
            </span>
          </div>
        )}

        {/* ═══ КНОПКА «ВНИЗ» ═══ */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            title="Вниз"
            className="absolute bottom-36 right-6 z-30 p-3 rounded-full bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all animate-fadeIn"
          >
            <ArrowDown size={20} />
          </button>
        )}

        {/* INPUT AREA — заменён на кнопку «Удалить группу», если вас удалили */}
        {/* скрыт в режиме выделения */}
        {removedFromGroup ? (
          <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 flex-none w-full z-20">
            <button
              onClick={handleRemoveGroupFromList}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
            >
              Удалить группу
            </button>
          </div>
        ) : !selectionMode ? (
          <ChatInput
            onSendMessage={onSendWrapper}
            onEditMessage={onEditMessage}
            replyingTo={replyingTo}
            editingMessage={editingMessage}
            onCancelReply={() => {
              setReplyingTo(null);
              setEditingMessage(null);
            }}
          />
        ) : null}

      {/* INPUT AREA */}
      {/* <ChatInput
        onSendMessage={onSendWrapper}
        onEditMessage={onEditMessage}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onCancelReply={() => {
          setReplyingTo(null);
          setEditingMessage(null);
        }}
      /> */}

      {/* Модалка пересылки (одно или несколько сообщений) */}
      <ForwardModal
        open={showForwardModal}
        messages={forwardMessages}
        currentUser={currentUser}
        onClose={() => {
          setShowForwardModal(false);
          setForwardMessages(null);
        }}
        onForward={handleForwardConfirm}
      />

      {/* Модалка информации о пользователе (клик по участнику/аватару в группе) */}
      {infoUserId !== null && (
        <ChatInfoModal
          open={true}
          chatId={infoUserId}
          chatType="user"
          currentUser={currentUser}
          onClose={() => setInfoUserId(null)}
          onUpdated={() => { /* имя обновится через WS contact_updated */ }}
        />
      )}
    </div>
  );
};