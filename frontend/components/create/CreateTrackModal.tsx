// frontend/components/music/CreateMusicModal.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Music, Image as ImageIcon, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '@/services/uploadService'; // ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩИЙ СЕРВИС
import { getMediaURL } from '@/lib/mediaUtils'; // ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩУЮ УТИЛИТУ

interface CreateTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackCreated?: () => void;
}

interface Album {
  id: number;
  name: string;
  cover_url: string;
}

export default function CreateTrackModal({ isOpen, onClose, onTrackCreated }: CreateTrackModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [tags, setTags] = useState('');
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [newAlbumCover, setNewAlbumCover] = useState<File | null>(null);
  const [newAlbumCoverPreview, setNewAlbumCoverPreview] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const albumCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
    }
  }, [isOpen]);

  const loadAlbums = async () => {
    try {
      const token = localStorage.getItem('authToken');

      const response = await fetch('https://collabhub.cloudpub.ru/api/v1/music/albums/my', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();
      setAlbums(data || []);
    } catch (error) {
      console.error('Failed to load albums:', error);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleAlbumCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewAlbumCover(file);
      setNewAlbumCoverPreview(URL.createObjectURL(file));
    }
  };

  const createAlbum = async (): Promise<number> => {
    if (!newAlbumName) {
      throw new Error('Введите название альбома');
    }

    let coverUrl = '';
    if (newAlbumCover) {
      // ИСПОЛЬЗУЕМ uploadFile из uploadService
      coverUrl = await uploadFile(newAlbumCover, 'image');
    }

    const token = localStorage.getItem('authToken');
    const response = await fetch('https://collabhub.cloudpub.ru/api/v1/music/albums', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        name: newAlbumName,
        description: newAlbumDescription,
        cover_url: coverUrl,
      }),
    });

    const album = await response.json();
    return album.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !audioFile) {
      toast.error('Заполните название и загрузите аудио файл');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Создаем альбом если нужно
      let albumId = selectedAlbumId;
      if (isCreatingAlbum) {
        albumId = await createAlbum();
        toast.success('Альбом создан!');
      }

      // 2. Загружаем обложку
      let coverUrl = '';
      if (coverFile) {
        toast.loading('Загрузка обложки...');
        coverUrl = await uploadFile(coverFile, 'image'); // ИСПОЛЬЗУЕМ uploadFile
        toast.dismiss();
      }

      // 3. Загружаем аудио
      toast.loading('Загрузка аудио...');
      const audioUrl = await uploadFile(audioFile, 'audio'); // ИСПОЛЬЗУЕМ uploadFile
      toast.dismiss();

      // 4. Получаем длительность аудио
      const audio = new Audio(URL.createObjectURL(audioFile));
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
      });
      const duration = Math.floor(audio.duration);

      // 5. Создаем трек
      toast.loading('Создание трека...');
      const token = localStorage.getItem('authToken');
      const response = await fetch('https://collabhub.cloudpub.ru/api/v1/music/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          title,
          description,
          genre,
          lyrics,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          cover_url: coverUrl,
          audio_url: audioUrl,
          duration,
          album_id: albumId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create track');
      }

      toast.dismiss();
      toast.success('Трек успешно создан!');
      
      resetForm();

      // вызываем callback для перезагрузки списка
      if (onTrackCreated) {
        onTrackCreated();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to create track:', error);
      toast.dismiss();
      toast.error(error.message || 'Ошибка при создании трека');
    } finally {
      setIsLoading(false);
    }
  };

const resetForm = () => {
    setTitle('');
    setDescription('');
    setGenre('');
    setLyrics('');
    setTags('');
    setCoverFile(null);
    setCoverPreview('');
    setAudioFile(null);
    setSelectedAlbumId(null);
    setIsCreatingAlbum(false);
    setNewAlbumName('');
    setNewAlbumDescription('');
    setNewAlbumCover(null);
    setNewAlbumCoverPreview('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header - ИСПРАВЛЕНО: убрали sticky */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Загрузить музыку
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
          {/* Обложка трека - ИСПРАВЛЕНО: квадратная */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Обложка трека
            </label>
            <div
              onClick={() => coverInputRef.current?.click()}
              className="relative w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition flex items-center justify-center overflow-hidden"
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
              Название трека *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название трека"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
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
              placeholder="Расскажите о треке"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Жанр */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Жанр
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Выберите жанр</option>
              <option value="pop">Pop</option>
              <option value="rock">Rock</option>
              <option value="hip-hop">Hip-Hop</option>
              <option value="electronic">Electronic</option>
              <option value="jazz">Jazz</option>
              <option value="classical">Classical</option>
              <option value="r&b">R&B</option>
              <option value="country">Country</option>
              <option value="indie">Indie</option>
              <option value="other">Другое</option>
            </select>
          </div>

          {/* Альбом */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Альбом
            </label>
            {!isCreatingAlbum ? (
              <div className="flex gap-2">
                <select
                  value={selectedAlbumId || ''}
                  onChange={(e) => setSelectedAlbumId(Number(e.target.value) || null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Без альбома</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingAlbum(true)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition flex items-center gap-2"
                >
                  <Plus size={20} />
                  Создать
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-purple-300 dark:border-purple-700 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white">Новый альбом</h3>
                
                {/* Обложка альбома - ИСПРАВЛЕНО: квадратная */}
                <div
                  onClick={() => albumCoverInputRef.current?.click()}
                  className="relative w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition flex items-center justify-center overflow-hidden"
                >
                  {newAlbumCoverPreview ? (
                    <img src={newAlbumCoverPreview} alt="Album cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-gray-400" />
                  )}
                </div>
                <input
                  ref={albumCoverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAlbumCoverChange}
                  className="hidden"
                />

                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Название альбома"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
                
                <textarea
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  placeholder="Описание альбома"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() => setIsCreatingAlbum(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
          
          {/* Теги */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Теги (через запятую)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="любовь, лето, энергия"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Текст песни */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Текст песни
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Введите текст песни"
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
            />
          </div>

          {/* Аудио файл */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Аудио файл *
            </label>
            <div
              onClick={() => audioInputRef.current?.click()}
              className="relative w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-purple-500 transition flex flex-col items-center justify-center"
            >
              {audioFile ? (
                <div className="text-center">
                  <Music size={48} className="mx-auto text-purple-500 mb-2" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{audioFile.name}</p>
                  <p className="text-xs text-gray-500">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Нажмите для загрузки аудио</p>
                  <p className="text-xs text-gray-400 mt-1">MP3, WAV, FLAC</p>
                </div>
              )}
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="hidden"
            />
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Загрузка...' : 'Создать трек'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
