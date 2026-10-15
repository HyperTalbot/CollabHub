// frontend/components/messenger/ChatInfoModal.tsx
// Модалка с полной информацией о собеседнике (DM) или группе.
// Открывается кликом по хитбоксу названия чата в ChatHeader.
"use client";

import React, { useEffect, useState } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import {
  X, Image as ImageIcon, FileText, Link2, Mic, MoreVertical,
  User as UserIcon, Users as UsersIcon, Pencil, Share2, ArrowRight, Loader2,
} from 'lucide-react';

interface MediaItem {
  id: number;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'link';
  sender_name: string;
  sender_id: number;
  message?: string;
  file_name?: string;
  created_at: string;
}

interface ChatUserInfo {
  id: number;
  display_name: string;
  username: string;
  email?: string;
  bio?: string;
  avatar_url: string;
}

interface GroupMember {
  id: number;
  display_name: string;
  username: string;
  avatar_url: string;
  role: string;
}

export interface ChatInfoData {
  type: 'dm' | 'group';
  id: number;
  title: string;
  avatar_url: string;
  user?: ChatUserInfo;
  members?: GroupMember[];
  member_count: number;
  folders: { media: number; files: number; links: number; voices: number };
  media: MediaItem[];
  files: MediaItem[];
  links: MediaItem[];
  voices: MediaItem[];
}

interface ChatInfoModalProps {
  open: boolean;
  chatId: number;
  chatType: 'dm' | 'group';
  currentUser: any;
  onClose: () => void;
  // вызывается после успешного изменения имени контакта / группы,
  // чтобы обновить шапку и список чатов
  onUpdated: (info: { kind: 'contact' | 'group'; id: number; name: string; avatar_url?: string }) => void;
}

type FolderKey = 'media' | 'files' | 'links' | 'voices';

const FOLDER_TABS: { key: FolderKey; label: string; icon: React.ReactNode }[] = [
  { key: 'media', label: 'Медиа', icon: <ImageIcon size={14} /> },
  { key: 'files', label: 'Файлы', icon: <FileText size={14} /> },
  { key: 'links', label: 'Ссылки', icon: <Link2 size={14} /> },
  { key: 'voices', label: 'Голосовые', icon: <Mic size={14} /> },
];

const Avatar: React.FC<{ src?: string; name?: string; size?: number }> = ({ src, name, size = 80 }) => (
  <div
    className="rounded-full overflow-hidden bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0"
    style={{ width: size, height: size }}
  >
    {src ? (
      <img src={src} alt={name || ''} className="w-full h-full object-cover" />
    ) : (
      <span style={{ fontSize: size / 2.6 }}>{(name || '?')[0]?.toUpperCase()}</span>
    )}
  </div>
);

