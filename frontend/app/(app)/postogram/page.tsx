// // /frontend/app/(app)/postogram/page.tsx
// "use client";

// import React, { useState, useEffect } from 'react';
// import axios from '@/lib/axiosInstance';
// import { useAuth } from '@/context/AuthContext';
// import LikeButton from '@/components/shared/LikeButton';
// import ShareButton from '@/components/shared/ShareButton';
// import CommentSection from '@/components/comment/CommentSection';
// import { MessageCircle, Eye } from 'lucide-react';
// import { useRouter } from 'next/navigation';
// import UserActionsDropdown from '@/components/user/UserActionDropdown';

// // const POSTS_API_URL = 'http://localhost:8084/api/v1/posts/';
// const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts/';

// // Тип для данных Поста (должен совпадать с Go-моделью)
// interface Post {
//   id: number;
//   user_id: number;
//   user_username: string;
//   title: string;
//   content: string;
//   author_avatar_url: string;
//   created_at: string;
//   likes_count: number;
//   is_liked_by_me: boolean;
//   comments_count: number;
// }

// const fetchPosts = async () => {
//   try {
//     // Включаем токен, если пользователь залогинен (это обрабатывается в axiosInstance)
//     const response = await axios.get(POSTS_API_URL);
//     return response.data || [];
//   } catch (error) {
//     console.error("Failed to fetch posts:", error);
//     return [];
//   }
// };

// export default function Postogram() {
//   const { user, isLoggedIn } = useAuth();
//   const [posts, setPosts] = useState<Post[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

//   const loadPosts = async () => {
//     setLoading(true);
//     const fetchedPosts = await fetchPosts();
//     setPosts(fetchedPosts);
//     setLoading(false);
//   };
  
//   // Использование loadPosts в качестве колбэка
//   const handlePostCreated = () => {
//     loadPosts(); 
//   };

//   useEffect(() => {
//     loadPosts();
//   }, [isLoggedIn]); // Обновляем ленту при изменении статуса авторизации

//   const toggleComments = (postId: number) => {
//     if (expandedPostId === postId) {
//       setExpandedPostId(null);
//     } else {
//       setExpandedPostId(postId);
//     }
//   };

//   const router = useRouter();

//   const navigateToPost = (postId: number) => {
//     router.push(`/postogram/${postId}/`);
//   };

//   return (
//     <div className="">
//       <main className="w-1/2 mx-auto">
//         <h1 className="text-3xl text-black font-bold mb-4">
//           Добро пожаловать в Postogram, {user?.username || 'Гость'}!
//         </h1>
        
//         {/* <CreatePostForm onPostCreated={handlePostCreated} /> */}

//         {loading ? (
//           <p>Загрузка постов...</p>
//         ) : (
//           <div className="space-y-4">
//             {posts.length === 0 ? (
//               <p className="text-lg text-black">Постов пока нет. Будьте первым!</p>
//             ) : (
//               posts.map((post) => (
//                 <div key={post.id} className="bg-white p-4 shadow-lg rounded-xl dark:bg-gray-500">
//                   {/* Заголовок поста */}
//                   <div className="w-fit flex items-center space-x-3 mb-3 border border-gray-200 rounded-lg p-2 shadow-sm">
//                     {/* Аватар (Заглушка) */}
//                     <div className="flex items-center gap-3 mb-3">
//                       <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
//                           {post.author_avatar_url ? ( // Убедитесь, что бэк возвращает это поле!
//                               <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
//                           ) : (
//                               <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold">
//                                   {post.user_username?.[0]?.toUpperCase()}
//                               </div>
//                           )}
//                       </div>
//                     </div>
//                     {/* Инфо о пользователе */}
//                     <div className="flex-1">
//                       <p className="font-bold text-black">{post.user_username ? post.user_username : `User ${post.user_id}`} • 🟦🔶🟢</p>
//                       <p className="text-xs text-gray-500">
//                         {new Date(post.created_at).toLocaleDateString('ru-RU')}
//                       </p>
//                       {isLoggedIn && user && post.user_id !== user.id && (
//                         <UserActionsDropdown
//                           targetUserId={post.user_id}
//                           username={post.user_username}
//                         />
//                       )}
//                     </div>
//                   </div>
                  
//                   {/* Контент поста */}
//                   <h2 className='text-2xl font-bold text-black flex items-center justify-center my-3'>{post.title}</h2>
//                   <p className="text-lg text-black">{post.content}</p>
                  
//                   {/* --- ПАНЕЛЬ ДЕЙСТВИЙ (Футер) --- */}
//                   <div className="flex justify-between items-center justify-center mt-4 pt-3 border-t">
//                     <div className="flex space-x-6"> 

