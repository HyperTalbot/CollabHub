// /frontend/components/CreateContentModal.tsx
"use client";

import React, { useState } from 'react';
import { Video, Camera, Mic, Edit3, Music, Send, LucideIcon } from 'lucide-react';
import CreatePostForm from '@/components/create/CreatePostForm'; // Мы переиспользуем эту форму
import { CreationMode } from './CreateFanMenu'; // Импортируем тип

interface CreateContentModalProps {
  mode: CreationMode | null;
  onClose: () => void;
  onPostCreated: () => void; // Коллбэк для обновления ленты
}

// Тип для состояния, что мы создаем
// type CreationMode = null | 'post' | 'video' | 'short' | 'stream' | 'music' | 'dm';

export default function CreateContentModal({ mode, onClose, onPostCreated }: CreateContentModalProps) {
  if (!mode) return null;

  // Определяем заголовок
  const title = {
      video: 'Загрузить видео',
      short: 'Создать короткое видео',
      stream: 'Начать прямую трансляцию',
      post: 'Создать новый пост',
      music: 'Создать музыкальный трек',
      dm: 'Написать личное сообщение',
  }[mode] || 'Создать контент'; // Запасной вариант 

  return (
// Окно (z-50, ВЫШЕ хедера и ВЫШЕ оверлея)
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4">
      <div 
        className="bg-white p-6 rounded-lg shadow-2xl max-w-lg w-full relative dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
        
        <h2 className="text-xl font-bold mb-6 text-center text-black">{title}</h2>

        {mode === 'post' ? (
          // 1. Форма создания поста
          <CreatePostForm 
            onPostCreated={() => {
              onPostCreated(); // Вызываем коллбэк
              onClose(); // Закрываем окно
            }} 
          />
        ) : (
          // 2. Заглушки для остального
          <p className="text-center text-black">
            Здесь будет форма для создания "{mode}". Этот функционал в разработке.
          </p>
        )}
      </div>
    </div>
  );
}

// Вспомогательный компонент для кружочков
function CreateButton({ icon: Icon, label, onClick }: { icon: LucideIcon, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="w-16 h-16 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
        <Icon size={28} />
      </div>
      <span className="text-sm mt-2 font-medium text-black text-center">{label}</span>
    </button>
  );
}
