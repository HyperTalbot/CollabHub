// frontend/components/video/UploadVideoModal.tsx
"use client";

import { useState, useRef } from 'react';
import { X, Upload, Video as VideoIcon, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '@/services/uploadService';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoUploaded?: () => void;
}

const CATEGORIES = [
  'Музыка',
  'Игры',
  'Спорт',
  'Образование',
  'Новости',
  'Развлечения',
  'Наука и технологии',
  'Путешествия',
  'Блоги',
  'Другое',
];

export default function UploadVideoModal({ isOpen, onClose, onVideoUploaded }: UploadVideoModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      // Автоматически заполняем название если пусто
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !videoFile) {
      toast.error('Заполните название и загрузите видео');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Загружаем превью
      let thumbnailUrl = '';
      if (thumbnailFile) {
        toast.loading('Загрузка превью...');
        thumbnailUrl = await uploadFile(thumbnailFile, 'image');
        toast.dismiss();
      }

      // 2. Загружаем видео
      toast.loading('Загрузка видео...');
      const videoUrl = await uploadFile(videoFile, 'video');
      toast.dismiss();

      // 3. Получаем длительность видео
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      await new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve);
      });
      const duration = Math.floor(video.duration);

      // 4. Создаем видео на сервере
      toast.loading('Создание видео...');
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://collabhub.cloudpub.ru/api/v1/video/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          title,
          description,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration,
          category,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          is_public: isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create video');
      }

      toast.dismiss();
      toast.success('Видео успешно загружено!');
      
      resetForm();
      
      if (onVideoUploaded) {
        onVideoUploaded();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to upload video:', error);
      toast.dismiss();
      toast.error(error.message || 'Ошибка при загрузке видео');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setTags('');
    setIsPublic(true);
    setVideoFile(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Загрузить видео
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
          {/* Video File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Видео файл *
            </label>
            <div
              onClick={() => videoInputRef.current?.click()}
              className="relative w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition flex flex-col items-center justify-center"
            >
              {videoFile ? (
                <div className="text-center">
                  <VideoIcon size={48} className="mx-auto text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{videoFile.name}</p>
                  <p className="text-xs text-gray-500">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Нажмите для загрузки видео</p>
                  <p className="text-xs text-gray-400 mt-1">MP4, AVI, MOV (до 500MB)</p>
                </div>
              )}
            </div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Превью видео
            </label>
            <div
              onClick={() => thumbnailInputRef.current?.click()}
              className="relative w-full aspect-video border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition flex items-center justify-center overflow-hidden"
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Нажмите для загрузки превью</p>
                </div>
              )}
            </div>
            <input 
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Название *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название видео"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите о вашем видео"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Категория
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Выберите категорию</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Теги (через запятую)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="gaming, tutorial, funny"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Public */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Публичное видео (видят все)
              </span>
            </label>
          </div>

          {/* Buttons */}
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
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Загрузка...' : 'Загрузить видео'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
