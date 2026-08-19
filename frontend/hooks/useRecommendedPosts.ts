// frontend/hooks/useRecommendedPosts.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '@/lib/axiosInstance';
import Cookies from 'js-cookie';

interface Post {
  id: number;
  user_id: number;
  user_username: string;
  title: string;
  content: string;
  author_avatar_url: string;
  created_at: string;
  likes_count: number;
  is_liked_by_me: boolean;
  comments_count: number;
}

const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts/';
// НОВОЕ: размер одной пачки для бесконечной прокрутки
const BATCH_SIZE = 10;

export function useRecommendedPosts(limit: number = BATCH_SIZE) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // НОВОЕ: догрузка
  const [error, setError] = useState<string | null>(null);
  const [isRecommended, setIsRecommended] = useState(false);
  const [hasMore, setHasMore] = useState(true); // НОВОЕ: есть ли ещё пачки
  const loadedIdsRef = useRef<Set<number>>(new Set()); // защита от дубликатов

  const fetchRecommendedPosts = async () => {
    setLoading(true);
    setError(null);
    loadedIdsRef.current = new Set();
    try {
      // 1. Получаем рекомендации через Next.js API route
      const token = Cookies.get('token');
      const recResponse = await fetch(`/api/recommendations?type=post&limit=${limit}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const recData = await recResponse.json();
      const recommendations = recData.data || [];

      if (recommendations.length === 0) {
        // Fallback: первая пачка всех постов
        console.log('📝 No recommendations, loading first batch');
        const allPostsResponse = await axios.get(POSTS_API_URL, {
          params: { limit, offset: 0 },
        });
        const batch: Post[] = allPostsResponse.data || [];
        batch.forEach((p) => loadedIdsRef.current.add(p.id));
        setPosts(batch);
        setIsRecommended(false);
        setHasMore(batch.length >= limit);
        setLoading(false);
        return;
      }

      // 2. Собираем ID постов из рекомендаций
      const postIds = recommendations
        .filter((rec: any) => rec.content_type === 'post')
        .map((rec: any) => rec.content_id);

      if (postIds.length === 0) {
        const allPostsResponse = await axios.get(POSTS_API_URL, {
          params: { limit, offset: 0 },
        });
        const batch: Post[] = allPostsResponse.data || [];
        batch.forEach((p) => loadedIdsRef.current.add(p.id));
        setPosts(batch);
        setIsRecommended(false);
        setHasMore(batch.length >= limit);
        setLoading(false);
        return;
      }

      // 3. Загружаем посты через Next.js API route
      const postsResponse = await fetch(`/api/posts/by-ids?ids=${postIds.join(',')}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const postsData: Post[] = (await postsResponse.json()) || [];
      postsData.forEach((p) => loadedIdsRef.current.add(p.id));
      setPosts(postsData);
      setIsRecommended(true);
      setHasMore(true); // проверим при первой догрузке
    } catch (err: any) {
      console.error('Failed to load recommended posts:', err);
      setError(err.message || 'Failed to load posts');
      // Fallback: первая пачка
      try {
        const fallbackResponse = await axios.get(POSTS_API_URL, {
          params: { limit, offset: 0 },
        });
        const batch: Post[] = fallbackResponse.data || [];
        batch.forEach((p) => loadedIdsRef.current.add(p.id));
        setPosts(batch);
        setIsRecommended(false);
        setHasMore(batch.length >= limit);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedPosts();
  }, [limit]);

  // НОВОЕ: догрузка следующей пачки при прокрутке вниз
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      let batch: Post[] = [];
      if (!isRecommended) {
        // Обычная лента: следующая страница БД
        const res = await axios.get(POSTS_API_URL, {
          params: { limit, offset: loadedIdsRef.current.size },
        });
        batch = res.data || [];
      } else {
        // Рекомендации не пагинируются: берём обычные посты,
        // которых ещё нет в ленте
        const res = await axios.get(POSTS_API_URL, {
          params: { limit: limit * 2, offset: 0 },
        });
        batch = ((res.data || []) as Post[])
          .filter((p) => !loadedIdsRef.current.has(p.id))
          .slice(0, limit);
      }
      const fresh = batch.filter((p) => !loadedIdsRef.current.has(p.id));
      fresh.forEach((p) => loadedIdsRef.current.add(p.id));
      setPosts((prev) => [...prev, ...fresh]);
      if (fresh.length < limit) setHasMore(false);
    } catch (err) {
      console.error('Failed to load more posts:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, isRecommended, limit]);

  return {
    posts,
    loading,
    loadingMore,
    error,
    isRecommended,
    hasMore,
    loadMore,
    refetch: fetchRecommendedPosts,
  };
}