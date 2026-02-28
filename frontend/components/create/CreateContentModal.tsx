// /frontend/components/create/CreateContentModal.tsx
"use client";

import React from 'react';
import CreatePostForm from '@/components/create/CreatePostForm';
import { CreationMode } from './CreateFanMenu';
import { LucideIcon } from 'lucide-react'

interface CreateContentModalProps {
  mode: CreationMode | null;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreateContentModal({ mode, onClose, onPostCreated }: CreateContentModalProps) {
  if (!mode) return null;

  const title = {
    video: 'Загрузить видео',
    short: 'Создать короткое видео',
    stream: 'Начать прямую трансляцию',
    post: 'Создать новый пост',
    music: 'Создать музыкальный трек',
    dm: 'Написать личное сообщение',
  }[mode] ?? 'Создать контент';

  return (
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
        
        <h2 className="text-xl font-bold mb-6 text-center text-black dark:text-white">
          {title}
        </h2>

        {mode === 'post' ? (
          <CreatePostForm
            onPostCreated={onPostCreated}
            onClose={onClose} // ✅ ИСПРАВЛЕНО: Передаем onClose
          />
        ) : (
          <p className="text-center text-black dark:text-gray-300">
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
