// frontend/app/(app)/postogram/page.tsx
"use client";

import React, { useEffect, useRef } from 'react';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';
import { useAuth } from '@/context/AuthContext';
import { useRecommendedPosts } from '@/hooks/useRecommendedPosts';
import { useViewTracking } from '@/hooks/useViewTracking';
import LikeButton from '@/components/shared/LikeButton';
import ShareButton from '@/components/shared/ShareButton';
import ImageCarousel, { MediaContent } from '@/components/post/ImageCarousel';
import { MessageCircle, Eye, Sparkles, LayoutGrid, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserActionsDropdown from '@/components/user/UserActionDropdown';
import { getMediaURL } from '@/lib/mediaUtils';

const PROFILE_URL = (id: number) => `/profile/${id}`;

// LIST_WIDTH — ширина в режиме "список"
// GRID_WIDTH — ширина в режиме "сетка" (растянута почти на весь экран).
// Примеры значений: 'w-1/2', 'w-4/5', 'w-[92%]', 'max-w-[1700px]', 'w-full px-8'

const LIST_WIDTH = 'w-1/2';
const GRID_WIDTH = 'w-[92%] max-w-[1700px]';

// Максимальная высота markdown-контента в карточке сетки (правь здесь)
const GRID_CONTENT_MAX_HEIGHT = 'max-h-44';

interface Post {
  id: number;
  user_id: number;
  user_username: string;
  title: string;
  content: string;
  author_avatar_url: string;
  user_avatar_url?: string;
  image_url?: string;
  image_urls?: string[];
  post_style?: string;
  created_at: string;
  likes_count: number;
  is_liked_by_me: boolean;
  comments_count: number;
}

function PostCard({ post, gridMode = false }: { post: Post; gridMode?: boolean }) {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const { trackLike, trackComment, trackShare } = useViewTracking({
    contentType: 'post',
    contentId: post.id,
  });

  const navigateToPost = () => {
    trackComment();
    router.push(`/postogram/${post.id}/`);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, [data-user-block], form, input, textarea, [contenteditable], [data-stop], .cm-editor')) return;
    navigateToPost();
  };

  const handleUserBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(PROFILE_URL(post.user_id));
  };

  const avatarUrl = post.author_avatar_url || post.user_avatar_url;
  const carouselImages = (post.image_urls || []).filter(Boolean);

  return (
    <div
      id={`post-${post.id}`}
      onClick={handleCardClick}
      className={`cursor-pointer bg-white dark:bg-gray-800/90 border border-indigo-100/70 dark:border-gray-700/70 p-4 shadow-lg shadow-indigo-100/50 dark:shadow-black/30 rounded-2xl transition-shadow duration-300 hover:shadow-xl hover:shadow-indigo-200/60 dark:hover:shadow-black/40 ${gridMode ? 'flex flex-col h-full' : ''}`}
    >
      {/* Плашка пользователя -> профиль */}
      <div
        data-user-block
        onClick={handleUserBlockClick}
        className="w-fit max-w-full flex items-center gap-3 mb-3 border border-indigo-100/80 dark:border-gray-600/70 bg-gradient-to-r from-indigo-50 via-white to-violet-50 dark:from-indigo-950/40 dark:via-gray-800 dark:to-violet-950/30 rounded-full pl-1.5 pr-2 py-1.5 shadow-sm hover:ring-2 hover:ring-indigo-200/60 dark:hover:ring-indigo-800/50 transition-all cursor-pointer"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-indigo-100 dark:bg-gray-700 ring-2 ring-indigo-200/70 dark:ring-indigo-800/60 shrink-0">
          {avatarUrl ? (
            <img src={getMediaURL(avatarUrl)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold">
              {post.user_username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-gray-100 truncate">
            {post.user_username || `User ${post.user_id}`} • 🟦🔶
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(post.created_at).toLocaleDateString('ru-RU')}
          </p>
        </div>
        {isLoggedIn && user && post.user_id !== user.id && (
          <div className="self-center ml-1 shrink-0" data-stop onClick={(e) => e.stopPropagation()}>
            <UserActionsDropdown targetUserId={post.user_id} currentUserId={user.id} username={post.user_username} />
          </div>
        )}
      </div>

      <h2 className={`${gridMode ? 'text-lg line-clamp-2' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-50 flex items-center justify-center my-3 text-center`}>
        {post.title}
      </h2>

      {post.post_style === 'reddit' && carouselImages.length > 0 && (
        <div className={gridMode ? 'my-2' : 'my-3'} data-stop>
          <ImageCarousel images={carouselImages} alt={post.title} heightClass={gridMode ? 'h-44' : 'h-[420px]'} />
        </div>
      )}

      {post.post_style !== 'reddit' && post.image_url && (
        <div className={`${gridMode ? 'my-2' : 'my-3'} rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm`}>
          <MediaContent
            src={post.image_url}
            alt={post.title}
            className="w-full"
            mediaClass={gridMode ? 'w-full h-44 object-cover' : 'w-full max-h-[420px] object-contain'}
          />
        </div>
      )}

      {/* Контент:
          - список: полный markdown;
          - сетка: markdown С ФОРМАТИРОВАНИЕМ, но с ограничением высоты
            и градиентным затуханием внизу (компактная карточка). */}
      {gridMode ? (
        <div className={`relative ${GRID_CONTENT_MAX_HEIGHT} overflow-hidden`}>
          <MarkdownRenderer content={post.content} compact stopLinks />
          {/* Градиент-фейд внизу обрезанного контента */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-gray-800/95 to-transparent" />
        </div>
      ) : (
        <MarkdownRenderer content={post.content} compact stopLinks />
      )}

      <div className={`flex justify-center items-center pt-3 border-t border-indigo-100/60 dark:border-gray-700/60 ${gridMode ? 'mt-auto' : 'mt-4'}`}>
        <div className="flex space-x-6">
          <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
            <Eye size={20} />
            <p>0</p>
          </div>
          <LikeButton id={post.id} type='post' initialIsLiked={post.is_liked_by_me}
            initialLikesCount={post.likes_count} onLikeSuccess={() => trackLike()} />
          <button onClick={(e) => { e.stopPropagation(); navigateToPost(); }}
            className="flex items-center space-x-1 text-sm text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="Комментарии">
            <MessageCircle size={16} />
            <span>Комментариев {post.comments_count}</span>
          </button>
          <div onClick={(e) => { e.stopPropagation(); trackShare(); }}>
            <ShareButton postId={post.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Postogram() {
  const { user, isLoggedIn } = useAuth();
  const { posts, loading, loadingMore, isRecommended, hasMore, loadMore } = useRecommendedPosts(10);

  // Переключатель "список / сетка", запоминаем выбор
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('postogram_view') as 'list' | 'grid') || 'list';
  });
  useEffect(() => {
    localStorage.setItem('postogram_view', viewMode);
  }, [viewMode]);

  // Бесконечная прокрутка: sentinel внизу страницы
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const toggleBtn = (active: boolean) =>
    `p-2 rounded-full transition-colors ${active ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`;

  return (
    <div className="">
      {/* ШИРИНА: в сетке контейнер растягивается (GRID_WIDTH), в списке — LIST_WIDTH.*/}
      <main className={`${viewMode === 'grid' ? GRID_WIDTH : LIST_WIDTH} mx-auto transition-all duration-300`}>
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-3xl text-gray-900 dark:text-gray-50 font-bold">
            {isLoggedIn ? `Для вас, ${user?.username}!` : 'Популярное'}
          </h1>
          {isRecommended && <Sparkles className="text-violet-500 dark:text-violet-400" size={24} />}

          {/* Переключатель отображения */}
          <div className="ml-auto flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-sm">
            <button type="button" onClick={() => setViewMode('list')} title="Списком" className={toggleBtn(viewMode === 'list')}>
              <List size={18} />
            </button>
            <button type="button" onClick={() => setViewMode('grid')} title="Сеткой (3 в ряд)" className={toggleBtn(viewMode === 'grid')}>
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Загрузка постов...</p>
        ) : (
          <>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {posts.length === 0 ? (
                <p className="text-lg text-gray-700 dark:text-gray-300">Постов пока нет. Будьте первым!</p>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} gridMode={viewMode === 'grid'} />
                ))
              )}
            </div>

            {/* Sentinel для IntersectionObserver + индикаторы */}
            <div ref={sentinelRef} className="h-10" />
            {loadingMore && (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Загрузка...</p>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-center text-gray-500 dark:text-gray-500 py-4">Вы посмотрели всё 🎉</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
