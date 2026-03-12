// // frontend/app/(app)/symphonya/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { MusicPlayer } from '@/components/music/MusicPlayer';
// import { Search, Play } from 'lucide-react';

// interface Track {
//   id: number;
//   title: string;
//   artist: string;
//   album?: string;
//   cover_url: string;
//   audio_url: string;
//   duration: number;
//   genre?: string;
//   play_count?: number;
// }

// interface Playlist {
//   id: number;
//   name: string;
//   description: string;
//   cover_url: string;
//   tracks?: Track[];
// }

// // const API_URL = 'http://localhost:8085/api/music';
// const API_URL = 'https://collabhub.cloudpub.ru/api/v1/music';

// const SongCard = ({ track, onPlay }: { track: Track; onPlay: () => void }) => (
//   <div className="group cursor-pointer" onClick={onPlay}>
//     <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
//       <img 
//         src={track.cover_url} 
//         alt={track.title}
//         className="w-full h-full object-cover group-hover:scale-105 transition-transform"
//       />
//       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
//         <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 hover:scale-110 transition">
//           <Play size={24} className="text-black ml-1" />
//         </button>
//       </div>
//     </div>
//     <h3 className="font-semibold text-white text-sm line-clamp-1">{track.title}</h3>
//     <p className="text-gray-400 text-sm line-clamp-1">{track.artist}</p>
//   </div>
// );

// const PlaylistCard = ({ playlist, onPlay }: { playlist: Playlist; onPlay: () => void }) => (
//   <div className="group cursor-pointer" onClick={onPlay}>
//     <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
//       <img 
//         src={playlist.cover_url} 
//         alt={playlist.name}
//         className="w-full h-full object-cover group-hover:scale-105 transition-transform"
//       />
//       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
//         <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 hover:scale-110 transition">
//           <Play size={24} className="text-black ml-1" />
//         </button>
//       </div>
//     </div>
//     <h3 className="font-semibold text-white text-sm line-clamp-1">{playlist.name}</h3>
//     <p className="text-gray-400 text-sm line-clamp-2">{playlist.description}</p>
//   </div>
// );

// const GenreChip = ({ genre, onClick }: { genre: string; onClick: () => void }) => (
//   <button 
//     onClick={onClick}
//     className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-medium transition whitespace-nowrap"
//   >
//     {genre}
//   </button>
// );

// export default function SymphonyaPage() {
//   const [genres, setGenres] = useState<string[]>([]);
//   const [quickPicks, setQuickPicks] = useState<Track[]>([]);
//   const [recommended, setRecommended] = useState<Track[]>([]);
//   const [playlists, setPlaylists] = useState<Playlist[]>([]);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [searchResults, setSearchResults] = useState<Track[]>([]);
  
//   // Player state
//   const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
//   const [queue, setQueue] = useState<Track[]>([]);
//   const [isPlayerVisible, setIsPlayerVisible] = useState(false);

//   // Загрузка данных
//   useEffect(() => {
//     loadGenres();
//     loadQuickPicks();
//     loadRecommended();
//     loadPlaylists();
//   }, []);

//   const loadGenres = async () => {
//     try {
//       const res = await fetch(`${API_URL}/genres`);
//       const data = await res.json();
//       setGenres(data || []);
//     } catch (error) {
//       console.error('Failed to load genres:', error);
//     }
//   };

//   const loadQuickPicks = async () => {
//     try {
//       const res = await fetch(`${API_URL}/quick-picks`);
//       const data = await res.json();
//       setQuickPicks(data || []);
//     } catch (error) {
//       console.error('Failed to load quick picks:', error);
//     }
//   };

//   const loadRecommended = async () => {
//     try {
//       const res = await fetch(`${API_URL}/recommended`);
//       const data = await res.json();
//       setRecommended(data || []);
//     } catch (error) {
//       console.error('Failed to load recommended:', error);
//     }
//   };

//   const loadPlaylists = async () => {
//     try {
//       const res = await fetch(`${API_URL}/playlists/recommended`);
//       const data = await res.json();
//       setPlaylists(data || []);
//     } catch (error) {
//       console.error('Failed to load playlists:', error);
//     }
//   };

//   const handleSearch = async (query: string) => {
//     setSearchQuery(query);
//     if (!query.trim()) {
//       setSearchResults([]);
//       return;
//     }

//     try {
//       const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
//       const data = await res.json();
//       setSearchResults(data || []);
//     } catch (error) {
//       console.error('Search failed:', error);
//     }
//   };

