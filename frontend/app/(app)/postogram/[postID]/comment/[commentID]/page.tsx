// /frontend/app/(app)/comment/[commentID]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from '@/lib/axiosInstance';
import OriginalAxios from 'axios';
import { CommentType } from '@/components/comment/Comment';
import { buildCommentTree } from '@/utils/commentTree';
import CommentReply from '@/components/comment/CommentReply'; // Мы переиспользуем этот компонент!

const COMMENTS_API_URL = 'http://localhost:8081/api/v1/comments';

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
      // 1. Загружаем ВСЮ ветку (плоский список)
      const response = await axios.get(`${COMMENTS_API_URL}/${commentID}/thread`);
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

  // Функция отправки ответа (такая же, как на странице поста)
  const handleReplySubmit = async (content: string, parentId: number) => {
    if (!rootComment) return;
    
    // ВНИМАНИЕ: Мы отправляем запрос на /posts/:id/comments, а не /comments/
    const POSTS_API_URL = 'http://localhost:8081/api/v1/posts';

    try {
      await axios.post(`${POSTS_API_URL}/${rootComment.post_id}/comments, {
        content: content,
        parent_id: parentId,
      }`);
      
      setReplyingTo(null);
      setDataReloadKey(prev => prev + 1); // Обновляем ветку
      
    } catch (err) {
      console.error("Failed to post comment:", err);
      alert("Ошибка при отправке комментария.");
    }
  };

  if (loading) {
    return <div className="text-center mt-10 dark:text-white">Загрузка ветки...</div>;
  }
  
  if (!rootComment) {
    return <div className="text-center mt-10 text-red-500">Комментарий не найден.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-black dark:text-white mb-4">
        Ветка комментария (ID: {rootComment.id})
      </h2>
      
      {/* Мы просто рендерим CommentReply с корнем.
        MAX_DEPTH и пагинация будут работать АВТОМАТИЧЕСКИ.
      */}
      <CommentReply
        comment={rootComment}
        postID={parseInt(postID)}
        // currentDepth={1}
        onReplyClick={(parentId) => setReplyingTo(parentId)}
        activeReplyId={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSubmitReply={handleReplySubmit}
      />
    </div>
  );
}