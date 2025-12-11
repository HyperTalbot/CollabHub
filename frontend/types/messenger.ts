// /types/messenger.ts

export interface User {
  id: number;
  username: string;
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
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: string;
}

export interface Server {
  id: number;
  name: string;
  avatar_url: string;
}

export type ViewMode = 'dm' | 'server' | 'friends' | 'map'; // Режим отображения (ЛС или Сервер)