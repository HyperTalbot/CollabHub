// /frontend/components/comment/CommentReply.tsx
"use client";

import React, { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import Comment, { CommentType } from '@/components/comment/Comment'; // Используем наш основной компонент Comment
import CommentReplyForm from "@/components/comment/CommentReplyForm";
import Link from "next/link";

// Максимальная глубина, после которой требуется отдельная страница
const MAX_DEPTH = 5;
// Количество ответов, которое показывается сразу
const INITIAL_REPLIES_SHOW = 3;
// Количество ответов для показа при нажатии "Показать еще"
const PAGINATION_STEP = 3;

interface CommentReplyProps {
  comment: CommentType;
  // currentDepth: number;
  postID: number;
  onReplyClick: (parentId: number) => void;
  // ID комментария, на который отвечают
  activeReplyId: number | null;
  // Функция для отмены 
  onCancelReply: () => void;
  // Функция для отправки 
  onSubmitReply: (content: string, parentId: number) => Promise<void>;
}

// РЕКУРСИВНЫЙ КОМПОНЕНТ
export default function CommentReply({ comment, postID, onReplyClick, activeReplyId, onCancelReply, onSubmitReply }: CommentReplyProps) {
  // Управляет пагинацией вложенных ответов
  const [repliesToShow, setRepliesToShow] = useState(INITIAL_REPLIES_SHOW);

  const totalReplies = comment.replies?.length || 0;
  
  // Определяем, нужно ли скрывать ответы и показывать кнопку "Показать еще"
  const isRepliesHidden = totalReplies > repliesToShow;

  // Ответы, которые нужно отобразить
  const visibleReplies = comment.replies ? comment.replies.slice(0, repliesToShow) : [];

  // Проверка глубины (для масштабируемости)
  // Мы используем фиктивное поле depth, добавленное в buildCommentTree
  const currentDepth = (comment as any).depth || 1; 

  if (currentDepth > MAX_DEPTH) {
    // Если глубина превышена, показываем заглушку
    return (
      <div className="ml-4 p-2 bg-blue-50 rounded-md border border-blue-200">
        <MessageSquare size={16} className="inline mr-2 text-blue-600" />
        <span className="text-sm text-black">Дискуссия слишком глубока. <Link href={`/postogram/${postID}/comment/${comment.id}`} className="text-blue-500 hover:underline">Перейти на страницу комментария</Link> для продолжения.</span>
      </div>
    );
  }

  const isReplying = activeReplyId === comment.id;

  return (
    <div className="mt-4">
      {/* 1. Рендерим сам комментарий */}
      <Comment comment={comment} showReplyButton={true} onReplyClick={onReplyClick} />

      {/* Рендерим форму ответа (если isReplying true) */}
      {isReplying && (
        <CommentReplyForm
          parentId={comment.id}
          onSubmit={onSubmitReply}
          onCancel={onCancelReply}
          autoFocus={true}
        />
      )}

      {/* 2. Рендерим вложенные ответы (рекурсия) */}
      <div className="ml-8 border-l border-gray-300 pl-4">
        {visibleReplies.map(reply => (
          // Рекурсивно вызываем тот же компонент для ответа
          <CommentReply 
            key={reply.id} 
            comment={reply} 
            postID={postID}
            // currentDepth={currentDepth}
            onReplyClick={onReplyClick} 
            activeReplyId={activeReplyId}
            onCancelReply={onCancelReply}
            onSubmitReply={onSubmitReply}
          />
        ))}

        {/* 3. Кнопка "Показать остальные ответы" */}
        {isRepliesHidden && (
          <button
            onClick={() => setRepliesToShow(prev => prev + PAGINATION_STEP)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2 transition-colors font-medium"
          >
            <ChevronDown size={14} className="mr-1" />
            Показать остальные ответы ({totalReplies - repliesToShow} / {totalReplies})
          </button>
        )}
      </div>
    </div>
  );
}