export interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  cover_url: string;
  audio_url: string;
  duration: number;
  genre?: string;
  release_year?: number;
  play_count?: number;
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
  user_id: number;
  is_public: boolean;
  tracks?: Track[];
  created_at?: string;
  updated_at?: string;
}

export interface Comment {
  id: number;
  track_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface ListeningHistory {
  id: number;
  user_id: number;
  track_id: number;
  played_at: string;
  duration: number;
}

export interface TrackLike {
  user_id: number;
  track_id: number;
  created_at: string;
}

export type PlayMode = 'normal' | 'shuffle' | 'repeat-all' | 'repeat-one';

export type DockPosition = 
  | 'top' 
  | 'top-right' 
  | 'right' 
  | 'bottom-right' 
  | 'bottom' 
  | 'bottom-left' 
  | 'left' 
  | 'top-left';

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  position: DockPosition;
}

export interface MusicContextType {
  playerState: PlayerState;
  playTrack: (track: Track, queue?: Track[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setPosition: (position: DockPosition) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}