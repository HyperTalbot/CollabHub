'use client';

import React from 'react';

interface GenreSectionProps {
  genres: string[];
  onGenreClick: (genre: string) => void;
}

const genreColors: { [key: string]: string } = {
  'Поп': 'from-pink-500 to-rose-500',
  'Рок': 'from-red-600 to-orange-600',
  'Хип-хоп': 'from-purple-600 to-indigo-600',
  'Электроника': 'from-cyan-500 to-blue-600',
  'Джаз': 'from-amber-600 to-yellow-500',
  'Классика': 'from-gray-600 to-slate-700',
  'Инди': 'from-green-600 to-emerald-600',
  'R&B': 'from-pink-600 to-purple-600',
  'Акустика': 'from-teal-500 to-cyan-500',
};

const genreEmojis: { [key: string]: string } = {
  'Поп': '🎤',
  'Рок': '🎸',
  'Хип-хоп': '🎧',
  'Электроника': '🔊',
  'Джаз': '🎷',
  'Классика': '🎻',
  'Инди': '🎹',
  'R&B': '🎵',
  'Акустика': '🎼',
};

export const GenreSection: React.FC<GenreSectionProps> = ({ genres, onGenreClick }) => {
  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold text-white mb-6">Жанры</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {genres.map((genre, index) => {
          const colorClass = genreColors[genre] || 'from-gray-600 to-gray-700';
          const emoji = genreEmojis[genre] || '🎵';
          
          return (
            <button
              key={index}
              onClick={() => onGenreClick(genre)}
              className={`bg-gradient-to-br ${colorClass} rounded-xl p-6 cursor-pointer hover:scale-105 transition-transform shadow-lg hover:shadow-xl`}
            >
              <div className="text-4xl mb-2">{emoji}</div>
              <h3 className="text-xl font-bold text-white">{genre}</h3>
            </button>
          );
        })}
      </div>
    </div>
  );
};