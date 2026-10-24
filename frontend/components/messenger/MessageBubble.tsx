// frontend/components/messenger/MessageBubble.tsx
import React, { useRef } from 'react';
import { Reply, Copy, Trash2, Edit2, Pin, Forward, CheckCheck, X, Download, File, Video, Phone, PhoneMissed, PhoneOff, CheckCircle, Check, ListTodo, ListChecks } from 'lucide-react';
import { Message } from '@/types/messenger';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  senderName?: string;
  senderAvatar?: string;
  senderId?: number;
  currentUserId?: number;
  time: string;

  menuPosition: { x: number, y: number } | null;
  onContextMenu: (e: React.MouseEvent, msgId: number) => void;
  closeMenu: () => void;

  onReply: (msg: Message) => void;
  onPin: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onDelete: (msgId: number, deleteForBoth: boolean) => void;
  onForward: (msg: Message) => void;
  // replyToMessage: Message | null;
  // ИЗМЕНЕНО: массив источников ответа (мультивыбор)
  replySources: ReplySource[];
  onSenderClick?: (senderId: number) => void;
  // клик по блоку ответа → переход к оригинальному сообщению
  onReplyClick?: (messageId: number) => void;

  // НОВОЕ: мультивыбор
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (msgId: number) => void;
  onEnterSelection?: (msg: Message) => void;
}

