// Моковые данные для демонстрации без backend

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
}

export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
  tracks?: Track[];
}

export const mockTracks: Track[] = [
  {
    id: 1,
    title: "Sunset Dreams",
    artist: "The Waves",
    album: "Ocean Vibes",
    duration: 225,
    cover_url: "https://picsum.photos/seed/sunset/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    genre: "Поп",
    release_year: 2024,
    play_count: 15420,
    likes_count: 1230,
  },
  {
    id: 2,
    title: "Electric Love",
    artist: "Neon Hearts",
    album: "Synth Wave",
    duration: 252,
    cover_url: "https://picsum.photos/seed/electric/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    genre: "Электроника",
    release_year: 2024,
    play_count: 12890,
    likes_count: 980,
  },
  {
    id: 3,
    title: "Midnight City",
    artist: "Urban Soul",
    album: "City Lights",
    duration: 208,
    cover_url: "https://picsum.photos/seed/midnight/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    genre: "Инди",
    release_year: 2023,
    play_count: 18750,
    likes_count: 1450,
  },
  {
    id: 4,
    title: "Summer Vibes",
    artist: "Beach Boys Revival",
    album: "Tropical Mix",
    duration: 235,
    cover_url: "https://picsum.photos/seed/summer/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    genre: "Поп",
    release_year: 2024,
    play_count: 22100,
    likes_count: 1890,
  },
  {
    id: 5,
    title: "Rainy Day",
    artist: "Acoustic Dreams",
    album: "Calm Sessions",
    duration: 243,
    cover_url: "https://picsum.photos/seed/rain/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    genre: "Акустика",
    release_year: 2023,
    play_count: 9540,
    likes_count: 720,
  },
  {
    id: 6,
    title: "Dance Floor",
    artist: "DJ Pulse",
    album: "Club Nights",
    duration: 198,
    cover_url: "https://picsum.photos/seed/dance/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    genre: "Электроника",
    release_year: 2024,
    play_count: 31200,
    likes_count: 2450,
  },
  {
    id: 7,
    title: "Mountain High",
    artist: "Echo Valley",
    album: "Nature Sounds",
    duration: 267,
    cover_url: "https://picsum.photos/seed/mountain/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    genre: "Рок",
    release_year: 2023,
    play_count: 14300,
    likes_count: 1100,
  },
  {
    id: 8,
    title: "Jazz Night",
    artist: "The Blue Notes",
    album: "Smooth Sessions",
    duration: 289,
    cover_url: "https://picsum.photos/seed/jazz/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    genre: "Джаз",
    release_year: 2024,
    play_count: 8900,
    likes_count: 670,
  },
  {
    id: 9,
    title: "Hip Hop Chronicles",
    artist: "MC Flow",
    album: "Street Stories",
    duration: 213,
    cover_url: "https://picsum.photos/seed/hiphop/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    genre: "Хип-хоп",
    release_year: 2024,
    play_count: 27800,
    likes_count: 2100,
  },
  {
    id: 10,
    title: "Classical Morning",
    artist: "Symphony Orchestra",
    album: "Masterpieces",
    duration: 342,
    cover_url: "https://picsum.photos/seed/classical/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    genre: "Классика",
    release_year: 2023,
    play_count: 6700,
    likes_count: 520,
  },
  {
    id: 11,
    title: "Neon Lights",
    artist: "Synthwave Collective",
    album: "Retro Future",
    duration: 256,
    cover_url: "https://picsum.photos/seed/neon/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    genre: "Электроника",
    release_year: 2024,
    play_count: 19300,
    likes_count: 1540,
  },
  {
    id: 12,
    title: "Acoustic Sunrise",
    artist: "Morning Coffee",
    album: "Peaceful Moments",
    duration: 198,
    cover_url: "https://picsum.photos/seed/acoustic/400",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    genre: "Акустика",
    release_year: 2023,
    play_count: 11200,
    likes_count: 890,
  },
];

export const mockPlaylists: Playlist[] = [
  {
    id: 1,
    name: "Топ 50 - Россия",
    description: "Самые популярные треки недели",
    cover_url: "https://picsum.photos/seed/top50/400",
    tracks: mockTracks.slice(0, 10),
  },
  {
    id: 2,
    name: "Chill Vibes",
    description: "Расслабляющая музыка для работы",
    cover_url: "https://picsum.photos/seed/chill/400",
    tracks: mockTracks.filter(t => t.genre === "Акустика" || t.genre === "Джаз"),
  },
  {
    id: 3,
    name: "Workout Mix",
    description: "Энергичная музыка для тренировок",
    cover_url: "https://picsum.photos/seed/workout/400",
    tracks: mockTracks.filter(t => t.genre === "Электроника" || t.genre === "Хип-хоп"),
  },
  {
    id: 4,
    name: "Ретро 80-90s",
    description: "Хиты из прошлого",
    cover_url: "https://picsum.photos/seed/retro/400",
    tracks: mockTracks.slice(3, 8),
  },
  {
    id: 5,
    name: "Indie Rock",
    description: "Лучшие инди треки",
    cover_url: "https://picsum.photos/seed/indie/400",
    tracks: mockTracks.filter(t => t.genre === "Инди" || t.genre === "Рок"),
  },
  {
    id: 6,
    name: "Party Hits",
    description: "Музыка для вечеринок",
    cover_url: "https://picsum.photos/seed/party/400",
    tracks: mockTracks.filter(t => t.genre === "Поп" || t.genre === "Электроника"),
  },
];

export const mockGenres = [
  "Поп",
  "Рок",
  "Хип-хоп",
  "Электроника",
  "Джаз",
  "Классика",
  "Инди",
  "R&B",
  "Акустика",
];

// Функция для поиска треков
export const searchTracks = (query: string): Track[] => {
  const lowercaseQuery = query.toLowerCase();
  return mockTracks.filter(
    track =>
      track.title.toLowerCase().includes(lowercaseQuery) ||
      track.artist.toLowerCase().includes(lowercaseQuery) ||
      track.album?.toLowerCase().includes(lowercaseQuery)
  );
};

// Функция для получения похожих треков
export const getSimilarTracks = (trackId: number): Track[] => {
  const track = mockTracks.find(t => t.id === trackId);
  if (!track) return [];
  
  return mockTracks
    .filter(t => t.id !== trackId && t.genre === track.genre)
    .slice(0, 5);
};

// Функция для фильтрации по жанру
export const filterByGenre = (genre: string): Track[] => {
  return mockTracks.filter(track => track.genre === genre);
};