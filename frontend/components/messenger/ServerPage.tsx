// frontend/components/messenger/ServerPage.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, Volume2, UserPlus, ChevronDown, ChevronRight, Lock, Plus,
  Users as UsersIcon, Ellipsis, Folder, FolderOpen, ArrowUp, ArrowDown,
  Pencil, Pin, Trash2, X, Search, Check, Loader2, Crown,
  Reply, Forward, Copy,
} from 'lucide-react';
import axiosMessenger from '@/lib/axiosMessenger';
import { User, Message } from '@/types/messenger';
import { VoiceChannel } from './VoiceChannel';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ChatInfoModal } from './ChatInfoModal';
import { ForwardModal } from './ForwardModal';
import { ChatHeader } from './ChatHeader';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useWebSocket } from '@/context/WebSocketContext';
import toast from 'react-hot-toast';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  server_id: number;
  category_id?: number | null;
  is_private?: boolean;
  is_pinned?: boolean;
  position?: number;
}

interface Folder {
  id: number;
  server_id: number;
  parent_id?: number | null;
  name: string;
  position: number;
  is_pinned: boolean;
}

interface ServerMember {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

interface ServerPageProps {
  serverId: number;
  serverName: string;
  serverAvatar?: string;
  currentUser: User | null;
  onClose?: () => void;
}

type CtxKind = 'folder' | 'channel' | 'root';

interface CtxMenu {
  x: number;
  y: number;
  kind: CtxKind;
  id: number;
  isPinned: boolean;
}

const MAX_LEN = 4096;

export const ServerPage: React.FC<ServerPageProps> = ({
  serverId, serverName, serverAvatar, currentUser, onClose,
}) => {
  const { sendMessage } = useWebSocket();

  // Структура
  const [folders, setFolders] = useState<Folder[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<number | null>(null);

   // Участники — панель по умолчанию СКРЫТА (включается кнопкой в ChatHeader)
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [showMembersList, setShowMembersList] = useState(false);
  const [infoUserId, setInfoUserId] = useState<number | null>(null);
  const [showServerInfo, setShowServerInfo] = useState(false); // НОВОЕ: модалка сервера

  // Контекстное меню структуры
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [createSubOpen, setCreateSubOpen] = useState(false);

  // НОВОЕ: мультивыбор сообщений
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Переименование
  const [renaming, setRenaming] = useState<{ kind: 'folder' | 'channel'; id: number } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Добавление участников
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [toAdd, setToAdd] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  // Чат канала
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | Message[] | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);
  const [forwardMessages, setForwardMessages] = useState<Message[] | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myRole = members.find((m) => Number(m.id) === Number(currentUser?.id))?.role;
  const canManage = myRole === 'owner';

  // ═══ Загрузка структуры и участников ═══
  const loadStructure = useCallback(async () => {
    try {
      const { data } = await axiosMessenger.get(`/servers/${serverId}/structure`);
      const fs: Folder[] = data.folders || [];
      const cs: Channel[] = (data.channels || []).filter((c: Channel) => c.id != null);
      setFolders(fs);
      setChannels(cs);
      setExpanded((prev) => {
        if (prev.size === 0) return new Set(fs.map((f) => f.id)); // первый раз — всё раскрыто
        const next = new Set(prev);
        fs.forEach((f) => { if (!prev.has(f.id) && f.is_pinned) next.add(f.id); });
        return next;
      });
      setSelectedChannel((prevSel) => {
        if (prevSel && cs.some((c) => c.id === prevSel.id)) {
          return cs.find((c) => c.id === prevSel.id) || prevSel;
        }
        return cs.find((c) => c.type === 'text') || null;
      });
    } catch (e) {
      console.error('Failed to load structure', e);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  const loadMembers = useCallback(async () => {
    try {
      const { data } = await axiosMessenger.get(`/servers/${serverId}/members`);
      setMembers(data || []);
    } catch (e) {
      console.error('Failed to load members', e);
    }
  }, [serverId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ═══ Сообщения канала ═══
  useEffect(() => {
    if (!selectedChannel) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosMessenger.get(`/channels/${selectedChannel.id}/messages`);
        if (!cancelled) setMessages(data.messages || []);
      } catch (e) {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedChannel?.id]);

  // live-сообщения канала (WS → window event из WebSocketContext)
  useEffect(() => {
    const onWs = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (!msg?.channel_id || !selectedChannel) return;
      if (Number(msg.channel_id) !== Number(selectedChannel.id)) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    window.addEventListener('ws-new-message', onWs);
    return () => window.removeEventListener('ws-new-message', onWs);
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, selectedChannel?.id]);

  // Сброс выделения при смене канала
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [selectedChannel?.id]);

  // ═══ МУЛЬТИВЫБОР ═══
  const enterSelection = (msg: Message) => {
    setSelectionMode(true);
    setSelectedIds([msg.id]);
  };

  // ═══ Отправка / действия с сообщениями ═══
  const handleSend = async (text: string, replyToId?: number, files?: File[], replyToIds?: number[]) => {
    if (!selectedChannel) return;
    if (!text.trim() && (!files || files.length === 0)) return;

    if (files && files.length > 0) {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('channel_id', String(selectedChannel.id));
        try {
          await axiosMessenger.post('/messages/attachment', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          toast.error('Не удалось отправить файл');
        }
      }
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX_LEN) chunks.push(text.substring(i, i + MAX_LEN));

    for (let idx = 0; idx < chunks.length; idx++) {
      const body: any = { channel_id: selectedChannel.id, content: chunks[idx] };
      if (idx === 0 && replyToId) body.reply_to_id = replyToId;
      try {
        await axiosMessenger.post('/messages/send', body);
      } catch (e: any) {
        toast.error(e?.response?.data?.error || 'Не удалось отправить сообщение');
      }
    }
    setReplyingTo(null);
  };

  const handleEditMsg = async (messageId: number, content: string) => {
    try {
      await axiosMessenger.put(`/messages/${messageId}/edit`, { content });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content, is_edited: true } : m)));
      setEditingMessage(null);
      toast.success('Сообщение изменено');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось изменить сообщение');
    }
  };

  const handleDeleteMsg = async (messageId: number) => {
    try {
      await axiosMessenger.delete(`/messages/${messageId}/delete`, { data: { delete_for_both: true } });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success('Сообщение удалено');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось удалить сообщение');
    }
  };

  const handlePinMsg = async (msgId: number) => {
    try {
      await axiosMessenger.post(`/messages/${msgId}/pin`, {});
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_pinned: !m.is_pinned } : m)));
    } catch {
      toast.error('Не удалось закрепить сообщение');
    }
  };

  const handleForwardConfirm = async (
    targets: { id: number; type: 'dm' | 'group' | 'channel' }[],
    comment?: string,
    showSender?: boolean
  ) => {
    const list = forwardMessages || [];
    for (const t of targets) {
      for (const m of list) {
        const payload: any = { content: m.content || '' };
        if (t.type === 'dm') payload.conversation_id = t.id;
        else payload.group_id = t.id;
        if (showSender !== false) payload.forwarded_from = m.sender_id;
        if (m.attachment_url) {
          payload.attachment_url = m.attachment_url;
          payload.attachment_type = m.attachment_type;
        }
        sendMessage(payload, m.content || 'вложение');
        await new Promise((r) => setTimeout(r, 80));
      }
      if (comment?.trim()) {
        const cp: any = { content: comment.trim() };
        if (t.type === 'dm') cp.conversation_id = t.id;
        else cp.group_id = t.id;
        sendMessage(cp, comment.trim());
        await new Promise((r) => setTimeout(r, 80));
      }
    }
    toast.success(`Переслано в чатов: ${targets.length}`);
    setShowForwardModal(false);
    setForwardMessages(null);
  };

  // Контекстное меню сообщений
  const handleMsgContextMenu = (e: React.MouseEvent, msgId: number) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.pageX, y = e.pageY;
    if (x + 210 > window.innerWidth) x = window.innerWidth - 220;
    if (y + 300 > window.innerHeight) y = Math.max(10, window.innerHeight - 310);
    setActiveMenuId(msgId);
    setMenuCoords({ x, y });
  };

  useEffect(() => {
    const h = () => { setActiveMenuId(null); setMenuCoords(null); };
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  const flashTarget = (id: number) => {
    const el = (document.querySelector(`[data-message-id="${id}"] .msg-bubble`) ||
      document.querySelector(`[data-message-id="${id}"]`)) as HTMLElement | null;
    if (!el) {
      toast('Сообщение не найдено в загруженной истории', { icon: 'ℹ️' });
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('message-flash');
    void el.offsetWidth;
    el.classList.add('message-flash');
    setTimeout(() => el.classList.remove('message-flash'), 2000);
  };

  // ═══ НОВОЕ: клик по закреплённому сообщению в ChatHeader канала →
  // прокрутка к сообщению + подсветка ═══
  useEffect(() => {
    const onScrollToMessage = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.message_id);
      if (id) flashTarget(id);
    };
    window.addEventListener('scroll-to-message', onScrollToMessage);
    return () => window.removeEventListener('scroll-to-message', onScrollToMessage);
  }, []);

  const getReplySources = (m: Message) => {
    const ids: number[] = [];
    if (Array.isArray(m.reply_to_ids)) ids.push(...(m.reply_to_ids as number[]).map(Number));
    else if (typeof m.reply_to_ids === 'string' && m.reply_to_ids) {
      ids.push(...m.reply_to_ids.split(',').map((s) => parseInt(s, 10)).filter(Boolean));
    }
    if (m.reply_to_id && !ids.includes(m.reply_to_id)) ids.push(m.reply_to_id);
    if (!ids.length) return [];
    return ids.map((id) => {
      const found = messages.find((x) => x.id === id);
      if (found) {
        return {
          id, content: found.content, sender_id: found.sender_id,
          sender_username: found.sender_username || found.sender?.username,
          attachment_type: found.attachment_type,
        };
      }
      const pv = (m.reply_previews || []).find((p) => p.id === id);
      if (pv) return pv;
      if (m.reply_preview && m.reply_preview.id === id) return m.reply_preview;
      return null;
    }).filter(Boolean) as any[];
  };

  // ═══ Контекстное меню структуры (папки/каналы) ═══
  const closeCtx = () => { setCtxMenu(null); setCreateSubOpen(false); };

  useEffect(() => {
    const h = () => closeCtx();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  const openCtx = (e: React.MouseEvent, kind: CtxKind, id: number, isPinned: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX, y = e.clientY;
    if (x + 250 > window.innerWidth) x = window.innerWidth - 260;
    if (y + 320 > window.innerHeight) y = Math.max(10, window.innerHeight - 330);
    setCtxMenu({ x, y, kind, id, isPinned });
    setCreateSubOpen(false);
  };

  const moveItem = async (direction: 'up' | 'down') => {
    if (!ctxMenu || ctxMenu.kind === 'root') return;
    try {
      await axiosMessenger.post(`/servers/${serverId}/reorder`, {
        item_type: ctxMenu.kind, item_id: ctxMenu.id, direction,
      });
      await loadStructure();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось переместить');
    }
    closeCtx();
  };

  const createItem = async (what: 'folder' | 'text' | 'voice') => {
    // контекст на папке → создаём ВНУТРИ неё; на канале → в его папке; root → в корне
    let parentId: number | null = null;
    if (ctxMenu?.kind === 'folder') parentId = ctxMenu.id;
    else if (ctxMenu?.kind === 'channel') {
      parentId = channels.find((c) => c.id === ctxMenu.id)?.category_id ?? null;
    }

    const defaults = { folder: 'Новая папка', text: 'Текстовый чат', voice: 'Голосовой канал' };
    try {
      if (what === 'folder') {
        await axiosMessenger.post(`/servers/${serverId}/folders`, {
          server_id: serverId, name: defaults.folder, parent_id: parentId,
        });
        if (parentId) setExpanded((prev) => new Set(prev).add(parentId!));
      } else {
        await axiosMessenger.post('/channels', {
          server_id: serverId, name: defaults[what], type: what, folder_id: parentId,
        });
        if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      }
      await loadStructure();
      toast.success('Создано');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось создать');
    }
    closeCtx();
  };

  const startRename = () => {
    if (!ctxMenu || ctxMenu.kind === 'root') return;
    const name = ctxMenu.kind === 'folder'
      ? folders.find((f) => f.id === ctxMenu.id)?.name || ''
      : channels.find((c) => c.id === ctxMenu.id)?.name || '';
    setRenaming({ kind: ctxMenu.kind, id: ctxMenu.id });
    setRenameValue(name);
    closeCtx();
  };

  const submitRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    try {
      if (renaming.kind === 'folder') await axiosMessenger.put(`/folders/${renaming.id}`, { name: renameValue.trim() });
      else await axiosMessenger.put(`/channels/${renaming.id}`, { name: renameValue.trim() });
      await loadStructure();
      setRenaming(null);
      toast.success('Переименовано');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось переименовать');
    }
  };

  const togglePin = async () => {
    if (!ctxMenu || ctxMenu.kind === 'root') return;
    try {
      await axiosMessenger.post(`/servers/${serverId}/pin`, {
        item_type: ctxMenu.kind, item_id: ctxMenu.id,
      });
      await loadStructure();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось изменить закрепление');
    }
    closeCtx();
  };

  const toggleSelect = (msgId: number) => {
    setSelectedIds((prev) => (prev.includes(msgId) ? prev.filter((x) => x !== msgId) : [...prev, msgId]));
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };
  const selectedMessages = messages.filter((m) => selectedIds.includes(m.id));

  const handleCopySelected = () => {
    navigator.clipboard.writeText(selectedMessages.map((m) => m.content).filter(Boolean).join('\n\n'));
    toast.success(`Скопировано сообщений: ${selectedMessages.length}`);
    exitSelection();
  };
  const handleDeleteSelected = async () => {
    if (!window.confirm(`Удалить выбранные сообщения (${selectedIds.length})?`)) return;
    for (const id of [...selectedIds]) await handleDeleteMsg(id);
    exitSelection();
  };
  const handlePinSelected = async () => {
    for (const id of [...selectedIds]) await handlePinMsg(id);
    toast.success(`Закреплено: ${selectedIds.length}`);
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

  const deleteItem = async () => {
    if (!ctxMenu || ctxMenu.kind === 'root') return;
    const name = ctxMenu.kind === 'folder'
      ? folders.find((f) => f.id === ctxMenu.id)?.name
      : channels.find((c) => c.id === ctxMenu.id)?.name;
    const warn = ctxMenu.kind === 'folder'
      ? `Удалить папку «${name}»? Все вложенные папки и каналы будут удалены.`
      : `Удалить «${name}»?`;
    closeCtx();
    if (!window.confirm(warn)) return;
    try {
      if (ctxMenu.kind === 'folder') await axiosMessenger.delete(`/folders/${ctxMenu.id}`);
      else await axiosMessenger.delete(`/channels/${ctxMenu.id}`);
      if (ctxMenu.kind === 'channel' && selectedChannel?.id === ctxMenu.id) setSelectedChannel(null);
      await loadStructure();
      toast.success('Удалено');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  // ═══ Дерево проводника ═══
  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const siblingsOf = (parentId: number | null) => {
    const fs = folders
      .filter((f) => f.id != null && (f.parent_id ?? null) === parentId && !f.is_pinned)
      .map((f) => ({ kind: 'folder' as const, data: f as Folder | Channel, pos: f.position }));
    const cs = channels
      .filter((c) => c.id != null && (c.category_id ?? null) === parentId && !c.is_pinned)
      .map((c) => ({ kind: 'channel' as const, data: c as Folder | Channel, pos: c.position ?? 0 }));
    return [...fs, ...cs].sort((a, b) => a.pos - b.pos || a.data.id - b.data.id);
  };

  const handleChannelClick = (ch: Channel) => {
    if (ch.type === 'text') {
      setSelectedChannel(ch);
      setActiveVoiceChannel(null);
    } else {
      setActiveVoiceChannel((prev) => (prev === ch.id ? null : ch.id));
    }
  };

  const renderFolderRow = (f: Folder) => {
    const isOpen = expanded.has(f.id);
    return (
      <div key={`f-${f.id}`}>
        <div
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          onClick={() => toggleExpand(f.id)}
          onContextMenu={(e) => openCtx(e, 'folder', f.id, f.is_pinned)}
        >
          {isOpen ? <ChevronDown size={13} className="flex-shrink-0" /> : <ChevronRight size={13} className="flex-shrink-0" />}
          {isOpen
            ? <FolderOpen size={15} className="text-yellow-500 flex-shrink-0" />
            : <Folder size={15} className="text-yellow-500 flex-shrink-0" />}
          <span className="text-sm font-semibold truncate flex-1 text-left">{f.name}</span>
          <button
            onClick={(e) => openCtx(e, 'folder', f.id, f.is_pinned)}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700 rounded flex-shrink-0"
            title="Ещё"
          >
            <Ellipsis size={14} />
          </button>
        </div>
        {/* Вертикальная линия вложенности */}
        {isOpen && (
          <div className="ml-[15px] pl-1.5 border-l-2 border-gray-300/80 dark:border-gray-600/60">
            {renderTree(f.id)}
          </div>
        )}
      </div>
    );
  };

  const renderChannelRow = (ch: Channel) => {
    const isVoice = ch.type === 'voice';
    const isSelected = selectedChannel?.id === ch.id;
    const isInVoice = activeVoiceChannel === ch.id;
    return (
      <div
        key={`c-${ch.id}`}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
          isSelected || isInVoice
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'hover:bg-gray-200/70 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}
        onClick={() => handleChannelClick(ch)}
        onContextMenu={(e) => openCtx(e, 'channel', ch.id, !!ch.is_pinned)}
      >
        {isVoice
          ? <Volume2 size={15} className={`flex-shrink-0 ${isInVoice ? 'text-green-500' : ''}`} />
          : <Hash size={15} className="flex-shrink-0" />}
        <span className="text-sm font-medium truncate flex-1 text-left">{ch.name}</span>
        {ch.is_private && <Lock size={11} className="text-gray-500 flex-shrink-0" />}
        <button
          onClick={(e) => openCtx(e, 'channel', ch.id, !!ch.is_pinned)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700 rounded flex-shrink-0"
          title="Ещё"
        >
          <Ellipsis size={14} />
        </button>
      </div>
    );
  };

  const renderTree = (parentId: number | null): React.ReactNode =>
    siblingsOf(parentId).map((item) =>
      item.kind === 'folder'
        ? renderFolderRow(item.data as Folder)
        : renderChannelRow(item.data as Channel)
    );

  const pinnedItems = [
    ...folders.filter((f) => f.is_pinned).map((f) => ({ kind: 'folder' as const, data: f as Folder | Channel })),
    ...channels.filter((c) => c.is_pinned).map((c) => ({ kind: 'channel' as const, data: c as Folder | Channel })),
  ];

  // ═══ Добавление участников ═══
  const searchCandidates = async () => {
    setSearching(true);
    try {
      const { data } = await axiosMessenger.get(
        `/servers/${serverId}/candidates?q=${encodeURIComponent(searchQ.trim())}`
      );
      setCandidates(data?.candidates || []);
    } catch {
      toast.error('Поиск не удался');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!showAddMembers) return;
    const t = setTimeout(searchCandidates, searchQ.trim() ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMembers, searchQ, serverId]);

  const submitAddMembers = async () => {
    if (toAdd.length === 0) return;
    setAdding(true);
    try {
      await axiosMessenger.post(`/servers/${serverId}/invite`, { user_ids: toAdd });
      toast.success(`Приглашения отправлены: ${toAdd.length}`);
      setShowAddMembers(false);
      setToAdd([]);
      setSearchQ('');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Не удалось отправить приглашение');
    } finally {
      setAdding(false);
    }
  };

  const openAddMenu = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCtxMenu({ x: rect.left, y: rect.bottom + 4, kind: 'root', id: 0, isPinned: false });
    setCreateSubOpen(false);
  };

  const AvatarImg: React.FC<{ src?: string; name: string; size?: number }> = ({ src, name, size = 32 }) => (
    <div
      className="rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {src ? <img src={resolveMediaUrl(src)} alt={name} className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );

  return (
    <>
      <div className="h-full flex bg-gray-100 dark:bg-gray-900">
        {/* ═══ ЛЕВО: папки и каналы (проводник) ═══ */}
        <div className="w-64 flex-shrink-0 flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <div className="h-14 px-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shadow-sm">
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowServerInfo(true)}
              title="О сервере"
            >
              <AvatarImg src={serverAvatar} name={serverName} size={28} />
              <h2 className="font-bold text-gray-900 dark:text-white truncate text-sm">{serverName}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAddMembers(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Добавить участников"
              >
                <UserPlus size={16} className="text-gray-500" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Вернуться к чатам"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>

          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Каналы и папки
            </span>
            {canManage && (
              <button
                onClick={openAddMenu}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500"
                title="Создать в корне"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div
            className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2"
            onContextMenu={(e) => canManage && openCtx(e, 'root', 0, false)}
          >
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Загрузка...
              </div>
            ) : (
              <>
                {pinnedItems.length > 0 && (
                  <div className="mb-3">
                    <div className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Pin size={10} /> Закреплённые
                    </div>
                    <div className="bg-gray-200/60 dark:bg-gray-800/60 rounded-xl p-1.5 border border-gray-300/50 dark:border-gray-700/50 space-y-0.5">
                      {pinnedItems.map((item) =>
                        item.kind === 'folder'
                          ? renderFolderRow(item.data as Folder)
                          : renderChannelRow(item.data as Channel)
                      )}
                    </div>
                  </div>
                )}
                {renderTree(null)}
                {folders.length === 0 && channels.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Нет каналов. ПКМ — создать.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ ЦЕНТР: чат канала ═══ */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0 relative">
          {selectedChannel ? (
            <>
              {/* ChatHeader в режиме канала: имя канала, закрепы канала,
                  кнопка «Участники сервера», клик по хитбоксу → медиа канала */}
              <ChatHeader
                key={selectedChannel.id}
                chatId={selectedChannel.id}
                chatType="channel"
                channelName={selectedChannel.name}
                currentUser={currentUser}
                onToggleMembers={() => setShowMembersList((v) => !v)}
                membersVisible={showMembersList}
              />

              {/* ═══ Панель мультивыбора ═══ */}
              {selectionMode && (
                <div className="absolute top-14 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md px-4 py-2.5 flex items-center gap-3 animate-fadeIn">
                  <button onClick={exitSelection} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Отмена">
                    <X size={18} />
                  </button>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Выбрано: {selectedIds.length}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={handleReplySelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Ответить">
                      <Reply size={17} />
                    </button>
                    <button onClick={handleForwardSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Переслать">
                      <Forward size={17} />
                    </button>
                    <button onClick={handleCopySelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Скопировать">
                      <Copy size={17} />
                    </button>
                    <button onClick={handlePinSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40" title="Закрепить">
                      <Pin size={17} />
                    </button>
                    <button onClick={handleDeleteSelected} disabled={selectedIds.length === 0} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 disabled:opacity-40" title="Удалить">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-2 bg-gradient-to-br from-gray-50 to-blue-50/50 dark:from-gray-900 dark:to-[#0c1a3d]">
                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                      <Hash size={32} className="text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      Добро пожаловать в #{selectedChannel.name}!
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Это начало канала</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = Number(msg.sender_id) === Number(currentUser?.id);
                  return (
                    <div
                      key={msg.id}
                      data-message-id={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[85%] md:max-w-[70%]">
                        <MessageBubble
                          msg={msg}
                          isMe={isMe}
                          senderName={!isMe ? (msg.sender_username || msg.sender?.display_name || msg.sender?.username) : undefined}
                          senderAvatar={!isMe ? (msg.sender_avatar || msg.sender?.avatar_url) : undefined}
                          senderId={!isMe ? msg.sender_id : undefined}
                          currentUserId={Number(currentUser?.id)}
                          time={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          menuPosition={!selectionMode && activeMenuId === msg.id ? menuCoords : null}
                          onContextMenu={handleMsgContextMenu}
                          closeMenu={() => { setActiveMenuId(null); setMenuCoords(null); }}
                          onReply={(m) => setReplyingTo(m)}
                          onPin={(m) => handlePinMsg(m.id)}
                          onEdit={(m) => setEditingMessage(m)}
                          onDelete={(id) => handleDeleteMsg(id)}
                          onForward={(m) => { setForwardMessages([m]); setShowForwardModal(true); }}
                          replySources={getReplySources(msg)}
                          onSenderClick={(uid) => uid !== Number(currentUser?.id) && setInfoUserId(uid)}
                          onReplyClick={flashTarget}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.includes(msg.id)}
                          onToggleSelect={toggleSelect}
                          onEnterSelection={enterSelection}
                        />
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <ChatInput
                onSendMessage={handleSend}
                onEditMessage={handleEditMsg}
                replyingTo={replyingTo}
                editingMessage={editingMessage}
                onCancelReply={() => { setReplyingTo(null); setEditingMessage(null); }}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Выберите текстовый канал
            </div>
          )}
        </div>

        {/* ═══ ПРАВО: участники сервера ═══ */}
        {showMembersList && (
          <div className="w-60 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Участники — {members.length}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {(['owner', 'admin', 'member'] as const).map((role) => {
                const list = members.filter((m) => (m.role || 'member') === role);
                if (list.length === 0) return null;
                const titles = { owner: 'ВЛАДЕЛЕЦ', admin: 'АДМИНИСТРАТОРЫ', member: 'УЧАСТНИКИ' };
                return (
                  <div key={role} className="mb-3">
                    <h4 className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-2 mb-1">
                      {titles[role]} — {list.length}
                    </h4>
                    {list.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => Number(m.id) !== Number(currentUser?.id) && setInfoUserId(m.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="relative">
                          <AvatarImg src={m.avatar_url} name={m.display_name || m.username} size={32} />
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-50 dark:border-gray-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                            {m.display_name || m.username}
                          </span>
                          <span className="text-[10px] text-gray-400 truncate block">@{m.username}</span>
                        </div>
                        {m.role === 'owner' && <Crown size={14} className="text-yellow-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                );
              })}
              {members.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Загрузка...</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Контекстное меню структуры ═══ */}
      {ctxMenu && (
        <div
          className="fixed z-[80] w-60 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 text-sm animate-fadeIn"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.kind !== 'root' && canManage && (
            <>
              <CtxItem icon={<ArrowUp size={15} />} text="Переместить наверх" onClick={() => moveItem('up')} />
              <CtxItem icon={<ArrowDown size={15} />} text="Переместить вниз" onClick={() => moveItem('down')} />
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            </>
          )}
          {canManage && (
            <div>
              <CtxItem
                icon={<Plus size={15} />}
                text="Создать"
                chevron
                onClick={(e) => { e.stopPropagation(); setCreateSubOpen((v) => !v); }}
              />
              {createSubOpen && (
                <div className="pl-3 pr-1 pb-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                  <CtxItem icon={<Folder size={14} className="text-yellow-500" />} text="Папку" onClick={() => createItem('folder')} />
                  <CtxItem icon={<Hash size={14} className="text-blue-500" />} text="Текстовый чат" onClick={() => createItem('text')} />
                  <CtxItem icon={<Volume2 size={14} className="text-green-500" />} text="Голосовой канал" onClick={() => createItem('voice')} />
                </div>
              )}
            </div>
          )}
          {ctxMenu.kind !== 'root' && (
            <>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              {canManage && <CtxItem icon={<Pencil size={15} />} text="Переименовать" onClick={startRename} />}
              <CtxItem icon={<Pin size={15} />} text={ctxMenu.isPinned ? 'Открепить' : 'Закрепить'} onClick={togglePin} />
              {canManage && <CtxItem icon={<Trash2 size={15} />} text="Удалить" danger onClick={deleteItem} />}
            </>
          )}
        </div>
      )}

      {/* ═══ Модалка переименования ═══ */}
      {renaming && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRenaming(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Переименовать {renaming.kind === 'folder' ? 'папку' : 'канал'}
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
              maxLength={50}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRenaming(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                Отмена
              </button>
              <button onClick={submitRename} className="px-4 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 font-medium">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Модалка добавления участников ═══ */}
      {showAddMembers && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddMembers(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Пригласить на сервер</h3>
              <button onClick={() => setShowAddMembers(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
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
                  placeholder="Поиск среди друзей и контактов..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pb-2">
              {searching ? (
                <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                  <Loader2 size={18} className="animate-spin" /> Поиск...
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Никого не найдено</div>
              ) : (
                candidates.map((u) => {
                  const checked = toAdd.includes(Number(u.id));
                  return (
                    <button
                      key={u.id}
                      onClick={() => setToAdd((prev) => checked ? prev.filter((x) => x !== Number(u.id)) : [...prev, Number(u.id)])}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <AvatarImg src={u.avatar_url} name={u.display_name || u.username} size={36} />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.display_name || u.username}</p>
                        <p className="text-xs text-gray-500 truncate">
                          @{u.username}
                          {u.source === 'friend' && <span className="ml-1.5 text-green-600 dark:text-green-400">· друг</span>}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
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
                className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adding && <Loader2 size={15} className="animate-spin" />}
                Пригласить {toAdd.length > 0 ? `(${toAdd.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Пересылка ═══ */}
      <ForwardModal
        open={showForwardModal}
        messages={forwardMessages}
        currentUser={currentUser}
        onClose={() => { setShowForwardModal(false); setForwardMessages(null); }}
        onForward={handleForwardConfirm}
      />

      {/* ═══ НОВОЕ: модалка сервера (аватар, дата создания, участники, приглашение, общее медиа) ═══ */}
      {showServerInfo && (
        <ChatInfoModal
          open={true}
          chatId={serverId}
          chatType="server"
          currentUser={currentUser}
          onClose={() => setShowServerInfo(false)}
          onUpdated={() => loadMembers()}
        />
      )}

      {/* ═══ Профиль пользователя (клик по участнику/аватару) ═══ */}
      {infoUserId !== null && (
        <ChatInfoModal
          open={true}
          chatId={infoUserId}
          chatType="user"
          currentUser={currentUser}
          serverId={serverId}
          onClose={() => setInfoUserId(null)}
          onUpdated={() => loadMembers()}
        />
      )}

      {/* ═══ Голосовой канал ═══ */}
      {activeVoiceChannel && (
        <VoiceChannel
          channelId={activeVoiceChannel}
          channelName={channels.find((ch) => ch.id === activeVoiceChannel)?.name || 'Voice'}
          serverId={serverId}
          onLeave={() => setActiveVoiceChannel(null)}
        />
      )}

      <style>{`
        @keyframes messageFlash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
          20%, 60% { box-shadow: 0 0 0 4px rgba(34,197,94,0.6); }
          40%, 80% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .message-flash { animation: messageFlash 1.6s ease-in-out; border-radius: 1rem; }
      `}</style>
    </>
  );
};

const CtxItem = ({ icon, text, onClick, danger, chevron }: {
  icon: React.ReactNode; text: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; chevron?: boolean;
}) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    className={`w-full text-left px-3.5 py-2 text-sm flex items-center gap-2.5 transition-colors ${
      danger
        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    {icon}
    <span className="font-medium flex-1">{text}</span>
    {chevron && <ChevronRight size={13} className="opacity-50" />}
  </button>
);