//   const playTrack = async (track: Track, queueTracks: Track[] = []) => {
//     setCurrentTrack(track);
//     setQueue(queueTracks);
//     setIsPlayerVisible(true);

//     // Увеличиваем счетчик прослушиваний
//     try {
//       await fetch(`${API_URL}/tracks/${track.id}/play, { method: 'POST' }`);
//     } catch (error) {
//       console.error('Failed to increment play count:', error);
//     }
//   };

//   const playPlaylist = async (playlist: Playlist) => {
//     if (playlist.tracks && playlist.tracks.length > 0) {
//       playTrack(playlist.tracks[0], playlist.tracks.slice(1));
//     }
//   };

//   const handleNext = () => {
//     if (queue.length > 0) {
//       const [nextTrack, ...remainingQueue] = queue;
//       setCurrentTrack(nextTrack);
//       setQueue(remainingQueue);
//     }
//   };

//   const handlePrevious = () => {
//     // Для упрощения, просто перезапускаем текущий трек
//     if (currentTrack) {
//       playTrack(currentTrack, queue);
//     }
//   };

//   const handleTrackEnd = () => {
//     handleNext();
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 pb-32">
//       {/* Header */}
//       <header className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
//         <div className="container mx-auto px-6 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-8">
//             <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
//               Symphonya
//             </div>
//             <nav className="flex gap-6">
//               <button className="text-white hover:text-pink-400 transition">Главная</button>
//               <button className="text-gray-400 hover:text-white transition">Поиск</button>
//               <button className="text-gray-400 hover:text-white transition">Библиотека</button>
//             </nav>
//           </div>
//           <div className="flex items-center gap-4">
//             <div className="relative">
//               <input
//                 type="search"
//                 placeholder="Песни, исполнители, альбомы..."
//                 value={searchQuery}
//                 onChange={(e) => handleSearch(e.target.value)}
//                 className="w-80 px-4 py-2 pl-10 bg-white/10 text-white rounded-full focus:outline-none focus:bg-white/20 placeholder-gray-400"
//               />
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//             </div>
//             <button className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full"></button>
//           </div>
//         </div>

//         {/* Search Results */}
//         {searchResults.length > 0 && (
//           <div className="container mx-auto px-6 py-4 bg-gray-800/50">
//             <h3 className="text-white font-semibold mb-3">Результаты поиска</h3>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//               {searchResults.slice(0, 6).map((track) => (
//                 <SongCard key={track.id} track={track} onPlay={() => playTrack(track, searchResults.slice(1))} />
//               ))}
//             </div>
//           </div>
//         )}
//       </header>

//       {/* Main Content */}
//       <div className="container mx-auto px-6 py-8">
//         {/* Genres */}
//         {genres.length > 0 && (
//           <div className="mb-8">
//             <h2 className="text-2xl font-bold text-white mb-4">Жанры</h2>
//             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
//               {genres.map((genre, index) => (
//                 <GenreChip key={index} genre={genre} onClick={() => handleSearch(genre)} />
//               ))}
//             </div>
//           </div>
//         )}

//         {/* Featured Section */}
//         <div className="mb-12">
//           <div className="relative rounded-2xl overflow-hidden h-96 bg-gradient-to-br from-pink-600 to-purple-600">
//             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
//             <div className="absolute bottom-8 left-8">
//               <p className="text-pink-300 text-sm font-semibold mb-2">Плейлист дня</p>
//               <h1 className="text-5xl font-bold text-white mb-4">Топ хиты 2025</h1>
//               <p className="text-gray-300 mb-6">Самая популярная музыка прямо сейчас</p>
//               <button 
//                 onClick={() => quickPicks.length > 0 && playTrack(quickPicks[0], quickPicks.slice(1))}
//                 className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition flex items-center gap-2"
//               >
//                 <Play size={20} className="ml-1" />
//                 Играть
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Quick Picks */}
//         {quickPicks.length > 0 && (
//           <div className="mb-12">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-3xl font-bold text-white">Быстрый выбор</h2>
//               <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
//             </div>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//               {quickPicks.map((track) => (
//                 <SongCard key={track.id} track={track} onPlay={() => playTrack(track, quickPicks.filter(t => t.id !== track.id))} />
//               ))}
//             </div>
//           </div>
//         )}

//         {/* Recommended Tracks */}
//         {recommended.length > 0 && (
//           <div className="mb-12">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-3xl font-bold text-white">Рекомендации для вас</h2>
//               <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
//             </div>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//               {recommended.slice(0, 6).map((track) => (
//                 <SongCard key={track.id} track={track} onPlay={() => playTrack(track, recommended.filter(t => t.id !== track.id))} />
//               ))}
//             </div>
//           </div>
//         )}

