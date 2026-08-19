// /frontend/components/comment/CommentReply.tsx
"use client";

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Comment, { CommentType } from '@/components/comment/Comment';
import CommentReplyForm from "@/components/comment/CommentReplyForm";

// Количество прямых ответов, показываемых сразу
const INITIAL_REPLIES_SHOW = 3;
// Сколько уровней/ответов добавляет ОДНО нажатие "Открыть все ответы"
const PAGINATION_STEP = 3;
// Максимальная глубина вложенности, показываемая ИЗНАЧАЛЬНО
const MAX_INLINE_REPLY_DEPTH = 2;

interface CommentReplyProps {
  comment: CommentType;
  postID: number;
  onReplyClick: (parentId: number) => void;
  activeReplyId: number | null;
  onCancelReply: () => void;
  onSubmitReply: (content: string, parentId: number) => Promise<void>;
  // глубина передаётся явно (не зависит от мутирующего comment.depth)
  currentDepth?: number;
  // Показывать ВСЕ ответы без лимитов (страница ветки комментария)
  expandAll?: boolean;
  // общий на всю ветку счётчик нажатий "Открыть все ответы"
  threadSteps?: number;
  onThreadExpand?: () => void;
  // глубина корня ветки (для отсчёта относительной вложенности)
  rootBase?: number;
}

// Полное количество узлов в поддереве (включая сам комментарий)
const countAll = (c: CommentType): number =>
  1 + (c.replies || []).reduce((sum, r) => sum + countAll(r), 0);

// Количество видимых узлов при текущих лимитах (зеркало рендера)
const countVisible = (
  c: CommentType,
  rel: number,
  allowed: number,
  directLimit: number
): number => {
  let n = 1;
  if (rel < allowed) {
    for (const k of (c.replies || []).slice(0, directLimit)) {
      n += countVisible(k, rel + 1, allowed, INITIAL_REPLIES_SHOW);
    }
  }
  return n;
};

// РЕКУРСИВНЫЙ КОМПОНЕНТ
export default function CommentReply({
  comment,
  postID,
  onReplyClick,
  activeReplyId,
  onCancelReply,
  onSubmitReply,
  currentDepth = 1,
  expandAll = false,
  threadSteps,
  onThreadExpand,
  rootBase,
}: CommentReplyProps) {
  const router = useRouter();

  // НОВОЕ: состоянием раскрытия владеет КОРЕНЬ ветки, остальные узлы
  // получают его через пропсы. Поэтому после ПЕРВОГО нажатия
  // "Открыть все ответы" ВСЕ кнопки ветки сразу становятся
  // "Открыть ветку целиком" (второе нажатие -> страница комментария).
  const isThreadRoot = threadSteps === undefined;
  const [localSteps, setLocalSteps] = useState(0);
  const steps = isThreadRoot ? localSteps : (threadSteps as number);
  const expandThread = isThreadRoot
    ? () => setLocalSteps((s) => s + 1)
    : (onThreadExpand as () => void);

  const depth = currentDepth;
  const base = rootBase ?? depth;          // глубина корня отображаемой ветки
  const relativeDepth = depth - base;      // 0 = корень

  // Лимиты действуют только на странице поста (не на странице ветки)
  const limited = !expandAll;

  // Разрешённая относительная глубина: базовый лимит + бонус за нажатия (общий на ветку)
  const effectiveAllowed = MAX_INLINE_REPLY_DEPTH + PAGINATION_STEP * steps;
  // Лимит прямых ответов: 3 сразу, +3 после первого нажатия
  const directLimit = INITIAL_REPLIES_SHOW + PAGINATION_STEP * steps;

  const totalReplies = comment.replies?.length || 0;

  // Обрезка по ГЛУБИНЕ: мы на границе лимита и есть ещё ответы
  const depthTruncated = limited && relativeDepth >= effectiveAllowed && totalReplies > 0;
  // Обрезка по КОЛИЧЕСТВУ прямых ответов
  const sliceHidden = limited && !depthTruncated && totalReplies > directLimit;
  const showButton = limited && (depthTruncated || sliceHidden);

  const visibleReplies = limited
    ? (comment.replies || []).slice(0, directLimit)
    : (comment.replies || []);

  // Счётчик кнопки: ВСЕ последующие ответы, которые сейчас скрыты
  const hiddenCount = limited
    ? Math.max(countAll(comment) - countVisible(comment, relativeDepth, effectiveAllowed, directLimit), 0)
    : 0;

  // ПОВЕДЕНИЕ КНОПКИ:
  // 1-е нажатие (во всей ветке) — показать ещё +3;
  // любое следующее нажатие — переход на страницу ветки комментария.
  const handleExpandClick = () => {
    if (steps === 0) {
      expandThread();
    } else {
      router.push(`/postogram/${postID}/comment/${comment.id}`);
    }
  };

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

      {/* 2. Рендерим вложенные ответы (рекурсия), если не обрезаны по глубине */}
      <div className="ml-6 sm:ml-8 border-l-2 border-indigo-200/70 dark:border-indigo-900/50 pl-3 sm:pl-4">
        {!depthTruncated && visibleReplies.map(reply => (
          <CommentReply
            key={reply.id}
            comment={reply}
            postID={postID}
            onReplyClick={onReplyClick}
            activeReplyId={activeReplyId}
            onCancelReply={onCancelReply}
            onSubmitReply={onSubmitReply}
            currentDepth={depth + 1}      // НОВОЕ: явная глубина
            expandAll={expandAll}
            rootBase={base}               // корень ветки один на всех
            threadSteps={steps}           // общий счётчик нажатий ветки
            onThreadExpand={expandThread}
          />
        ))}

        {/* 3. ПАГИНАЦИЯ:
               steps === 0 -> "Открыть все ответы (N) в ветке" (+3 уровня);
               steps >= 1 -> СРАЗУ "Открыть ветку целиком" -> страница комментария. */}
        {showButton && hiddenCount > 0 && (
          <button
            type="button"
            onClick={handleExpandClick}
            className="flex items-center w-fit gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 mt-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 shadow-sm transition-colors"
          >
            <ChevronDown size={14} />
            {steps === 0
              ? `Открыть все ответы (${hiddenCount}) в ветке`
              : `Открыть ветку целиком (${hiddenCount}) — переход на страницу комментария`}
          </button>
        )}
      </div>
    </div>
  );
}






