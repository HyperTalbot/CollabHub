// /frontend/components/shared/ShareButton.tsx
"use client";

import React, { useState } from 'react';
import Image from 'next/image';

interface ShareButtonProps {
  postId: number; // ID поста, которым делимся
}

export default function ShareButton({ postId }: ShareButtonProps) {
  // Состояние для отображения "Скопировано!"
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    // 1. Формируем URL
    // window.location.origin дает "http://localhost:3000"
    const postUrl = `${window.location.origin}/postogram/${postId}`;

    // 2. Используем 'navigator.clipboard' (работает на HTTPS и localhost)
    navigator.clipboard.writeText(postUrl)
      .then(() => {
        // 3. Показываем уведомление
        setCopied(true);
        // 4. Сбрасываем уведомление через 2 секунды
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
        alert('Не удалось скопировать ссылку.');
      });
  };

  return (
    <button 
      onClick={handleShare}
      className="flex items-center text-sm text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
    >
      <div className="relative" style={{ width: 18, height: 18 }}>
        <Image 
            src="/icons/share.svg" // <-- Убедитесь, что эта иконка у вас есть
            alt="Поделиться" 
            layout="fill" 
            objectFit="contain"
        />
      </div>
      
      {/* 5. Меняем текст кнопки в зависимости от состояния 'copied' */}
      <span className="ml-1.5">
        {copied ? 'Скопировано!' : 'Поделиться'}
      </span>
    </button>
  );
}