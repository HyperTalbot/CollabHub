// /frontend/components/CommentReplyForm.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface CommentReplyFormProps {
  // ID родителя, на которого мы отвечаем
  parentId: number; 
  // Функция, которая будет вызвана для отправки
  onSubmit: (content: string, parentId: number) => Promise<void>; 
  // Функция для закрытия формы
  onCancel: () => void; 
  // Автофокус на поле ввода
  autoFocus?: boolean;
}

export default function CommentReplyForm({ parentId, onSubmit, onCancel, autoFocus = false }: CommentReplyFormProps) {
  const { isLoggedIn } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !isLoggedIn) return;

    setIsSubmitting(true);
    await onSubmit(content, parentId); // Вызываем функцию со страницы
    setIsSubmitting(false);
    setContent(''); // Очищаем поле
  };

  if (!isLoggedIn) {
    return <p className="text-sm text-gray-500 ml-12 my-2">Войдите, чтобы ответить.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="ml-12 my-4 pl-4 border-l-2 border-blue-200">
      <textarea
        className="w-full p-2 border rounded-md text-black focus:ring-2 focus:ring-blue-500"
        rows={2}
        placeholder="Написать ответ..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus={autoFocus}
        required
      />
      <div className="flex space-x-2 mt-2">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="px-4 py-1 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Отправка...' : 'Отправить'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1 bg-gray-200 text-black rounded-md text-sm font-medium hover:bg-gray-300"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}