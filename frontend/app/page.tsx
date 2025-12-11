'use client';

// import CollabHubLanding from '@/components/landing/CollabHubLanding';
// import type { Metadata } from 'next';
import Link from 'next/link';
import { useState } from 'react';

// export const metadata: Metadata = {
//   title: 'CollabHub - 6 платформ в одной | Социальная сеть будущего',
//   description: 'Объединяем видео, стримы, музыку, посты, чаты и AI помощника Кола в одной соц сети. Это просто космос!',
//   keywords: [
//     'социальная сеть',
//     'видео платформа', 
//     'короткие видео',
//     'стриминг',
//     'музыка онлайн',
//     'мессенджер',
//     'AI помощник',
//     'CollabHub'
//   ],
//   openGraph: {
//     title: 'CollabHub - это просто космос!',
//     description: '6 платформ в одной. Будущее социальных сетей уже здесь.',
//     type: 'website',
//     url: 'https://collabhub.com',
//     images: [
//       {
//         url: 'cosmo.jpg',
//         width: 1920,
//         height: 1080,
//         alt: 'CollabHub - космическая соц сеть',
//       },
//     ],
//   },
//   twitter: {
//     card: 'summary_large_image',
//     title: 'CollabHub - это просто космос!',
//     description: '6 платформ в одной соц сети',
//   },
// };

const StarCard = ({ name, subscribers, metric, metricValue, category, image }: any) => (
  <div className="bg-white rounded-2xl shadow-xl p-6 w-64 transform hover:scale-105 transition-all">
    <div className="w-full h-48 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl mb-4 flex items-center justify-center text-white text-6xl">
      {image || '👤'}
    </div>
    <h3 className="font-bold text-xl text-gray-800 mb-2">{name}</h3>
    <p className="text-gray-600 mb-1">👥 {subscribers} подписчиков</p>
    <p className="text-gray-600 mb-3">📊 {metric}: {metricValue}</p>
    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm inline-block">
      {category}
    </div>
  </div>
);

