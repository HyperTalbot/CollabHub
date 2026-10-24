// frontend/components/messenger/ChatInfoModal.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import {
  X, Image as ImageIcon, FileText, Link2, Mic, MoreVertical,
  User as UserIcon, Users as UsersIcon, Pencil, Share2, ArrowRight, Loader2,
  UserPlus, Search, Check, ArrowLeft, LogOut, UserMinus,
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
  type: 'dm' | 'group' | 'user';
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
  chatType: 'dm' | 'group' | 'user'; // 'user' — профиль пользователя по user_id
  currentUser: any;
  onClose: () => void;
  onUpdated: (info: { kind: 'contact' | 'group'; id: number; name: string; avatar_url?: string }) => void;
}

type FolderKey = 'media' | 'files' | 'links' | 'voices';
type TargetType = 'dm' | 'group' | 'user';

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

  // Внутренняя навигация: клик по участнику группы → профиль пользователя.
  // null = смотрим исходный чат.
  const [viewTarget, setViewTarget] = useState<{ id: number; type: TargetType } | null>(null);

  // Панель добавления участников
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [toAdd, setToAdd] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  // ═══ НОВОЕ: контекст группы при переходе к профилю участника ═══
  // (нужен, чтобы владелец видел «Удалить участника» в more-меню участника)
  const [groupCtx, setGroupCtx] = useState<{ groupId: number; myRole: string } | null>(null);

  const effectiveId = viewTarget?.id ?? chatId;
  const effectiveType: TargetType = viewTarget?.type ?? chatType;
  const isGroup = effectiveType === 'group';
  const isUserLike = effectiveType === 'dm' || effectiveType === 'user';

  const loadInfo = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosMessenger.get<ChatInfoData>(
        `/chats/${effectiveId}/info?type=${effectiveType}`
      );
      setInfo(data);
    } catch (e: any) {
      console.error('Failed to load chat info', e);
      toast.error('Не удалось загрузить информацию');
    } finally {
      setLoading(false);
    }
  }, [effectiveId, effectiveType]);

  useEffect(() => {
    if (!open) {
      setShowMore(false);
      setEditing(false);
      setViewTarget(null);
      setShowAddMembers(false);
      setGroupCtx(null);
      setInfo(null);
      return;
    }
    loadInfo();
  }, [open, loadInfo]);

  // закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showAddMembers) setShowAddMembers(false);
      else if (viewTarget) setViewTarget(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, viewTarget, showAddMembers]);

  // ───────── Поиск кандидатов (друзья + DM-контакты) для добавления ─────────
  // ВАЖНО: определена ДО `if (!open) return null`, чтобы эффект не падал на TDZ
  const doSearchUsers = async () => {
    if (!info || effectiveType !== 'group') return;
    setSearching(true);
    try {
      const { data } = await axiosMessenger.get(
        `/groups/${effectiveId}/candidates?q=${encodeURIComponent(searchQ.trim())}`
      );
      setSearchResults(data?.candidates || []);
    } catch (e) {
      console.error('Candidates search failed', e);
      toast.error('Поиск не удался');
    } finally {
      setSearching(false);
    }
  };

  // Автозагрузка кандидатов при открытии панели + debounce на ввод
  // ВАЖНО: этот useEffect ОБЯЗАН быть ДО early-return `if (!open) return null`
  useEffect(() => {
    if (!open || !showAddMembers || effectiveType !== 'group') return;
    const t = setTimeout(() => { doSearchUsers(); }, searchQ.trim() ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showAddMembers, searchQ, effectiveId, effectiveType]);

  if (!open) return null;

  // ═══ НОВОЕ: моя роль в группе ═══
  const myRole = isGroup && info?.members
    ? info.members.find((m) => Number(m.id) === Number(currentUser?.id))?.role || 'member'
    : null;
  const iAmOwner = myRole === 'owner';
  const canEditGroup = myRole === 'owner' || myRole === 'admin';

   // ───────── Переход к профилю участника ─────────
  const openUserProfile = (userId: number) => {
    if (Number(userId) === Number(currentUser?.id)) return;
    // запоминаем контекст группы — владелец увидит «Удалить участника»
    if (isGroup && info) {
      setGroupCtx({ groupId: info.id, myRole: myRole || 'member' });
    }
    setShowMore(false);
    setEditing(false);
    setViewTarget({ id: userId, type: 'user' });
  };

  const goBack = () => {
    setViewTarget(null);
    setEditing(false);
    setShowMore(false);
  };

  const toggleAddUser = (uid: number) => {
    setToAdd((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  };

  // ═══ НОВОЕ: удалить участника (только владелец группы) ═══
  const removeMemberFromGroup = async () => {
    if (!info?.user || !groupCtx) return;
    const name = info.user.display_name || info.user.username;
    if (!window.confirm(`Удалить ${name} из группы?`)) return;
    try {
      await axiosMessenger.delete(`/groups/${groupCtx.groupId}/members/${info.user.id}`);
      toast.success('Участник удалён из группы');
      setShowMore(false);
      const gid = groupCtx.groupId;
      setGroupCtx(null);
      goBack(); // возврат к группе — useEffect сам перезагрузит данные
      window.dispatchEvent(new CustomEvent('group-updated', { detail: { id: gid } }));
    } catch (e: any) {
      console.error('Remove member failed', e);
      toast.error(e?.response?.data?.error || 'Не удалось удалить участника');
    }
  };

  // ═══ НОВОЕ: покинуть группу (все, кроме владельца) ═══
  const leaveGroup = async () => {
    if (!info) return;
    if (!window.confirm('Покинуть группу? Она исчезнет из вашего списка чатов.')) return;
    try {
      await axiosMessenger.post(`/groups/${info.id}/leave`);
      toast.success('Вы покинули группу');
      setShowMore(false);
      const gid = info.id;
      onClose();
      // группа исчезнет из списка чатов; если была открыта — закроется
      window.dispatchEvent(new CustomEvent('group-left', { detail: { group_id: gid } }));
    } catch (e: any) {
      console.error('Leave group failed', e);
      toast.error(e?.response?.data?.error || 'Не удалось покинуть группу');
    }
  };

  const submitAddMembers = async () => {
    if (!info || toAdd.length === 0) return;
    setAdding(true);
    try {
      await axiosMessenger.post(`/groups/${info.id}/members`, { user_ids: toAdd });
      toast.success(`Добавлено участников: ${toAdd.length}`);
      setShowAddMembers(false);
      setToAdd([]);
      setSearchResults([]);
      setSearchQ('');
      await loadInfo();
      // уведомляем список чатов / шапку, что состав группы изменился
      window.dispatchEvent(
        new CustomEvent('group-updated', {
          detail: { id: info.id, name: info.title, avatar_url: info.avatar_url },
        })
      );
    } catch (e: any) {
      console.error('Add members failed', e);
      toast.error(e?.response?.data?.error || 'Не удалось добавить участников');
    } finally {
      setAdding(false);
    }
  };

  // ───────── Редактирование / шеринг ─────────
  const startEdit = () => {
    if (!info) return;
    setEditName(isUserLike ? info.user?.display_name || info.title : info.title);
    setEditAvatar(isUserLike ? info.user?.avatar_url || '' : info.avatar_url || '');
    setEditing(true);
    setShowMore(false);
  };

  const shareEntity = async () => {
    if (!info) return;
    const profileId = isUserLike ? info.user?.id : info.id;
    const url = `${window.location.origin}/profile/${profileId}`;
    const text = isUserLike
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
    } catch { /* отменено */ }
    setShowMore(false);
  };

  const saveEdit = async () => {
    if (!info || !editName.trim()) {
      toast.error('Имя не может быть пустым');
      return;
    }
    setSaving(true);
    try {
      if (isUserLike && info.user) {
        const { data } = await axiosMessenger.put(`/contacts/${info.user.id}`, {
          display_name: editName.trim(),
        });
        const name = data.display_name || editName.trim();
        setInfo({ ...info, title: name, user: { ...info.user, display_name: name } });
        onUpdated({ kind: 'contact', id: info.user.id, name });
        window.dispatchEvent(
          new CustomEvent('contact-updated', { detail: { user_id: info.user.id, display_name: name } })
        );
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

  const items: MediaItem[] = info ? (info[activeFolder] as MediaItem[]) || [] : [];
  const counts = info?.folders || { media: 0, files: 0, links: 0, voices: 0 };

  // ═══════════ Панель добавления участников (внутри модалки) ═══════════
  if (showAddMembers && isGroup) {
    return (
      <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddMembers(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <ArrowLeft size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Добавить участников</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 pb-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearchUsers()}
                placeholder="Поиск пользователей по имени..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pb-2">
            {searching ? (
              <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                <Loader2 size={18} className="animate-spin" /> Поиск...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm">
                <UserIcon size={28} className="mb-2 opacity-40" />
                {searchQ ? 'Никого не найдено' : 'Введите имя для поиска'}
              </div>
            ) : (
              searchResults.map((u) => {
                const uid = Number(u.id);
                const checked = toAdd.includes(uid);
                return (
                  <button
                    key={uid}
                    onClick={() => toggleAddUser(uid)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Avatar src={u.avatar_url} name={u.display_name || u.username} size={36} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {u.display_name || u.username}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{u.username}
                        {u.source === 'friend' && <span className="ml-1.5 text-green-600 dark:text-green-400">· друг</span>}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={submitAddMembers}
              disabled={toAdd.length === 0 || adding}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {adding && <Loader2 size={15} className="animate-spin" />}
              Добавить {toAdd.length > 0 ? `(${toAdd.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ Основная модалка ═══════════
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ───────── Header ───────── */}
        <div className="relative p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1">
              {viewTarget && (
                <button
                  onClick={goBack}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                  title="Назад к чату"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

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
                      {isUserLike ? 'Поделиться контактом' : 'Поделиться группой'}
                    </button>

                    {/* Группа: редактирование — только owner/admin */}
                    {(!isGroup || canEditGroup) && (
                      <button
                        onClick={startEdit}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                      >
                        <Pencil size={15} className="text-gray-500" />
                        {isUserLike ? 'Изменить контакт' : 'Изменить группу'}
                      </button>
                    )}

                    {/* ═══ НОВОЕ: Покинуть группу (все, кроме владельца) ═══ */}
                    {isGroup && !iAmOwner && (
                      <button
                        onClick={leaveGroup}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      >
                        <LogOut size={15} />
                        Покинуть группу
                      </button>
                    )}

                    {/* ═══ НОВОЕ: Удалить участника (только владелец группы,
                        в профиле участника, открытом из списка) ═══ */}
                    {isUserLike && groupCtx && groupCtx.myRole === 'owner' &&
                      info.user && Number(info.user.id) !== Number(currentUser?.id) && (
                      <button
                        onClick={removeMemberFromGroup}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      >
                        <UserMinus size={15} />
                        Удалить участника
                      </button>
                    )}
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
                  src={isGroup ? editAvatar : info.user?.avatar_url || info.avatar_url}
                  name={editName}
                  size={72}
                />
                {isGroup && (
                  <input
                    type="url"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    placeholder="URL аватарки группы (необязательно)"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={isUserLike ? 'Имя контакта' : 'Название группы'}
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
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
              <Avatar src={info.avatar_url} name={info.title} size={88} />
              <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white break-words">
                {isUserLike ? info.user?.display_name || info.title : info.title}
              </h2>

              {isUserLike && info.user ? (
                /* ═══ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (dm / user) ═══ */
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
                /* ═══ ГРУППА: участники в закруглённом прямоугольнике ═══ */
                <div className="w-full mt-1">
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5">
                    <UsersIcon size={14} />
                    {info.member_count} участников
                  </p>

                  {/* Закруглённый прямоугольник: список участников + кнопка добавления */}
                  <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                    {/* Кнопка "Добавить участников" */}
                    <button
                      onClick={() => setShowAddMembers(true)}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-semibold transition-colors"
                    >
                      <UserPlus size={16} />
                      Добавить участников
                    </button>
                    
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 text-left">
                      {(info.members || []).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => openUserProfile(m.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-700 transition-colors text-left"
                          title="Открыть информацию о пользователе"
                        >
                          <Avatar src={m.avatar_url} name={m.display_name || m.username} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {m.display_name || m.username}
                            </p>
                            {m.display_name && m.username && (
                              <p className="text-[11px] text-gray-400 truncate">@{m.username}</p>
                            )}
                          </div>
                          {m.role !== 'member' && (
                            <span className="text-[10px] uppercase font-bold text-blue-500 flex-shrink-0">
                              {m.role === 'owner' ? 'владелец' : 'админ'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
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
                          <span className="absolute inset-0 flex items-center justify-center text-white/90">▶</span>
                        </>
                      ) : (
                        <img src={item.url} alt={item.message || 'media'} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800">
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
                            {activeFolder === 'files' ? item.file_name || item.url.split('/').pop() : item.url}
                          </a>
                        )}
                        <p className="text-[11px] text-gray-400 truncate">
                          {item.sender_name} · {new Date(item.created_at).toLocaleDateString('ru-RU')}
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