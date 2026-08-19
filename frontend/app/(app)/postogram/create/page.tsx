// /frontend/app/(app)/postogram/create/page.tsx
"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from '@/lib/axiosInstance';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // для таблиц и зачеркиваний, как в Obsidian
import { Image as ImageIcon, Layout, Columns } from 'lucide-react';
import { uploadFile } from '@/services/uploadService';
import toast from 'react-hot-toast';

export default function CreatePostPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'reddit' | 'article'>('reddit');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isLoggedIn) {
    return <div className="p-10 text-center dark:text-white">Пожалуйста, авторизуйтесь для создания поста.</div>;
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      toast.loading("Загрузка изображений...", { id: "uploading" });
      
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i], 'image');
        
        if (mode === 'article') {
          // В режиме статьи вставляем картинку прямо в Markdown код (Хабр стайл)
          setContent(prev => `${prev}\n![ОПИСАНИЕ](${url})\n`);
        } else {
          // В режиме Reddit добавляем в массив для карусели
          setCarouselImages(prev => [...prev, url]);
        }
      }
      toast.success("Загружено!", { id: "uploading" });
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при загрузке", { id: "uploading" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error("Заголовок и контент обязательны");
      return;
    }

    setIsSubmitting(true);
    try {
      // Так как в БД image_url это varchar(255), мы можем сохранить туда только одну ссылку.
      // Если это режим "Reddit" и картинок несколько, мы элегантно добавим их в конец Markdown контента.
      let finalContent = content;
      let coverImage = '';

      if (mode === 'reddit' && carouselImages.length > 0) {
        coverImage = carouselImages[0]; // Первая картинка идет в обложку
        const carouselMd = carouselImages.map(img => `![carousel_image](${img})`).join('\n');
        finalContent = `${content}\n\n---\n*Медиа:* \n${carouselMd}`;
      } else if (mode === 'article') {
        // Пытаемся найти первую картинку в статье для обложки
        const imgMatch = content.match(/!\[.*?\]\((.*?)\)/);
        if (imgMatch) coverImage = imgMatch[1];
      }

      const response = await axios.post('https://collabhub.cloudpub.ru/api/v1/posts/', {
        title,
        content: finalContent,
        image_url: coverImage,
      });

      toast.success("Пост успешно создан!");
      router.push(`/postogram/${response.data.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Ошибка при создании поста");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 mt-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Создать новый пост</h1>

      {/* Переключатель режимов */}
      <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-fit mb-6">
        <button
          type="button"
          onClick={() => setMode('reddit')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'reddit' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Columns size={16} className="mr-2" /> Режим "Reddit" (Карусель)
        </button>
        <button
          type="button"
          onClick={() => setMode('article')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'article' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layout size={16} className="mr-2" /> Режим "Статья" (Хабр)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <input
            type="text"
            placeholder="Заголовок"
            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Редактор */}
          <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="bg-gray-100 dark:bg-gray-800 p-2 flex border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center text-sm bg-white dark:bg-gray-700 px-3 py-1.5 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <ImageIcon size={16} className="mr-2" /> Прикрепить медиа
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                multiple
                accept="image/*"
                className="hidden"
              />
            </div>
            
            <textarea
              placeholder="Текст поста (поддерживается Markdown как в Obsidian...)"
              className="w-full p-4 h-[400px] bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none resize-none font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Предпросмотр Markdown */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 h-[400px] overflow-y-auto">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-2">Предпросмотр</div>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-img:rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*Здесь будет ваш текст...*'}
              </ReactMarkdown>
            </div>
            
            {/* Превью карусели для режима Reddit */}
            {mode === 'reddit' && carouselImages.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Медиа (Карусель)</div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {carouselImages.map((img, idx) => (
                    <img key={idx} src={img} alt="preview" className="h-32 w-auto object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </form>
    </div>
  );
}
