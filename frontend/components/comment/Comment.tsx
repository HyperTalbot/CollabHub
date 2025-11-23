// /frontend/components/Comment.tsx
"use client";

import React from 'react';
import LikeButton from '@/components/shared/LikeButton'; // Мы будем его переиспользовать!
import ShareButton from '../shared/ShareButton'; // И его тоже
import Image from "next/image";
// import { MessageCircle } from 'lucide-react';
// import { CommentType } from "./Comment";

// Тип для данных Комментария (должен совпадать с Go-моделью)
export interface CommentType {
  id: number;
  post_id: number;
  user_id: number;
  user_username: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked_by_me: boolean;
  parent_id: number | null; // Соответствует &uint (может быть null)
  replies?: CommentType[]; // Виртуальное поле для дерева (опционально)
  depth?: number; // Виртуальное поле для utils (опционально)
}

interface CommentProps {
  comment: CommentType;
  showReplyButton: boolean;
  onReplyClick: (parentId: number) => void;
}

export default function Comment({ comment, showReplyButton, onReplyClick }: CommentProps) {
  return (
    // 1. Контейнер-карточка (как у постов)
    <div className="bg-white p-4 shadow-lg rounded-xl dark:bg-gray-800">
      
      {/* --- Тело Комментария --- */}
      <div className="w-fit flex items-start space-x-3 border border-gray-200 rounded-lg p-2 shadow-sm">
        {/* Аватар */}
        <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
          {comment.user_id}
        </div>
        
        {/* Контент */}
        <div className="flex-1 rounded-lg"> 
          {/* 2. ВОССТАНОВЛЕНИЕ: Имя и дата в столбик */}
          <div className="p2">
            <p className="font-bold text-black dark:text-white">{comment.user_username || `User ${comment.user_id}`} • 🟦🔶🟢</p>
            <p className="text-xs text-gray-500 dark:text-gray-300">
              {new Date(comment.created_at).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>
      <p className="text-md text-black p-1 mt-2 dark:text-gray-300">{comment.content}</p>

      {/* 3. ВОССТАНОВЛЕНИЕ: Кнопки на прежнем месте (под контентом) */}
      <div className="flex items-center justify-center space-x-6 mt-2">
        <LikeButton
          id={comment.id}
          type="comment"
          initialIsLiked={comment.is_liked_by_me}
          initialLikesCount={comment.likes_count}
        />
        
        {showReplyButton && (
            <button 
                onClick={() => onReplyClick(comment.id)} 
                className="flex text-sm text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
            >
              <div className="relative w-[18px] h-[18] mr-1"> <Image src="/icons/reply.svg" alt="Ответить" layout="fill" objectFit="contain" /> 
              </div> 
              Ответить
            </button>
        )}

        <ShareButton postId={comment.post_id} />
      </div>
    </div>
  );
}