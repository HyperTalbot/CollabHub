// frontend/components/video/VideoComments.tsx
"use client";

import { useState, useEffect } from 'react';
import { Send, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Comment {
  id: number;
  video_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface VideoCommentsProps {
  videoId: number;
}

const API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';

export default function VideoComments({ videoId }: VideoCommentsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; commentId: number | null }>({ 
    show: false, 
    commentId: null 
  });

  useEffect(() => {
    loadComments();
  }, [videoId]);

  const loadComments = async () => {
    try {
      const response = await fetch(`${API_URL}/videos/${videoId}/comments`);
      const data = await response.json();
      setComments(data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) throw new Error('Failed to post comment');

      setNewComment('');
      loadComments();
      toast.success('Комментарий добавлен');
    } catch (error) {
      toast.error('Не удалось добавить комментарий');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (commentId: number) => {
    setDeleteModal({ show: true, commentId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.commentId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/comments/${deleteModal.commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      loadComments();
      toast.success('Комментарий удален');
      setDeleteModal({ show: false, commentId: null });
    } catch (error) {
      toast.error('Не удалось удалить комментарий');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Комментарии ({comments.length})
      </h3>

      {/* Add Comment */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Добавьте комментарий..."
                className="w-full px-4 py-2 border-b-2 border-gray-300 dark:border-gray-600 focus:border-green-500 dark:focus:border-green-500 outline-none bg-transparent dark:text-white transition"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setNewComment('')}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newComment.trim() || loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={16} />
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <AlertCircle size={20} className="text-green-600" />
            Войдите, чтобы оставить комментарий
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Войти
          </button>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                {comment.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {comment.username}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
                {user?.id === comment.user_id && (
                  <button
                    onClick={() => handleDeleteClick(comment.id)}
                    className="mt-2 text-sm text-red-500 hover:text-red-600 flex items-center gap-1 transition"
                  >
                    <Trash2 size={14} />
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Комментариев пока нет. Будьте первым!
          </p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Удалить комментарий?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Это действие нельзя будет отменить. Комментарий будет удален навсегда.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ show: false, commentId: null })}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}