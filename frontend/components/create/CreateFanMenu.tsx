// /frontend/components/CreateFanMenu.tsx
"use client";

import React from 'react';
import { Video, Camera, Mic, Edit3, Music, Send, LucideIcon } from 'lucide-react';

export type CreationMode = 'post' | 'video' | 'short' | 'stream' | 'music' | 'dm';

interface CreateFanMenuProps {
  isOpen: boolean;
  onSelect: (mode: CreationMode) => void;
}

// Координаты кнопок остаются для радиуса 140px (дуга 160°)
const buttons = [
  { 
    mode: 'video', 
    icon: Video, 
    label: 'Видео', 
    transform: 'translate-x-[-138px] translate-y-[24px]' 
  },
  { 
    mode: 'short', 
    icon: Camera, 
    label: 'Клип', 
    transform: 'translate-x-[-102px] translate-y-[100px]' 
  },
  { 
    mode: 'stream', 
    icon: Mic, 
    label: 'Стрим', 
    transform: 'translate-x-[-42px] translate-y-[136px]' 
  },
  { 
    mode: 'post', 
    icon: Edit3, 
    label: 'Пост', 
    transform: 'translate-x-[42px] translate-y-[136px]' 
  },
  { 
    mode: 'music', 
    icon: Music, 
    label: 'Музыка', 
    transform: 'translate-x-[102px] translate-y-[100px]' 
  },
  { 
    mode: 'dm', 
    icon: Send, 
    label: 'Письмо', 
    transform: 'translate-x-[138px] translate-y-[24px]' 
  },
];

export default function CreateFanMenu({ isOpen, onSelect }: CreateFanMenuProps) {
  return (
    // Отступ mt-3
    <div 
      className="absolute top-full left-1/2 mt-3 w-0 flex justify-center" 
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }} 
    >
      {/* 1. БЕЛЫЙ ФОН-АРКА */}
      <div 
        className={`absolute bg-white transition-all duration-300 ease-out dark:bg-gray-800
          ${isOpen 
            ? 'opacity-100 transform scale-100' 
            : 'opacity-0 transform scale-50'
          }`
        }
        style={{
          width: '360px', 
          // Высота делает ее более пологой
          height: '225px', 
          left: '-180px', 
          top: '0', 
          
          // ИЗМЕНЕНИЕ: Увеличен border-radius, чтобы соответствовать новой форме
          borderBottomLeftRadius: '200px', // Больше, чем половина ширины
          borderBottomRightRadius: '200px', // Больше, чем половина ширины
          borderTopLeftRadius: '40px',
          borderTopRightRadius: '40px',
          
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Заливка верхней части, чтобы обрезать прямой верхний край */}
        {/* ИЗМЕНЕНИЕ: Скорректирована высота, чтобы скрыть верхний край новой пологой арки */}
        {/* <div className="absolute inset-x-0 top-0 bg-white dark:bg-gray-800" style={{ height: '50px' }} /> */}
      </div>

      {/* 2. КНОПКИ (НАД ФОНОМ) */}
      {buttons.map((btn) => (
        <CreateButton
          key={btn.mode}
          icon={btn.icon}
          label={btn.label}
          isOpen={isOpen}
          transform={btn.transform}
          onClick={() => onSelect(btn.mode as CreationMode)}
        />
      ))}
    </div>
  );
}

// Вспомогательный компонент для "пальца" (без изменений)
function CreateButton({ icon: Icon, label, isOpen, transform, onClick }: {
  icon: LucideIcon;
  label: string;
  isOpen: boolean;
  transform: string;
  onClick: () => void;
}) {
  return (
    <div
      className={`absolute transition-all duration-300 ease-out ${
        isOpen 
          ? `opacity-100 ${transform}`
          : 'opacity-0 transform translate-y-0'
      }`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center cursor-pointer group">
        <div className="w-12 h-12 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110">
          <Icon size={24} />
        </div>
        <span className="mt-2 text-xs font-medium text-black bg-white/70 px-1 rounded">
          {label}
        </span>
      </div>
    </div>
  );
}