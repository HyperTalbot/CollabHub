// frontend/components/PostCard.tsx
"use client";

import { useViewTracking } from '@/hooks/useViewTracking';
import { useEffect } from 'react';

interface PostCardProps {
  postId: number;
}

export default function PostCard({ postId }: PostCardProps) {
  const { trackView, trackInteraction } = useViewTracking({
    contentType: 'post',
    contentId: postId,
  });

  // Автоматически трекаем просмотр при монтировании
  useEffect(() => {
    const timer = setTimeout(() => {
      trackView(); // Трекаем через 3 секунды
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleLike = async () => {
    // Трекаем взаимодействие
    await trackInteraction('like');
  };

  const handleComment = async () => {
    await trackInteraction('comment');
    // ... логика комментария
  };

  const handleShare = async () => {
    await trackInteraction('share');
    // ... логика шаринга
  };
  
  return (
    <div className="post-card">
      {/* ... существующий UI поста ... */}
      
      <button onClick={handleLike}>❤️ Лайк</button>
      <button onClick={handleComment}>💬 Комментарий</button>
      <button onClick={handleShare}>🔗 Поделиться</button>
    </div>
  );
}