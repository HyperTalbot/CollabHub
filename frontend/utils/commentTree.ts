// /frontend/utils/commentTree.ts
import { CommentType } from '@/components/comment/Comment';

// Рекурсивная функция для построения дерева комментариев
export const buildCommentTree = (comments: CommentType[], parentId: number | null = null): CommentType[] => {
  const tree: CommentType[] = [];

  comments.forEach(comment => {
    
    // ИСПРАВЛЕНИЕ:
    // !comment.parent_id будет true для null, undefined и 0.
    const isTopLevel = parentId === null && !comment.parent_id; 

    // Проверка для ответов (остается без изменений)
    const isReply = parentId !== null && comment.parent_id === parentId;
    
    if (isTopLevel || isReply) {
      // Находим все ответы на текущий комментарий
      const replies = buildCommentTree(comments, comment.id);
      
      const parentDepth = parentId ? (comments.find(c => c.id === parentId)?.depth || 0) : 0;
      const currentDepth = parentDepth + 1;
      
      comment.depth = currentDepth;
      comment.replies = replies; 
      tree.push(comment);
    }
  });

  return tree;
};