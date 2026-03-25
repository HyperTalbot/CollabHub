// frontend/app/(app)/symphonya/playlist/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, MoreVertical, Trash2, Clock } from 'lucide-react';
import { MusicPlayer } from '@/components/music/MusicPlayer';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import type { Track } from '@/types/music';

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

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  useEffect(() => {
    loadPlaylist();
  }, [params.id]);

  const loadPlaylist = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists/${params.id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load playlist');
      }

      const data = await response.json();
      setPlaylist(data);
    } catch (error) {
      console.error('Failed to load playlist:', error);
      toast.error('Не удалось загрузить плейлист');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    if (!user || !playlist) return false;
    return user.id === playlist.user_id || user.role === 'admin';
  };

  const removeTrack = async (trackId: number) => {
    if (!canEdit()) {
      toast.error('У вас нет прав на удаление треков из этого плейлиста');
      return;
    }

    if (!confirm('Удалить трек из плейлиста?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists/${params.id}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove track');
      }

      toast.success('Трек удален из плейлиста');
      
      // Обновляем список треков
      setPlaylist(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks?.filter(t => t.id !== trackId) || [],
        };
      });
    } catch (error) {
      console.error('Failed to remove track:', error);
      toast.error('Не удалось удалить трек');
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

  const playAll = () => {
    if (playlist?.tracks && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks.slice(1));
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">Плейлист не найден</h2>
          <button
            onClick={() => router.push('/symphonya')}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  const totalDuration = playlist.tracks?.reduce((sum, track) => sum + track.duration, 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-800/50 to-transparent">
        <div className="container mx-auto px-6 py-8">
          {/* Back Button */}
          <button
            onClick={() => router.push('/symphonya')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition mb-8"
          >
            <ArrowLeft size={24} />
            <span>Назад</span>
          </button>

          {/* Playlist Info */}
          <div className="flex gap-8 items-end">
            {/* Cover */}
            <div className="w-56 h-56 rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
              {playlist.cover_url ? (
                <img 
                  src={playlist.cover_url} 
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Play size={64} className="text-white/50" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pb-4">
              <p className="text-white/80 text-sm font-semibold mb-2">ПЛЕЙЛИСТ</p>
              <h1 className="text-white text-5xl font-bold mb-4">{playlist.name}</h1>
              {playlist.description && (
                <p className="text-white/60 text-lg mb-4">{playlist.description}</p>
              )}
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <span>{playlist.tracks?.length || 0} треков</span>
                <span>•</span>
                <span>{Math.floor(totalDuration / 60)} мин</span>
              </div>
            </div>
          </div>

          {/* Play Button */}
          <div className="mt-8">
            <button
              onClick={playAll}
              disabled={!playlist.tracks || playlist.tracks.length === 0}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={24} className="ml-1" />
              Играть
            </button>
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="container mx-auto px-6 py-8">
        {playlist.tracks && playlist.tracks.length > 0 ? (
          <div className="bg-black/20 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-white/60 text-sm">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5">НАЗВАНИЕ</div>
              <div className="col-span-3">ИСПОЛНИТЕЛЬ</div>
              <div className="col-span-2 flex items-center gap-2">
                <Clock size={16} />
                ВРЕМЯ
              </div>
              <div className="col-span-1"></div>
            </div>

            {/* Tracks */}
            <div>
              {playlist.tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-white/5 transition group"
                >
                  {/* Number */}
                  <div className="col-span-1 flex items-center justify-center text-white/60 group-hover:text-white">
                    <span className="group-hover:hidden">{index + 1}</span>
                    <button
                      onClick={() => playTrack(track, playlist.tracks!.slice(index + 1))}
                      className="hidden group-hover:block"
                    >
                      <Play size={16} className="text-white" />
                    </button>
                  </div>

                  {/* Title & Cover */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                      <img 
                        src={track.cover_url} 
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{track.title}</div>
                    </div>
                  </div>

                  {/* Artist */}
                  <div className="col-span-3 flex items-center text-white/60 truncate">
                    {track.artist}
                  </div>

                  {/* Duration */}
                  <div className="col-span-2 flex items-center text-white/60">
                    {formatDuration(track.duration)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end">
                    {canEdit() && (
                      <button
                        onClick={() => removeTrack(track.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-full transition"
                        title="Удалить из плейлиста"
                      >
                        <Trash2 size={16} className="text-red-400 hover:text-red-300" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Play size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Плейлист пуст</h3>
            <p className="text-gray-400">Добавьте треки в плейлист</p>
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
          onTrackEnd={handleNext}
          onClose={() => setIsPlayerVisible(false)}
        />
      )}
    </div>
  );
}