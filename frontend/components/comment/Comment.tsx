// frontend/components/comment/Comment.tsx
"use client";

import React from 'react';
import LikeButton from '@/components/shared/LikeButton';
import ShareButton from '../shared/ShareButton';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UserActionsDropdown from '@/components/user/UserActionDropdown';
import { getMediaURL } from '@/lib/mediaUtils';

// Если роут профиля другой — поменяй только здесь
const PROFILE_URL = (id: number) => `/profile/${id}`;

export interface CommentType {
  id: number;
  post_id: number;
  user_id: number;
  user_username: string;
  user_avatar_url?: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked_by_me: boolean;
  parent_id: number | null;
  replies?: CommentType[];
  depth?: number;
}

interface CommentProps {
  comment: CommentType;
  showReplyButton: boolean;
  onReplyClick: (parentId: number) => void;
}

export default function Comment({ comment, showReplyButton, onReplyClick }: CommentProps) {
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();

  // п.2: клик по плашке пользователя -> профиль (работает и на странице ветки)
  const handleUserBlockClick = () => {
    router.push(PROFILE_URL(comment.user_id));
  };

  return (
    <div className="bg-slate-50/90 dark:bg-gray-800/60 border border-slate-200/80 dark:border-gray-700/60 p-4 shadow-md shadow-slate-200/60 dark:shadow-black/20 rounded-2xl">
      {/* Плашка пользователя: rounded-full + переход в профиль */}
      <div
        data-user-block
        onClick={handleUserBlockClick}
        title={`Профиль: ${comment.user_username}`}
        className="w-fit max-w-full flex items-center gap-2.5 border border-indigo-100/80 dark:border-gray-600/60 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/20 rounded-full pl-1 pr-2 py-1 shadow-sm hover:ring-2 hover:ring-indigo-200/60 dark:hover:ring-indigo-800/50 transition-all cursor-pointer"
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-indigo-100 dark:bg-gray-700 ring-2 ring-emerald-200/60 dark:ring-emerald-900/50">
          {comment.user_avatar_url ? (
            <img src={getMediaURL(comment.user_avatar_url)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 font-bold text-white text-sm">
              {comment.user_username?.[0]?.toUpperCase() || comment.user_id}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
            {comment.user_username || `User ${comment.user_id}`} • 🟦🔶🟢
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(comment.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {isLoggedIn && user && Number(comment.user_id) !== Number(user.id) && (
          <div className="self-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <UserActionsDropdown targetUserId={comment.user_id} currentUserId={user.id} username={comment.user_username} />
          </div>
        )}
      </div>

      <p className="text-md text-gray-800 dark:text-gray-200 p-1 mt-2 whitespace-pre-wrap break-words">{comment.content}</p>

      <div className="flex items-center justify-center space-x-6 mt-2">
        <LikeButton id={comment.id} type="comment" initialIsLiked={comment.is_liked_by_me} initialLikesCount={comment.likes_count} />
        {showReplyButton && (
          <button onClick={() => onReplyClick(comment.id)}
            className="flex items-center text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">
            <div className="relative w-[18px] h-[18px] mr-1">
              <Image src="/icons/reply.svg" alt="Ответить" layout="fill" objectFit="contain" />
            </div>
            Ответить
          </button>
        )}
        <ShareButton postId={comment.post_id} />
      </div>
    </div>
  );
}





// "use client";

// import React from 'react';
// import LikeButton from '@/components/shared/LikeButton';
// import ShareButton from '../shared/ShareButton';
// import Image from "next/image";
// import { MoreVertical } from 'lucide-react'; // Иконка вертикальных точек
// import { getMediaURL } from '@/lib/mediaUtils';
// import UserActionsDropdown from '../user/UserActionDropdown';
// import { useAuth } from '@/context/AuthContext';

// export interface CommentType {
//   id: number;
//   post_id: number;
//   user_id: number;
//   user_username: string;
//   author_avatar_url?: string; // Добавлено поле аватара
//   content: string;
//   created_at: string;
//   likes_count: number;
//   is_liked_by_me: boolean;
//   parent_id: number | null;
//   replies?: CommentType[];
//   depth?: number;
// }

// interface CommentProps {
//   comment: CommentType;
//   showReplyButton: boolean;
//   onReplyClick: (parentId: number) => void;
// }

// export default function Comment({ comment, showReplyButton, onReplyClick }: CommentProps) {
//   const { user, isLoggedIn } = useAuth();

//   return (
//     <div className="bg-white dark:bg-[#616060] border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow rounded-xl">
      
//       {/* Полностью округленный прямоугольник + вертикальные точки внутри */}
//       <div className="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1.5 shadow-sm bg-gray-50 dark:bg-gray-700 w-fit mb-3">
//         <div className="flex items-center space-x-3">
//           <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200">
//              {comment.author_avatar_url ? (
//                 <img src={getMediaURL(comment.author_avatar_url)} alt="avatar" className="w-full h-full object-cover" />
//              ) : (
//                 <div className="w-full h-full flex items-center justify-center bg-green-500 font-bold text-white text-sm">
//                   {comment.user_username?.[0]?.toUpperCase() ?? 'U'}
//                 </div>
//              )}
//           </div>
          
//           <div className="pr-2">
//             <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
//               {comment.user_username || `User ${comment.user_id}`} • 🟦🔶🟢
//             </p>
//             <p className="text-[11px] text-gray-500 dark:text-gray-400">
//               {new Date(comment.created_at).toLocaleString('ru-RU', {
//                 day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
//               })}
//             </p>
//           </div>
//         </div>

//         {/* Кнопка "more" выровненная справа внутри прямоугольника */}
//         {isLoggedIn && user && comment.post_id !== user.id && (
//           <UserActionsDropdown
//             targetUserId={comment.post_id}
//             username={comment.user_username}
//           />
//         )}
//       </div>

//       <p className="text-sm text-gray-800 dark:text-gray-200 p-1 mb-1 whitespace-pre-wrap">{comment.content}</p>

//       <div className="flex items-center justify-center space-x-6 mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
//         <LikeButton
//           id={comment.id}
//           type="comment"
//           initialIsLiked={comment.is_liked_by_me}
//           initialLikesCount={comment.likes_count}
//         />
        
//         {showReplyButton && (
//             <button 
//                 onClick={() => onReplyClick(comment.id)} 
//                 className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
//             >
//               <div className="relative w-4 h-4 mr-1.5"> 
//                  <Image src="/icons/reply.svg" alt="Ответить" layout="fill" objectFit="contain" /> 
//               </div> 
//               Ответить
//             </button>
//         )}

//         <ShareButton postId={comment.post_id} />
//       </div>
//     </div>
//   );
// }
