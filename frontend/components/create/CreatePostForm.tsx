// /frontend/components/CreatePostForm.tsx
"use client";

import React, { useState } from 'react';
import axios from '@/lib/axiosInstance'; // <-- Наш настроенный axios
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import { title } from 'process';

// Адрес нашего Posts Service
const POSTS_API_URL = 'http://localhost:8081/api/v1/posts/';

// Пропс, чтобы главная страница могла обновить ленту
interface CreatePostFormProps {
  onPostCreated: () => void;
}

export default function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { isLoggedIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLoggedIn) {
      // Если пользователь не вошел, показываем модальное окно
      setIsModalOpen(true);
      return;
    }

    try {
      const response = await axios.post(POSTS_API_URL, {
        title: title,
        content: content,
      });

      if (response.status === 201) {
        setTitle(''); 
        setContent(''); // Очищаем поле
        onPostCreated(); // Сообщаем родительской странице, что пост создан
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось создать пост. Попробуйте снова.');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-white p-4 shadow-md rounded-lg mb-6">
        <h2 className="text-lg text-black font-semibold mb-3">Создать пост</h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        
        <input 
          type='text'
          className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-3'
          placeholder='Заголовок поста'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          rows={3}
          placeholder="Что у вас нового?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minLength={5}
          required
        />

        <div className="flex justify-end mt-3">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Опубликовать
          </button>
        </div>
      </form>

      {/* Модальное окно для неавторизованных пользователей */}
      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}