export default function LandingPage() {
  const stars = [
    { name: 'Иван Иванов', subscribers: '5.2М', metric: 'Просмотры/мес', metricValue: '120М', category: 'Топ Видео-блогер', image: '🎬' },
    { name: 'Мария Петрова', subscribers: '3.8М', metric: 'Средний онлайн', metricValue: '45К', category: 'Топ Стример', image: '🎮' },
    { name: 'DJ Cosmos', subscribers: '2.1М', metric: 'Прослушиваний/мес', metricValue: '80М', category: 'Топ Музыкант', image: '🎵' },
    { name: 'Анна Сидорова', subscribers: '4.5М', metric: 'Прочтений/мес', metricValue: '95М', category: 'Топ Блогер', image: '✍️' },
    { name: 'Максим Лайт', subscribers: '6.1М', metric: 'Просмотры/мес', metricValue: '200М', category: 'Топ Видео-блогер', image: '📹' },
    { name: 'Елена Стар', subscribers: '3.2М', metric: 'Средний онлайн', metricValue: '38К', category: 'Топ Стример', image: '🌟' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/20 backdrop-blur-md z-50 border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-3xl font-bold text-white">CollabHub</div>
          <Link 
            href="/homepage"
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all"
          >
            Попробовать
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwMCIgaGVpZ2h0PSIxMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxyYWRpYWxHcmFkaWVudCBpZD0iZ2xvdyI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmZjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmZjtzdG9wLW9wYWNpdHk6MCIvPjwvcmFkaWFsR3JhZGllbnQ+PC9kZWZzPjxnPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMiIgZmlsbD0idXJsKCNnbG93KSIvPjxjaXJjbGUgY3g9IjMwMCIgY3k9IjIwMCIgcj0iMyIgZmlsbD0idXJsKCNnbG93KSIvPjxjaXJjbGUgY3g9IjYwMCIgY3k9IjE1MCIgcj0iMiIgZmlsbD0idXJsKCNnbG93KSIvPjxjaXJjbGUgY3g9IjgwMCIgY3k9IjMwMCIgcj0iMyIgZmlsbD0idXJsKCNnbG93KSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-7xl font-bold text-white mb-6 animate-pulse">
            CollabHub - это просто космос! 🚀
          </h1>
          <p className="text-2xl text-blue-200 mb-12">
            6 платформ в одном месте. Твой мир развлечений без границ.
          </p>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-20 px-6">
        <div className="container mx-auto space-y-32">
          {/* DoubleYou */}
          <div className="flex items-center gap-12 flex-col md:flex-row">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                DoubleYou 📹
              </h2>
              <p className="text-3xl text-blue-300">
                это просто записи твоих дорогих моментов!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                🎬 Видео плеер
              </div>
            </div>
          </div>

          {/* FlashCards */}
          <div className="flex items-center gap-12 flex-col md:flex-row-reverse">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                FlashCards 📱
              </h2>
              <p className="text-3xl text-purple-300">
                это просто контент со всех сторон!
              </p>
              <p className="text-xl text-gray-300 mt-2">
                Листай вверх, вниз, влево и вправо!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                ⬆️⬇️⬅️➡️ Свайп
              </div>
            </div>
          </div>

          {/* Kvach */}
          <div className="flex items-center gap-12 flex-col md:flex-row">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                Kvach 🎮
              </h2>
              <p className="text-3xl text-green-300">
                это просто живые моменты прямо сейчас!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                🔴 LIVE стримы
              </div>
            </div>
          </div>

          {/* Postogram */}
          <div className="flex items-center gap-12 flex-col md:flex-row-reverse">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                Postogram 📝
              </h2>
              <p className="text-3xl text-blue-300">
                это просто все твои истории!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                ✍️ Посты и истории
              </div>
            </div>
          </div>

          {/* Symphonya */}
          <div className="flex items-center gap-12 flex-col md:flex-row">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                Symphonya 🎵
              </h2>
              <p className="text-3xl text-pink-300">
                это просто музыка твоей души!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                🎧 Музыка
              </div>
            </div>
          </div>

          {/* Misable */}
          <div className="flex items-center gap-12 flex-col md:flex-row-reverse">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                Misable 💬
              </h2>
              <p className="text-3xl text-indigo-300">
                это просто море общения!
              </p>
              <div className="mt-6 w-full h-64 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-4xl">
                💬 Чаты и каналы
              </div>
            </div>
          </div>

          {/* Kola AI */}
          <div className="flex items-center gap-12 flex-col md:flex-row">
            <div className="flex-1">
              <h2 className="text-5xl font-bold text-white mb-4">
                Кола 🤖
              </h2>
              <p className="text-3xl text-yellow-300">
                это просто твой помощник на все случаи жизни!
              </p>
              <div className="mt-6 space-y-4">
                <div className="w-full p-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl text-white">
                  <p className="text-2xl font-semibold">🎤 Управление голосом</p>
                  <p className="text-lg mt-2">Просто скажи: "Кола, открой Misable"</p>
                </div>
                <div className="w-full p-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl text-white">
                  <p className="text-2xl font-semibold">💬 Общение в чате</p>
                  <p className="text-lg mt-2">Спроси совет, узнай новости, развлекайся</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stars Section */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 text-9xl opacity-5 overflow-hidden">
          {'⭐'.repeat(50)}
        </div>
        <div className="container mx-auto relative z-10">
          <h2 className="text-6xl font-bold text-white text-center mb-6">
            Стань звездой! ⭐
          </h2>
          <p className="text-2xl text-center text-blue-200 mb-16">
            Присоединяйся к лучшим создателям контента и светись ярче всех!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
            {stars.map((star, index) => (
              <div
                key={index}
                className="animate-float"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <StarCard {...star} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold text-white mb-8">
            Готов начать свое космическое путешествие?
          </h2>
          <Link 
            href="/homepage"
            className="inline-block bg-white text-blue-600 px-12 py-4 rounded-full text-xl font-bold hover:shadow-2xl hover:scale-110 transition-all"
          >
            Попробовать прямо сейчас! 🚀
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-black/40 text-center">
        <div className="container mx-auto">
          <Link href="/policies" className="text-blue-300 hover:text-blue-200 underline">
            Политики и правила
          </Link>
          <p className="text-gray-400 mt-4">
            © 2025 CollabHub. Все платформы в одном месте.
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
