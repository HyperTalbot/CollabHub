import React, { useEffect, useState } from 'react';
import { 
  MapPin, Calendar, ExternalLink, Users, Eye, Video, 
  MessageCircle, Music, Radio, Share2, Edit, Settings,
  CheckCircle, Plus, Grid, List
} from 'lucide-react';
import axios from 'axios';

interface ProfilePageProps {
    userId: string;
}

// export default function ProfilePage({ userId }:ProfilePageProps) {
//     const [profile, setProfile] = useState(null);
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         // Загрузка данных профиля
//         const fetchProfile = async () => {
//             try {
//                 const response = await axios.get(`/api/v1/users/${userId}`);
//                 setProfile(response.data);
//             } catch (error) {
//                 console.error("Failed to fetch profile: ", error);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchProfile();
//     }, [userId]);

//     if (loading) {
//         return <div className='flex items-center justify-center min-h-screen'>
//             <div className='animate-spin rounded-full h-12 w -12 border-blue-600'></div>
//         </div>;
//     }
// }

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Моковые данные профиля
  const profile = {
    id: '1',
    username: 'techmaster',
    displayName: 'Tech Master',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=techmaster',
    cover: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=400&fit=crop',
    bio: 'Создаю контент про технологии и программирование. Стримлю, снимаю видео и делюсь полезными знаниями!',
    location: 'Москва, Россия',
    website: 'techmaster.com',
    joinedDate: 'Март 2023',
    followers: '125K',
    following: '342',
    totalViews: '5.2M',
    isVerified: true,
    stats: {
      videos: 234,
      streams: 89,
      posts: 567,
      tracks: 12
    }
  };

  // Моковые данные контента
  const content = {
    videos: [
      { id: 1, title: 'Как стать программистом за 6 месяцев', thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=250&fit=crop', views: '125K', duration: '15:23', date: '2 дня назад' },
      { id: 2, title: 'Лучшие IDE 2024 года', thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=250&fit=crop', views: '89K', duration: '12:45', date: '5 дней назад' },
      { id: 3, title: 'React vs Vue - Что выбрать?', thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=250&fit=crop', views: '156K', duration: '18:30', date: '1 неделю назад' },
    ],
    posts: [
      { id: 1, content: 'Только что закончил работу над новым курсом по Python! Скоро релиз 🚀', likes: 1245, comments: 89, date: '3 часа назад' },
      { id: 2, content: 'Какой фреймворк вы используете для фронтенда? Напишите в комментариях!', likes: 892, comments: 156, date: '1 день назад' },
    ]
  };

  const tabs = [
    { id: 'videos', label: 'Видео', icon: Video, count: profile.stats.videos },
    { id: 'streams', label: 'Стримы', icon: Radio, count: profile.stats.streams },
    { id: 'posts', label: 'Посты', icon: MessageCircle, count: profile.stats.posts },
    { id: 'music', label: 'Музыка', icon: Music, count: profile.stats.tracks },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-gradient-to-r from-blue-600 to-indigo-600 overflow-hidden">
        <img 
          src={profile.cover} 
          alt="Cover" 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        {/* Edit Cover Button (for owner) */}
        <button className="absolute top-4 right-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/30 transition-colors flex items-center gap-2">
          <Edit size={16} />
          Изменить обложку
        </button>
      </div>

      {/* Profile Info */}
      <div className="max-w-7xl mx-auto px-4 -mt-20 relative">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="relative">
              <img 
                src={profile.avatar} 
                alt={profile.displayName}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-700 shadow-xl"
                />
              {profile.isVerified && (
                <div className="absolute bottom-2 right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-700">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {profile.displayName}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">@{profile.username}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsFollowing(!isFollowing)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2 ${
                      isFollowing
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
                    }`}
                  >
                    {isFollowing ? <CheckCircle size={20} /> : <Plus size={20} />}
                    {isFollowing ? 'Подписан' : 'Подписаться'}
                  </button>
                  <button className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <Share2 size={20} className="text-gray-700 dark:text-gray-300" />
                  </button>
                  <button className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <Settings size={20} className="text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Bio */}
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                {profile.bio}
              </p>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-1">
                  <MapPin size={16} />
                  {profile.location}
                </div>
                <div className="flex items-center gap-1">
                  <ExternalLink size={16} />
                  <a href={`https://${profile.website}`} className="text-blue-600 hover:underline">
                    {profile.website}
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  Присоединился {profile.joinedDate}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Users size={16} />
                    <span className="text-xs font-medium">Подписчики</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.followers}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Users size={16} />
                    <span className="text-xs font-medium">Подписки</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.following}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Eye size={16} />
                    <span className="text-xs font-medium">Просмотры</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.totalViews}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Video size={16} />
                    <span className="text-xs font-medium">Видео</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.stats.videos}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="mt-8">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg p-2 flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={20} />
                    {tab.label}
                    <span className="text-sm opacity-75">({tab.count})</span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-400'}`}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'text-gray-400'}`}
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-lg p-6">
            {activeTab === 'videos' && (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {content.videos.map((video) => (
                  <div 
                    key={video.id}
                    className={`group cursor-pointer ${viewMode === 'list' ? 'flex gap-4' : ''}`}
                  >
                    <div className={`relative overflow-hidden rounded-xl ${viewMode === 'list' ? 'w-48' : ''}`}>
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
                        {video.duration}
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100">
                          <Video className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    <div className={viewMode === 'list' ? 'flex-1' : 'mt-3'}>
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <Eye size={14} />
                        <span>{video.views} просмотров</span>
                        <span>•</span>
                        <span>{video.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-4">
                {content.posts.map((post) => (
                  <div key={post.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6">
                    <p className="text-gray-900 dark:text-white mb-4">{post.content}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="text-red-500">❤️</span> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={16} /> {post.comments}
                      </span>
                      <span className="ml-auto">{post.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;