//                       {/* ПРОСМОТРЫ */}
//                       <Eye size={20}/><p>0</p>
                      
//                       {/* КНОПКА ЛАЙКА */}
//                       <LikeButton 
//                         id={post.id}
//                         type='post'
//                         initialIsLiked={post.is_liked_by_me}
//                         initialLikesCount={post.likes_count}
//                       />
                      
//                       {/* КНОПКА КОММЕНТАРИЕВ */}
//                       <button 
//                         onClick={() => navigateToPost(post.id)}
//                         className="flex items-center space-x-1 text-sm text-gray-900 hover:text-green-500 transition-colors"
//                         title="Комментарии"
//                       >
//                         <MessageCircle size={16} />
//                         <span>Комментариев {post.comments_count}</span>
//                       </button>
                      
//                       {/* КНОПКА ПОДЕЛИТЬСЯ */}
//                       <ShareButton postId={post.id} />
//                     </div>
//                   </div>

//                   {/* --- СЕКЦИЯ КОММЕНТАРИЕВ --- */}
//                   {expandedPostId === post.id && (
//                     <CommentSection postId={post.id} />
//                   )}
//                 </div>
//               ))
//             )}
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }


// frontend/app/(app)/postogram/page.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRecommendedPosts } from '@/hooks/useRecommendedPosts';
import { useViewTracking } from '@/hooks/useViewTracking';
import LikeButton from '@/components/shared/LikeButton';
import ShareButton from '@/components/shared/ShareButton';
import { MessageCircle, Eye, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserActionsDropdown from '@/components/user/UserActionDropdown';

interface Post {
  id: number;
  user_id: number;
  user_username: string;
  title: string;
  content: string;
  author_avatar_url: string;
  created_at: string;
  likes_count: number;
  is_liked_by_me: boolean;
  comments_count: number;
}

function PostCard({ post }: { post: Post }) {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();
  const { trackLike, trackComment, trackShare } = useViewTracking({
    contentType: 'post',
    contentId: post.id,
  });

  const navigateToPost = () => {
    trackComment();
    router.push(`/postogram/${post.id}/`);
  };

  const handleLikeSuccess = () => {
    trackLike();
  };

  const handleShare = () => {
    trackShare();
  };

  return (
    <div 
      id={`post-${post.id}`}
      className="bg-white p-4 shadow-lg rounded-xl dark:bg-gray-500"
    >
      <div className="w-fit flex items-center space-x-3 mb-3 border border-gray-200 rounded-lg p-2 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
            {post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold">
                {post.user_username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <p className="font-bold text-black">
            {post.user_username || `User ${post.user_id}`} • 🟦🔶🟢
          </p>
          <p className="text-xs text-gray-500">
            {new Date(post.created_at).toLocaleDateString('ru-RU')}
          </p>
          {isLoggedIn && user && post.user_id !== user.id && (
            <UserActionsDropdown
              targetUserId={post.user_id}
              username={post.user_username}
            />
          )}
        </div>
      </div>

      <h2 className='text-2xl font-bold text-black flex items-center justify-center my-3'>
        {post.title}
      </h2>
      <p className="text-lg text-black">{post.content}</p>

      <div className="flex justify-between items-center mt-4 pt-3 border-t">
        <div className="flex space-x-6">
          <div className="flex items-center space-x-1">
            <Eye size={20}/>
            <p>0</p>
          </div>

          <LikeButton
            id={post.id}
            type='post'
            initialIsLiked={post.is_liked_by_me}
            initialLikesCount={post.likes_count}
            onLikeSuccess={handleLikeSuccess}
          />

          <button
            onClick={navigateToPost}
            className="flex items-center space-x-1 text-sm text-gray-900 hover:text-green-500 transition-colors"
            title="Комментарии"
          >
            <MessageCircle size={16} />
            <span>Комментариев {post.comments_count}</span>
          </button>

          <div onClick={handleShare}>
            <ShareButton postId={post.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Postogram() {
  const { user, isLoggedIn } = useAuth();
  const { posts, loading, isRecommended } = useRecommendedPosts(20);

  return (
    <div className="">
      <main className="w-1/2 mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-3xl text-black font-bold">
            {isLoggedIn ? `Для вас, ${user?.username}!` : 'Популярное'}
          </h1>
          {isRecommended && (
            <Sparkles className="text-purple-500" size={24} />
          )}
        </div>

        {loading ? (
          <p>Загрузка постов...</p>
        ) : (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-lg text-black">Постов пока нет. Будьте первым!</p>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}