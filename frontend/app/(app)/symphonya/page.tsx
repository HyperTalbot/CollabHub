'use client';

import { useState } from 'react';

const SongCard = ({ title, artist, duration, cover }: any) => (
  <div className="group cursor-pointer">
    <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
      <div className={`w-full h-full bg-gradient-to-br ${cover} flex items-center justify-center text-white text-6xl group-hover:scale-105 transition-transform`}>
        🎵
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
        <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 text-4xl hover:scale-110 transition">
          ▶️
        </button>
      </div>
    </div>
    <h3 className="font-semibold text-white text-sm line-clamp-1">{title}</h3>
    <p className="text-gray-400 text-sm">{artist}</p>
  </div>
);

const PlaylistCard = ({ name, description, cover }: any) => (
  <div className="group cursor-pointer">
    <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
      <div className={`w-full h-full bg-gradient-to-br ${cover} flex items-center justify-center text-white text-5xl group-hover:scale-105 transition-transform`}>
        📀
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
        <button className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-4 text-4xl hover:scale-110 transition">
          ▶️
        </button>
      </div>
    </div>
    <h3 className="font-semibold text-white text-sm line-clamp-1">{name}</h3>
    <p className="text-gray-400 text-sm line-clamp-2">{description}</p>
  </div>
);

export default function SymphonyaPage() {
  const [isPlaying, setIsPlaying] = useState(false);

  const quickPicks = [
    { title: 'Sunset Dreams', artist: 'The Waves', duration: '3:45', cover: 'from-orange-500 to-pink-500' },
    { title: 'Electric Love', artist: 'Neon Hearts', duration: '4:12', cover: 'from-purple-500 to-blue-500' },
    { title: 'Midnight City', artist: 'Urban Soul', duration: '3:28', cover: 'from-indigo-500 to-purple-500' },
    { title: 'Summer Vibes', artist: 'Beach Boys', duration: '3:55', cover: 'from-yellow-500 to-orange-500' },
    { title: 'Rainy Day', artist: 'Acoustic Dreams', duration: '4:03', cover: 'from-gray-500 to-blue-500' },
    { title: 'Dance Floor', artist: 'DJ Pulse', duration: '3:18', cover: 'from-pink-500 to-red-500' },
  ];

  const playlists = [
    { name: 'Топ 50 - Россия', description: 'Самые популярные треки недели', cover: 'from-red-500 to-orange-500' },
    { name: 'Chill Vibes', description: 'Расслабляющая музыка для работы', cover: 'from-blue-400 to-cyan-400' },
    { name: 'Workout Mix', description: 'Энергичная музыка для тренировок', cover: 'from-green-500 to-emerald-500' },
    { name: 'Ретро 80-90s', description: 'Хиты из прошлого', cover: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 pb-32">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
              Symphonya
            </div>
            <nav className="flex gap-6">
              <button className="text-white hover:text-pink-400 transition">Главная</button>
              <button className="text-gray-400 hover:text-white transition">Поиск</button>
              <button className="text-gray-400 hover:text-white transition">Библиотека</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="search"
              placeholder="Песни, исполнители, альбомы..."
              className="w-80 px-4 py-2 bg-white/10 text-white rounded-full focus:outline-none focus:bg-white/20 placeholder-gray-400"
            />
            <button className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full"></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Featured Section */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden h-96 bg-gradient-to-br from-pink-600 to-purple-600">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-8 left-8">
              <p className="text-pink-300 text-sm font-semibold mb-2">Плейлист дня</p>
              <h1 className="text-5xl font-bold text-white mb-4">Топ хиты 2025</h1>
              <p className="text-gray-300 mb-6">Самая популярная музыка прямо сейчас</p>
              <button className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition">
                ▶️ Играть
              </button>
            </div>
          </div>
        </div>

        {/* Quick Picks */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">Быстрый выбор</h2>
            <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickPicks.map((song, index) => (
              <SongCard key={index} {...song} />
            ))}
          </div>
        </div>

        {/* Playlists */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">Плейлисты для тебя</h2>
            <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {playlists.map((playlist, index) => (
              <PlaylistCard key={index} {...playlist} />
            ))}
          </div>
        </div>

        {/* Recently Played */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">Недавно прослушанное</h2>
            <button className="text-gray-400 hover:text-white text-sm">Показать все</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickPicks.slice(0, 4).map((song, index) => (
              <SongCard key={index} {...song} />
            ))}
          </div>
        </div>

        {/* Genres */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-6">Жанры</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Поп', color: 'from-pink-500 to-rose-500' },
              { name: 'Рок', color: 'from-red-600 to-orange-600' },
              { name: 'Хип-хоп', color: 'from-purple-600 to-indigo-600' },
              { name: 'Электроника', color: 'from-cyan-500 to-blue-600' },
              { name: 'Джаз', color: 'from-amber-600 to-yellow-500' },
              { name: 'Классика', color: 'from-gray-600 to-slate-700' },
              { name: 'Инди', color: 'from-green-600 to-emerald-600' },
              { name: 'R&B', color: 'from-pink-600 to-purple-600' },
            ].map((genre, index) => (
              <div 
                key={index}
                className={`bg-gradient-to-br ${genre.color} rounded-xl p-6 cursor-pointer hover:scale-105 transition`}
              >
                <h3 className="text-2xl font-bold text-white">{genre.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-6 py-4 z-50">
        <div className="container mx-auto flex items-center justify-between">
          {/* Current Track Info */}
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-2xl">
              🎵
            </div>
            <div>
              <p className="text-white font-semibold">Sunset Dreams</p>
              <p className="text-gray-400 text-sm">The Waves</p>
            </div>
            <button className="text-gray-400 hover:text-white ml-4">❤️</button>
          </div>

          {/* Player Controls */}
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center justify-center gap-6 mb-2">
              <button className="text-gray-400 hover:text-white">🔀</button>
              <button className="text-gray-400 hover:text-white text-2xl">⏮️</button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="bg-white rounded-full p-3 hover:scale-105 transition text-2xl"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <button className="text-gray-400 hover:text-white text-2xl">⏭️</button>
              <button className="text-gray-400 hover:text-white">🔁</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">1:23</span>
              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-orange-500 w-1/3"></div>
              </div>
              <span className="text-xs text-gray-400">3:45</span>
            </div>
          </div>

          {/* Volume & Options */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <button className="text-gray-400 hover:text-white">📋</button>
            <button className="text-gray-400 hover:text-white">🔊</button>
            <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-white w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}