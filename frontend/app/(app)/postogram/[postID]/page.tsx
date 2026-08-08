// /frontend/app/(app)/postogram/[postID]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams, useRouter } from 'next/navigation';
import axios from '@/lib/axiosInstance';
import OriginalAxios from 'axios';
import Cookies from "js-cookie";
import { useAuth } from '@/context/AuthContext';
import { CommentType } from '@/components/comment/Comment';
import { buildCommentTree } from '@/utils/commentTree';
import CommentReply from '@/components/comment/CommentReply';
import UserActionDropdown from "@/components/user/UserActionDropdown";
import ShareButton from '@/components/shared/ShareButton';
import LikeButton from '@/components/shared/LikeButton';
import Image from "next/image";
import toast from "react-hot-toast";
import { getMediaURL } from '@/lib/mediaUtils';
import { Eye } from 'lucide-react';
import { useViewTracking } from '@/hooks/useViewTracking';

// const POSTS_API_URL = 'http://localhost:8084/api/v1/posts';
const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts';

interface PostDetailType {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  user_id: number;
  user_username: string;
  author_avatar_url?: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
  is_liked_by_me: boolean;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postID;

  const { isLoggedIn, user } = useAuth();

  const [post, setPost] = useState<PostDetailType | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [dataReloadKey, setDataReloadKey] = useState(0);
  const [newCommentContent, setNewCommentContent] = useState('');

  const fetchPostData = async () => {
    try {
      console.log('📥 Fetching post:', postId);

      // Загрузка поста
      const postResponse = await axios.get(`${POSTS_API_URL}/${postId}`);
      console.log('📦 Post response:', postResponse.data);

      setPost(postResponse.data);

      // Загрузка комментариев
      const commentsResponse = await axios.get(`${POSTS_API_URL}/${postId}/comments`);
      console.log('💬 Comments response:', commentsResponse.data);

      setComments(commentsResponse.data ?? []);

    } catch (err) {
      if (OriginalAxios.isAxiosError(err) && err.response?.status === 404) {
        console.error('❌ Post not found');
        setPost(null);
      } else {
        console.error("❌ Failed to fetch post details:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      fetchPostData();
    }
  }, [postId]);

  if (loading) {
    return <div className="text-center mt-10">Загрузка поста...</div>;
  }

  if (!post) {
    return <div className="text-center mt-10 text-red-500">Пост не найден.</div>;
  }

  const commentTree = buildCommentTree(comments);

  const handleReplySubmit = async (content: string, parentId: number | null) => {
    if (!postId) return;

    try {
      await axios.post(`${POSTS_API_URL}/${postId}/comments`, {
        content: content,
        parent_id: parentId,
      });

      setReplyingTo(null);
      setNewCommentContent('');

      await fetchPostData();
      setDataReloadKey(prev => prev + 1);

      toast.success('Комментарий добавлен');
    } catch (err) {
      console.error("Failed to post comment:", err);
      toast.error("Ошибка при отправке комментария.");
    }

    // trackInteraction('comment');
    
  };

  // // ДОБАВЬТЕ трекинг
  // const { trackView, trackInteraction } = useViewTracking({
  //   contentType: 'post',
  //   contentId: post?.id || 0,
  //   enabled: !!post,
  // });

  // // Трекаем просмотр при монтировании
  // useEffect(() => {
  //   if (post) {
  //     const timer = setTimeout(() => {
  //       trackView();
  //     }, 5000); // Через 5 секунд

  //     return () => clearTimeout(timer);
  //   }
  // }, [post]);

  return (
    <>
      <div className="max-w-3xl mx-auto bg-white p-6 shadow-xl rounded-xl dark:bg-gray-800">
        <div className="mb-6 pb-4 border-b">
          <div className="w-fit flex items-center space-x-3 mb-4 border border-gray-200 rounded-lg p-2 shadow-sm dark:bg-gray-700 dark:border-gray-600">
            {/* АВАТАР */}
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 border border-gray-300">
              {post.author_avatar_url ? (
                <img
                  src={getMediaURL(post.author_avatar_url)}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-lg">
                  {post.user_username?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-black dark:text-white">
                {post.user_username ?? `User ${post.user_id}`} • 🟦🔶🟢
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {post.created_at
                  ? new Date(post.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  : 'Invalid Date'
                }
              </p>
            </div>

          {/* Меню действий */}
          {isLoggedIn && user && String(post.user_id) !== String(user.id) && (
            <UserActionDropdown
              targetUserId={post.user_id}
              username={post.user_username}
            />
          )}
          </div>

          <h1 className="text-2xl font-extrabold text-black text-center mb-2 dark:text-white">
            {post.title}
          </h1>

          {/* ИЗОБРАЖЕНИЕ */}
          {post.image_url && (
            <div className="relative w-full h-[400px] mb-6 rounded-xl overflow-hidden shadow-sm bg-gray-100">
              <img
                src={getMediaURL(post.image_url)}
                alt={post.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* РЕНДЕРИНГ MARKDOWN */}
          <div className="prose prose-lg max-w-none text-black dark:text-gray-300 dark:prose-invert">
            <ReactMarkdown>{post.content ?? ''}</ReactMarkdown>
          </div>
        </div>

        <h2 className="text-1xl font-bold text-black mb-4 flex items-center space-x-3 dark:text-gray-500">
          {/* ПРОСМОТРЫ */}
          <Eye size={20}/><p>0</p>
          
          <LikeButton
            id={post.id}
            type="post"
            initialIsLiked={post.is_liked_by_me}
            initialLikesCount={post.likes_count}
            onLikeSuccess={() => {
              setDataReloadKey(prev => prev + 1);
            }}
          />
          <div className="relative w-[18px] h-[18px] mr-1">
            <Image src="/icons/reply.svg" alt="Ответить" layout="fill" objectFit="contain" />
          </div>
          <span>{comments.length ?? 0}</span>
          <ShareButton postId={post.id} />
        </h2>

        {/* Форма для ответа на пост */}
        <div className="mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReplySubmit(newCommentContent, null);
            }}
            className="flex space-x-3"
          >
            <input
              type="text"
              name="content"
              className="flex-1 border rounded p-2 text-black"
              placeholder={isLoggedIn ? "Написать комментарий..." : "Войдите, чтобы комментировать"}
              disabled={!isLoggedIn}
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={!isLoggedIn}
              className="bg-blue-500 text-white p-2 rounded disabled:opacity-50"
            >
              Отправить
            </button>
          </form>
        </div>
      </div>

      {/* ДЕРЕВО КОММЕНТАРИЕВ */}
      <div className="max-w-3xl mt-8 mx-auto p-6 rounded-xl">
        {commentTree.map(comment => (
          <CommentReply
            key={comment.id}
            comment={comment}
            postID={post.id}
            onReplyClick={(parentId) => setReplyingTo(parentId)}
            activeReplyId={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onSubmitReply={handleReplySubmit}
          />
        ))}
      </div>
    </>
  );
}