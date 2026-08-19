import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const AccessDenied = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center px-4">
      <div className="bg-red-100 dark:bg-red-900/30 p-6 rounded-full mb-6">
        <ShieldAlert size={64} className="text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
        Доступ запрещен
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md">
        У вашего аккаунта недостаточно прав для просмотра этой страницы.
      </p>
      <Link 
        href="/homepage"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg"
      >
        Вернуться на главную
      </Link>
    </div>
  );
};