// /frontend/components/ShareButton.tsx
"use client";

import React, { useState } from 'react';
import { Share2, Link } from 'lucide-react'; // Предполагая, что вы используете lucide-react (или другой иконочный пакет)

interface ShareButtonProps {
  postId: number;
}

export default function ShareButton({ postId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    // В реальном приложении это будет полный URL поста
    const postUrl = `${window.location.origin}/postogram/${postId}`;
    
    // Копируем URL в буфер обмена
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Скрываем сообщение через 2 секунды
    }).catch(err => {
      console.error('Не удалось скопировать URL:', err);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="flex items-center space-x-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        title="Поделиться"
      >
        {copied ? (
          <>
            <Link size={16} />
            <span>Ссылка скопирована!</span>
          </>
        ) : (
          <>
            <Share2 size={16} />
            <span>Поделиться</span>
          </>
        )}
      </button>
    </div>
  );
}