export const ChatInfoModal: React.FC<ChatInfoModalProps> = ({
  open,
  chatId,
  chatType,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ChatInfoData | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderKey>('media');
  const [showMore, setShowMore] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowMore(false);
      setEditing(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axiosMessenger.get<ChatInfoData>(
          `/chats/${chatId}/info?type=${chatType}`
        );
        if (!cancelled) setInfo(data);
      } catch (e: any) {
        console.error('Failed to load chat info', e);
        if (!cancelled) toast.error('Не удалось загрузить информацию о чате');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, chatId, chatType]);

  // закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const startEdit = () => {
    if (!info) return;
    setEditName(chatType === 'dm' ? info.user?.display_name || info.title : info.title);
    setEditAvatar(chatType === 'dm' ? info.user?.avatar_url || '' : info.avatar_url || '');
    setEditing(true);
    setShowMore(false);
  };

  const shareEntity = async () => {
    if (!info) return;
    const url = `${window.location.origin}/profile/${chatType === 'dm' ? info.user?.id : info.id}`;
    const text =
      chatType === 'dm'
        ? `Контакт: ${info.user?.display_name || info.title} — ${url}`
        : `Группа: ${info.title} — ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: info.title, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success('Ссылка скопирована в буфер обмена');
      } else {
        window.prompt('Скопируйте ссылку:', text);
      }
    } catch {
      /* пользователь отменил шеринг */
    }
    setShowMore(false);
  };

  const saveEdit = async () => {
    if (!info || !editName.trim()) {
      toast.error('Имя не может быть пустым');
      return;
    }
    setSaving(true);
    try {
      if (chatType === 'dm' && info.user) {
        const { data } = await axiosMessenger.put(`/contacts/${info.user.id}`, {
          display_name: editName.trim(),
        });
        const name = data.display_name || editName.trim();
        setInfo({ ...info, title: name, user: { ...info.user, display_name: name } });
        onUpdated({ kind: 'contact', id: info.user.id, name });
        toast.success('Контакт обновлён');
      } else {
        const { data } = await axiosMessenger.put(`/chats/${info.id}/group-info`, {
          name: editName.trim(),
          avatar_url: editAvatar.trim(),
        });
        setInfo({ ...info, title: data.name || editName.trim(), avatar_url: data.avatar_url ?? editAvatar });
        onUpdated({
          kind: 'group',
          id: info.id,
          name: data.name || editName.trim(),
          avatar_url: data.avatar_url,
        });
        toast.success('Группа обновлена');
      }
      setEditing(false);
    } catch (e: any) {
      console.error('Failed to save', e);
      const msg =
        e?.response?.data?.error === 'Only owner or admin can update group'
          ? 'Только владелец или админ может изменять группу'
          : e?.response?.data?.error || 'Не удалось сохранить изменения';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const items: MediaItem[] = info ? info[activeFolder] || [] : [];
  const counts = info?.folders || { media: 0, files: 0, links: 0, voices: 0 };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ───────── Header ───────── */}
        <div className="relative p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              title="Закрыть"
            >
              <X size={18} />
            </button>

            {!loading && info && (
              <div className="relative">
                <button
                  onClick={() => setShowMore((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                  title="Ещё"
                >
                  <MoreVertical size={18} />
                </button>

                {showMore && (
                  <div className="absolute right-0 top-9 z-10 w-56 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-sm">
                    <button
                      onClick={shareEntity}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                      <Share2 size={15} className="text-blue-500" />
                      {chatType === 'dm' ? 'Поделиться контактом' : 'Поделиться группой'}
                    </button>
                    <button
                      onClick={startEdit}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                      <Pencil size={15} className="text-gray-500" />
                      {chatType === 'dm' ? 'Изменить контакт' : 'Изменить группу'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-8 text-gray-400">
              <Loader2 size={28} className="animate-spin mb-3" />
              <span className="text-sm">Загрузка…</span>
            </div>
          ) : !info ? (
            <div className="py-8 text-center text-gray-500 text-sm">Информация недоступна</div>
          ) : editing ? (
            /* ───────── Режим редактирования ───────── */
            <div className="mt-2 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Avatar
                  src={chatType === 'group' ? editAvatar : info.user?.avatar_url || info.avatar_url}
                  name={editName}
                  size={72}
                />
                {chatType === 'group' && (
                  <input
                    type="url"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    placeholder="URL аватарки группы (необязательно)"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={chatType === 'dm' ? 'Имя контакта' : 'Название группы'}
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {chatType === 'dm' && (
                <p className="text-xs text-gray-400">
                  Меняет отображаемое имя контакта (синхронизируется с профилем).
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Отмена
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            /* ───────── Просмотр ───────── */
            <div className="mt-1 flex flex-col items-center text-center">
              <Avatar
                src={info.avatar_url}
                name={info.title}
                size={88}
              />
              <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white break-words">
                {chatType === 'dm' ? info.user?.display_name || info.title : info.title}
              </h2>

              {chatType === 'dm' && info.user ? (
                <div className="w-full mt-1">
                  <p className="text-sm text-gray-500">@{info.user.username}</p>
                  {info.user.email && (
                    <p className="text-xs text-gray-400 mt-0.5">{info.user.email}</p>
                  )}
                  {info.user.bio && (
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-left">
                      {info.user.bio}
                    </p>
                  )}
                  <a
                    href={`/profile/${info.user.id}`}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  >
                    Перейти в профиль
                    <ArrowRight size={15} />
                  </a>
                </div>
              ) : (
                <div className="w-full mt-1">
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5">
                    <UsersIcon size={14} />
                    {info.member_count} участников
                  </p>
                  {info.members && info.members.length > 0 && (
                    <div className="mt-3 max-h-36 overflow-y-auto custom-scrollbar space-y-1 text-left">
                      {info.members.map((m) => (
                        <a
                          key={m.id}
                          href={`/profile/${m.id}`}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <Avatar src={m.avatar_url} name={m.display_name || m.username} size={28} />
                          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                            {m.display_name || m.username}
                          </span>
                          {m.role !== 'member' && (
                            <span className="ml-auto text-[10px] uppercase font-bold text-blue-500">
                              {m.role}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───────── Content folders ───────── */}
        {!loading && info && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="grid grid-cols-4 gap-1 px-4 pt-3">
              {FOLDER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFolder(tab.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeFolder === tab.key
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {tab.icon}
                    {tab.label}
                  </span>
                  <span className="text-[10px] opacity-70">{counts[tab.key]}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
              {items.length === 0 ? (
                <div className="h-full min-h-24 flex flex-col items-center justify-center text-gray-400 text-sm gap-1">
                  <UserIcon size={20} className="opacity-40" />
                  Пусто
                </div>
              ) : activeFolder === 'media' ? (
                <div className="grid grid-cols-3 gap-2">
                  {items.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 relative group"
                      title={item.sender_name}
                    >
                      {item.type === 'video' ? (
                        <>
                          <video src={item.url} className="w-full h-full object-cover" muted />
                          <span className="absolute inset-0 flex items-center justify-center text-white/90">
                            ▶
                          </span>
                        </>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.message || 'media'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center text-gray-500 flex-shrink-0">
                        {activeFolder === 'files' ? <FileText size={16} />
                          : activeFolder === 'links' ? <Link2 size={16} />
                          : <Mic size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {activeFolder === 'voices' ? (
                          <audio src={item.url} controls className="w-full h-8" />
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {activeFolder === 'files'
                              ? item.file_name || item.url.split('/').pop()
                              : item.url}
                          </a>
                        )}
                        <p className="text-[11px] text-gray-400 truncate">
                          {item.sender_name} ·{' '}
                          {new Date(item.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInfoModal;
