// /frontend/components/user/UserActionsDropdown.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, MessageCircle, Video, Play, Music, Mic, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axiosInstance';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

interface UserActionsDropdownProps {
  targetUserId: number; // ID пользователя, для которого действия
  currentUserId?: number; // Мой ID (для сравнения)
  username?: string; // Имя пользователя для отображения
}

export default function UserActionsDropdown({ targetUserId, currentUserId, username }: UserActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStartChat = async () => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    if (!token) {
        toast.error("Ошибка: Требуется авторизация для начала чата.");
        return;
    }
    try {
      await axios.post('http://localhost:8082/api/v1/conversations', 
        { target_user_id: targetUserId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      router.push('/misable');
      toast.success(`Чат с ${username || 'пользователем'} успешно открыт!`);
    } catch (err: any) {
      console.error("Failed to start chat:", err);
      toast.error(err.response?.data?.error || "Не удалось начать чат.");
    } finally {
      setIsOpen(false); // Закрываем дропдаун после действия
    }
  };

  const handleReport = () => {
    toast(`Сообщение о пользователе ${username || targetUserId} отправлено.`, { icon: '⚠️'});
    setIsOpen(false);
  };

  // Не показываем дропдаун, если это мой профиль
  if (currentUserId === targetUserId) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Действия пользователя"
      >
        <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10 py-1">
          <button 
            onClick={handleStartChat} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <MessageCircle size={18} className="mr-2 text-blue-500" /> Написать личное сообщение
          </button>
          <button 
            onClick={() => { toast("Функция записи видео еще не реализована.", { icon: '🎥'}); setIsOpen(false); }} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <Video size={18} className="mr-2 text-green-500" /> Записать совместное видео
          </button>
           <button 
            onClick={() => { toast("Функция трансляции еще не реализована.", { icon: '📡'}); setIsOpen(false); }} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <Play size={18} className="mr-2 text-red-500" /> Начать трансляцию
            </button>
           <button 
            onClick={() => { toast("Функция создания короткого видео еще не реализована.", { icon: '📱'}); setIsOpen(false); }} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <Mic size={18} className="mr-2 text-yellow-500" /> Короткое видео
          </button>
           <button 
            onClick={() => { toast("Функция просмотра постов еще не реализована.", { icon: '🖼️'}); setIsOpen(false); }} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <Play size={18} className="mr-2 text-purple-500" /> Посмотреть посты
          </button>
           <button 
            onClick={() => { toast("Функция прослушивания треков еще не реализована.", { icon: '🎵'}); setIsOpen(false); }} 
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <Music size={18} className="mr-2 text-indigo-500" /> Прослушать треки
          </button>
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
          <button 
            onClick={handleReport} 
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-600"
          >
            <AlertTriangle size={18} className="mr-2" /> Пожаловаться
          </button>
        </div>
      )}
    </div>
  );
}