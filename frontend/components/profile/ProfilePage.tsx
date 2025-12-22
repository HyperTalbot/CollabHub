import React, { useEffect, useState } from 'react';
import { 
  MapPin, Calendar, ExternalLink, Users, Eye, Video, 
  MessageCircle, Music, Radio, Share2, Settings,
  CheckCircle, Plus, Grid, List, Camera, Save, X
} from 'lucide-react';
import axios from '@/lib/axiosInstance'; // Используем НАСТРОЕННЫЙ инстанс (он сам ставит токен)
import { useAuth } from '@/context/AuthContext';
import { uploadFile } from '@/services/uploadService';
import toast from 'react-hot-toast';
import { CityAutocomplete } from '@/components/ui/CityAutocomplete';

interface ProfilePageProps {
    userId?: string; 
}

// URL сервисов (без /api/v1, так как axiosInstance уже имеет baseURL, но тут мы обращаемся к разным портам)
// ВАЖНО: axiosInstance настроен на 8081 (Post). Для Auth (8080) нужно указывать полный путь.
const AUTH_API_URL = 'http://localhost:8080/api/v1';
const POST_API_URL = 'http://localhost:8081/api/v1';

const ProfilePage = ({ userId }: ProfilePageProps) => {
  const { user: currentUser } = useAuth();
  
  // STATE
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // EDIT STATE
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
      bio: '',
      location: '',
      website: ''
  });
  const [uploading, setUploading] = useState(false);

  // ЛОГИКА ОПРЕДЕЛЕНИЯ ПРОФИЛЯ
  // Если userId нет ВООБЩЕ (мы на /profile) -> это "Мой профиль".
  // Если userId есть, и он совпадает с моим username или id -> это тоже "Мой профиль".
  const isMyProfile = !userId || 
                      (currentUser && (String(currentUser.id) === userId || currentUser.username === userId));
  
  // Кого грузить?
  const fetchEndpoint = isMyProfile ? `${AUTH_API_URL}/users/me` : `${AUTH_API_URL}/users/${userId}`;
  
  // --- ЗАГРУЗКА ДАННЫХ ---
  const fetchProfileData = async () => {
      setLoading(true);
      try {
          // 1. Профиль (Auth Service 8080)
          // axiosInstance сам подставит токен из Cookies
          const endpoint = userId ? `${AUTH_API_URL}/users/${userId}` : `${AUTH_API_URL}/users/me`;
          const userRes = await axios.get(endpoint);
          
          setProfile(userRes.data);
          setEditForm({
              bio: userRes.data.bio || '',
              location: userRes.data.location || '',
              website: userRes.data.website || ''
          });

          // 2. Посты (Post Service 8081)
          // axiosInstance по дефолту стучится на 8081, можно писать просто '/posts'
          // Но для надежности укажем полный путь
          try {
              const postsRes = await axios.get(`${POST_API_URL}/posts`);
              const allPosts = postsRes.data || [];
              const userPosts = allPosts.filter((p: any) => String(p.user_id) === String(userRes.data.id));
              setPosts(userPosts);
          } catch (postErr) {
              console.warn("Posts load error:", postErr); // Не крашим профиль из-за постов
          }

      } catch (e: any) {
          console.error("Profile Error:", e);
          if (e.response?.status === 401) {
              toast.error("Сессия истекла. Пожалуйста, войдите снова.");
          } else {
              toast.error("Не удалось загрузить профиль");
          }
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchProfileData();
  }, [userId]); // Убрал currentUser из зависимостей, чтобы не дёргалось лишний раз

  // --- HANDLERS ---

  const handleSaveProfile = async () => {
      try {
          await axios.put(`${AUTH_API_URL}/users/me`, {
              bio: editForm.bio,
              location: editForm.location,
              website: editForm.website
          });
          
          toast.success("Профиль обновлен!");
          setIsEditing(false);
          fetchProfileData();
      } catch (e) {
          toast.error("Ошибка сохранения");
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
          // 1. Загрузка на Media Service (8084)
          // uploadFile использует свой axios вызов, убедитесь, что там токен берется верно
          const url = await uploadFile(file, type); // type у нас уже есть ('avatar' или 'cover')
          
          // 2. Сохранение URL в профиль
          const payload = type === 'avatar' ? { avatar_url: url } : { cover_url: url };
          await axios.put(`${AUTH_API_URL}/users/me`, payload);

          toast.success("Загружено!");
          fetchProfileData();
      } catch (error) {
          console.error(error);
          toast.error("Ошибка загрузки");
      } finally {
          setUploading(false);
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center dark:text-white"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  if (!profile) return <div className="flex h-screen items-center justify-center dark:text-white">Профиль не найден</div>;

  const tabs = [
    { id: 'posts', label: 'Посты', icon: MessageCircle, count: posts.length },
    { id: 'videos', label: 'Видео', icon: Video, count: 0 },
    { id: 'streams', label: 'Стримы', icon: Radio, count: 0 },
    { id: 'music', label: 'Музыка', icon: Music, count: 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-10">
      
      {/* HEADER / COVER */}
      <div className="relative h-64 md:h-80 bg-gray-300 dark:bg-gray-800 overflow-hidden group">
        {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
        
        {isMyProfile && (
            <label className="absolute top-4 right-4 px-4 py-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-black/70 transition-colors flex items-center gap-2 cursor-pointer">
                <Camera size={16} />
                <span>{uploading ? '...' : 'Обложка'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} disabled={uploading} />
            </label>
        )}
      </div>

      {/* INFO CARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* AVATAR */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-700 shadow-xl overflow-hidden bg-gray-200">
                  {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-4xl font-bold">
                          {profile.username?.[0]?.toUpperCase()}
                      </div>
                  )}
              </div>
              {isMyProfile && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                      <Camera size={24} />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} disabled={uploading} />
                  </label>
              )}
            </div>

            {/* DETAILS */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {profile.username}
                    {profile.role === 'admin' && <CheckCircle className="w-6 h-6 text-blue-500" name="Admin" />}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
                </div>

                {/* BUTTONS */}
                <div className="flex gap-3">
                  {isMyProfile ? (
                      isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"><Save size={18} /> Сохранить</button>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"><X size={18} /></button>
                          </div>
                      ) : (
                          <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-2 font-medium">
                              <Settings size={18} /> Редактировать
                          </button>
                      )
                  ) : (
                      <button onClick={() => setIsFollowing(!isFollowing)} className={`px-6 py-2 rounded-lg font-bold transition-all ${isFollowing ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-blue-600 text-white'}`}>
                          {isFollowing ? 'Подписан' : 'Подписаться'}
                      </button>
                  )}
                </div>
              </div>

              {/* BIO SECTION */}
              {isEditing ? (
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border dark:border-gray-700 animate-fadeIn">
                      <textarea 
                        value={editForm.bio} 
                        onChange={e => setEditForm({...editForm, bio: e.target.value})} 
                        placeholder="О себе..." 
                        className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex gap-4 flex-col md:flex-row">
                          <div className="flex-1">
                              <CityAutocomplete 
                                  value={editForm.location} 
                                  onChange={(val) => setEditForm({...editForm, location: val})} 
                              />
                          </div>
                          <input 
                            value={editForm.website} 
                            onChange={e => setEditForm({...editForm, website: e.target.value})} 
                            placeholder="Сайт (https://...)" 
                            className="flex-1 p-2 rounded border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                      </div>
                  </div>
              ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{profile.bio || "Информация о себе не указана."}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                        {profile.location && <div className="flex items-center gap-1"><MapPin size={16}/> {profile.location}</div>}
                        {profile.website && <div className="flex items-center gap-1"><ExternalLink size={16}/> <a href={profile.website} target="_blank" className="text-blue-500 hover:underline">{profile.website}</a></div>}
                        <div className="flex items-center gap-1"><Calendar size={16}/> На проекте с {new Date(profile.created_at).toLocaleDateString()}</div>
                    </div>
                  </>
              )}
            </div>
          </div>
        </div>

        {/* TABS & CONTENT */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-1 flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap flex-1 justify-center
                      ${activeTab === tab.id
                        ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <tab.icon size={18} />
                    {tab.label}
                    <span className="bg-gray-200 dark:bg-gray-600 text-xs py-0.5 px-2 rounded-full text-gray-600 dark:text-gray-300">{tab.count}</span>
                  </button>
              ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-sm border-x border-b border-gray-200 dark:border-gray-700 p-6 min-h-[300px]">
            {activeTab === 'posts' ? (
                posts.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
                        {posts.map((post) => (
                            <div key={post.id} className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 hover:shadow-md transition-shadow">
                                {post.image_url && <img src={post.image_url} alt="" className="w-full h-64 object-cover rounded-lg mb-4" />}
                                <h3 className="font-bold text-lg dark:text-white mb-2">{post.title}</h3>
                                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{post.content}</p>
                                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 border-t dark:border-gray-700 pt-3">
                                    <span className="flex items-center gap-1"><span className="text-red-500">❤️</span> {post.likes_count}</span>
                                    <span className="flex items-center gap-1 text-blue-500"><MessageCircle size={16}/> {post.comments_count}</span>
                                    <span className="ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <MessageCircle size={48} className="mb-2 opacity-20" />
                        <p>Постов пока нет</p>
                    </div>
                )
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                        {activeTab === 'videos' && <Video size={32} />}
                        {activeTab === 'music' && <Music size={32} />}
                        {activeTab === 'streams' && <Radio size={32} />}
                      </div>
                    <p className="font-medium">Раздел пуст</p>
                    <p className="text-sm opacity-70">Здесь пока ничего нет</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;