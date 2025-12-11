'use client';

import Link from 'next/link';

const VideoCard = ({ title, views, duration, channel }: any) => (
  <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer">
    <div className="relative">
      <div className="w-full h-48 bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white text-4xl">
        ▶️
      </div>
      <span className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
        {duration}
      </span>
    </div>
    <div className="p-4">
      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">{title}</h3>
      <p className="text-sm text-gray-600">{channel}</p>
      <p className="text-sm text-gray-500">{views} просмотров</p>
    </div>
  </div>
);

export default function DoubleYouPage() {
  const videos = [
    { title: 'Как я построил дом за месяц', views: '1.2М', duration: '15:23', channel: 'Строитель Про' },
    { title: 'Топ 10 мест для путешествий 2025', views: '856К', duration: '12:45', channel: 'Путешествуй' },
    { title: 'Обзор новых технологий', views: '2.1М', duration: '20:15', channel: 'ТехноБлог' },
    { title: 'Рецепт идеальной пасты', views: '634К', duration: '8:30', channel: 'Кухня Мастер' },
    { title: 'Тренировка для начинающих', views: '945К', duration: '18:00', channel: 'Фитнес Гуру' },
    { title: 'История одного стартапа', views: '512К', duration: '25:40', channel: 'Бизнес Истории' },
    { title: 'Лайфхаки для дома', views: '1.5М', duration: '10:20', channel: 'Лайфхакер' },
    { title: 'Обучение игре на гитаре', views: '728К', duration: '14:55', channel: 'Музыка для всех' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-red-600">
              DoubleYou
            </Link>
            <div className="flex-1 max-w-2xl">
              <input
                type="search"
                placeholder="Поиск видео..."
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full">
              📹
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              🔔
            </button>
            <button className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white">
              U
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white h-[calc(100vh-64px)] sticky top-16 p-4 space-y-2 overflow-y-auto">
          <button className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-lg font-medium">
            🏠 Главная
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-lg">
            🔥 В тренде
          </button>
          <button className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-lg">
            📚 Подписки
          </button>
          <div className="border-t pt-4 mt-4">
            <p className="px-4 text-sm font-semibold text-gray-600 mb-2">Категории</p>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm">
              🎮 Игры
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm">
              🎵 Музыка
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm">
              📰 Новости
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm">
              ⚽ Спорт
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg text-sm">
              🎓 Образование
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Category Pills */}
          <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
            <button className="px-4 py-2 bg-black text-white rounded-full text-sm whitespace-nowrap">
              Все
            </button>
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm whitespace-nowrap">
              В прямом эфире
            </button>
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm whitespace-nowrap">
              Музыка
            </button>
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm whitespace-nowrap">
              Игры
            </button>
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm whitespace-nowrap">
              Новости
            </button>
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm whitespace-nowrap">
              Недавно загруженные
            </button>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video, index) => (
              <VideoCard key={index} {...video} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}