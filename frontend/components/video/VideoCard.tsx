// frontend/components/video/VideoCard.tsx
"use client";

import { Video } from '@/types/video';
import { useRouter } from 'next/navigation';
import { Eye, Clock } from 'lucide-react';

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  const router = useRouter();

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffMs / 604800000);
    const diffMonths = Math.floor(diffMs / 2592000000);
    const diffYears = Math.floor(diffMs / 31536000000);

    if (diffMins < 60) return `${diffMins} минут назад`;
    if (diffHours < 24) return `${diffHours} часов назад`;
    if (diffDays < 7) return `${diffDays} дней назад`;
    if (diffWeeks < 4) return `${diffWeeks} недель назад`;
    if (diffMonths < 12) return `${diffMonths} месяцев назад`;
    return `${diffYears} лет назад`;
  };

  return (
    <div 
      className="cursor-pointer group"
      onClick={() => router.push(`/doubleyou/watch/${video.id}`)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 mb-3">
        {video.thumbnail_url ? (
          <img 
            src={video.thumbnail_url} 
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <Clock size={48} className="text-gray-500" />
          </div>
        )}
        
        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {video.username?.[0]?.toUpperCase() || 'U'}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-2 text-gray-900 dark:text-white mb-1">
            {video.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
            {video.username}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {formatViews(video.view_count)} просмотров
            </span>
            <span>•</span>
            <span>{formatTimeAgo(video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}