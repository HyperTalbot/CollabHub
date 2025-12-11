'use client';

import Link from 'next/link';

export default function VideoPage() {
  const suggestedVideos = [
    { title: 'Похожее видео 1', views: '500К', duration: '10:20' },
    { title: 'Похожее видео 2', views: '1.2М', duration: '15:30' },
    { title: 'Похожее видео 3', views: '856К', duration: '12:45' },
    { title: 'Похожее видео 4', views: '2.1М', duration: '20:00' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/doubleyou" className="text-2xl font-bold text-red-600">
            DoubleYou
          </Link>
          <div className="flex-1 max-w-2xl mx-8">
            <input
              type="search"
              placeholder="Поиск видео..."
              className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full">📹</button>
            <button className="p-2 hover:bg-gray-100 rounded-full">🔔</button>
            <button className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white">
              U
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6 flex gap-6">
        {/* Main Video Column */}
        <div className="flex-1">
          {/* Video Player */}
          <div className="bg-black rounded-xl overflow-hidden mb-4">
            <div className="aspect-video bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-6xl">
              ▶️
            </div>
          </div>

          {/* Video Info */}
          <div className="bg-white rounded-xl p-6 mb-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Удивительное видео про технологии будущего
            </h1>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  C
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Канал Технологий</p>
                  <p className="text-sm text-gray-600">1.5М подписчиков</p>
                </div>
                <button className="ml-4 bg-red-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-red-700">
                  Подписаться
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
                  👍 <span className="font-semibold">12K</span>
                </button>
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
                  👎
                </button>
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
                  ↗️ Поделиться
                </button>
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
                  ⋮
                </button>
              </div>
            </div>

            <div className="bg-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                2.3М просмотров • 2 дня назад
              </p>
              <p className="text-gray-700">
                Это описание видео, где автор рассказывает о своем контенте. Здесь можно разместить 
                ссылки, упомянуть партнеров и добавить любую полезную информацию для зрителей.
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              1,234 комментария
            </h2>
            
            <div className="flex gap-4 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                U
              </div>
              <input
                type="text"
                placeholder="Добавьте комментарий..."
                className="flex-1 border-b-2 border-gray-300 focus:border-red-500 outline-none pb-2"
              />
            </div>

            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    U{i}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">
                      Пользователь {i} <span className="text-sm text-gray-500 font-normal">• 1 день назад</span>
                    </p>
                    <p className="text-gray-700 mt-1">
                      Отличное видео! Очень интересный контент и качественная подача материала.
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <button className="text-sm text-gray-600 hover:text-gray-800">👍 24</button>
                      <button className="text-sm text-gray-600 hover:text-gray-800">👎</button>
                      <button className="text-sm text-gray-600 hover:text-gray-800">Ответить</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar with Suggested Videos */}
        <aside className="w-96">
          <div className="space-y-3">
            {suggestedVideos.map((video, index) => (
              <div key={index} className="flex gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg">
                <div className="w-40 h-24 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-2xl relative">
                  ▶️
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white px-1 text-xs rounded">
                    {video.duration}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-600">Канал автора</p>
                  <p className="text-xs text-gray-500">{video.views} просмотров</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}