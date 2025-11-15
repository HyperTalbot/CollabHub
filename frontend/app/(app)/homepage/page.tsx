// /frontend/app/(app)/homepage/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
// import axios from '@/lib/axiosInstance';
// import { useAuth } from '@/context/AuthContext';
// import CreatePostForm from '@/components/create/CreatePostForm';
// import LikeButton from '@/components/shared/LikeButton';
// import ShareButton from '@/components/shared/ShareButton';
// import CommentSection from '@/components/comment/CommentSection';
// import { MessageCircle } from 'lucide-react';

const POSTS_API_URL = 'http://localhost:8081/api/v1/posts/';

// Тип для данных Поста (должен совпадать с Go-моделью)
interface Post {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  created_at: string;
  
  // Добавленные поля для лайков
  likes_count: number;
  is_liked_by_me: boolean;

  comments_count: number;
}

// const fetchPosts = async () => {
//   try {
//     // Включаем токен, если пользователь залогинен (это обрабатывается в axiosInstance)
//     const response = await axios.get(POSTS_API_URL);
//     return response.data || [];
//   } catch (error) {
//     console.error("Failed to fetch posts:", error);
//     return [];
//   }
// };

export default function HomePage() {
  // const { user, isLoggedIn } = useAuth();
  // const [posts, setPosts] = useState<Post[]>([]);
  // const [loading, setLoading] = useState(true);
  // const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

  // const loadPosts = async () => {
  //   setLoading(true);
  //   const fetchedPosts = await fetchPosts();
  //   setPosts(fetchedPosts);
  //   setLoading(false);
  // };
  
  // // Использование loadPosts в качестве колбэка
  // const handlePostCreated = () => {
  //   loadPosts(); 
  // };

  // useEffect(() => {
  //   loadPosts();
  // }, [isLoggedIn]); // Обновляем ленту при изменении статуса авторизации

  // const toggleComments = (postId: number) => {
  //   if (expandedPostId === postId) {
  //     setExpandedPostId(null);
  //   } else {
  //     setExpandedPostId(postId);
  //   }
  // };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      
      {/* --- ЛЕВАЯ КОЛОНКА (Выжимка контента) --- */}
        {/* Заглушка под Видео (YouTube/TikTok) */}
        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="font-semibold mb-2 text-xl text-black">🎬 Видео дня</h3>
          <div className="aspect-video bg-gray-200 rounded animate-pulse h-40"></div>
          <p className="text-sm mt-2 text-gray-500">Заглушка для контента с YouTube/TikTok</p>
        </div>
        
      {/* Заглушка под Музыку (Spotify) */}
        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="font-semibold mb-2 text-black">🎧 Музыка Недели</h3>
          <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
        </div>

        {/* Заглушка под Новости/Музыку */}
        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="font-semibold mb-2 text-xl text-black">📰 Горячие новости</h3>
          <div className="h-16 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
          <p className="text-sm mt-2 text-gray-500">Заглушка для интеграции Discord/Telegram</p>
        </div>

    </div>
  );
}