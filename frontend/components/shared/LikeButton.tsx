// /frontend/components/LikeButton.tsx
"use client";

import React, { useState } from 'react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import OriginalAxios from 'axios'; // Для проверки ошибок
import axiosInstance from '@/lib/axiosInstance';

const POSTS_API_URL = 'http://localhost:8081/api/v1/posts';
const COMMENTS_API_URL = 'http://localhost:8081/api/v1/comments';

interface LikeButtonProps {
  initialLikesCount: number;
  initialIsLiked: boolean;
  id: number; // ID Поста или Комментария
  type: 'post' | 'comment'; // Новый пропс!
}

export default function LikeButton({ initialLikesCount, initialIsLiked, id, type }: LikeButtonProps) {
  const { isLoggedIn } = useAuth();

  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    if (!isLoggedIn) {
      setIsModalOpen(true);
      return;
    }
    if (isLoading) return;
    setIsLoading(true);

    const wasLiked = isLiked; // Состояние до клика
    
    // Определяем, куда слать запрос
    const endpoint = type === 'post' 
      ? `${POSTS_API_URL}/${id}/like`
      : `${COMMENTS_API_URL}/${id}/like`;

    try {
      if (wasLiked) {
        // --- Логика Un-Like ---
        await axiosInstance.delete(endpoint);
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        // --- Логика Like ---
        await axiosInstance.post(endpoint);
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (err) {
      // Обработка ошибок (например, 409 Conflict или 404 Not Found)
      console.error(`Failed to ${wasLiked ? 'unlike' : 'like'} ${type}`, err);
      
      // Если запрос упал, мы ничего не меняем в UI, 
      // но нужно синхронизировать состояние на случай 409/404
      if (OriginalAxios.isAxiosError(err) && err.response) {
          if (err.response.status === 409) { // Already liked
              setIsLiked(true);
          }
          if (err.response.status === 404) { // Like not found (when unliking)
              setIsLiked(false);
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleLike}
        disabled={isLoading}
        className={`flex items-center space-x-1 text-sm font-medium transition-colors duration-150 ${
          isLiked 
            ? 'text-red-500 hover:text-red-600'
            : 'text-gray-500 hover:text-red-500'
        } ${isLoading ? 'opacity-50' : ''}`}
      >
        <span>{isLiked ? '❤️' : '🤍'}</span>
        <span>{likesCount}</span>
      </button>

      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}