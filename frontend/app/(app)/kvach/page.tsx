'use client';

import Link from 'next/link';

const StreamCard = ({ title, streamer, viewers, game, category }: any) => (
  <div className="group cursor-pointer">
    <div className="relative rounded-xl overflow-hidden mb-3">
      <div className="aspect-video bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl">
        🔴
      </div>
      <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
        LIVE
      </div>
      <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
        👁️ {viewers}
      </div>
      <div className="absolute bottom-2 left-2 bg-purple-600 text-white px-2 py-1 rounded text-xs">
        {category}
      </div>
    </div>
    <div className="flex gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex-shrink-0"></div>
      <div className="flex-1">
        <h3 className="font-semibold text-white group-hover:text-purple-400 transition line-clamp-1">
          {title}
        </h3>
        <p className="text-sm text-gray-400">{streamer}</p>
        <p className="text-sm text-gray-500">{game}</p>
      </div>
    </div>
  </div>
);

export default function KvachPage() {
  const streams = [
    { title: 'Турнир по CS2 - ФИНАЛ!', streamer: 'ProGamer123', viewers: '45K', game: 'Counter-Strike 2', category: 'Киберспорт' },
    { title: 'Прохождение Elden Ring', streamer: 'DarkSoulsMan', viewers: '12K', game: 'Elden Ring', category: 'RPG' },
    { title: 'Рисую портрет подписчика', streamer: 'ArtistPro', viewers: '8.5K', game: 'Art', category: 'Творчество' },
    { title: 'Готовлю пасту карбонара', streamer: 'ChefMaster', viewers: '15K', game: 'Just Chatting', category: 'Кулинария' },
    { title: 'Играю в Dota 2 на 8000 MMR', streamer: 'DotaPro', viewers: '32K', game: 'Dota 2', category: 'MOBA' },
    { title: 'Изучаем Python для начинающих', streamer: 'CodeTeacher', viewers: '6.2K', game: 'Software Development', category: 'Обучение' },
    { title: 'Музыкальный вечер', streamer: 'MusicLover', viewers: '11K', game: 'Music', category: 'Музыка' },
    { title: 'Valorant с подписчиками', streamer: 'ValPro', viewers: '28K', game: 'Valorant', category: 'Шутеры' },
  ];

  const categories = [
    { name: 'Just Chatting', viewers: '245K', icon: '💬' },
    { name: 'Counter-Strike 2', viewers: '189K', icon: '🎮' },
    { name: 'League of Legends', viewers: '156K', icon: '⚔️' },
    { name: 'Dota 2', viewers: '134K', icon: '🛡️' },
    { name: 'Valorant', viewers: '98K', icon: '🔫' },
    { name: 'Minecraft', viewers: '87K', icon: '⛏️' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-purple-500">
              Kvach
            </Link>
            <nav className="flex gap-6">
              <button className="text-white hover:text-purple-400 transition">
                Обзор
              </button>
              <button className="text-gray-400 hover:text-white transition">
                Подписки
              </button>
              <button className="text-gray-400 hover:text-white transition">
                Категории
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="search"
              placeholder="Поиск..."
              className="w-64 px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700">
              Начать стрим
            </button>
            <button className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 min-h-screen p-4 border-r border-gray-700">
          <div className="space-y-1 mb-6">
            <button className="w-full text-left px-4 py-3 text-white bg-gray-700 rounded-lg font-medium">
              🏠 Главная
            </button>
            <button className="w-full text-left px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg">
              📺 Подписки
            </button>
            <button className="w-full text-left px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg">
              🎯 Категории
            </button>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm font-semibold text-gray-400 px-4 mb-3">Топ категории</p>
            <div className="space-y-1">
              {categories.map((cat, index) => (
                <button key={index} className="w-full text-left px-4 py-2 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-xs text-gray-500">👁️ {cat.viewers}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Featured Stream */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">🔥 Популярное сейчас</h2>
            <div className="relative rounded-2xl overflow-hidden cursor-pointer group">
              <div className="aspect-video bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-8xl">
                🔴
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2">
                <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
              <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-2 rounded-lg font-semibold">
                👁️ 125K зрителей
              </div>
              <div className="absolute bottom-6 left-6 right-6">
                <h3 className="text-3xl font-bold text-white mb-2">
                  Чемпионат мира по киберспорту - Гранд финал!
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                  <div>
                    <p className="font-semibold text-white">EsportsChampion</p>
                    <p className="text-sm text-gray-300">Counter-Strike 2 • Киберспорт</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Channels */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Прямые эфиры</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {streams.map((stream, index) => (
                <StreamCard key={index} {...stream} />
              ))}
            </div>
          </div>
          
          {/* Load More */}
          <div className="mt-8 text-center">
            <button className="bg-gray-800 text-white px-8 py-3 rounded-lg hover:bg-gray-700 transition">
              Загрузить еще
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}