// "use client";

// import React, { useState } from 'react';
// import { ChevronDown, MessageSquare } from 'lucide-react';
// import Comment, { CommentType } from '@/components/comment/Comment';
// import CommentReplyForm from "@/components/comment/CommentReplyForm";
// import Link from "next/link";

// const MAX_DEPTH = 3;
// const INITIAL_REPLIES_SHOW = 3;
// const PAGINATION_STEP = 3;

// interface CommentReplyProps {
//   comment: CommentType;
//   postID: number;
//   onReplyClick: (parentId: number) => void;
//   activeReplyId: number | null;
//   onCancelReply: () => void;
//   onSubmitReply: (content: string, parentId: number) => Promise<void>;
// }

// export default function CommentReply({ comment, postID, onReplyClick, activeReplyId, onCancelReply, onSubmitReply }: CommentReplyProps) {
//   const [repliesToShow, setRepliesToShow] = useState(INITIAL_REPLIES_SHOW);

//   const totalReplies = comment.replies?.length || 0;
//   const isRepliesHidden = totalReplies > repliesToShow;
//   const visibleReplies = comment.replies ? comment.replies.slice(0, repliesToShow) : [];

//   const currentDepth = comment.depth || 1; 

//   if (currentDepth > MAX_DEPTH) {
//     return (
//       <div className="ml-4 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
//         <MessageSquare size={16} className="inline mr-2 text-blue-600 dark:text-blue-400" />
//         <span className="text-sm text-gray-800 dark:text-gray-200">
//           Дискуссия уходит вглубь.{' '}
//           <Link 
//             href={`/postogram/${postID}/comment/${comment.id}`} 
//             className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
//           >
//             Продолжить чтение ветки
//           </Link>
//         </span>
//       </div>
//     );
//   }

//   const isReplying = activeReplyId === comment.id;

//   return (
//     <div className="mt-4">
//       <Comment comment={comment} showReplyButton={true} onReplyClick={onReplyClick} />

//       {isReplying && (
//         <CommentReplyForm
//           parentId={comment.id}
//           onSubmit={onSubmitReply}
//           onCancel={onCancelReply}
//           autoFocus={true}
//         />
//       )}

//       <div className="ml-6 sm:ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-2">
//         {visibleReplies.map(reply => (
//           <CommentReply 
//             key={reply.id} 
//             comment={reply} 
//             postID={postID}
//             onReplyClick={onReplyClick} 
//             activeReplyId={activeReplyId}
//             onCancelReply={onCancelReply}
//             onSubmitReply={onSubmitReply}
//           />
//         ))}

//         {isRepliesHidden && (
//           <button
//             onClick={() => setRepliesToShow(prev => prev + PAGINATION_STEP)}
//             className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-3 transition-colors font-medium"
//           >
//             <ChevronDown size={16} className="mr-1" />
//             Показать ещё ({totalReplies - repliesToShow} / {totalReplies})
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }
