// frontend/components/messenger/ForwardModal.tsx
import React, { useState, useEffect } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import {
  X, Search, Users as UsersIcon, User as UserIcon, ArrowRight,
  ChevronDown, ChevronRight, MessageSquare, Loader2, Folder, Hash,
  Server as ServerIcon, Check,
} from 'lucide-react';
import { Message, ChatPreview } from '@/types/messenger';
import { resolveMediaUrl } from '@/lib/mediaUrl';

export interface ForwardTarget {
  id: number;
  type: 'dm' | 'group' | 'channel';
}

interface FwdFolder { id: number; name: string; parent_id?: number | null; position: number; is_pinned: boolean }
interface FwdChannel { id: number; name: string; type: 'text' | 'voice'; category_id?: number | null; position?: number; is_pinned?: boolean }
interface ServerStructure { folders: FwdFolder[]; channels: FwdChannel[] }

interface ForwardModalProps {
  open: boolean;
  messages: Message[] | null;
  currentUser: any;
  onClose: () => void;
  onForward: (targets: ForwardTarget[], comment?: string, showSender?: boolean) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  open, messages, currentUser, onClose, onForward,
}) => {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [structures, setStructures] = useState<Record<number, ServerStructure>>({});
  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showSender, setShowSender] = useState(true);

  useEffect(() => {
    if (!open) {
      setSelected(new Set()); setSearchQuery(''); setComment('');
      setShowComment(false); setShowPreview(true); setShowSender(true);
      setExpandedServers(new Set()); setExpandedFolders(new Set());
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [convRes, groupRes, serverRes] = await Promise.all([
          axiosMessenger.get('/conversations'),
          axiosMessenger.get('/groups'),
          axiosMessenger.get('/servers').catch(() => ({ data: [] })),
        ]);
        const conversations: ChatPreview[] = (convRes.data || []).map((c: any) => {
          const partner = c.participants?.find((p: any) => Number(p.id) !== Number(currentUser?.id));
          return {
            id: c.id, type: 'dm' as const,
            title: partner?.display_name || partner?.username || 'Пользователь',
            avatarUrl: partner?.avatar_url || '', unreadCount: 0, originalData: c,
          };
        });
        const groups: ChatPreview[] = (groupRes.data || []).map((g: any) => ({
          id: g.id, type: 'group' as const, title: g.name || 'Группа',
          avatarUrl: g.avatar_url || '', unreadCount: 0, originalData: g,
        }));
        setChats([...conversations, ...groups]);
        setServers(serverRes.data || []);
      } catch (e) {
        console.error(e);
        toast.error('Не удалось загрузить чаты');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, currentUser]);

  if (!open || !messages || messages.length === 0) return null;
  const firstMessage = messages[0];

  const q = searchQuery.toLowerCase();
  const filteredChats = chats.filter((c) => c.title.toLowerCase().includes(q));
  const filteredServers = servers.filter((s: any) => (s.name || '').toLowerCase().includes(q));

  const toggleTarget = (id: number, type: 'dm' | 'group' | 'channel') => {
    const key = `${type}_${id}`;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const toggleServer = async (sid: number) => {
    const n = new Set(expandedServers);
    if (n.has(sid)) { n.delete(sid); setExpandedServers(n); return; }
    n.add(sid);
    setExpandedServers(n);
    if (!structures[sid]) {
      try {
        const { data } = await axiosMessenger.get(`/servers/${sid}/structure`);
        setStructures((prev) => ({
          ...prev,
          [sid]: {
            folders: (data.folders || []).filter((f: FwdFolder) => !f.is_pinned),
            channels: (data.channels || []).filter((c: FwdChannel) => c.type === 'text' && !c.is_pinned),
          },
        }));
      } catch {
        toast.error('Не удалось загрузить каналы сервера');
      }
    }
  };

  const toggleFolder = (fid: number) => {
    const n = new Set(expandedFolders);
    if (n.has(fid)) n.delete(fid); else n.add(fid);
    setExpandedFolders(n);
  };

  const Selector = ({ isSel }: { isSel: boolean }) => (
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
      isSel ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'
    }`}>
      {isSel && <Check size={12} className="text-white" />}
    </span>
  );

  const renderServerTree = (sid: number, parentId: number | null): React.ReactNode => {
    const st = structures[sid];
    if (!st) return null;
    type Item = { kind: 'folder'; d: FwdFolder; pos: number } | { kind: 'channel'; d: FwdChannel; pos: number };
    const items: Item[] = [
      ...st.folders.filter((f) => (f.parent_id ?? null) === parentId)
        .map((f) => ({ kind: 'folder' as const, d: f, pos: f.position })),
      ...st.channels.filter((c) => (c.category_id ?? null) === parentId)
        .map((c) => ({ kind: 'channel' as const, d: c, pos: c.position ?? 0 })),
    ].sort((a, b) => a.pos - b.pos || a.d.id - b.d.id);

    return items.map((item) => {
      if (item.kind === 'folder') {
        const f = item.d;
        const isOpen = expandedFolders.has(f.id);
        return (
          <div key={`sf-${f.id}`}>
            <button
              onClick={() => toggleFolder(f.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm transition-colors"
            >
              {isOpen ? <ChevronDown size={13} className="flex-shrink-0" /> : <ChevronRight size={13} className="flex-shrink-0" />}
              <Folder size={14} className="text-yellow-500 flex-shrink-0" />
              <span className="truncate font-medium text-left">{f.name}</span>
            </button>
            {isOpen && (
              <div className="ml-[14px] pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                {renderServerTree(sid, f.id)}
              </div>
            )}
          </div>
        );
      }
      const ch = item.d;
      const isSel = selected.has(`channel_${ch.id}`);
      return (
        <button
          key={`sc-${ch.id}`}
          onClick={() => toggleTarget(ch.id, 'channel')}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            isSel ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
        >
          <Hash size={14} className="flex-shrink-0" />
          <span className="truncate flex-1 text-left font-medium">{ch.name}</span>
          <Selector isSel={isSel} />
        </button>
      );
    });
  };

  const handleForward = () => {
    if (selected.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }
    const targets: ForwardTarget[] = Array.from(selected).map((key) => {
      const idx = key.indexOf('_');
      return { type: key.slice(0, idx) as 'dm' | 'group' | 'channel', id: Number(key.slice(idx + 1)) };
    });
    onForward(targets, showComment ? comment.trim() || undefined : undefined, showSender);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Переслать сообщение</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Превью (Скрыть/Показать) */}
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
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Скрыть">
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => setShowPreview(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              <ChevronDown size={14} className="rotate-180" /> Показать сообщение
            </button>
          </div>
        )}

        {/* Поиск */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск чатов, групп, серверов..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Загрузка...
            </div>
          ) : (
            <div className="space-y-1">
              {/* ЛС и группы */}
              {filteredChats.map((chat) => {
                const key = `${chat.type}_${chat.id}`;
                const isSel = selected.has(key);
                const isGroup = chat.type === 'group';
                return (
                  <button
                    key={key}
                    onClick={() => toggleTarget(chat.id, chat.type)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isSel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold overflow-hidden ${
                        isGroup ? 'from-purple-500 to-pink-500' : 'from-blue-400 to-indigo-500'
                      }`}>
                        {chat.avatarUrl
                          ? <img src={resolveMediaUrl(chat.avatarUrl)} alt={chat.title} className="w-full h-full object-cover" />
                          : <span>{chat.title[0]?.toUpperCase() || '?'}</span>}
                      </div>
                      {isGroup && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border border-white dark:border-gray-900">
                          <UsersIcon size={9} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{chat.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{isGroup ? 'Группа' : 'Личный чат'}</p>
                    </div>
                    <Selector isSel={isSel} />
                  </button>
                );
              })}

              {/* Серверы — раскрывающееся дерево (по умолчанию свёрнуты) */}
              {filteredServers.map((s: any) => {
                const isOpen = expandedServers.has(s.id);
                return (
                  <div key={`srv-${s.id}`}>
                    <button
                      onClick={() => toggleServer(s.id)}
                      className="w-full flex items-center gap-2.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {isOpen
                        ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                        : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
                      <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                        {s.avatar_url
                          ? <img src={resolveMediaUrl(s.avatar_url)} alt={s.name} className="w-full h-full object-cover" />
                          : <ServerIcon size={15} />}
                      </div>
                      <span className="flex-1 text-left text-sm font-semibold text-gray-900 dark:text-white truncate">{s.name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">сервер</span>
                    </button>
                    {isOpen && (
                      <div className="ml-7 pl-2 border-l-2 border-gray-200 dark:border-gray-700 mb-1">
                        {!structures[s.id] ? (
                          <div className="py-2 px-2 text-xs text-gray-400 flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" /> Загрузка каналов...
                          </div>
                        ) : (
                          renderServerTree(s.id, null)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {!loading && filteredChats.length === 0 && filteredServers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <UserIcon size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">Ничего не найдено</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Опции + комментарий */}
        {selected.size > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={showSender} onChange={(e) => setShowSender(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Показывать автора сообщения</span>
            </label>
            <button onClick={() => setShowComment(!showComment)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
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
            {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Выберите чаты'}
          </p>
          <button
            onClick={handleForward}
            disabled={selected.size === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Далее <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;