interface ReplySource {
  id: number;
  content: string;
  sender_id: number;
  sender_username?: string;
  attachment_type?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg, isMe, senderName, senderAvatar, senderId, currentUserId, time,
  menuPosition, onContextMenu, closeMenu,
  onReply, onPin, onEdit, onDelete, onForward, replySources,
  onSenderClick, onReplyClick,
  selectionMode, isSelected, onToggleSelect, onEnterSelection
}) => {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteForBoth, setDeleteForBoth] = React.useState(true);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => name?.[0]?.toUpperCase() || '?';

  // ─── FALLBACK имени/аватара отправителя ───
  // История сообщений (REST) возвращает sender вложенным объектом,
  // а WS — плоскими sender_username/sender_avatar. Поддерживаем оба.
  const effectiveName = senderName || msg.sender_username || msg.sender?.username || msg.sender?.display_name;
  const effectiveAvatar = senderAvatar || msg.sender_avatar || msg.sender?.avatar_url;
  const effectiveSenderId = senderId ?? msg.sender_id;

  // ═══ Блок ответа: один или несколько источников ═══
  const sources = replySources || [];
  const firstSource = sources[0] || null;

  // ─── Источник данных для блока "Ответ" ───
  // 1) сообщение найдено в загруженной истории
  // 2) reply_preview из WS-payload / обогащённой истории
  const replySenderLabel = firstSource
    ? (Number(firstSource.sender_id) === Number(currentUserId)
      ? 'Вы'
      : (firstSource.sender_username || 'Сообщение'))
    : '';
  const singleReplyText = firstSource?.content
    || (firstSource?.attachment_type ? '📎 Вложение' : 'Сообщение');

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    toast.success('Скопировано');
    closeMenu();
  };

  const handleDeleteClick = () => {
    closeMenu();
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    onDelete(msg.id, deleteForBoth);
    setShowDeleteModal(false);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Ошибка загрузки файла');
    }
  };

  // Системные сообщения о звонках
  if (msg.is_system_message && msg.system_type === 'call') {
    const systemData = msg.system_data ? JSON.parse(msg.system_data) : {};

    const getCallIcon = () => {
      if (systemData.status === 'missed') return <PhoneMissed size={14} className="text-red-500" />;
      if (systemData.status === 'declined') return <PhoneOff size={14} className="text-orange-500" />;
      if (systemData.type === 'video') return <Video size={14} className="text-blue-500" />;
      return <Phone size={14} className="text-green-500" />;
    };

    const getCallColor = () => {
      if (systemData.status === 'missed') return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
      if (systemData.status === 'declined') return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400';
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    };

    return (
      <div className="flex justify-center my-2">
        <div className={`px-4 py-2 rounded-full text-xs flex items-center gap-2 ${getCallColor()}`}>
          {getCallIcon()}
          <span className="font-medium">{msg.content}</span>
          <span className="text-[10px] opacity-70">{time}</span>
        </div>
      </div>
    );
  }

  // ═══ НОВОЕ: прочие системные события (удалён из группы / покинул группу) ═══
  if (msg.is_system_message) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-200/90 dark:bg-gray-700/90 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-full text-xs text-center max-w-[85%] shadow-sm backdrop-blur-sm">
          <span className="font-medium">{msg.content}</span>
          <span className="text-[10px] opacity-70 ml-2">{time}</span>
        </div>
      </div>
    );
  }

  return (
        <>
      <div
        className={`group relative mb-2 flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${selectionMode ? 'cursor-pointer' : ''}`}
        onClick={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect?.(msg.id); } : undefined}
      >
        {/* ═══ ЧЕКБОКС в режиме выделения ═══ */}
        {selectionMode && (
          <div className={`flex-shrink-0 mb-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
              ? 'bg-blue-500 border-blue-500'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
            }`}>
            {isSelected && <Check size={14} className="text-white" />}
          </div>
        )}

        {/* Аватар собеседника — КЛИКАБЕЛЬНЫЙ (открывает модалку пользователя) */}
        {!isMe && effectiveName && !selectionMode && (
          <button
            type="button"
            onClick={() => effectiveSenderId && onSenderClick?.(effectiveSenderId)}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-sm mb-1 hover:ring-2 hover:ring-blue-400 transition-all"
            title="Открыть информацию о пользователе"
          >
            {effectiveAvatar ? (
              <img src={effectiveAvatar} alt={effectiveName} className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(effectiveName)}</span>
            )}
          </button>
        )}

        {/* САМО СООБЩЕНИЕ */}
        <div
          ref={bubbleRef}
          onContextMenu={selectionMode ? undefined : (e) => onContextMenu(e, msg.id)}
          className={`msg-bubble relative px-4 py-3 shadow-sm max-w-full break-words
                        ${isMe
              ? 'bg-gradient-to-br from-blue-800 to-blue-500 text-white rounded-2xl rounded-br-sm'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm border border-gray-200 dark:border-gray-700'
            }
                        ${selectionMode && isSelected ? 'ring-2 ring-blue-500 opacity-90' : ''}
                        transition-all duration-200 hover:shadow-md cursor-default select-text
                    `}
        >
          {/* Имя отправителя в группе — КЛИКАБЕЛЬНОЕ */}
          {!isMe && effectiveName && !selectionMode && (
            <button
              type="button"
              onClick={() => effectiveSenderId && onSenderClick?.(effectiveSenderId)}
              className="block text-xs font-bold text-blue-500 mb-1 hover:underline text-left"
            >
              {effectiveName}
            </button>
          )}

          {/* БЛОК ОТВЕТА (один или несколько источников)(первые две строки оригинала) */}
          {/* клик переносит к оригиналу и подсвечивает его */}
          {/* один источник — прыжок к сообщению, несколько — панель списка в ChatHeader */}
          {sources.length > 0 && (
            <div
              onClick={(e) => {
                  e.stopPropagation();
                  if (selectionMode) return;
                  if (sources.length > 1) {
                      window.dispatchEvent(new CustomEvent('show-reply-sources', {
                          detail: {
                              sources: sources.map((s) => ({
                                  id: s.id,
                                  content: s.content,
                                  sender_username: Number(s.sender_id) === Number(currentUserId)
                                      ? 'Вы'
                                      : (s.sender_username || 'Собеседник'),
                              })),
                          },
                      }));
                  } else if (firstSource) {
                      onReplyClick?.(firstSource.id);
                  }
              }}
              title={sources.length > 1 ? 'Показать список сообщений' : 'Перейти к сообщению'}
              className={`mb-2 rounded-lg px-3 py-2 border-l-4 text-xs cursor-pointer transition-colors
                  ${isMe
                      ? 'bg-blue-950/40 border-blue-200/70 hover:bg-blue-950/60'
                      : 'bg-gray-100 dark:bg-gray-700/70 border-blue-500 hover:bg-gray-200/70 dark:hover:bg-gray-700'
                  }`}
            >
              {sources.length === 1 ? (
                <>
                  <div className={`font-semibold mb-0.5 ${isMe ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'}`}>
                    {replySenderLabel}
                  </div>
                  <div
                    className={isMe ? 'text-blue-50/90' : 'text-gray-600 dark:text-gray-300'}
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                  >
                    {singleReplyText}
                  </div>
                </>
              ) : (
                <>
                  <div className={`font-semibold mb-0.5 ${isMe ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'}`}>
                    Ответ на {sources.length} сообщ.
                  </div>
                  {sources.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className={`truncate ${isMe ? 'text-blue-50/90' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      <span className="font-semibold">
                        {Number(s.sender_id) === Number(currentUserId) ? 'Вы' : (s.sender_username || '—')}
                      </span>
                      : {s.content || '📎 Вложение'}
                    </div>
                  ))}
                  {sources.length > 3 && (
                    <div className={`mt-0.5 ${isMe ? 'text-blue-200' : 'text-blue-500'}`}>
                      + ещё {sources.length - 3}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

            {/* ═══ МЕТКА ПЕРЕСЛАННОГО СООБЩЕНИЯ (автор) ═══ */}
            {!!msg.forwarded_from && (
              <div className={`text-[11px] italic mb-1 flex items-center gap-1 ${isMe ? 'text-blue-100' : 'text-blue-500 dark:text-blue-400'}`}>
                <Forward size={11} />
                Переслано от {msg.forwarded_from_name || 'пользователя'}
              </div>
            )}

            {/* Вложения */}
            {msg.attachment_url ? (
              <div className="space-y-2">
                {msg.attachment_type === 'image' ? (
                  <img
                    src={msg.attachment_url}
                    alt="Изображение"
                    className="max-w-sm rounded-lg cursor-pointer hover:opacity-90"
                    onClick={() => window.open(msg.attachment_url, '_blank')}
                  />
                ) : msg.attachment_type === 'video' ? (
                  <video src={msg.attachment_url} controls className="max-w-sm rounded-lg" />
                ) : msg.attachment_type === 'audio' ? (
                  <audio src={msg.attachment_url} controls className="w-full" />
                ) : (
                  <div
                    onClick={() => handleDownload(msg.attachment_url!, msg.content || 'file')}
                    className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <File size={32} className="text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{msg.content}</p>
                      <p className={`text-xs ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>Нажмите для скачивания</p>
                    </div>
                    <Download size={20} className="text-gray-400" />
                  </div>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {msg.content}
              </p>
            )}

            <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
              {msg.is_edited && <span>(ред.)</span>}
              <span>{time}</span>
              {/* ═══ Галочки: ✓ — не прочитано, ✓✓ — прочитано получателем ═══ */}
              {isMe && (msg.is_read_by_recipient
                ? <CheckCheck size={14} className="opacity-90" />
                : <Check size={14} className="opacity-70" />)}
              {msg.is_pinned && <Pin size={10} className="opacity-80 ml-1" />}
            </div>
          </div>
        </div>

        {/* Контекстное меню */}
        {menuPosition && (
          <div
            className="fixed z-50 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden animate-fadeIn"
            style={{ top: menuPosition.y, left: menuPosition.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem icon={<Reply size={16} />} text="Ответить" onClick={() => { onReply(msg); closeMenu(); }} />
            <MenuItem icon={<Copy size={16} />} text="Скопировать" onClick={handleCopy} />
            <MenuItem icon={<Forward size={16} />} text="Переслать" onClick={() => { onForward(msg); closeMenu(); }} />
            <MenuItem icon={<Pin size={16} />} text={msg.is_pinned ? 'Открепить' : 'Закрепить'} onClick={() => { onPin(msg); closeMenu(); }} />
            {/* <MenuItem icon={<Languages size={16} />} text="Перевести" onClick={() => { toast.success('Перевод...'); closeMenu(); }} /> */}
            <MenuItem icon={<CheckCircle size={16} />} text="Выбрать" onClick={() => { onEnterSelection?.(msg); closeMenu(); }} />
            {isMe && (
              <>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <MenuItem icon={<Edit2 size={16} />} text="Изменить" onClick={() => { onEdit(msg); closeMenu(); }} />
                <MenuItem icon={<Trash2 size={16} />} text="Удалить" color="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleDeleteClick} />
              </>
            )}
          </div>
        )}

        {/* Модалка удаления */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 m-4 max-w-sm w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Удалить сообщение?</h3>
                <button onClick={() => setShowDeleteModal(false)}><X size={20} className="text-gray-500" /></button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Это действие нельзя отменить.</p>
              {isMe && (
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                  <input type="checkbox" checked={deleteForBoth} onChange={(e) => setDeleteForBoth(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Удалить у всех</span>
                </label>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-300 rounded-lg font-medium">Отмена</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">Удалить</button>
              </div>
            </div>
          </div>
        )}
      </>
      );
};

      const MenuItem = ({icon, text, onClick, color = "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}: any) => (
      <button onClick={(e) => { e.stopPropagation(); onClick(); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${color}`}>
        {icon} <span className="font-medium">{text}</span>
      </button>
      );