// frontend/app/(app)/shorts/watch/[id]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { ThumbsUp, ThumbsDown, Share2, MoreVertical, Eye, Calendar, Plus, Check, Link as LinkIcon } from 'lucide-react';
import VideoCard from '@/components/video/VideoCard';
import VideoComments from '@/components/video/VideoComments';
import SaveToPlaylistModal from '@/components/video/SaveToPlaylistModal';
import type { Video } from '@/types/video';
import toast from 'react-hot-toast';

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';

export default function WatchVideoPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  
  // Лайки
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  
  // Подписка
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  
  // Плейлист
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  // Поделиться
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadVideo();
      loadRecommendedVideos();
      loadLikeStatus();
      loadSubscriptionStatus();
      loadSubscriberCount();
    }
  }, [params.id]);

  const loadVideo = async () => {
    try {
      const response = await fetch(`${API_URL}/videos/${params.id}`);
      const data = await response.json();
      setVideo(data);
      
      incrementViewCount();
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementViewCount = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/videos/${params.id}/view`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
    } catch (error) {
      console.error('Failed to increment view count:', error);
    }
  };

  const loadRecommendedVideos = async () => {
    try {
      const response = await fetch(`${API_URL}/videos`);
      const data = await response.json();
      setRecommendedVideos((data || []).filter((v: Video) => v.id !== Number(params.id)).slice(0, 12));
    } catch (error) {
      console.error('Failed to load recommended videos:', error);
    }
  };

  const loadLikeStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/videos/${params.id}/like-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setLiked(data.liked);
      setDisliked(data.disliked);
    } catch (error) {
      console.error('Failed to load like status:', error);
    }
  };

  const loadSubscriptionStatus = async () => {
    if (!video) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/channels/${video.user_id}/subscription-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setIsSubscribed(data.subscribed);
    } catch (error) {
      console.error('Failed to load subscription status:', error);
    }
  };

  const loadSubscriberCount = async () => {
    if (!video) return;
    
    try {
      const response = await fetch(`${API_URL}/channels/${video.user_id}/subscribers`);
      const data = await response.json();
      setSubscriberCount(data.count);
    } catch (error) {
      console.error('Failed to load subscriber count:', error);
    }
  };

  useEffect(() => {
    if (video) {
      loadSubscriptionStatus();
      loadSubscriberCount();
    }
  }, [video]);

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Войдите, чтобы оценить видео');
        return;
      }

      const response = await fetch(`${API_URL}/videos/${params.id}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to like');

      setLiked(!liked);
      if (disliked) setDisliked(false);
      
      loadVideo();
    } catch (error) {
      toast.error('Не удалось поставить лайк');
    }
  };

  const handleDislike = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Войдите, чтобы оценить видео');
        return;
      }

      const response = await fetch(`${API_URL}/videos/${params.id}/dislike`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to dislike');

      setDisliked(!disliked);
      if (liked) setLiked(false);
      
      loadVideo();
    } catch (error) {
      toast.error('Не удалось поставить дизлайк');
    }
  };

  const handleSubscribe = async () => {
    if (!video) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Войдите, чтобы подписаться');
        return;
      }

      const response = await fetch(`${API_URL}/channels/${video.user_id}/subscribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setIsSubscribed(data.subscribed);
      
      // Обновляем счетчик подписчиков
      setSubscriberCount(prev => data.subscribed ? prev + 1 : prev - 1);
      
      toast.success(data.subscribed ? 'Вы подписались' : 'Вы отписались');
    } catch (error) {
      toast.error('Ошибка при подписке');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Ссылка скопирована в буфер обмена');
    setShowShareMenu(false);
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M подписчиков`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K подписчиков`;
    if (count === 1) return '1 подписчик';
    if (count < 5) return `${count} подписчика`;
    return `${count} подписчиков`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Видео не найдено
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
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="bg-black rounded-xl overflow-hidden mb-4">
              <video
                ref={videoRef}
                src={video.video_url}
                controls
                className="w-full aspect-video"
                autoPlay
              >
                Ваш браузер не поддерживает видео.
              </video>
            </div>

            {/* Video Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
              {/* Title */}
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {video.title}
              </h1>

              {/* Stats & Actions */}
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye size={16} />
                    {formatViews(video.view_count)} просмотров
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    {formatDate(video.created_at)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                      liked 
                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <ThumbsUp size={18} className={liked ? 'fill-current' : ''} />
                    <span className="font-medium">{video.like_count}</span>
                  </button>
                  <button 
                    onClick={handleDislike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                      disliked 
                        ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <ThumbsDown size={18} className={disliked ? 'fill-current' : ''} />
                  </button>
                  
                  {/* Share Button */}
                  <div className="relative">
                    <button 
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      <Share2 size={18} />
                      <span className="hidden sm:inline">Поделиться</span>
                    </button>
                  </div>

                  {/* Save to Playlist Button */}
                  <button 
                    onClick={() => setShowPlaylistModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Сохранить</span>
                    </button>

                  <button className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Channel Info */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                  {video.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {video.username}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatSubscribers(subscriberCount)}
                  </p>
                </div>
                
                {/* ИСПРАВЛЕНО: Показываем кнопку подписки только если это НЕ мое видео */}
                {user && user.id !== video.user_id && (
                  <button 
                    onClick={handleSubscribe}
                    className={`px-6 py-2 rounded-full font-medium transition ${
                      isSubscribed
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isSubscribed ? (
                      <span className="flex items-center gap-2">
                        <Check size={18} />
                        Подписан
                      </span>
                    ) : (
                      'Подписаться'
                    )}
                  </button>
                )}
                
                {/* Если это мое видео - показываем бейдж */}
                {user && user.id === video.user_id && (
                  <div className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                    Ваше видео
                  </div>
                )}
              </div>

              {/* Description */}
              {video.description && (
                <div className="mt-4">
                  <div className={`text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${!showFullDescription && 'line-clamp-3'}`}>
                    {video.description}
                  </div>
                  {video.description.length > 150 && (
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mt-2"
                    >
                      {showFullDescription ? 'Скрыть' : 'Показать полностью'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Comments */}
            <VideoComments videoId={video.id} />
          </div>

          {/* Recommended Videos Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Рекомендуемые видео
            </h3>
            <div className="space-y-4">
              {recommendedVideos.map((recommendedVideo) => (
                <div key={recommendedVideo.id} className="cursor-pointer" onClick={() => router.push(`/doubleyou/watch/${recommendedVideo.id}`)}>
                  <div className="flex gap-2">
                    <div className="relative w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                      {recommendedVideo.thumbnail_url ? (
                        <img 
                          src={recommendedVideo.thumbnail_url} 
                          alt={recommendedVideo.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-800"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2 text-gray-900 dark:text-white mb-1">
                        {recommendedVideo.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
                        {recommendedVideo.username}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatViews(recommendedVideo.view_count)} просмотров
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save to Playlist Modal */}
      <SaveToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        videoId={video.id}
      />
    </div>
  );
}