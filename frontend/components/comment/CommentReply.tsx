"use client";

import React, { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import Comment, { CommentType } from '@/components/comment/Comment';
import CommentReplyForm from "@/components/comment/CommentReplyForm";
import Link from "next/link";

const MAX_DEPTH = 3;
const INITIAL_REPLIES_SHOW = 3;
const PAGINATION_STEP = 3;

interface CommentReplyProps {
  comment: CommentType;
  postID: number;
  onReplyClick: (parentId: number) => void;
  activeReplyId: number | null;
  onCancelReply: () => void;
  onSubmitReply: (content: string, parentId: number) => Promise<void>;
}

export default function CommentReply({ comment, postID, onReplyClick, activeReplyId, onCancelReply, onSubmitReply }: CommentReplyProps) {
  const [repliesToShow, setRepliesToShow] = useState(INITIAL_REPLIES_SHOW);

  const totalReplies = comment.replies?.length || 0;
  const isRepliesHidden = totalReplies > repliesToShow;
  const visibleReplies = comment.replies ? comment.replies.slice(0, repliesToShow) : [];

  const currentDepth = comment.depth || 1; 

  if (currentDepth > MAX_DEPTH) {
    return (
      <div className="ml-4 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
        <MessageSquare size={16} className="inline mr-2 text-blue-600 dark:text-blue-400" />
        <span className="text-sm text-gray-800 dark:text-gray-200">
          Дискуссия уходит вглубь.{' '}
          <Link 
            href={`/postogram/${postID}/comment/${comment.id}`} 
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Продолжить чтение ветки
          </Link>
        </span>
      </div>
    );
  }

  const isReplying = activeReplyId === comment.id;

  return (
    <div className="mt-4">
      <Comment comment={comment} showReplyButton={true} onReplyClick={onReplyClick} />

      {isReplying && (
        <CommentReplyForm
          parentId={comment.id}
          onSubmit={onSubmitReply}
          onCancel={onCancelReply}
          autoFocus={true}
        />
      )}

      <div className="ml-6 sm:ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-2">
        {visibleReplies.map(reply => (
          <CommentReply 
            key={reply.id} 
            comment={reply} 
            postID={postID}
            onReplyClick={onReplyClick} 
            activeReplyId={activeReplyId}
            onCancelReply={onCancelReply}
            onSubmitReply={onSubmitReply}
          />
        ))}

        {isRepliesHidden && (
          <button
            onClick={() => setRepliesToShow(prev => prev + PAGINATION_STEP)}
            className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-3 transition-colors font-medium"
          >
            <ChevronDown size={16} className="mr-1" />
            Показать остальные ответы ({totalReplies - repliesToShow} / {totalReplies})
          </button>
        )}
      </div>
    </div>
  );
}
