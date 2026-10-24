// frontend/components/messenger/ForwardModal.tsx
import React, { useState, useEffect } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import { X, Search, Users as UsersIcon, User as UserIcon, ArrowRight, ChevronDown, ChevronUp, MessageSquare, Loader2 } from 'lucide-react';
import { Message, ChatPreview } from '@/types/messenger';

interface ForwardModalProps {
  open: boolean;
  messages: Message[] | null; // ИЗМЕНЕНО: одно или несколько сообщений
  currentUser: any;
  onClose: () => void;
  onForward: (
    targets: { id: number; type: 'dm' | 'group' }[],
    comment?: string, // комментарий (отправится вторым сообщением)
    showSender?: boolean // показывать автора оригинала в пересланном сообщении
  ) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  open,
  messages,
  currentUser,
  onClose,
  onForward,
}) => {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showSender, setShowSender] = useState(true);

  useEffect(() => {
    if (!open) {
      setSelectedChats(new Set());
      setSearchQuery('');
      setComment('');
      setShowComment(false);
      setShowPreview(true);
      setShowSender(true);
      return;
    }

    const loadChats = async () => {
      setLoading(true);
      try {
        const [convRes, groupRes] = await Promise.all([
          axiosMessenger.get('/conversations'),
          axiosMessenger.get('/groups'),
        ]);

        const conversations: ChatPreview[] = (convRes.data || []).map((c: any) => {
          const partner = c.participants?.find((p: any) => Number(p.id) !== Number(currentUser?.id));
          return {
            id: c.id,
            type: 'dm' as const,
            title: partner?.display_name || partner?.username || 'Пользователь',
            avatarUrl: partner?.avatar_url || '',
            unreadCount: c.unread_count || 0,
            originalData: c,
          };
        });

        const groups: ChatPreview[] = (groupRes.data || []).map((g: any) => ({
          id: g.id,
          type: 'group' as const,
          title: g.name || 'Группа',
          avatarUrl: g.avatar_url || '',
          unreadCount: g.unread_count || 0,
          originalData: g,
        }));

        setChats([...conversations, ...groups]);
      } catch (e) {
        console.error('Failed to load chats', e);
        toast.error('Не удалось загрузить чаты');
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [open, currentUser]);

  if (!open || !messages || messages.length === 0) return null;
  
  const firstMessage = messages[0];

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleChat = (chatId: number, chatType: 'dm' | 'group') => {
    const key = `${chatType}_${chatId}`;
    const newSet = new Set(selectedChats);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedChats(newSet);
  };

  const handleForward = () => {
    if (selectedChats.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    const selected = Array.from(selectedChats).map((key) => {
      const idx = key.indexOf('_');
      const type = key.slice(0, idx);
      const id = Number(key.slice(idx + 1));
      return { id, type: type as 'dm' | 'group' };
    });

    onForward(selected, showComment ? comment.trim() || undefined : undefined, showSender);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Переслать сообщение</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Preview */}
        {showPreview ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {messages.length > 1 ? `Пересылаемые сообщения (${messages.length}):` : 'Пересылаемое сообщение:'}
                </p>
                <p className="text-sm text-gray-900 dark:text-white line-clamp-3 break-words">
                  {firstMessage.content || '📎 Вложение'}
                  {messages.length > 1 && <span className="text-gray-500"> · + ещё {messages.length - 1}</span>}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="Скрыть"
              >
                <ChevronUp size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowPreview(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <ChevronDown size={14} />
              Показать сообщение
            </button>
          </div>
        )}

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск чатов..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Загрузка...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <UserIcon size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Чаты не найдены</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChats.map((chat) => {
                const key = `${chat.type}_${chat.id}`;
                const isSelected = selectedChats.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => toggleChat(chat.id, chat.type)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold overflow-hidden">
                        {chat.avatarUrl ? (
                          <img src={chat.avatarUrl} alt={chat.title} className="w-full h-full object-cover" />
                        ) : (
                          <span>{chat.title[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      {chat.type === 'group' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border border-white dark:border-gray-900">
                          <UsersIcon size={9} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {chat.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {chat.type === 'dm' ? 'Личный чат' : 'Группа'}
                      </p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Options + Comment */}
        {selectedChats.size > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {/* Показать автора */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSender}
                onChange={(e) => setShowSender(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Показывать автора сообщения
              </span>
            </label>

            <button
              onClick={() => setShowComment(!showComment)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showComment ? 'Скрыть комментарий' : 'Добавить комментарий'}
            </button>
            {showComment && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Комментарий отправится отдельным сообщением..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedChats.size > 0 ? `Выбрано чатов: ${selectedChats.size}` : 'Выберите чаты'}
          </p>
          <button
            onClick={handleForward}
            disabled={selectedChats.size === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Далее
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;