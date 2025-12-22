// /types/messenger.ts

export interface User {
  id: number;
  username: string;
  email?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Conversation {
  id: number;
  type?: 'dm' | 'group'; // Опционально, если бэкенд пока не шлет
  name?: string;
  avatar_url?: string;
  updated_at: string;
  participants: User[];
  last_message_content?: string;
  last_message_at?: string;
  unread_count: number;
  created_at?: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: User;
  content: string;
  created_at: string;
  updated_at?: string;
  reply_to_id?: number; // ID сообщения на которое отвечают
  is_edited?: boolean;
  is_pinned?: boolean;
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