'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function StreamPage() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { user: 'Viewer1', message: 'Привет всем! 👋', color: 'text-blue-400' },
    { user: 'Viewer2', message: 'Крутой стрим!', color: 'text-green-400' },
    { user: 'Viewer3', message: 'Где купить такую мышку?', color: 'text-purple-400' },
    { user: 'Moderator', message: 'Добро пожаловать!', color: 'text-yellow-400', badge: '⭐' },
  ]);

  const handleSendMessage = () => {
    if (message.trim()) {
      setChatMessages([...chatMessages, { user: 'You', message, color: 'text-pink-400' }]);
      setMessage('');
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/kvach" className="text-2xl font-bold text-purple-500">
            Kvach
          </Link>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-white font-semibold text-sm">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-white">🔍</button>
          <button className="text-gray-400 hover:text-white">🔔</button>
          <button className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Stream Area */}
        <div className="flex-1 flex flex-col">
          {/* Video Player */}
          <div className="flex-1 bg-black relative">
            <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-9xl">
              🔴
            </div>
            
            {/* Stream Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">👁️ 45,234 зрителей</p>
              </div>
              
              <div className="flex gap-2">
                <button className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-black/80">
                  ⚙️
                </button>
                <button className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-black/80">
                  🔊
                </button>
                <button className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-black/80">
                  ⛶
                </button>
              </div>
            </div>
          </div>

          {/* Stream Info */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                <div>
                  <h1 className="text-xl font-bold text-white mb-1">
                    Турнир по CS2 - Невероятная игра!
                  </h1>
                  <div className="flex items-center gap-3 text-sm">
                    <Link href="#" className="text-purple-400 hover:text-purple-300 font-semibold">
                      ProGamer123
                    </Link>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">Counter-Strike 2</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">Киберспорт</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700">
                  ❤️ Подписаться
                </button>
                <button className="bg-gray-700 text-white p-2 rounded-lg hover:bg-gray-600">
                  🔔
                </button>
                <button className="bg-gray-700 text-white p-2 rounded-lg hover:bg-gray-600">
                  ↗️
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2">
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                Русский
              </span>
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                Киберспорт
              </span>
              <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                CS2
              </span>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <aside className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold">Чат стрима</h2>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, index) => (
              <div key={index} className="text-sm">
                <span className={`font-semibold ${msg.color}`}>
                  {msg.badge && <span className="mr-1">{msg.badge}</span>}
                  {msg.user}:
                </span>
                <span className="text-gray-300 ml-2">{msg.message}</span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Написать в чат..."
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button 
                onClick={handleSendMessage}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-semibold"
              >
                Отправить
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="text-2xl hover:scale-110 transition">😀</button>
              <button className="text-2xl hover:scale-110 transition">🎉</button>
              <button className="text-2xl hover:scale-110 transition">❤️</button>
              <button className="text-2xl hover:scale-110 transition">🔥</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}