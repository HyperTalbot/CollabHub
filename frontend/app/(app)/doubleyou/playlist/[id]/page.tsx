// frontend/app/(app)/shorts/playlist/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play, Trash2, ArrowLeft, Lock, Globe } from 'lucide-react';
import VideoCard from '@/components/video/VideoCard';
import type { Video } from '@/types/video';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';

interface Playlist {
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

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadPlaylist();
    }
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
        throw new Error('Playlist not found');
      }

      const data = await response.json();
      setPlaylist(data);
    } catch (error) {
      console.error('Failed to load playlist:', error);
      toast.error('Плейлист не найден');
      router.push('/shorts');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVideo = async (videoId: number) => {
    if (!playlist) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists/${playlist.id}/videos/${videoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) throw new Error('Failed to remove video');

      toast.success('Видео удалено из плейлиста');
      loadPlaylist();
    } catch (error) {
      toast.error('Не удалось удалить видео');
    }
  };

  const canEdit = playlist && user && playlist.user_id === user.id;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Плейлист не найден
          </h2>
          <button
            onClick={() => router.push('/shorts')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft size={20} />
          Назад
        </button>

        {/* Playlist Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Thumbnail */}
            <div className="w-full md:w-64 aspect-video bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              {playlist.thumbnail_url ? (
                <img
                  src={playlist.thumbnail_url}
                  alt={playlist.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Play size={64} className="text-white/50" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                {playlist.is_public ? (
                  <>
                    <Globe size={16} />
                    <span>Публичный плейлист</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Приватный плейлист</span>
                  </>
                )}
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {playlist.name}
              </h1>

              {playlist.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {playlist.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{playlist.videos?.length || 0} видео</span>
                <span>•</span>
                <span>Создан {new Date(playlist.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Videos Grid */}
        {playlist.videos && playlist.videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {playlist.videos.map((video) => (
              <div key={video.id} className="relative group">
                <VideoCard video={video} />
                
                {/* Remove Button for Owner */}
                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveVideo(video.id);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
            <Play size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Плейлист пуст
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              В этом плейлисте пока нет видео
            </p>
          </div>
        )}
      </div>
    </div>
  );
}