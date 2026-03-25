// frontend/app/(app)/shorts/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Video as VideoIcon, Search, Upload, CheckCircle } from 'lucide-react';
import VideoCard from '@/components/video/VideoCard';
import UploadVideoModal from '@/components/video/UploadVideoModal';
import type { Video } from '@/types/video';

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';

const CATEGORIES = [
  'Все',
  'Музыка',
  'Игры',
  'Спорт',
  'Образование',
  'Новости',
  'Развлечения',
  'Наука и технологии',
  'Путешествия',
  'Блоги',
];

export default function ShortsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [viewedVideoIds, setViewedVideoIds] = useState<Set<number>>(new Set()); // ДОБАВЛЕНО
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastVideoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadVideos(true);
    loadViewHistory(); // ДОБАВЛЕНО
  }, [selectedCategory]);

  const loadVideos = async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const categoryParam = selectedCategory !== 'Все' ? `?category=${selectedCategory}` : '';
      const response = await fetch(`${API_URL}/videos${categoryParam}`);
      const data = await response.json();
      
      if (reset) {
        setVideos(data || []);
      } else {
        setVideos(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore(data && data.length >= 12);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  // ДОБАВЛЕНО: Загрузка истории просмотров
  const loadViewHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/view-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setViewedVideoIds(new Set(data.video_ids || []));
    } catch (error) {
      console.error('Failed to load view history:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      loadVideos(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setVideos(data || []);
      setHasMore(false);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const lastVideoElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !searchQuery) {
        loadVideos(false);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <VideoIcon size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
                Shorts
              </h1>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Поиск видео..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition flex items-center gap-2"
            >
              <Upload size={20} />
              <span className="hidden sm:inline">Загрузить</span>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-[1800px] mx-auto px-6 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium transition ${
                  selectedCategory === category
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8">
            {videos.map((video, index) => (
              <div
                key={video.id}
                ref={index === videos.length - 1 ? lastVideoElementRef : null}
                className="relative"
              >
                {/* ДОБАВЛЕНО: Индикатор просмотра */}
                {viewedVideoIds.has(video.id) && (
                  <div className="absolute top-2 left-2 z-10 bg-green-600 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium shadow-lg">
                    <CheckCircle size={14} />
                    Просмотрено
                  </div>
                )}
                <VideoCard video={video} />
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="text-center py-20">
            <VideoIcon size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Видео не найдены
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'Попробуйте изменить запрос' : 'Загрузите первое видео!'}
            </p>
          </div>
        )}

        {/* Loading More */}
        {loading && videos.length > 0 && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadVideoModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onVideoUploaded={() => {
          loadVideos(true);
          loadViewHistory(); // Обновляем историю
        }}
      />

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