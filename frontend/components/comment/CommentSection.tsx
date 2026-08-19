// /frontend/components/CommentSection.tsx
"use client";

import React, { useState, useEffect } from 'react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '../auth/AuthModal';
import Comment, { CommentType } from '@/components/comment/Comment'; // Импортируем наш компонент
import { buildCommentTree } from "@/utils/commentTree";

const POSTS_API_URL = 'http://localhost:8081/api/v1/posts';

interface CommentSectionProps {
  postId: number;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { isLoggedIn } = useAuth();
  const [comments, setComments] = useState<CommentType[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Функция загрузки комментариев
  const fetchComments = async () => {
    try {
      const response = await axios.get(`${POSTS_API_URL}/${postId}/comments`);
      setComments(response.data || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Загружаем комменты при первом рендере
  useEffect(() => {
    fetchComments();
  }, [postId]);

  // 3. Функция отправки нового комментария
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setIsModalOpen(true);
      return;
    }

    try {
      const response = await axios.post(`${POSTS_API_URL}/${postId}/comments`, {
        content: content,
      });
      // Добавляем новый коммент в список (оптимистично)
      setComments([...comments, response.data]);
      setContent('');
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t">
      {/* Форма для нового комментария */}
      <form onSubmit={handleSubmitComment} className="flex space-x-3 mb-4">
        <input
          type="text"
          className="flex-1 shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Написать комментарий..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Отправить
        </button>
      </form>

      {/* Список комментариев */}
      <div className="space-y-4">
        {isLoading ? (
          <p>Загрузка комментариев...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center">Комментариев пока нет.</p>
        ) : (
          comments.map((comment) => (
            <Comment 
              key={comment.id} 
              comment={comment} 
              showReplyButton={false}
              onReplyClick={() => {}}
              />
          ))
        )}
      </div>
      
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}