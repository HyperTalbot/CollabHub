'use client';

import { useState } from 'react';

interface Video {
  id: number;
  author: string;
  description: string;
  likes: string;
  comments: string;
  shares: string;
  color: string;
}

const videos: Video[][] = [
  [
    { id: 1, author: '@dancer_pro', description: 'Новый танец под хит сезона! 💃', likes: '125K', comments: '2.1K', shares: '8.5K', color: 'from-pink-500 to-rose-500' },
    { id: 2, author: '@comedy_king', description: 'Когда забыл сделать домашку 😅', likes: '89K', comments: '1.5K', shares: '4.2K', color: 'from-blue-500 to-cyan-500' },
    { id: 3, author: '@food_lover', description: 'Идеальный рецепт пасты 🍝', likes: '156K', comments: '3.2K', shares: '12K', color: 'from-orange-500 to-yellow-500' },
  ],
  [
    { id: 4, author: '@travel_addict', description: 'Невероятный закат на Бали 🌅', likes: '234K', comments: '4.5K', shares: '18K', color: 'from-purple-500 to-pink-500' },
    { id: 5, author: '@fitness_guru', description: 'Тренировка для пресса 💪', likes: '178K', comments: '2.8K', shares: '9.5K', color: 'from-green-500 to-emerald-500' },
    { id: 6, author: '@magic_tricks', description: 'Как я это сделал? 🎩✨', likes: '312K', comments: '5.6K', shares: '22K', color: 'from-indigo-500 to-purple-500' },
  ],
  [
    { id: 7, author: '@pet_lover', description: 'Мой котик такой милый! 😻', likes: '445K', comments: '8.9K', shares: '35K', color: 'from-yellow-500 to-orange-500' },
    { id: 8, author: '@car_enthusiast', description: 'Новая тачка в коллекции 🚗', likes: '267K', comments: '4.2K', shares: '15K', color: 'from-red-500 to-pink-500' },
    { id: 9, author: '@tech_reviewer', description: 'Обзор нового гаджета 📱', likes: '198K', comments: '3.4K', shares: '11K', color: 'from-cyan-500 to-blue-500' },
  ],
];

export default function FlipPage() {
  const [currentRow, setCurrentRow] = useState(1);
  const [currentCol, setCurrentCol] = useState(0);

  const handleSwipe = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'up' && currentCol > 0) {
      setCurrentCol(currentCol - 1);
    } else if (direction === 'down' && currentCol < videos[currentRow].length - 1) {
      setCurrentCol(currentCol + 1);
    } else if (direction === 'left' && currentRow > 0) {
      setCurrentRow(currentRow - 1);
      setCurrentCol(0);
    } else if (direction === 'right' && currentRow < videos.length - 1) {
      setCurrentRow(currentRow + 1);
      setCurrentCol(0);
    }
  };

  const currentVideo = videos[currentRow][currentCol];

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* Video Container */}
      <div className={`h-full w-full bg-gradient-to-br ${currentVideo.color} flex items-center justify-center text-white text-9xl relative`}>
        ▶️
        
        {/* Top gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 to-transparent z-10"></div>
        
        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/70 to-transparent z-10"></div>

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 z-20">
          <div className="text-2xl font-bold">Flip</div>
          <button className="text-2xl">🔍</button>
        </div>

        {/* Navigation Hints */}
        <div className="absolute top-1/2 left-8 transform -translate-y-1/2 z-20">
          <button 
            onClick={() => handleSwipe('left')}
            className={`text-4xl ${currentRow > 0 ? 'opacity-100' : 'opacity-30'}`}
            disabled={currentRow === 0}
          >
            ⬅️
          </button>
        </div>
        
        <div className="absolute top-1/2 right-8 transform -translate-y-1/2 z-20">
        
        <button 
            onClick={() => handleSwipe('right')}
            className={`text-4xl ${currentRow < videos.length - 1 ? 'opacity-100' : 'opacity-30'}`}
            disabled={currentRow === videos.length - 1}
          >
            ➡️
          </button>
        </div>

        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-20">
          <button 
            onClick={() => handleSwipe('up')}
            className={`text-4xl ${currentCol > 0 ? 'opacity-100' : 'opacity-30'}`}
            disabled={currentCol === 0}
          >
            ⬆️
          </button>
        </div>

        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
          <button 
            onClick={() => handleSwipe('down')}
            className={`text-4xl ${currentCol < videos[currentRow].length - 1 ? 'opacity-100' : 'opacity-30'}`}
            disabled={currentCol === videos[currentRow].length - 1}
          >
            ⬇️
          </button>
        </div>

        {/* Video Info - Left Side */}
        <div className="absolute bottom-24 left-6 z-20 max-w-md">
          <h2 className="text-xl font-bold mb-2">{currentVideo.author}</h2>
          <p className="text-base">{currentVideo.description}</p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span>🎵 Original Audio</span>
          </div>
        </div>

        {/* Action Buttons - Right Side */}
        <div className="absolute bottom-24 right-6 flex flex-col items-center gap-6 z-20">
          <div className="flex flex-col items-center">
            <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-3xl hover:bg-white/30 transition">
              ❤️
            </button>
            <span className="text-sm mt-1">{currentVideo.likes}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-3xl hover:bg-white/30 transition">
              💬
            </button>
            <span className="text-sm mt-1">{currentVideo.comments}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-3xl hover:bg-white/30 transition">
              ↗️
            </button>
            <span className="text-sm mt-1">{currentVideo.shares}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <button className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-3xl hover:bg-white/30 transition">
              ⋮
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
          {videos[currentRow].map((_, index) => (
            <div 
              key={index}
              className={`h-1 w-8 rounded-full ${index === currentCol ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-md border-t border-white/10 z-30">
        <div className="flex items-center justify-around py-3">
          <button className="flex flex-col items-center text-white">
            <span className="text-2xl">🏠</span>
            <span className="text-xs mt-1">Главная</span>
          </button>
          <button className="flex flex-col items-center text-white/50">
            <span className="text-2xl">🔍</span>
            <span className="text-xs mt-1">Поиск</span>
          </button>
          <button className="flex flex-col items-center text-white/50">
          <span className="text-2xl">➕</span>
            <span className="text-xs mt-1">Создать</span>
          </button>
          <button className="flex flex-col items-center text-white/50">
            <span className="text-2xl">💬</span>
            <span className="text-xs mt-1">Сообщения</span>
          </button>
          <button className="flex flex-col items-center text-white/50">
            <span className="text-2xl">👤</span>
            <span className="text-xs mt-1">Профиль</span>
          </button>
        </div>
      </div>

      {/* Swipe Instructions (показывать первые 5 секунд) */}
      <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
        <div className="bg-black/70 text-white px-8 py-4 rounded-2xl text-center animate-pulse">
          <p className="text-xl font-semibold mb-2">Листай в 4 стороны! ⬆️⬇️⬅️➡️</p>
          <p className="text-sm">Вверх/вниз - другое видео, влево/вправо - другая лента</p>
        </div>
      </div>
    </div>
  );
}