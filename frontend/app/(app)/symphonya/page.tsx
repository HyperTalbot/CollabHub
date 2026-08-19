// frontend/app/(app)/symphonya/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MusicPlayer } from '@/components/music/MusicPlayer';
import { Search, Play, Music, Plus, MoreVertical } from 'lucide-react';
import type { Track } from '@/types/music';
import AddToPlaylistModal from '@/components/music/AddToPlaylistModal'; 

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/music';

interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
  user_id: number;
  is_public: boolean;
  tracks?: Track[];
}

// Компоненты карточек
const SongCard = ({ 
  track, 
  onPlay,
  onAddToPlaylist 
}: { 
  track: Track; 
  onPlay: () => void;
  onAddToPlaylist: () => void; // ДОБАВЛЕНО
}) => (
  <div className="group">
    <div className="relative aspect-square rounded-lg overflow-hidden mb-3 cursor-pointer" onClick={onPlay}>
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
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-sm line-clamp-1">{track.title}</h3>
        <p className="text-gray-400 text-sm line-clamp-1">{track.artist}</p>
      </div>
      
      {/* ДОБАВЛЕНО: Кнопка меню */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onAddToPlaylist();
        }}
        className="p-1 hover:bg-white/10 rounded-full transition flex-shrink-0"
        title="Добавить в плейлист"
      >
        <Plus size={16} className="text-gray-400 hover:text-white" />
      </button>
    </div>
  </div>
);

const PlaylistCard = ({ 
  playlist, 
  onNavigate // ИЗМЕНЕНО: вместо onPlay
}: { 
  playlist: Playlist; 
  onNavigate: () => void; // ИЗМЕНЕНО
}) => (
  <div className="group cursor-pointer" onClick={onNavigate}> {/* ИЗМЕНЕНО */}
    <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
      {playlist.cover_url ? (
        <img src={playlist.cover_url} 
          alt={playlist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Music size={64} className="text-white/50" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
        <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 hover:scale-110 transition">
          <Play size={24} className="text-black ml-1" />
        </button>
      </div>
    </div>
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-sm line-clamp-1">{playlist.name}</h3>
        <p className="text-gray-400 text-xs line-clamp-2">{playlist.description || 'Плейлист'}</p>
      </div>
      <button 
        onClick={(e) => e.stopPropagation()} 
        className="p-1 hover:bg-white/10 rounded-full transition flex-shrink-0"
      >
        <MoreVertical size={16} className="text-gray-400" />
      </button>
    </div>
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
  const router = useRouter();
  const [genres] = useState<string[]>(['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz']);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]); // ПЕРЕИМЕНОВАНО
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]); // ДОБАВЛЕНО
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  const [addToPlaylistTrackId, setAddToPlaylistTrackId] = useState<number | null>(null);


 useEffect(() => {
    loadTracks();
    loadMyPlaylists(); // ПЕРЕИМЕНОВАНО
    loadPublicPlaylists(); // ДОБАВЛЕНО
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
      console.log('📀  Loaded tracks:', data);
      setTracks(data || []);
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setTracks([]);
    }
  };

  // Загрузка плейлистов текущего пользователя
  const loadMyPlaylists = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('No token, skipping my playlists load');
        return;
      }

      const res = await fetch(`${API_URL}/playlists`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📚 Loaded my playlists:', data);
      setMyPlaylists(data || []);
    } catch (error) {
      console.error('Failed to load my playlists:', error);
      setMyPlaylists([]);
    }
  };

  // ДОБАВЛЕНО: Загрузка публичных плейлистов
  const loadPublicPlaylists = async () => {
    try {
      const res = await fetch(`${API_URL}/playlists/public`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('🌍 Loaded public playlists:', data);
      setPublicPlaylists(data || []);
    } catch (error) {
      console.error('Failed to load public playlists:', error);
      setPublicPlaylists([]);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
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
      const token = localStorage.getItem('authToken');
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

  // ДОБАВЛЕНО: Воспроизведение плейлиста
  const playPlaylist = async (playlist: Playlist) => {
    if (playlist.tracks && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks.slice(1));
    } else {
      // Если треки не загружены, загружаем плейлист полностью
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_URL}/playlists/${playlist.id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          playTrack(data.tracks[0], data.tracks.slice(1));
        }
      } catch (error) {
        console.error('Failed to load playlist tracks:', error);
      }
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
                <SongCard 
                  key={track.id} 
                  track={track} 
                  onPlay={() => playTrack(track, searchResults)}
                  onAddToPlaylist={() => setAddToPlaylistTrackId(track.id)} // ДОБАВЛЕНО
                />
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

        {/* My Playlists - ОБНОВЛЕНО */}
        {myPlaylists.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Мои плейлисты</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {myPlaylists.map((playlist) => (
                <PlaylistCard 
                  key={playlist.id} 
                  playlist={playlist} 
                  onNavigate={() => router.push(`/symphonya/playlist/${playlist.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Public Playlists - ДОБАВЛЕНО */}
        {publicPlaylists.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Все плейлисты</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {publicPlaylists.map((playlist) => (
                <PlaylistCard 
                  key={playlist.id} 
                  playlist={playlist} 
                  onNavigate={() => router.push(`/symphonya/playlist/${playlist.id}`)}
                />
              ))}
            </div>
          </div>
        )}


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
                  onAddToPlaylist={() => setAddToPlaylistTrackId(track.id)} // ДОБАВЛЕНО
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

        {/* Add to Playlist Modal - ДОБАВЛЕНО */}
        {addToPlaylistTrackId && (
          <AddToPlaylistModal
            isOpen={true}
            trackId={addToPlaylistTrackId}
            onClose={() => setAddToPlaylistTrackId(null)}
          />
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