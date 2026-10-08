// frontend/app/(app)/postogram/[postID]/comment/[commentID]/page.tsx
// Страница ветки комментария (сюда ведёт пагинация после 3-го ответа)
"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from '@/lib/axiosInstance';
import OriginalAxios from 'axios';
import toast from 'react-hot-toast';
import { CommentType } from '@/components/comment/Comment';
import { buildCommentTree } from '@/utils/commentTree';
import CommentReply from '@/components/comment/CommentReply'; // Мы переиспользуем этот компонент!

// ИСПРАВЛЕНО (404): ветку загружаем через группу /posts — этот путь
// гарантированно проксируется в production. Бэкенд-алиас:
// posts.GET("/comment-thread/:id", ..., commentHandler.GetCommentThread)
const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts';

export default function CommentThreadPage() {
  const params = useParams();
  const postID = params.postID as string;
  const commentID = params.commentID as string;

  const [rootComment, setRootComment] = useState<CommentType | null>(null);
  const [loading, setLoading] = useState(true);

  // Состояния для управления ответами (как на странице поста)
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [dataReloadKey, setDataReloadKey] = useState(0);

  const fetchThread = async () => {
    try {
      // 1. Загружаем ВСЮ ветку (плоский список) через алиас в группе /posts
      const response = await axios.get(`${POSTS_API_URL}/comment-thread/${commentID}`);
      const allComments: CommentType[] = response.data || [];

      if (allComments.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Находим "корень" (тот, что мы запросили)
      const foundRoot = allComments.find(c => c.id === parseInt(commentID));
      if (!foundRoot) {
        setLoading(false);
        return; // Ошибка, корень не найден в ответе
      }

      // 3. Строим дерево ОТВЕТОВ (детей)
      const repliesTree = buildCommentTree(allComments, foundRoot.id);

      // 4. Присваиваем ответы корню
      foundRoot.replies = repliesTree;
      setRootComment(foundRoot);
    } catch (err) {
      if (OriginalAxios.isAxiosError(err) && err.response?.status === 404) {
        setRootComment(null);
      }
      console.error("Failed to fetch comment thread:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (commentID) {
      fetchThread();
    }
  }, [commentID, dataReloadKey]); // Перезагружаем по ключу

  // Функция отправки ответа (запросы на создание комментариев тоже через /posts)
  const handleReplySubmit = async (content: string, parentId: number) => {
    if (!rootComment) return;
    try {
      await axios.post(`${POSTS_API_URL}/${rootComment.post_id}/comments`, {
        content: content,
        parent_id: parentId,
      });
      setReplyingTo(null);
      setDataReloadKey(prev => prev + 1); // Обновляем ветку
      toast.success('Ответ добавлен');
    } catch (err) {
      console.error("Failed to post comment:", err);
      toast.error("Ошибка при отправке комментария.");
    }
  };

  if (loading) {
    return <div className="text-center mt-10 text-gray-600 dark:text-gray-300">Загрузка ветки...</div>;
  }

  if (!rootComment) {
    return <div className="text-center mt-10 text-red-500">Комментарий не найден.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">
        Ветка комментария (ID: {rootComment.id})
      </h2>

      {/* Рендерим CommentReply с корнем.
          expandAll={true}: на странице ветки показываем ВСЕ ответы
          без лимитов и кнопок пагинации. */}
      <CommentReply
        comment={rootComment}
        postID={parseInt(postID) || rootComment.post_id}
        onReplyClick={(parentId) => setReplyingTo(parentId)}
        activeReplyId={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSubmitReply={handleReplySubmit}
        expandAll={true}
      />
    </div>
  );
}
