// /frontend/components/AuthModal.tsx
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    // Задний фон (Overlay)
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-75 background-blur-sm flex justify-center items-center z-50"
      onClick={onClose} // Закрытие по клику на фон
    >
      {/* Само модальное окно */}
      <div 
        className="bg-white p-8 rounded-lg shadow-2xl max-w-sm w-full relative"
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике внутри
      >
        <h2 className="text-xl font-bold mb-4 text-center text-black">Необходимо авторизоваться</h2>
        <p className="text-gray-700 mb-6 text-center">
          Чтобы ставить лайки, оставлять комментарии или создавать посты, пожалуйста, войдите или зарегистрируйтесь.
        </p>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => {
              onClose();
              router.push('/login');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition duration-200"
          >
            Войти
          </button>
          <button
            onClick={() => {
              onClose();
              router.push('/register');
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded transition duration-200"
          >
            Регистрация
          </button>
        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
          aria-label="Закрыть"
        >
          &times;
        </button>
      </div>
    </div>
  );
}