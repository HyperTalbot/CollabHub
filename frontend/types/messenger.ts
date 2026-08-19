// /types/messenger.ts

export interface User {
  id: number;
  username: string;
  email?: string;
  avatar_url?: string;
  created_at?: string;
}

// export interface Conversation {
//   id: number;
//   type?: 'dm' | 'group'; // Опционально, если бэкенд пока не шлет
//   name?: string;
//   avatar_url?: string;
//   updated_at: string;
//   participants: User[];
//   last_message_sender_id: number;
//   last_message_content?: string;
//   last_message_at?: string;
//   unread_count: number;
//   created_at?: string;
// }

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_avatar: string | undefined;
  sender_username: string | undefined;
  sender?: User;
  content: string;
  created_at: string;
  updated_at?: string;
  reply_to_id?: number; // ID сообщения на которое отвечают
  is_edited?: boolean;
  is_pinned?: boolean;

  // Поля для вложений
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio' | 'file';

  // Системные сообщения
  is_system_message?: boolean;
  system_type?: 'call' | 'event';
  system_data?: string; // JSON string
}

export interface Server {
  id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  owner_id?: number;
  tags?: string;
  created_at?: string;
}

export interface Channel {
  id: number;
  server_id: number;
  name: string;
  type: 'text' | 'voice';
  category_id?: number;
  is_private?: boolean;
  position?: number;
  created_at?: string;
}

export type ViewMode = 'dm' | 'server' | 'friends' | 'map'; // Режим отображения (ЛС или Сервер)

// Модель ЛС (с бэкенда)
export interface Conversation {
  id: number;
  participants: User[];
  last_message_content?: string;
  last_message_at?: string;
  unread_count?: number;
}

// Модель Группы (с бэкенда)
export interface Group {
  id: number;
  name: string;
  description?: string;
  avatar_url?: string;
  owner_id: number;
  members?: { user_id: number; role: string }[]; // упрощенно
  last_message_content?: string;
  last_message_at?: string;
  unread_count?: number;
}

// --- УНИВЕРСАЛЬНЫЙ ТИП ДЛЯ UI ---
// Мы приводим и группы и чаты к этому виду перед рендером
export interface ChatPreview {
  id: number;
  type: 'dm' | 'group'; // Самое важное поле для различия
  title: string;        // Имя юзера или название группы
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount: number;
  originalData: Conversation | Group; // Ссылка на оригинал, если нужно
}

export interface PinnedMessage {
  id: number;
  message_id: number;
  content: string;
  sender_username: string;
  sender_id: number;
  created_at: string;
  pinned_at: string;
  pinned_by_user_id: number;
}