// frontend/types/video.ts
export interface Video {
  id: number;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  category: string;
  tags: string;
  user_id: number;
  username: string;
  view_count: number;
  like_count: number;
  dislike_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoPlaylist {
  id: number;
  name: string;
  description: string;
  thumbnail_url: string;
  user_id: number;
  is_public: boolean;
  videos?: Video[];
  created_at: string;
  updated_at: string;
}