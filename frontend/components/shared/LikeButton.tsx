// /frontend/components/LikeButton.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import OriginalAxios from 'axios'; // Для проверки ошибок
import axiosInstance from '@/lib/axiosInstance';
import { Heart } from 'lucide-react';

const POSTS_API_URL = 'http://localhost:8081/api/v1/posts';
const COMMENTS_API_URL = 'http://localhost:8081/api/v1/comments';

interface LikeButtonProps {
  id: number; // ID Поста или Комментария
  type: 'post' | 'comment'; 
  initialLikesCount: number;
  initialIsLiked: boolean;
  onLikeSuccess?: () => void;
}

export default function LikeButton({ initialLikesCount, initialIsLiked, id, type, onLikeSuccess }: LikeButtonProps) {
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

      // Вызываем коллбэк после успеха
      if (onLikeSuccess) {
        onLikeSuccess();
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
      className={`flex items-center space-x-1 transition-colors ${
        isLiked
          ? 'text-red-500' // Цвет лайка
          : 'text-gray-500 hover:text-red-500 dark:text-gray-800 dark:hover:text-red-500'
      }`}
    >
      <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
      <span className="text-sm">{likesCount}</span>
    </button>

      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}



// // /frontend/components/shared/LikeButton.tsx
// "use client";

// import React, { useState } from 'react';
// import axios from '@/lib/axiosInstance';
// import { Heart } from 'lucide-react';
// import { useAuth } from '@/context/AuthContext';

// interface LikeButtonProps {
//   id: number;
//   type: 'post' | 'comment';
//   initialIsLiked: boolean;
//   initialLikesCount: number;
//   onLikeSuccess?: () => void; // <-- 1. ДОБАВЬТЕ ЭТОТ ПРОПС
// }

// const API_URL = 'http://localhost:8081/api/v1';

// export default function LikeButton({ id, type, initialIsLiked, initialLikesCount, onLikeSuccess }: LikeButtonProps) {
//   const [isLiked, setIsLiked] = useState(initialIsLiked);
//   const [likesCount, setLikesCount] = useState(initialLikesCount);
//   const { isLoggedIn } = useAuth();

//   const handleLike = async () => {
//     if (!isLoggedIn) {
//       alert("Необходимо войти в систему, чтобы ставить лайки.");
//       return;
//     }

//     const endpoint = type === 'post' 
//     ? `/posts/${id}/like `
//     : `/comments/${id}/like`;
    
//     try {
//       if (isLiked) {
//         // Логика Dislike
//         await axios.delete(`${API_URL}${endpoint}`);
//         setIsLiked(false);
//         setLikesCount(prev => prev - 1);
//       } else {
//         // Логика Like
//         await axios.post(`${API_URL}${endpoint}`);
//         setIsLiked(true);
//         setLikesCount(prev => prev + 1);
//       }
      
//       // 2. ВЫЗЫВАЕМ КОЛЛБЭК ПОСЛЕ УСПЕХА
//       if (onLikeSuccess) {
//         onLikeSuccess();
//       }

//     } catch (err) {
//       console.error(`Failed to ${isLiked ? 'unlike' : 'like'}:`, err);
//     }
//   };

//   return (
//     <button
//       onClick={handleLike}
//       className={`flex items-center space-x-1 transition-colors ${
//         isLiked
//           ? 'text-red-500' // Цвет лайка
//           : 'text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400'
//       }`}
//     >
//       <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
//       <span className="text-sm">{likesCount}</span>
//     </button>
//   );
// }