// components/messenger/ChatArea.tsx
import React, { useRef, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Plus, MessageCircleMore, Search, Settings, Users, X, Pin, Image as ImageIcon, FileText, Paperclip, Mic, Smile, CheckCheck, Reply, Copy, Trash2, Edit2, Forward, Languages } from 'lucide-react';
import { Message, Conversation, User } from '@/types/messenger';
import { MessageBubble } from './MessageBubble';
import toast from 'react-hot-toast';

const MAX_MESSAGE_LENGTH = 4096;

interface ChatAreaProps {
  activeChat: Conversation | null;
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
  activeChat,
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
  const [messageContent, setMessageContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Контекстное меню
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{x: number, y: number} | null>(null);

  // Вложения и Аудио
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prevHeight, setPrevHeight] = useState(0);

  // Фильтр дубликатов
  const uniqueMessages = useMemo(() => {
      const seen = new Set();
      return messages.filter(msg => {
          if (seen.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
      }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  const currentChatPinned = useMemo(() => uniqueMessages.filter(m => m.is_pinned), [uniqueMessages]);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickGlobal = (e: MouseEvent) => {
        // Закрываем контекстное меню
        setActiveMenuId(null);
        setMenuCoords(null);

        // Закрываем меню вложений, если клик не по кнопке скрепки
        if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
            setShowAttachMenu(false);
        }
    };
    window.addEventListener('click', handleClickGlobal);
    return () => window.removeEventListener('click', handleClickGlobal);
  }, []);

  // Скролл вниз при новых сообщениях
  useLayoutEffect(() => {
    if (uniqueMessages.length > 0 && prevHeight === 0) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 0);
    }
  }, [activeChat?.id, uniqueMessages.length, prevHeight]);

  // Сохранение позиции скролла при подгрузке
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
      if (scrollTop < 50 && hasMore) {
          setPrevHeight(scrollHeight);
          onLoadMore();
      }
  };

  // --- ОТПРАВКА ---
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const textToSend = messageContent.trim();

    // Если пусто и нет файлов — не отправляем
    if (!textToSend && selectedFiles.length === 0) return;

    if (editingMessage) {
       // Логика редактирования (пока просто лог)
       console.log("Edit:", editingMessage.id, textToSend);
       setEditingMessage(null);
    } else {
       // Отправляем
       onSendMessage(textToSend, replyingTo?.id, selectedFiles);
    }

    // Сброс
    setReplyingTo(null);
    setMessageContent('');
    setSelectedFiles([]);
  };

  // --- АУДИО ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          recorder.start();
          setIsRecording(true);

          const startTime = Date.now();
          timerRef.current = setInterval(() => {
              setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
          }, 1000);

      } catch (err) {
          console.error("Mic error:", err);
          toast.error("Нет доступа к микрофону");
      }
  };

  const stopRecording = () => {
      if (!mediaRecorderRef.current || !isRecording) return;

      mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          // Создаем файл из блоба
          const audioFile = new File([audioBlob], "voice_message.webm", { type: 'audio/webm' });

          // Отправляем как файл
          onSendMessage('', replyingTo?.id, [audioFile]);

          // Очистка
          if (mediaRecorderRef.current?.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          }
          setRecordingTime(0);
          audioChunksRef.current = [];
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = null; // Убираем обработчик, чтобы не отправилось
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setRecordingTime(0);
      audioChunksRef.current = [];
      if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- ФАЙЛЫ ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
    setShowAttachMenu(false);
    e.target.value = ''; // Сброс value, чтобы можно было выбрать тот же файл
  };

  const triggerFileSelect = (accept: string) => {
      if (fileInputRef.current) {
          fileInputRef.current.accept = accept;
          fileInputRef.current.click();
      }
  };

  // --- КОНТЕКСТНОЕ МЕНЮ ---
  const handleOpenContextMenu = (e: React.MouseEvent, msgId: number) => {
      e.preventDefault();
      e.stopPropagation();

      const menuWidth = 208;
      const menuHeight = 300;
      let x = e.pageX;
      let y = e.pageY;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

      setActiveMenuId(msgId);
      setMenuCoords({ x, y });
  };

  // --- RENDER ---
  if (!activeChat) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
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

  const isGroup = activeChat.type === 'group';
  const partner = activeChat.participants?.find(p => p.id !== currentUser?.id) || activeChat.participants?.[0];
  const chatName = isGroup ? (activeChat.name || 'Группа') : partner?.username;
  const avatarUrl = isGroup ? activeChat.avatar_url : partner?.avatar_url;

  return (
    <div className="flex flex-col h-full bg-gradient-to-t from-blue via-gray-50 to-blue-50 dark:from-blue-700 dark:via-blue-950 dark:to-gray-900 relative overflow-hidden">

        {/* HEADER */}
        <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10 flex-none">
            <div className="flex items-center gap-4">
                {!isSidebarOpen && (
                    <button onClick={onToggleSidebar} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <MessageCircleMore size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                )}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover"/> : chatName?.[0]}
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{chatName}</h3>
                    <span className="text-xs text-gray-500">{isGroup ? 'Группа' : 'В сети'}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {currentChatPinned.length > 0 && (
                   <button onClick={() => setShowPinnedList(!showPinnedList)} className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg">
                       <Pin size={18} />
                   </button>
                )}
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><Search size={20} className="text-gray-500" /></button>
            </div>
        </div>

        {/* PINNED MESSAGES */}
        {showPinnedList && currentChatPinned.length > 0 && (
            <div className="bg-blue-50 dark:bg-gray-800 p-2 border-b border-blue-100 dark:border-gray-700 max-h-32 overflow-y-auto">
                {currentChatPinned.map(m => (
                    <div key={m.id} className="text-sm p-2 bg-white dark:bg-gray-700 rounded mb-1 cursor-pointer">
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
            {isLoadingMessages && uniqueMessages.length === 0 && <div className="text-center p-4">Загрузка...</div>}

            {uniqueMessages.map((msg, index) => {
                const isMe = Number(msg.sender_id) === Number(currentUser?.id);
                const prevMsg = index > 0 ? uniqueMessages[index - 1] : null;
                const showDate = !prevMsg || !isSameDay(msg.created_at, prevMsg.created_at);

                return (
                    <React.Fragment key={msg.id}>
                        {showDate && (
                            <div className="flex justify-center my-4">
                                <span className="bg-gray-200 dark:bg-gray-700 text-xs px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
                                    {formatDateSeparator(msg.created_at)}
                                </span>
                            </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] ${!isMe && isGroup ? 'ml-0' : ''}`}>
                                <MessageBubble
                                    msg={msg} isMe={isMe}
                                    senderName={!isMe && isGroup ? msg.sender?.username : undefined}
                                    senderAvatar={!isMe && isGroup ? msg.sender?.avatar_url : undefined}
                                    time={new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    menuPosition={activeMenuId === msg.id ? menuCoords : null}
                                    onContextMenu={handleOpenContextMenu}
                                    closeMenu={() => setActiveMenuId(null)}
                                    onReply={(m) => { setReplyingTo(m); fileInputRef.current?.focus(); }}
                                    onPin={(m) => onPinMessage && onPinMessage(m.id)}
                                    onEdit={(m) => { setEditingMessage(m); setMessageContent(m.content); }}
                                    onDelete={(id, both) => console.log('delete', id, both)}
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
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 relative z-20">

            {/* Панель ответа */}
            {(replyingTo || editingMessage) && (
                <div className="flex justify-between items-center p-2 mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
                    <div className="text-sm overflow-hidden">
                        <span className="font-bold text-blue-500">{editingMessage ? 'Редактирование' : 'Ответ на:'}</span>
                        <div className="truncate text-gray-600 dark:text-gray-400">{(replyingTo || editingMessage)?.content}</div>
                    </div>
                    <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setMessageContent(''); }}><X size={16}/></button>
                </div>
            )}

            {/* Превью файлов */}
            {selectedFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                    {selectedFiles.map((f, i) => (
                        <div key={i} className="relative min-w-[60px] h-[60px] bg-gray-100 border rounded flex items-center justify-center">
                            {f.type.startsWith('image/')
                                ? <img src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded" />
                                : <FileText size={24} />}
                            <button onClick={() => setSelectedFiles(p => p.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Скрытый инпут для файлов */}
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

            {isRecording ? (
                // Интерфейс записи аудио
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 p-3 rounded-xl animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                    <span className="flex-1 font-mono text-red-600 dark:text-red-400 font-bold">{formatTime(recordingTime)}</span>
                    <button onClick={cancelRecording} className="text-sm text-gray-500 hover:text-gray-700">Отмена</button>
                    <button onClick={stopRecording} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform hover:scale-110">
                        <Send size={18} />
                    </button>
                </div>
            ) : (
                // Стандартная форма ввода
                <form onSubmit={handleSend} className="flex items-end gap-2">
                    <div className="relative" ref={attachMenuRef}>
                        <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                            <Paperclip size={24} />
                        </button>

                        {/* Меню вложений - absolute позиционирование исправлено */}
                        {showAttachMenu && (
                            <div className="absolute bottom-14 left-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-scaleIn">
                                <button type="button" onClick={() => triggerFileSelect('image/*')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                                    <ImageIcon size={18} className="text-blue-500"/> Фото/Видео
                                </button>
                                <button type="button" onClick={() => triggerFileSelect('*/*')} className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                                    <FileText size={18} className="text-green-500"/> Файл
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center px-2">
                        <TextareaAutosize
                            minRows={1} maxRows={5}
                            placeholder="Сообщение..."
                            className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-gray-900 dark:text-white"
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        />
                        <button type="button" className="p-2 text-gray-400 hover:text-yellow-500"><Smile size={24}/></button>
                    </div>

                    {messageContent.trim() || selectedFiles.length > 0 ? (
                        <button type="submit" className="p-3 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-transform transform active:scale-95">
                            <Send size={24} />
                        </button>
                    ) : (
                        <button type="button" onClick={startRecording} className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Mic size={24} />
                        </button>
                    )}
                </form>
            )}
        </div>
    </div>
  );
};