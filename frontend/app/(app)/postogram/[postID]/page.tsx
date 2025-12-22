// /frontend/app/(app)/postogram/[postID]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown'; // 1. Импорт рендера
import { useParams, useRouter } from 'next/navigation';
import axios from '@/lib/axiosInstance';
import OriginalAxios from 'axios'; // Для проверки ошибок
import Cookies from "js-cookie";
import { useAuth } from '@/context/AuthContext';
import { CommentType } from '@/components/comment/Comment';
import { buildCommentTree } from '@/utils/commentTree'; // Наша утилита
import CommentReply from '@/components/comment/CommentReply'; // Рекурсивный компонент
// import CreatePostForm from '@/components/CreatePostForm'; // Переиспользуем форму для ответа
// import { MessageCircle } from 'lucide-react';
import UserActionDropdown from "@/components/user/UserActionDropdown";
import ShareButton from '@/components/shared/ShareButton';
import LikeButton from '@/components/shared/LikeButton';
import Image from "next/image";
import toast from "react-hot-toast";

const POSTS_API_URL = 'http://localhost:8081/api/v1/posts';

// Тип для Поста (только то, что нам нужно для отображения)
interface PostDetailType {
  id: number;
  title: string;
  content: string;
  image_url: string;
  user_id: number;
  user_username: string;
  author_avatar_url: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
  is_liked_by_me: boolean;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postID;

  const { isLoggedIn, user } = useAuth(); // Получаем текущего пользователя

  const [post, setPost] = useState<PostDetailType | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<number | null>(null); // ID родителя для ответа
	const [dataReloadKey, setDataReloadKey] = useState(0);
	const [newCommentContent, setNewCommentContent] = useState('');

