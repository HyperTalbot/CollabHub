'use client'

import React, { useState } from 'react';
import { 
  Star, TrendingUp, Users, Eye, CheckCircle, Filter, Search,
  Video, Zap, Radio, MessageSquare, Music, Award
} from 'lucide-react';

const OurStarsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Категории контента
  const categories = [
    { id: 'all', label: 'Все', icon: Star },
    { id: 'video', label: 'Видео-блогеры', icon: Video },
    { id: 'shorts', label: 'Shorts звёзды', icon: Zap },
    { id: 'streamers', label: 'Стримеры', icon: Radio },
    { id: 'bloggers', label: 'Постеры', icon: MessageSquare },
    { id: 'musicians', label: 'Музыканты', icon: Music },
  ];

  // Жанры/темы
  const genres = {
    video: ['Авто', 'Технологии', 'Образование', 'Развлечения', 'Путешествия', 'Спорт'],
    shorts: ['Танцы', 'Комедия', 'Лайфхаки', 'Челленджи', 'Кулинария'],
    streamers: ['Игры', 'IRL', 'Творчество', 'Спорт', 'Образование'],
    bloggers: ['Политика', 'Технологии', 'Лайфстайл', 'Бизнес', 'Наука'],
    musicians: ['Рок', 'Поп', 'Хип-хоп', 'Электроника', 'Классика', 'Джаз'],
  };

  // Моковые данные звёзд
  const stars = [
    {
      id: 1,
      name: 'Алексей Технов',
      username: 'techguru',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
      category: 'video',
      genre: 'Технологии',
      followers: '2.5M',
      avgViews: '450K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=600&fit=crop',
    },
    {
      id: 2,
      name: 'Мария Авто',
      username: 'carstyle',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
      category: 'video',
      genre: 'Авто',
      followers: '1.8M',
      avgViews: '320K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=600&fit=crop',
    },
    {
      id: 3,
      name: 'DancePro',
      username: 'dancepro',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dance',
      category: 'shorts',
      genre: 'Танцы',
      followers: '3.2M',
      avgViews: '1.2M',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=600&fit=crop',
    },
    {
      id: 4,
      name: 'GameMaster',
      username: 'gmaster',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gamer',
      category: 'streamers',
      genre: 'Игры',
      followers: '4.1M',
      avgViewers: '25K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=600&fit=crop',
    },
    {
      id: 5,
      name: 'IRL Walker',
      username: 'irlwalker',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=walker',
      category: 'streamers',
      genre: 'IRL',
      followers: '890K',
      avgViewers: '12K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=600&fit=crop',
    },
    {
      id: 6,
      name: 'RockStar',
      username: 'rockstar',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rock',
      category: 'musicians',
      genre: 'Рок',
      followers: '1.5M',
      avgPlays: '250K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&h=600&fit=crop',
    },
    {
      id: 7,
      name: 'PopDiva',
      username: 'popdiva',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diva',
      category: 'musicians',
      genre: 'Поп',
      followers: '2.8M',
      avgPlays: '520K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=600&fit=crop',
    },
    {
      id: 8,
      name: 'TechWriter',
      username: 'techwriter',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=writer',
      category: 'bloggers',
      genre: 'Технологии',
      followers: '567K',
      avgReads: '45K',
      isVerified: true,
      cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=600&fit=crop',
    },
  ];

  // Фильтрация звёзд
  const filteredStars = stars.filter(star => {
    const matchesCategory = selectedCategory === 'all' || star.category === selectedCategory;
    const matchesGenre = selectedGenre === 'all' || star.genre === selectedGenre;
    const matchesSearch = star.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         star.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesGenre && matchesSearch;
  });

  // Получить метрику в зависимости от категории
  const getMetric = (star: typeof stars[0]) => {
    if (star.category === 'streamers') {
      return { label: 'Средний онлайн', value: star.avgViewers };
    } else if (star.category === 'musicians') {
      return { label: 'Прослушиваний/мес', value: star.avgPlays };
    } else if (star.category === 'bloggers') {
      return { label: 'Прочтений/мес', value: star.avgReads };
    } else {
      return { label: 'Просмотров/мес', value: star.avgViews };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
              <Award className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4">Наши звёзды 🌟</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Топ создателей контента CollabHub. Лучшие блогеры, стримеры и музыканты в одном месте!
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по имени или username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={20} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Категория</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedGenre('all');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${selectedCategory === cat.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon size={16} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genre Filter */}
          {selectedCategory !== 'all' && genres[selectedCategory as keyof typeof genres] && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Жанр/Тема</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGenre('all')}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    selectedGenre === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Все
                </button>
                {genres[selectedCategory as keyof typeof genres].map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                      selectedGenre === genre
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6 text-gray-700 dark:text-gray-300">
          Найдено: <span className="font-bold text-blue-600">{filteredStars.length}</span> звёзд
        </div>

        {/* Stars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStars.map((star) => {
            const metric = getMetric(star);
            return (
              <div
                key={star.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 overflow-hidden group"
              >
                {/* Cover/Photo */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={star.cover}
                    alt={star.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                  
                  {/* Verified Badge */}
                  {star.isVerified && (
                    <div className="absolute top-3 right-3 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}

                  {/* Genre Badge */}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-semibold">
                    {star.genre}
                  </div>
                </div>

                {/* Info */}
                <div className="p-6">
                  {/* Avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <img
                      src={star.avatar}
                      alt={star.name}
                      className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-700 -mt-12 shadow-xl"
                    />
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all transform hover:scale-105">
                      Подписаться
                    </button>
                  </div>

                  {/* Name & Username */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                    {star.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">@{star.username}</p>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users size={16} className="text-blue-600" />
                        <span>Подписчики</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{star.followers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Eye size={16} className="text-blue-600" />
                        <span>{metric.label}</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{metric.value}</span>
                    </div>
                  </div>

                  {/* Category Tag */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-green-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        Топ в категории "{categories.find(c => c.id === star.category)?.label}"
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredStars.length === 0 && (
          <div className="text-center py-16">
            <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Звёзды не найдены
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OurStarsPage;