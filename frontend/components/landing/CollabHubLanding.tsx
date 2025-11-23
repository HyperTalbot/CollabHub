"use client"

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Video, Zap, Radio, MessageSquare, Music, MessageCircle, 
  Sparkles, Mic, Play, ArrowRight, Star, ChevronDown
} from 'lucide-react';
import Image from "next/image";

const CollabHubLanding = () => {
  const [currentSection, setCurrentSection] = useState(0);
  const [showKolaDemo, setShowKolaDemo] = useState<'voice' | 'chat' | null>(null);

  // Плавная прокрутка к секции
  const scrollToSection = (index: number) => {
    const section = document.getElementById(`section-${index}`);
    section?.scrollIntoView({ behavior: 'smooth' });
  };

  // Автоскролл при смене секции
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('.platform-section');
      const scrollPosition = window.scrollY + window.innerHeight / 2;

      sections.forEach((section, index) => {
        const element = section as HTMLElement;
        if (
          scrollPosition >= element.offsetTop &&
          scrollPosition < element.offsetTop + element.offsetHeight
        ) {
          setCurrentSection(index);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const platforms = [
    {
      id: 'doubleyou',
      icon: Video,
      title: 'DoubleYou',
      slogan: 'это просто записи твоих дорогих моментов!',
      description: 'Делись видео, создавай воспоминания и смотри контент, который тебе нравится. Твой YouTube с душой.',
      color: 'from-red-500 to-pink-600',
      features: ['Длинные видео', 'Подписки', 'Плейлисты', 'Live стримы']
    },
    {
      id: 'flashcards',
      icon: Zap,
      title: 'FlashCards',
      slogan: 'это просто контент со всех сторон!',
      description: 'Листай контент в 4 направлениях! Вверх, вниз, влево, вправо - везде новые видео и впечатления.',
      color: 'from-purple-500 to-pink-600',
      features: ['Свайпы в 4 стороны', 'Короткие видео', 'Тренды', 'Челленджи']
    },
    {
      id: 'kvach',
      icon: Radio,
      title: 'Kvach',
      slogan: 'это просто живые моменты прямо сейчас!',
      description: 'Трансляции в реальном времени. Общайся со зрителями, проводи стримы и будь в центре событий.',
      color: 'from-blue-500 to-cyan-600',
      features: ['Live стриминг', 'Чат в реальном времени', 'Донаты', 'Алерты']
    },
    {
      id: 'postogram',
      icon: MessageSquare,
      title: 'Postogram',
      slogan: 'это просто все твои истории!',
      description: 'Публикуй посты, делись мыслями, участвуй в обсуждениях. Твой Twitter и Reddit в одном месте.',
      color: 'from-green-500 to-emerald-600',
      features: ['Посты', 'Комментарии', 'Лайки', 'Сообщества']
    },
    {
      id: 'symphonya',
      icon: Music,
      title: 'Symphonya',
      slogan: 'это просто музыка твоей души!',
      description: 'Слушай музыку, создавай плейлисты, делись треками. Твой персональный музыкальный мир.',
      color: 'from-orange-500 to-red-600',
      features: ['Музыкальные треки', 'Плейлисты', 'Альбомы', 'Подкасты']
    },
    {
      id: 'misable',
      icon: MessageCircle,
      title: 'Misable',
      slogan: 'это просто море общения!',
      description: 'Чаты, группы, каналы. Общайся с друзьями, создавай сообщества и будь всегда на связи.',
      color: 'from-indigo-500 to-purple-600',
      features: ['Личные чаты', 'Групповые чаты', 'Каналы', 'Голосовые звонки']
    },
  ];

  return (
    <>
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Header с кнопкой "Попробовать" */}
      <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-black/50 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
            {/* <Rocket className="w-7 h-7" /> */}
            <Image alt='CollabHub' src={'/logo/CollabHub1.jpg'} width={40} height={40}/>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            CollabHub
          </span>
        </div>
        
        <a
          href="/homepage"
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center gap-2"
        >
          Попробовать
          <ArrowRight className="w-5 h-5" />
        </a>
      </header>

      {/* Hero Section - Космос */}
      <section 
        id="section-0"
        className="platform-section min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          backgroundImage: 'url(https://cdn.fishki.net/upload/post/201512/20/1783207/tn/1_15.jpg)', // https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Overlay для читаемости */}
        <div className="absolute inset-0 bg-black/60"></div>
        
        {/* Звёзды анимация */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <Star
              key={i}
              className="absolute text-white animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 3 + 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center "> 
              {/* <Rocket className="w-14 h-14" /> animate-bounce*/}
              <Image alt='CollabHub' src={'/logo/CollabHub1.jpg'} width={80} height={80}/>
            </div>
          </div>
          
          <h1 className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-pulse">
            CollabHub
          </h1>
          
          <p className="text-4xl md:text-5xl font-bold mb-8 text-white drop-shadow-lg">
            это просто космос! 🚀
          </p>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
            6 платформ в одной. Видео, стримы, музыка, чаты и многое другое. 
            Всё в одном месте с AI помощником Кола.
          </p>
          
          <button
            onClick={() => scrollToSection(1)}
            className="animate-bounce"
          >
            <ChevronDown className="w-12 h-12 text-purple-400" />
          </button>
        </div>
      </section>

      {/* Платформы */}
      {platforms.map((platform, index) => {
        const Icon = platform.icon;
        return (
          <section
            key={platform.id}
            id={`section-${index + 1}`}
            className="platform-section min-h-screen flex items-center justify-center p-6 relative"
          >
            {/* Градиентный фон */}
            <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} opacity-10`}></div>
            
            <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              {/* Левая колонка - Инфо */}
              <div className={index % 2 === 0 ? 'order-1' : 'order-2'}>
                <div className="mb-6">
                  <div className={`w-20 h-20 bg-gradient-to-r ${platform.color} rounded-3xl flex items-center justify-center mb-4`}>
                    <Icon className="w-12 h-12" />
                  </div>
                  <h2 className="text-5xl font-black mb-4">{platform.title}</h2>
                  <p className="text-3xl font-bold text-gray-300 mb-6">
                    {platform.slogan}
                  </p>
                </div>
                
                <p className="text-xl text-gray-400 mb-8">
                  {platform.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {platform.features.map((feature) => (
                    <div 
                      key={feature}
                      className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
                    >
                      <p className="text-sm font-semibold">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Правая колонка - Визуал */}
              <div className={index % 2 === 0 ? 'order-2' : 'order-1'}>
                <div className={`relative w-full h-96 bg-gradient-to-br ${platform.color} rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-48 h-48 text-white/20" />
                  </div>
                  
                  {/* Мокап контента */}
                  <div className="absolute inset-0 p-8 flex flex-col justify-end">
                    <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full"></div>
                        <div>
                          <div className="w-24 h-3 bg-white/40 rounded mb-1"></div>
                          <div className="w-16 h-2 bg-white/20 rounded"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full h-3 bg-white/40 rounded"></div>
                        <div className="w-3/4 h-3 bg-white/40 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Секция Кола - AI помощник */}
      <section
        id="section-kola"
        className="platform-section min-h-screen flex items-center justify-center p-6 relative bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900"
      >
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/50 animate-pulse">
              <Sparkles className="w-20 h-20" />
            </div>
          </div>
          
          <h2 className="text-6xl font-black mb-4">Кола</h2>
          <p className="text-4xl font-bold text-gray-300 mb-6">
            это просто твой помощник на все случаи жизни! 🤖
          </p>
          
          <p className="text-xl text-gray-400 mb-12 max-w-3xl mx-auto">
            AI ассистент, который понимает голосовые команды и помогает управлять всей соц сетью. 
            Создавай посты, ищи контент, включай музыку - всё голосом или в чате!
          </p>

          {/* Демо функций */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Голосовое управление */}
            <div 
              className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer transform hover:scale-105"
              onClick={() => setShowKolaDemo('voice')}
            >
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mic className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Голосовое управление</h3>
              <p className="text-gray-400 mb-6">
                "Кола, включи музыку" или "Кола, напиши пост про путешествия"
              </p>
              <button className="px-6 py-3 bg-blue-600 rounded-full font-semibold hover:bg-blue-700 transition-colors">
                Попробовать
              </button>
            </div>

            {/* Чат с AI */}
            <div 
              className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer transform hover:scale-105"
              onClick={() => setShowKolaDemo('chat')}
            >
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Общение в чате</h3>
              <p className="text-gray-400 mb-6">
                Задавай вопросы, получай рекомендации, общайся как с другом
              </p>
              <button className="px-6 py-3 bg-purple-600 rounded-full font-semibold hover:bg-purple-700 transition-colors">
                Открыть чат
              </button>
            </div>
          </div>

          {/* Демо модалка */}
          {showKolaDemo && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <div className="bg-gray-900 rounded-3xl p-8 max-w-2xl w-full border border-white/10">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">
                    {showKolaDemo === 'voice' ? '🎤 Голосовое управление' : '💬 Чат с Кола'}
                  </h3>
                  <button
                    onClick={() => setShowKolaDemo(null)}
                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"
                  >
                    ✕
                  </button>
                </div>

                {showKolaDemo === 'voice' ? (
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Mic className="w-12 h-12" />
                    </div>
                    <p className="text-xl mb-6">Скажи: "Кола, ..."</p>
                    <div className="space-y-3 text-left max-w-md mx-auto">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-gray-400">Пример команд:</p>
                        <ul className="mt-2 space-y-2 text-sm">
                          <li>• "Кола, включи музыку Imagine Dragons"</li>
                          <li>• "Кола, напиши пост про путешествия"</li>
                          <li>• "Кола, найди видео про программирование"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="h-96 bg-black/40 rounded-2xl p-6 mb-4 overflow-y-auto">
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex-shrink-0"></div>
                          <div className="bg-white/10 rounded-2xl p-4 max-w-xs">
                            <p>Привет! Я Кола, чем могу помочь?</p>
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <div className="bg-blue-600 rounded-2xl p-4 max-w-xs">
                            <p>Расскажи о функциях CollabHub</p>
                          </div>
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex-shrink-0"></div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex-shrink-0"></div>
                          <div className="bg-white/10 rounded-2xl p-4 max-w-md">
                            <p>CollabHub объединяет 6 платформ: видео, короткие ролики, стримы, посты, музыку, чаты и многое другое! Могу помочь с любой из них 😊</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Напиши сообщение..."
                        className="flex-1 bg-white/10 rounded-full px-6 py-3 outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center hover:shadow-lg">
                        <Play className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-6xl font-black mb-6">
            Готов к космическому опыту?
          </h2>
          <p className="text-2xl text-gray-300 mb-12">
            Присоединяйся к CollabHub и открой для себя новый мир возможностей
          </p>
          
          <a
            href="/homepage"
            className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-2xl hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-110"
          >
            <Rocket className="w-8 h-8" />
            Начать путешествие
            <ArrowRight className="w-8 h-8" />
          </a>
          
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-4xl font-black text-purple-400 mb-2">7</p>
              <p className="text-sm text-gray-400">Платформ</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-pink-400 mb-2">∞</p>
              <p className="text-sm text-gray-400">Возможностей</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-blue-400 mb-2">1</p>
              <p className="text-sm text-gray-400">AI помощник</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-purple-400 mb-2">🚀</p>
              <p className="text-sm text-gray-400">Космос эмоций</p>
            </div>
          </div>
        </div>
      </section>

      {/* Навигационные точки */}
      <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-40 hidden md:block">
        <div className="space-y-3">
          {[0, ...platforms.map((_, i) => i + 1), platforms.length + 1].map((index) => (
            <button
              key={index}
              onClick={() => scrollToSection(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                currentSection === index
                  ? 'bg-purple-500 w-12'
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default CollabHubLanding;