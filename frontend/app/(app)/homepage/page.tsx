// frontend/app/(app)/page.tsx
"use client";

import { useRecommendations } from '@/hooks/useRecommendations';
import PostCard from '@/components/PostCard';
// import VideoCard from '@/components/VideoCard';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { isLoggedIn } = useAuth();
  const { recommendations, loading } = useRecommendations({
    type: 'all',
    limit: 20,
  });

  if (loading) {
    return <div className="text-center py-10">Загрузка ленты...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">
        {isLoggedIn ? 'Для вас' : 'Популярное'}
      </h1>

      <div className="space-y-6">
        {recommendations.map((rec) => {
          // Рендерим разные компоненты в зависимости от типа
          switch (rec.content_type) {
            case 'post':
              return <PostCard key={`post-${rec.content_id}`} postId={rec.content_id} />;
            
            // case 'video':
            //   return <VideoCard key={`video-${rec.content_id}`} videoId={rec.content_id} />;
            
            // case 'short':
            //   return <ShortCard key={`short-${rec.content_id}`} shortId={rec.content_id} />;
            
            // case 'music':
            //   return <MusicCard key={`music-${rec.content_id}`} trackId={rec.content_id} />;
            
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}