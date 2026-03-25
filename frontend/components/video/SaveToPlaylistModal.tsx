// frontend/components/video/SaveToPlaylistModal.tsx
"use client";

import { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Playlist {
  id: number;
  name: string;
  description: string;
  thumbnail_url: string;
  is_public: boolean;
}

interface SaveToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: number;
}

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';

export default function SaveToPlaylistModal({ isOpen, onClose, videoId }: SaveToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Set<number>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      loadSavedStatus();
    }
  }, [isOpen, videoId]);

  const loadPlaylists = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();
      setPlaylists(data || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  };

  const loadSavedStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();
      
      // Проверяем какие плейлисты содержат это видео
      const saved = new Set<number>();
      (data || []).forEach((playlist: any) => {
        if (playlist.videos?.some((v: any) => v.id === videoId)) {
          saved.add(playlist.id);
        }
      });
      setSavedPlaylists(saved);
    } catch (error) {
      console.error('Failed to load saved status:', error);
    }
  };

  const handleTogglePlaylist = async (playlistId: number) => {
    const token = localStorage.getItem('authToken');
    const isSaved = savedPlaylists.has(playlistId);

    try {
      if (isSaved) {
        // Удаляем из плейлиста
        await fetch(`${API_URL}/playlists/${playlistId}/videos/${videoId}`, {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        setSavedPlaylists(prev => {
          const newSet = new Set(prev);
          newSet.delete(playlistId);
          return newSet;
        });
        toast.success('Удалено из плейлиста');
      } else {
        // Добавляем в плейлист
        await fetch(`${API_URL}/playlists/${playlistId}/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ video_id: videoId }),
        });
        setSavedPlaylists(prev => new Set([...prev, playlistId]));
        toast.success('Добавлено в плейлист');
      }
    } catch (error) {
      toast.error('Ошибка при обновлении плейлиста');
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          name: newPlaylistName,
          description: '',
          thumbnail_url: '',
          is_public: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to create playlist');

      const newPlaylist = await response.json();
      
      // Сразу добавляем видео в новый плейлист
      await fetch(`${API_URL}/playlists/${newPlaylist.id}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ video_id: videoId }),
      });

      setNewPlaylistName('');
      setShowCreateForm(false);
      loadPlaylists();
      loadSavedStatus();
      toast.success('Плейлист создан');
    } catch (error) {
      toast.error('Не удалось создать плейлист');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Сохранить в плейлист
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create New Playlist */}
          {showCreateForm ? (
            <form onSubmit={handleCreatePlaylist} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Название плейлиста"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:text-white mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPlaylistName('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-500 transition flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-500"
            >
              <Plus size={20} />
              <span className="font-medium">Создать новый плейлист</span>
            </button>
          )}

          {/* Playlists List */}
          <div className="space-y-2">
            {playlists.length > 0 ? (
              playlists.map((playlist) => {
                const isSaved = savedPlaylists.has(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => handleTogglePlaylist(playlist.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold">
                      {playlist.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {playlist.name}
                      </h3>
                      {playlist.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                          {playlist.description}
                        </p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                      isSaved 
                        ? 'bg-green-600 border-green-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSaved && <Check size={16} className="text-white" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                У вас пока нет плейлистов
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}