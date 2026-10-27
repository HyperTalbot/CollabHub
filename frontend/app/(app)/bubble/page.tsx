// frontend/app/(app)/bubble/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Map, MessageCircleMore } from 'lucide-react';
import Cookies from 'js-cookie';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import { CreateModal } from '@/components/messenger/CreateModal';
import { NavigationRail } from '@/components/messenger/NavigationRail';
import { ChatListSidebar } from '@/components/messenger/ChatListSidebar';
import { ChatArea } from '@/components/messenger/ChatArea';
import { ChatHeader } from '@/components/messenger/ChatHeader';
import { ServerPage } from '@/components/messenger/ServerPage';
import { FriendsPage } from '@/components/messenger/FriendsPage';
import { usePendingRequests } from '@/hooks/usePendingRequests';
import { Message, Server, ViewMode, ChatPreview, Conversation, Group } from '@/types/messenger';
import toast from 'react-hot-toast';

const MESSENGER_API_URL = 'https://collabhub.cloudpub.ru/api/v1/messenger';
const MAX_MESSAGE_LENGTH = 4096;

export default function MessengerPage() {
	const { user: currentUser, isLoggedIn } = useAuth();
	const { lastJsonMessage, sendMessage } = useWebSocket();
  // НОВОЕ: счётчик запросов в друзья + приглашений на серверы
	const { total: pendingRequests } = usePendingRequests();

	// ─── Представления / серверы ───
	const [activeView, setActiveView] = useState<ViewMode>('dm');
	const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
	const [serverList, setServerList] = useState<Server[]>([]);
	const [isSidebarVisible, setIsSidebarVisible] = useState(true);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	// ─── Чаты ───
	const [chatList, setChatList] = useState<ChatPreview[]>([]);
	const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
	const [selectedChatType, setSelectedChatType] = useState<'dm' | 'group' | null>(null);
	const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
	const [storedLastReadId, setStoredLastReadId] = useState<number>(0);
	const [loading, setLoading] = useState(true);
	const [hasMore, setHasMore] = useState(true);
	const [isFetchingMore, setIsFetchingMore] = useState(false);

	// ══════════════════════════════════════════════════════════════
	// Загрузка данных
	// ══════════════════════════════════════════════════════════════
	const refreshData = async () => {
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		if (!token) return;
		try {
			const [serversRes, chatsRes, groupsRes] = await Promise.allSettled([
				axios.get(`${MESSENGER_API_URL}/servers`),
				axios.get(`${MESSENGER_API_URL}/conversations`),
				axios.get(`${MESSENGER_API_URL}/groups`)
			]);

			if (serversRes.status === 'fulfilled') {
				setServerList(serversRes.value.data || []);
			}

			let mergedChats: ChatPreview[] = [];
			if (chatsRes.status === 'fulfilled') {
				const dms: Conversation[] = chatsRes.value.data || [];
				mergedChats = mergedChats.concat(dms.map(c => {
					const partner = c.participants?.find(p => Number(p.id) !== Number(currentUser?.id));
					return {
						id: c.id,
						type: 'dm' as const,
						title: partner?.display_name || partner?.username || 'Неизвестный',
						avatarUrl: partner?.avatar_url,
						lastMessage: c.last_message_content,
						lastMessageDate: c.last_message_at,
						unreadCount: c.unread_count || 0,
						originalData: c
					};
				}));
			}
			if (groupsRes.status === 'fulfilled') {
				const groups: Group[] = groupsRes.value.data || [];
				mergedChats = mergedChats.concat(groups.map(g => ({
					id: g.id,
					type: 'group' as const,
					title: g.name,
					avatarUrl: g.avatar_url,
					lastMessage: g.last_message_content,
					lastMessageDate: g.last_message_at,
					unreadCount: g.unread_count || 0,
					originalData: g
				})));
			}

			mergedChats.sort((a, b) => {
				const tA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
				const tB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
				return tB - tA;
			});
			setChatList(mergedChats);
		} catch (e) {
			console.error("Data load error", e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isLoggedIn && currentUser) refreshData();
	}, [isLoggedIn, currentUser]);

	// ══════════════════════════════════════════════════════════════
	// Навигация
	// ══════════════════════════════════════════════════════════════
	const handleNavigate = (view: ViewMode, id?: number) => {
		setActiveView(view);
		if (view === 'server' && id) {
			setSelectedServerId(id);
			// режимы независимы: сбрасываем чат
			setSelectedChatId(null);
			setSelectedChatType(null);
			setIsSidebarVisible(false);
		} else {
			setSelectedServerId(null);
			setIsSidebarVisible(view === 'dm');
		}
	};

	const handleSelectChat = (id: number, type: 'dm' | 'group') => {
		setSelectedChatId(id);
		setSelectedChatType(type);
		setChatList(prev => prev.map(c =>
			(c.id === id && c.type === type) ? { ...c, unreadCount: 0 } : c
		));
	};

	const handleCreated = async () => {
		setIsCreateModalOpen(false);
		await refreshData();
		// сообщаем ChatListSidebar о необходимости обновить свой список
		window.dispatchEvent(new CustomEvent('group-updated', { detail: {} }));
	};

	const handleStartChatWithUser = async (userId: number) => {
		try {
			const { data } = await axios.post(`${MESSENGER_API_URL}/conversations`, {
				target_user_id: userId
			});
			setActiveView('dm');
			setSelectedServerId(null);
			setIsSidebarVisible(true);
			await refreshData();
			window.dispatchEvent(new CustomEvent('group-updated', { detail: {} }));
			setSelectedChatId(data.id);
			setSelectedChatType('dm');
			toast.success('Чат открыт');
		} catch (error) {
			console.error('Failed to start chat:', error);
			toast.error('Не удалось открыть чат');
		}
	};

	// ══════════════════════════════════════════════════════════════
	// Прочитано / непрочитано
	// ══════════════════════════════════════════════════════════════
	const markChatRead = async (id: number, type: 'dm' | 'group', messageId?: number) => {
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		const readEndpoint = type === 'dm'
			? `/conversations/${id}/read`
			: `/groups/${id}/read`;
		try {
			await axios.post(
				`${MESSENGER_API_URL}${readEndpoint}`,
				messageId ? { message_id: messageId } : {},
				{ headers: { 'Authorization': `Bearer ${token}` } }
			);
		} catch (e) {
			console.error('mark read failed', e);
		}
	};

	// Вызывается из ChatArea, когда пользователь РЕАЛЬНО УВИДЕЛ сообщение.
	// cid/ctype передаются явно: flush отложенной пометки может прийти
	// уже после переключения на другой чат.
	const handleMarkRead = async (messageId: number, cid?: number, ctype?: 'dm' | 'group') => {
		const id = cid ?? selectedChatId;
		const type = ctype ?? selectedChatType;
		if (!id || !type) return;
		markChatRead(id, type, messageId);
	};

	// ══════════════════════════════════════════════════════════════
	// История чата
	// ══════════════════════════════════════════════════════════════
	useEffect(() => {
		if (!selectedChatId || !selectedChatType) return;

		setActiveChatMessages([]);
		setHasMore(true);
		// сбрасываем, чтобы значение из прошлого чата не влияло на плашку
		setStoredLastReadId(0);

		const fetchHistory = async () => {
			const token = Cookies.get('authToken') || localStorage.getItem('authToken');
			const endpoint = selectedChatType === 'dm'
				? `/conversations/${selectedChatId}/messages`
				: `/groups/${selectedChatId}/messages`;
			try {
				const res = await axios.get(`${MESSENGER_API_URL}${endpoint}`, {
					headers: { 'Authorization': `Bearer ${token}` }
				});
				setActiveChatMessages(res.data.messages || []);
				setStoredLastReadId(Number(res.data.last_read_message_id) || 0);
				setHasMore((res.data.messages || []).length >= 50);
				// НЕ помечаем прочитанным при открытии — это делает
				// трекер видимости в ChatArea (иначе плашка «Новые сообщения»
				// вставала только у последнего сообщения)
			} catch (e) {
				console.error(e);
			}
		};
		fetchHistory();
	}, [selectedChatId, selectedChatType]);

	const handleLoadMore = async () => {
		if (!selectedChatId || !selectedChatType || !hasMore || isFetchingMore || activeChatMessages.length === 0) return;

		setIsFetchingMore(true);
		const oldestMessageId = activeChatMessages[0].id;
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		const endpoint = selectedChatType === 'dm'
			? `/conversations/${selectedChatId}/messages`
			: `/groups/${selectedChatId}/messages`;
		try {
			const res = await axios.get(`${MESSENGER_API_URL}${endpoint}?before_id=${oldestMessageId}`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const older: Message[] = res.data.messages || [];
			if (older.length < 50) setHasMore(false);
			if (older.length > 0) {
				setActiveChatMessages(prev => {
					const existing = new Set(prev.map(m => m.id));
					const unique = older.filter(m => !existing.has(m.id));
					return [...unique, ...prev];
				});
			}
		} catch (e) {
			console.error(e);
		} finally {
			setIsFetchingMore(false);
		}
	};

	// ══════════════════════════════════════════════════════════════
	// Live-сообщения из WebSocket
	// ══════════════════════════════════════════════════════════════
	useEffect(() => {
		if (!lastJsonMessage) return;
		const msgPayload = (lastJsonMessage as any).payload || lastJsonMessage;
		const msgChatId = msgPayload.conversation_id || msgPayload.group_id;
		const msgType = msgPayload.group_id ? 'group' : 'dm';

    // НОВОЕ: сообщения каналов серверов обрабатывает ServerPage — пропускаем
		if (!msgChatId) return;

		// Обновляем сообщения в активном чате (БЕЗ автопометки прочитанным)
		if (selectedChatId === msgChatId && selectedChatType === msgType) {
			setActiveChatMessages(prev => {
				if (prev.some(m => m.id === msgPayload.id)) return prev;
				return [...prev, msgPayload];
			});
		}

		// Обновляем превью в списке чатов
		setChatList(prev => {
			const idx = prev.findIndex(c => c.id === msgChatId && c.type === msgType);
			if (idx === -1) {
				refreshData();
				return prev;
			}
			const existing = prev[idx];
			const isMine = Number(msgPayload.sender_id) === Number(currentUser?.id);
			const isActiveChat = selectedChatId === msgChatId && selectedChatType === msgType;
			const updated: ChatPreview = {
				...existing,
				lastMessage: msgPayload.content,
				lastMessageDate: msgPayload.created_at,
				unreadCount: isActiveChat || isMine ? 0 : (existing.unreadCount + 1)
			};
			const newArr = [...prev];
			newArr.splice(idx, 1);
			return [updated, ...newArr];
		});
	}, [lastJsonMessage, selectedChatId, selectedChatType, currentUser]);

	// ══════════════════════════════════════════════════════════════
	// Live-события: редактирование / удаление / закрепление / ✓✓ / выход из группы
	// ══════════════════════════════════════════════════════════════
	useEffect(() => {
		const onMessageUpdated = (e: Event) => {
			const p = (e as CustomEvent).detail;
			setActiveChatMessages(prev => prev.map(m =>
				m.id === p.id ? { ...m, content: p.content, is_edited: true } : m
			));
		};
		const onMessageDeleted = (e: Event) => {
			const p = (e as CustomEvent).detail;
			setActiveChatMessages(prev => prev.filter(m => m.id !== p.id));
		};
		const onMessagePinned = (e: Event) => {
			const p = (e as CustomEvent).detail;
			setActiveChatMessages(prev => prev.map(m =>
				m.id === p.message_id ? { ...m, is_pinned: p.is_pinned } : m
			));
		};

		window.addEventListener('message-updated', onMessageUpdated);
		window.addEventListener('message-deleted', onMessageDeleted);
		window.addEventListener('message-pinned', onMessagePinned);
		return () => {
			window.removeEventListener('message-updated', onMessageUpdated);
			window.removeEventListener('message-deleted', onMessageDeleted);
			window.removeEventListener('message-pinned', onMessagePinned);
		};
	}, []);

	// Собеседник прочитал сообщения → меняем ✓ на ✓✓ у своих
	useEffect(() => {
		const onMessagesRead = (e: Event) => {
			const d = (e as CustomEvent).detail || {};
			const evtChatId = Number(d.conversation_id || d.group_id);
			const evtType = d.group_id ? 'group' : 'dm';
			if (evtChatId !== Number(selectedChatId) || evtType !== selectedChatType) return;

			const lastRead = Number(d.last_read_message_id) || 0;
			setActiveChatMessages(prev => prev.map(m =>
				Number(m.sender_id) === Number(currentUser?.id) && m.id <= lastRead
					? { ...m, is_read_by_recipient: true }
					: m
			));
		};
		window.addEventListener('messages-read', onMessagesRead);
		return () => window.removeEventListener('messages-read', onMessagesRead);
	}, [selectedChatId, selectedChatType, currentUser]);

	// Пользователь покинул группу или был удалён из неё
	useEffect(() => {
		const onGroupLeft = (e: Event) => {
			const gid = Number((e as CustomEvent).detail?.group_id);
			if (!gid) return;
			if (selectedChatType === 'group' && Number(selectedChatId) === gid) {
				setSelectedChatId(null);
				setSelectedChatType(null);
			}
			refreshData();
			window.dispatchEvent(new CustomEvent('group-updated', { detail: {} }));
		};
		window.addEventListener('group-left', onGroupLeft);
		return () => window.removeEventListener('group-left', onGroupLeft);
	}, [selectedChatId, selectedChatType]);

	// ══════════════════════════════════════════════════════════════
	// Действия с сообщениями
	// ══════════════════════════════════════════════════════════════
	const handleSendMessage = async (text: string, replyToId?: number, files?: File[], replyToIds?: number[]) => {
		if (!selectedChatId || !selectedChatType) return;
		if (!text.trim() && (!files || files.length === 0)) return;

		// Файлы — через REST API (attachment)
		if (files && files.length > 0) {
			for (const file of files) {
				const formData = new FormData();
				formData.append('file', file);
				if (selectedChatType === 'dm') formData.append('conversation_id', selectedChatId.toString());
				if (selectedChatType === 'group') formData.append('group_id', selectedChatId.toString());

				try {
					await axios.post(`${MESSENGER_API_URL}/messages/attachment`, formData, {
						headers: { 'Content-Type': 'multipart/form-data' }
					});
				} catch (error) {
					console.error('File upload error:', error);
					toast.error('Не удалось отправить файл');
				}
			}
			return;
		}

		// Разбиваем текст на чанки по MAX_MESSAGE_LENGTH (4096)
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
			chunks.push(text.substring(i, i + MAX_MESSAGE_LENGTH));
		}

		for (let idx = 0; idx < chunks.length; idx++) {
			const chunk = chunks[idx];
			const payload: any = { content: chunk };
			if (selectedChatType === 'dm') payload.conversation_id = selectedChatId;
			else payload.group_id = selectedChatId;

			// Ответ прикрепляем только к первому чанку
			if (idx === 0) {
				if (replyToId) payload.reply_to_id = replyToId;
				if (replyToIds && replyToIds.length > 1) payload.reply_to_ids = replyToIds;
			}

			sendMessage(payload, chunk);
			await new Promise(r => setTimeout(r, 50));
		}
	};

	// Пересылка — поддерживает МАССИВ сообщений (мультивыбор)
	const handleForwardMessage = async (
		message: Message | Message[],
		targets: { id: number; type: 'dm' | 'group' | 'channel' }[],
		comment?: string,
		showSender?: boolean
	) => {
		const list = Array.isArray(message) ? message : [message];
		if (list.length === 0) return;
		try {
			for (const t of targets) {
				for (const m of list) {
					const payload: any = { content: m.content || '' };
					if (t.type === 'dm') payload.conversation_id = t.id;
					else if (t.type === 'group') payload.group_id = t.id;
					else payload.channel_id = t.id; // НОВОЕ: канал сервера
					if (showSender !== false) payload.forwarded_from = m.sender_id;
					if (m.attachment_url) {
						payload.attachment_url = m.attachment_url;
						payload.attachment_type = m.attachment_type;
					}
					sendMessage(payload, m.content || 'вложение');
					await new Promise(r => setTimeout(r, 80));
				}
				if (comment && comment.trim()) {
					const commentPayload: any = { content: comment.trim() };
					if (t.type === 'dm') commentPayload.conversation_id = t.id;
					else if (t.type === 'group') commentPayload.group_id = t.id;
					else commentPayload.channel_id = t.id;
					sendMessage(commentPayload, comment.trim());
					await new Promise(r => setTimeout(r, 80));
				}
			}
			toast.success(`Переслано в чатов: ${targets.length}`);
		} catch (e) {
			console.error('Forward error:', e);
			toast.error('Не удалось переслать сообщение');
		}
	};

	const handleEditMessage = async (messageId: number, newContent: string) => {
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		try {
			await axios.put(
				`${MESSENGER_API_URL}/messages/${messageId}/edit`,
				{ content: newContent },
				{ headers: { 'Authorization': `Bearer ${token}` } }
			);
			setActiveChatMessages(prev => prev.map(m =>
				m.id === messageId ? { ...m, content: newContent, is_edited: true } : m
			));
			toast.success('Сообщение изменено');
		} catch (e: any) {
			console.error('Edit error:', e);
			toast.error(e?.response?.data?.error || 'Не удалось изменить сообщение');
		}
	};

	const handleDeleteMessage = async (messageId: number, deleteForBoth: boolean) => {
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		try {
			await axios.delete(`${MESSENGER_API_URL}/messages/${messageId}/delete`, {
				headers: { 'Authorization': `Bearer ${token}` },
				data: { delete_for_both: deleteForBoth }
			});
			setActiveChatMessages(prev => prev.filter(m => m.id !== messageId));
			toast.success('Сообщение удалено');
		} catch (e: any) {
			console.error('Delete error:', e);
			toast.error(e?.response?.data?.error || 'Не удалось удалить сообщение');
		}
	};

	const handlePinMessage = async (msgId: number) => {
		const token = Cookies.get('authToken') || localStorage.getItem('authToken');
		try {
			await axios.post(
				`${MESSENGER_API_URL}/messages/${msgId}/pin`,
				{},
				{ headers: { 'Authorization': `Bearer ${token}` } }
			);
			// обновится через WS-событие message_pinned
		} catch (e) {
			console.error('Pin error:', e);
			toast.error('Не удалось закрепить сообщение');
		}
	};

  // НОВОЕ: добавили на сервер → обновляем список серверов
	useEffect(() => {
		const onServersUpdated = () => { refreshData(); };
		window.addEventListener('servers-updated', onServersUpdated);
		return () => window.removeEventListener('servers-updated', onServersUpdated);
	}, [currentUser]);

	// ══════════════════════════════════════════════════════════════
	// RENDER
	// ══════════════════════════════════════════════════════════════
	if (!isLoggedIn) {
		return (
			<div className="flex h-[calc(100vh-80px)] items-center justify-center dark:bg-gray-900 text-gray-500">
				Пожалуйста, войдите в систему
			</div>
		);
	}

	const currentChatPreview = chatList.find(c => c.id === selectedChatId && c.type === selectedChatType);

	return (
		<div className="flex h-[calc(100vh-120px)] rounded-2xl shadow-xl overflow-hidden dark:bg-gray-900 mt-4 border border-gray-200 dark:border-gray-800 bg-white">
			{/* ЛЕВАЯ ПАНЕЛЬ — NavigationRail (ЛС / Друзья / Карта / Серверы) */}
			<NavigationRail
				servers={serverList}
				activeView={activeView}
				selectedServerId={selectedServerId}
				friendsBadge={pendingRequests}
				onNavigate={handleNavigate}
				onCreateClick={() => setIsCreateModalOpen(true)}
			/>

			{/* ═══ РЕЖИМЫ НЕЗАВИСИМЫ: сервер / друзья / карта / чаты ═══ */}
			{activeView === 'server' && selectedServerId ? (
				/* РЕЖИМ СЕРВЕРА: только ServerPage на всю оставшуюся ширину.
				   ChatListSidebar/ChatHeader/ChatArea НЕ рендерятся */
				<div className="flex-1 flex flex-col overflow-hidden">
					<ServerPage
						serverId={selectedServerId}
						serverName={serverList.find(s => s.id === selectedServerId)?.name || 'Сервер'}
						serverAvatar={serverList.find(s => s.id === selectedServerId)?.avatar_url}
						currentUser={currentUser}
						onClose={() => {
							setActiveView('dm');
							setSelectedServerId(null);
							setIsSidebarVisible(true);
						}}
					/>
				</div>
			) : activeView === 'friends' ? (
				<div className="flex-1 overflow-hidden">
					<FriendsPage
						currentUser={currentUser}
						onStartChat={handleStartChatWithUser}
					/>
				</div>
			) : activeView === 'map' ? (
				<div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
					<Map size={64} className="text-green-500 mb-4" />
					<h2 className="text-2xl font-bold text-gray-800 dark:text-white">Карта мира</h2>
					<p className="text-gray-500 mt-2">Интерактивная карта пользователей</p>
				</div>
			) : (
				/* ═══ РЕЖИМ ЧАТОВ ═══ */
				<PanelGroup direction="horizontal" autoSaveId="messenger-layout">
					{isSidebarVisible && (
						<>
							<Panel
								defaultSize={25}
								minSize={15}
								maxSize={35}
								order={1}
								id="sidebar-panel"
								className="min-w-[280px] bg-gray-50 dark:bg-gray-900"
							>
								<ChatListSidebar
									currentUser={currentUser}
									selectedChatId={selectedChatId}
									selectedChatType={selectedChatType}
									onSelectChat={handleSelectChat}
								/>
							</Panel>
							<PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 transition-colors cursor-col-resize z-20" />
						</>
					)}

					<Panel minSize={30} order={2} id="chat-panel">
						<div className="h-full flex flex-col bg-white dark:bg-gray-800">
							{selectedChatId && selectedChatType ? (
								<>
									<ChatHeader
										chatId={selectedChatId}
										chatType={selectedChatType}
										currentUser={currentUser}
										cachedChatData={currentChatPreview}
									/>

									<ChatArea
										chatId={selectedChatId}
										chatType={selectedChatType}
										messages={activeChatMessages}
										currentUser={currentUser}
										storedLastReadId={storedLastReadId}
										onSendMessage={handleSendMessage}
										onPinMessage={handlePinMessage}
										onForwardMessage={handleForwardMessage}
										onEditMessage={handleEditMessage}
										onDeleteMessage={handleDeleteMessage}
										onMarkRead={handleMarkRead}
										isSidebarOpen={isSidebarVisible}
										onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
										onLoadMore={handleLoadMore}
										hasMore={hasMore}
										isLoadingMessages={isFetchingMore}
									/>
								</>
							) : (
								<div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative">
									{!isSidebarVisible && (
										<button
											onClick={() => setIsSidebarVisible(true)}
											className="absolute top-4 left-4 p-3 bg-white dark:bg-gray-800 shadow-md rounded-xl hover:scale-105 transition-transform z-20"
										>
											<MessageCircleMore size={20} className="text-gray-600 dark:text-gray-300" />
										</button>
									)}
									<div className="text-center text-gray-500 dark:text-gray-400">
										<MessageCircleMore size={64} className="mx-auto mb-4 opacity-20" />
										<p className="text-lg font-medium">Выберите чат, чтобы начать общение</p>
									</div>
								</div>
							)}
						</div>
					</Panel>
				</PanelGroup>
			)}

			{/* Модальное окно создания (группа / сервер) */}
			<CreateModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onCreated={handleCreated}
			/>
		</div>
	);
}