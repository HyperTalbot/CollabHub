// frontend/components/music/CreatePlaylistModal.tsx
"use client";

import { useState, useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '@/services/uploadService';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistCreated?: () => void;
}

export default function CreatePlaylistModal({ 
  isOpen, 
  onClose, 
  onPlaylistCreated 
}: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast.error('Введите название плейлиста');
      return;
    }

    setIsLoading(true);

    try {
      // Загружаем обложку
      let coverUrl = '';
      if (coverFile) {
        toast.loading('Загрузка обложки...');
        coverUrl = await uploadFile(coverFile, 'image');
        toast.dismiss();
      }

      // Создаем плейлист
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://collabhub.cloudpub.ru/api/v1/music/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          name,
          description,
          cover_url: coverUrl,
          is_public: isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create playlist');
      }

      toast.success('Плейлист успешно создан!');
      
      resetForm();
      
      if (onPlaylistCreated) {
        onPlaylistCreated();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to create playlist:', error);
      toast.error(error.message || 'Ошибка при создании плейлиста');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setCoverFile(null);
    setCoverPreview('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Создать плейлист
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Обложка */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Обложка плейлиста
            </label>
            <div
              onClick={() => coverInputRef.current?.click()}
              className="relative w-48 h-48 mx-auto border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition flex items-center justify-center overflow-hidden"
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Нажмите для загрузки</p>
                  <p className="text-xs text-gray-400">300x300</p>
                </div>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
          </div>

          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Название плейлиста *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мой супер плейлист"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          
          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите о плейлисте..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Публичность */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Публичный плейлист (видят все)
              </span>
            </label>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Создание...' : 'Создать плейлист'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}