// frontend/hooks/useRecommendedPosts.ts
"use client";

import { useState, useEffect } from 'react';
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

export function useRecommendedPosts(limit: number = 20) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecommended, setIsRecommended] = useState(false);

  useEffect(() => {
    fetchRecommendedPosts();
  }, [limit]);

  const fetchRecommendedPosts = async () => {
    setLoading(true);
    setError(null);

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
        // Fallback: загружаем все посты
        console.log('📝 No recommendations, loading all posts');
        const allPostsResponse = await axios.get(POSTS_API_URL);
        setPosts(allPostsResponse.data || []);
        setIsRecommended(false);
        setLoading(false);
        return;
      }

      // 2. Собираем ID постов
      const postIds = recommendations
        .filter((rec: any) => rec.content_type === 'post')
        .map((rec: any) => rec.content_id);

      if (postIds.length === 0) {
        const allPostsResponse = await axios.get(POSTS_API_URL);
        setPosts(allPostsResponse.data || []);
        setIsRecommended(false);
        setLoading(false);
        return;
      }

      // 3. Загружаем посты через Next.js API route
      const postsResponse = await fetch(`/api/posts/by-ids?ids=${postIds.join(',')}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const postsData = await postsResponse.json();
      setPosts(postsData || []);
      setIsRecommended(true);

    } catch (err: any) {
      console.error('Failed to load recommended posts:', err);
      setError(err.message || 'Failed to load posts');

      // Fallback: загружаем все посты
      try {
        const fallbackResponse = await axios.get(POSTS_API_URL);
        setPosts(fallbackResponse.data || []);
        setIsRecommended(false);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  return { posts, loading, error, isRecommended, refetch: fetchRecommendedPosts };
}