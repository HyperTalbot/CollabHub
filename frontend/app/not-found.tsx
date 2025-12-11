// /frontend/app/not-found.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center px-4">
      
      {/* Картинка (убедитесь, что файл есть в public/images/ или замените на SVG) */}
      {/* Если картинки нет, этот блок просто не покажет её или покажет alt */}
      <div className="relative w-64 h-64 mb-8">
         {/* Вы можете положить свою картинку в /public/404.svg */}
         <Image 
           src="/kola_info.jpg" 
           alt="404 Not Found" 
           layout="fill" 
           objectFit="contain"
           className="dark:opacity-80"
         />
      </div>

      <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-2">
        Упс!
      </h1>
      
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md">
        Страница не найдена или она находится в разработке.
      </p>

      <Link 
        href="/homepage"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-all shadow-lg hover:shadow-xl"
      >
        Вернуться на главную
      </Link>
    </div>
  );
}