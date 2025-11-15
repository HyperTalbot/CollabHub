// /frontend/app/(app)/postogram/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import LikeButton from '@/components/shared/LikeButton';
import ShareButton from '@/components/shared/ShareButton';
import CommentSection from '@/components/comment/CommentSection';
import { MessageCircle, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

const fetchPosts = async () => {
  try {
    // Включаем токен, если пользователь залогинен (это обрабатывается в axiosInstance)
    const response = await axios.get(POSTS_API_URL);
    return response.data || [];
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return [];
  }
};

export default function Postogram() {
  const { user, isLoggedIn } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    const fetchedPosts = await fetchPosts();
    setPosts(fetchedPosts);
    setLoading(false);
  };
  
  // Использование loadPosts в качестве колбэка
  const handlePostCreated = () => {
    loadPosts(); 
  };

  useEffect(() => {
    loadPosts();
  }, [isLoggedIn]); // Обновляем ленту при изменении статуса авторизации

  const toggleComments = (postId: number) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
    }
  };

  const router = useRouter();

  const navigateToPost = (postId: number) => {
    router.push(`/postogram/${postId}/`);
  };

  return (
    <div className="">
      <main className="w-1/2 mx-auto">
        <h1 className="text-3xl text-black font-bold mb-4">
          Добро пожаловать в Postogram, {user?.username || 'Гость'}!
        </h1>
        
        {/* <CreatePostForm onPostCreated={handlePostCreated} /> */}

        <h2 className="text-2xl text-black font-semibold mb-4 mt-6">Лента Postogram</h2>
        {loading ? (
          <p>Загрузка постов...</p>
        ) : (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-lg text-black">Постов пока нет. Будьте первым!</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white p-4 shadow-lg rounded-xl">
                  {/* Заголовок поста */}
                  <div className="flex items-center space-x-3 mb-3">
                    {/* Аватар (Заглушка) */}
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white text-lg">
                      {post.user_id}
                    </div>
                    {/* Инфо о пользователе */}
                    <div className="flex-1">
                      <p className="font-bold text-black">Пользователь (ID: {post.user_id})</p>
                      <p className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Контент поста */}
                  <h2 className='text-2xl font-bold text-black flex items-center justify-center my-3'>{post.title}</h2>
                  <p className="text-lg text-black">{post.content}</p>
                  
                  {/* --- ПАНЕЛЬ ДЕЙСТВИЙ (Футер) --- */}
                  <div className="flex justify-between items-center justify-center mt-4 pt-3 border-t">
                    <div className="flex space-x-6"> 
                      
                      {/* КНОПКА ЛАЙКА */}
                      <LikeButton 
                        id={post.id}
                        type='post'
                        initialIsLiked={post.is_liked_by_me}
                        initialLikesCount={post.likes_count}
                      />
                      
                      {/* КНОПКА КОММЕНТАРИЕВ */}
                      <button 
                        onClick={() => navigateToPost(post.id)}
                        className="flex items-center space-x-1 text-sm text-gray-500 hover:text-green-500 transition-colors"
                        title="Комментарии"
                      >
                        <MessageCircle size={16} />
                        <span>Комментариев {post.comments_count}</span>
                      </button>
                      
                      {/* КНОПКА ПОДЕЛИТЬСЯ */}
                      <ShareButton postId={post.id} />
                    </div>
                  </div>

                  {/* --- СЕКЦИЯ КОММЕНТАРИЕВ --- */}
                  {expandedPostId === post.id && (
                    <CommentSection postId={post.id} />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}