// frontend/components/music/MusicCreationTypeModal.tsx
"use client";

import { Music, ListMusic } from 'lucide-react';

interface MusicCreationTypeModalProps {
  isOpen: boolean;
  onSelectType: (type: 'track' | 'playlist') => void;
  onClose: () => void;
}

export default function MusicCreationTypeModal({ 
  isOpen, 
  onSelectType, 
  onClose 
}: MusicCreationTypeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          Что хотите создать?
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Создать трек */}
          <button
            onClick={() => onSelectType('track')}
            className="flex flex-col items-center gap-4 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition">
              <Music size={32} className="text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Трек
            </span>
          </button>

          {/* Создать плейлист */}
          <button
            onClick={() => onSelectType('playlist')}
            className="flex flex-col items-center gap-4 p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center group-hover:scale-110 transition">
              <ListMusic size={32} className="text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Плейлист
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}