  const fetchPostData = async () => {
    try {
      // 1. Загрузка поста (TODO: Нужен эндпоинт GET /posts/:id)
      const postResponse = await axios.get(`${POSTS_API_URL}/${postId}`); 
      // Временно берем первый пост, так как GET /posts/:id еще не создан
      // const foundPost = postResponse.data.find((p: any) => p.id == postId); 
      setPost(postResponse.data || null);

      // if (!foundPost) {
      //   setLoading(false);
      //   return;
      // }
      
      // 2. Загрузка комментариев
      const commentsResponse = await axios.get(`${POSTS_API_URL}/${postId}/comments`);
      setComments(commentsResponse.data || []);
      
    } catch (err) {
			// Если Axios выдает ошибку 404, обрабатываем ее
			if (OriginalAxios.isAxiosError(err) && err.response?.status === 404) {
				setPost(null) // Явно устанавливаем, что пост не найден
			} else {
				console.error("Failed to fetch post details:", err);
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

  // 3. Строим дерево комментариев
  const commentTree = buildCommentTree(comments);
  
  // 4. Обработка отправки ответа
  const handleReplySubmit = async (content: string, parentId: number | null) => {
    if (!postId) return;

    try {
      await axios.post(`${POSTS_API_URL}/${postId}/comments`, {
        content: content,
        parent_id: parentId, // parentId будет null для комментариев верхнего уровня
      });
      
      // Сбрасываем поля и обновляем комменты
      setReplyingTo(null);
      setNewCommentContent('');
      fetchPostData(); // Перезагружаем все данные поста
			setDataReloadKey(prev => prev + 1);

			await fetchPostData();
      
    } catch (err) {
      console.error("Failed to post comment:", err);
      // alert("Ошибка при отправке комментария.");
      toast.error("Ошибка при отправке комментария.")
    }
  };

  // const startChat = async (targetUserId: number) => {
  //   // 2. Получаем токен вручную
  //   const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
  //   if (!token) {
  //       alert("Ошибка авторизации: Токен не найден. Попробуйте перезайти.");
  //       return;
  //   }

  //   if (user && user.id === targetUserId) {
  //     toast.error("Нельзя начать чат с самим собой.")
  //   }

  //   try {
  //     // 3. Передаем заголовок явно вторым аргументом конфига
  //     await axios.post('http://localhost:8082/api/v1/conversations', 
  //       { 
  //         target_user_id: targetUserId 
  //       },
  //       {
  //         headers: {
  //           'Authorization': `Bearer ${token}` // <-- ЯВНАЯ ПЕРЕДАЧА
  //         }
  //       }
  //     );
      
  //     router.push('/misable');
  //     toast.success("Чат успешно начат или открыт!")
  //   } catch (err: any) { // any для typescript
  //     console.error(err);
  //     // alert("Не удалось начать чат. Проверьте консоль.");
  //     toast.error(err.response?.data.error || "Не удалось начать чат.")
  //   }
  // }

  return (
    <>
      <div className="max-w-3xl mx-auto bg-white p-6 shadow-xl rounded-xl dark:bg-gray-800">
        {/* -------------------- ОТОБРАЖЕНИЕ ПОСТА -------------------- */}
        <div className="mb-6 pb-4 border-b">
          <div className="w-fit flex items-center space-x-3 mb-4 border border-gray-200 rounded-lg p-2 shadow-sm dark:bg-gray-700 dark:border-gray-600">
            {/* АВАТАР */}
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 border border-gray-300">
              {post.author_avatar_url ? (
                      <img src={post.author_avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-lg">
                          {post.user_username?.[0]?.toUpperCase()}
                      </div>
                  )}
              </div>
            <div>
              <p className="font-bold text-black dark:text-white">{post.user_username || `User ${post.user_id}`} • 🟦🔶🟢</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {/* ИНФО */}
                {new Date(post.created_at).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* Меню действий */}
          {isLoggedIn && user && String(post.user_id) !== String(user.id) && (
              <UserActionDropdown
                targetUserId={post.user_id}
                username={post.user_username}
              />
          )}

          <h1 className="text-2xl font-extrabold text-black text-center mb-2 dark:text-white">{post.title}</h1>
          
          {/* 4. ОТОБРАЖЕНИЕ ИЗОБРАЖЕНИЯ (если есть) */}
          {post.image_url && (
            <div className="relative w-full h-96 my-4 rounded-lg overflow-hidden">
              <Image
                src={post.image_url}
                alt={post.title}
                layout="fill"
                objectFit="cover"
                // На случай, если URL изображения битый
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
              />
            </div>
          )}
          

          {/* <p className="text-lg text-black dark:text-gray-300">{post.content}</p> */}

           {/* ИЗОБРАЖЕНИЕ */}
          {post.image_url && (
            <div className="relative w-full h-[400px] mb-6 rounded-xl overflow-hidden shadow-sm bg-gray-100">
              <img // Используем обычный img для простоты, если домен картинки не в next.config.js
                src={post.image_url}
                alt={post.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* 5. РЕНДЕРИНГ MARKDOWN */}
          <div className="prose prose-lg max-w-none text-black dark:text-gray-300 dark:prose-invert">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>

          {/* Здесь можно добавить кнопки Лайк/Поделиться для самого поста */}
        </div>
      
      
        {/* -------------------- ФОРМА ОТВЕТА НА ПОСТ -------------------- */}

        <h2 className="text-1xl font-bold text-black mb-4 flex items-center space-x-3 dark:text-gray-500">
          <LikeButton
            id={post.id}
            type="post"
            initialIsLiked={post.is_liked_by_me}
            initialLikesCount={post.likes_count}
            onLikeSuccess={() => {
              setDataReloadKey(prev => prev + 1)
            }}
          />
          <div className="relative w-[18px] h-[18] mr-1"><Image src="/icons/reply.svg" alt="Ответить" layout="fill" objectFit="contain" /></div>
          <span>{comments.length || 0}</span> {/* Комментарии */}
          <ShareButton postId={post.id} />
        </h2>
      
        {/* Форма для ответа на пост (ParentID = null) */}
        <div className="mb-8">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleReplySubmit(newCommentContent, null); // Вызываем новую функцию
            }} 
            className="flex space-x-3"
          >
            <input
                type="text"
                name="content"
                className="flex-1 border rounded p-2 text-black"
                placeholder={isLoggedIn ? "Написать комментарий..." : "Войдите, чтобы комментировать"}
                disabled={!isLoggedIn}
                value={newCommentContent} // Управляем состоянием
                onChange={(e) => setNewCommentContent(e.target.value)}
                required
            />
            <button type="submit" disabled={!isLoggedIn} className="bg-blue-500 text-white p-2 rounded">
                Отправить
            </button>
          </form>
        </div>
      </div>
      {/* -------------------- ДЕРЕВО КОММЕНТАРИЕВ -------------------- */}
      <div className="max-w-3xl mt-8 mx-auto p-6  rounded-xl">
        {commentTree.map(comment => (
          <CommentReply 
            key={comment.id} 
            comment={comment} 
            postID={post.id}
            // currentDepth={1}
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
// TODO: Обновить homepage/page.tsx, чтобы он вел на этот роут
// TODO: Обновить CommentSection, чтобы он вел на этот роут