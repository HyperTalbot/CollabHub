// /frontend/utils/commentTree.ts
import { CommentType } from '@/components/comment/Comment';

// Рекурсивная функция для построения дерева комментариев.
// ИСПРАВЛЕНО: depth выставляется ДО рекурсивного вызова (pre-order),
// иначе дети всегда читали depth родителя = undefined и получали 1.
export const buildCommentTree = (
  comments: CommentType[],
  parentId: number | null = null,
  parentDepth: number = 0
): CommentType[] => {
  const tree: CommentType[] = [];
  const currentDepth = parentDepth + 1;

  comments.forEach(comment => {
    // !comment.parent_id будет true для null, undefined и 0.
    const isTopLevel = parentId === null && !comment.parent_id;
    const isReply = parentId !== null && comment.parent_id === parentId;

    if (isTopLevel || isReply) {
      // СНАЧАЛА фиксируем глубину текущего комментария...
      comment.depth = currentDepth;
      // ...и только ПОТОМ строим детей, передавая глубину вниз
      comment.replies = buildCommentTree(comments, comment.id, currentDepth);
      tree.push(comment);
    }
  });

  return tree;
};