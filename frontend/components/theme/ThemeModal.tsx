// frontend/components/theme/ThemeModal.tsx
"use client";

import React from 'react';
import { X, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const themes = [
    { 
      id: 'light' as const, 
      icon: Sun, 
      label: 'Светлая', 
      description: 'Классическая светлая тема',
      gradient: 'from-yellow-400 to-orange-500'
    },
    { 
      id: 'dark' as const, 
      icon: Moon, 
      label: 'Тёмная', 
      description: 'Приятная для глаз тёмная тема',
      gradient: 'from-blue-900 to-purple-900'
    },
    { 
      id: 'system' as const, 
      icon: Monitor, 
      label: 'Системная', 
      description: 'Следовать настройкам системы',
      gradient: 'from-gray-600 to-gray-800'
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Выбор темы
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Theme Options */}
        <div className="space-y-3">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isActive = theme === themeOption.id;

            return (
              <button
                key={themeOption.id}
                onClick={() => {
                  setTheme(themeOption.id);
                  setTimeout(() => onClose(), 300); // Закрываем с задержкой для визуального эффекта
                }}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  isActive
                    ? 'bg-gradient-to-r ' + themeOption.gradient + ' text-white shadow-lg scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                }`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-white/20' : 'bg-white/50 dark:bg-gray-600'
                }`}>
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`} />
                </div>

                {/* Text */}
                <div className="flex-1 text-left">
                  <p className={`font-semibold ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {themeOption.label}
                  </p>
                  <p className={`text-sm ${isActive ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                    {themeOption.description}
                  </p>
                </div>

                {/* Checkmark */}
                {isActive && (
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Предпросмотр:
          </p>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
            <p className="text-gray-900 dark:text-white font-medium">
              Пример текста
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Так будет выглядеть контент в выбранной теме
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