//         {/* Playlists */}
//         {playlists.length > 0 && (
//           <div className="mb-12">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-3xl font-bold text-white">Плейлисты для тебя</h2>
//               <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
//             </div>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
//               {playlists.map((playlist) => (
//                 <PlaylistCard key={playlist.id} playlist={playlist} onPlay={() => playPlaylist(playlist)} />
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
      
//       {/* Music Player */}
//       {isPlayerVisible && currentTrack && (
//         <MusicPlayer
//           currentTrack={currentTrack}
//           queue={queue}
//           onNext={handleNext}
//           onPrevious={handlePrevious}
//           onTrackEnd={handleTrackEnd}
//           onClose={() => setIsPlayerVisible(false)}
//         />
//       )}

//       {/* CSS для скрытия scrollbar */}
//       <style jsx global>{`
//         .scrollbar-hide::-webkit-scrollbar {
//           display: none;
//         }
//         .scrollbar-hide {
//           -ms-overflow-style: none;
//           scrollbar-width: none;
//         }
//       `}</style>
//     </div>
//   );
// }

// frontend/app/(app)/symphonya/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { MusicPlayer } from '@/components/music/MusicPlayer';
import { Search, Play, Music } from 'lucide-react';
import Cookies from 'js-cookie';
import type { Track } from '@/types/music';

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/music';

// Компоненты
const SongCard = ({ track, onPlay }: { track: Track; onPlay: () => void }) => (
  <div className="group cursor-pointer" onClick={onPlay}>
    <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
      <img 
        src={track.cover_url} 
        alt={track.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
        <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 hover:scale-110 transition">
          <Play size={24} className="text-black ml-1" />
        </button>
      </div>
    </div>
    <h3 className="font-semibold text-white text-sm line-clamp-1">{track.title}</h3>
    <p className="text-gray-400 text-sm line-clamp-1">{track.artist}</p>
  </div>
);

const GenreChip = ({ genre, onClick }: { genre: string; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-medium transition whitespace-nowrap"
  >
    {genre}
  </button>
);

export default function SymphonyaPage() {
  const [genres] = useState<string[]>(['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz']);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/tracks`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📀 Loaded tracks:', data);
      setTracks(data || []);
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setTracks([]); // Устанавливаем пустой массив при ошибке
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = Cookies.get('token');
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await res.json();
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const playTrack = async (track: Track, queueTracks: Track[] = []) => {
    setCurrentTrack(track);
    setQueue(queueTracks);
    setIsPlayerVisible(true);

    try {
      const token = Cookies.get('token');
      await fetch(`${API_URL}/tracks/${track.id}/play`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    } catch (error) {
      console.error('Failed to increment play count:', error);
    }
  };

  const handleNext = () => {
    if (queue.length > 0) {
      const [nextTrack, ...remainingQueue] = queue;
      setCurrentTrack(nextTrack);
      setQueue(remainingQueue);
    }
  };

  const handlePrevious = () => {
    if (currentTrack) {
      playTrack(currentTrack, queue);
    }
  };

  const handleTrackEnd = () => {
    handleNext();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 pb-32">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
            Symphonya
          </div>
          <div className="relative">
            <input
              type="search"
              placeholder="Песни, исполнители..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-80 px-4 py-2 pl-10 bg-white/10 text-white rounded-full focus:outline-none focus:bg-white/20 placeholder-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="container mx-auto px-6 py-4 bg-gray-800/50">
            <h3 className="text-white font-semibold mb-3">Результаты поиска</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {searchResults.slice(0, 6).map((track) => (
                <SongCard key={track.id} track={track} onPlay={() => playTrack(track, searchResults)} />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Genres */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Жанры</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {genres.map((genre, index) => (
              <GenreChip key={index} genre={genre} onClick={() => handleSearch(genre)} />
            ))}
          </div>
        </div>

        {/* All Tracks */}
        {tracks.length > 0 ? (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Все треки</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {tracks.map((track) => (
                <SongCard 
                  key={track.id} 
                  track={track} 
                  onPlay={() => playTrack(track, tracks.filter(t => t.id !== track.id))} 
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Music size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Пока нет треков</h3>
            <p className="text-gray-400">Загрузите первый трек!</p>
          </div>
        )}
      </div>
      
      {/* Music Player */}
      {isPlayerVisible && currentTrack && (
        <MusicPlayer
          currentTrack={currentTrack}
          queue={queue}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onTrackEnd={handleTrackEnd}
          onClose={() => setIsPlayerVisible(false)}
        />
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}