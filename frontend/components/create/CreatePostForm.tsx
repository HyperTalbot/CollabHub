// /frontend/components/CreatePostForm.tsx
"use client";

import React, { useState } from 'react';
import axios from '@/lib/axiosInstance'; // <-- Наш настроенный axios
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
// import ReactMde from "react-mde"; // 1. Импорт редактора
import { useTheme } from '@/context/ThemeContext'; // <-- 1. Импортируем тему для редактора
import "react-mde/lib/styles/css/react-mde-all.css"; // 2. Стили
// import * as Showdown from "showdown"; // 3. Конвертер
// 2. Импорт нового редактора
import MDEditor from "@uiw/react-md-editor";

// Адрес нашего Posts Service
// const POSTS_API_URL = 'http://localhost:8081/api/v1/posts/';
const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts/';

// // 4. Инициализация конвертера Markdown -> HTML (для превью)
// const converter = new Showdown.Converter({
//   tables: true,
//   simplifiedAutoLink: true,
//   strikethrough: true,
//   tasklists: true,
// });

interface CreatePostFormProps {
  onPostCreated: () => void; // Функция для обновления ленты
  onClose: () => void;
}

export default function CreatePostForm({ onPostCreated, onClose }: CreatePostFormProps) {
  const { isLoggedIn } = useAuth();
  const { theme } = useTheme(); // <-- Получаем текущую тему (light/dark)

  const [title, setTitle] = useState('');
  // const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState(''); // 5. Новое состояние
  const [content, setContent] = useState("Привет, мир!"); // 6. Markdown контент

  // 7. Состояние для вкладок "Write" | "Preview"
  const [selectedTab, setSelectedTab] = useState<"write" | "preview">("write");

  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLoggedIn) {
      // Если пользователь не вошел, показываем модальное окно
      setIsModalOpen(true);
      return;
    }

    setLoading(true);

    try {
      await axios.post(POSTS_API_URL, {
        title: title,
        content: content, // Отправляем Markdown
        image_url: imageUrl, // 8. Отправляем URL
      });
      
      onPostCreated(); // Обновляем ленту
      onClose(); // Закрываем модалку

    } catch (err: any) {
      console.error("Failed to create post:", err);
      setError(err.response?.data?.error || "Произошла ошибка при создании поста.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        {/* Поле Заголовка */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Заголовок
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-black"
            required
          />
        </div>

        {/* Поле Картинки */}
        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            URL Изображения (необязательно)
          </label>
          <input
            type="text"
            id="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-black"
            placeholder="https://example.com/image.png"
          />
        </div>

        {/* Поле Markdown (Новый редактор) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Содержание (Markdown)
          </label>
          
          {/* Атрибут data-color-mode автоматически меняет тему редактора */}
          <div data-color-mode={theme}>
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height={200} // Фиксированная высота
              preview="edit" // По умолчанию режим редактирования
            />
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </form>

      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
