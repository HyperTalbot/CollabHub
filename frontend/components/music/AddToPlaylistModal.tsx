// frontend/components/music/AddToPlaylistModal.tsx
"use client";

import { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Playlist {
  id: number;
  name: string;
  description: string;
  cover_url: string;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  trackId: number;
  onClose: () => void;
}

export default function AddToPlaylistModal({ isOpen, trackId, onClose }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedPlaylists, setAddedPlaylists] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://collabhub.cloudpub.ru/api/v1/music/playlists', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();
      setPlaylists(data || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      toast.error('Не удалось загрузить плейлисты');
    }
  };

  const addToPlaylist = async (playlistId: number) => {
    if (addedPlaylists.has(playlistId)) {
      toast.error('Трек уже добавлен в этот плейлист');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`https://collabhub.cloudpub.ru/api/v1/music/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add track');
      }

      toast.success('Трек добавлен в плейлист!');
      setAddedPlaylists(prev => new Set(prev).add(playlistId));
    } catch (error) {
      console.error('Failed to add track:', error);
      toast.error('Не удалось добавить трек');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Добавить в плейлист
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto p-6">
          {playlists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                У вас пока нет плейлистов
              </p>
              <button
                onClick={() => {
                  onClose();
                  // TODO: Открыть модальное окно создания плейлиста
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Создать плейлист
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => addToPlaylist(playlist.id)}
                  disabled={loading || addedPlaylists.has(playlist.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {/* Обложка */}
                  <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                    {playlist.cover_url ? (
                      <img 
                        src={playlist.cover_url} 
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Plus size={24} className="text-white/50" />
                      </div>
                    )}
                  </div>

                  {/* Название */}
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {playlist.name}
                    </h3>
                    {playlist.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {playlist.description}
                      </p>
                    )}
                  </div>

                  {/* Статус */}
                  {addedPlaylists.has(playlist.id) && (
                    <Check size={20} className="text-green-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}