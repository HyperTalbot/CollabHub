// frontend/components/profile/ProfilePage.tsx
import React, { useEffect, useState } from 'react';
import { 
  MapPin, Calendar, ExternalLink, Users, Eye, Video, 
  MessageCircle, Music, Radio, Share2, Settings,
  CheckCircle, Plus, Grid, List, Camera, Save, X,
  ChevronDown, ChevronUp, Home, PlaySquare, Layers
} from 'lucide-react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { uploadFile } from '@/services/uploadService';
import toast from 'react-hot-toast';
import { CityAutocomplete } from '@/components/ui/CityAutocomplete';

interface ProfilePageProps {
    userId?: string; 
}
// process.env.NEXT_PUBLIC_POSTS_API_URL
const AUTH_API_URL = 'http://localhost:8080/api/v1';
const POST_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts';
const VIDEO_API_URL = 'https://collabhub.cloudpub.ru/api/v1/video';
const MUSIC_API_URL = 'https://collabhub.cloudpub.ru/api/v1/music';

const ProfilePage = ({ userId }: ProfilePageProps) => {
  const { user: currentUser } = useAuth();
	const router = useRouter();
  
  // STATE
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [videoPlaylists, setVideoPlaylists] = useState<any[]>([]);
  const [musicPlaylists, setMusicPlaylists] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'feed'>('compact');

  // Expanded sections for compact mode
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    posts: false,
    videos: false,
    music: false,
  });

  // EDIT STATE
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
      bio: '',
      location: '',
      website: ''
  });
  const [uploading, setUploading] = useState(false);

  const isMyProfile = !userId || 
                      (currentUser && (String(currentUser.id) === userId || currentUser.username === userId));
  
  // --- ЗАГРУЗКА ДАННЫХ ---
  const fetchProfileData = async () => {
      setLoading(true);
      try {
          const endpoint = userId ? `${AUTH_API_URL}/users/${userId}` : `${AUTH_API_URL}/users/me`;
          const userRes = await axios.get(endpoint);
          
          setProfile(userRes.data);
          setEditForm({
              bio: userRes.data.bio || '',
              location: userRes.data.location || '',
              website: userRes.data.website || ''
          });

          // Загружаем весь контент параллельно
          await Promise.all([
            loadPosts(userRes.data.id),
            loadVideos(userRes.data.id),
            loadMusic(userRes.data.id),
            loadVideoPlaylists(userRes.data.id),
            loadMusicPlaylists(userRes.data.id),
          ]);

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

  const loadPosts = async (profileUserId: number) => {
    try {
      const postsRes = await axios.get(`${POST_API_URL}/`);
      const allPosts = postsRes.data || [];
      const userPosts = allPosts.filter((p: any) => String(p.user_id) === String(profileUserId));
      setPosts(userPosts);
    } catch (error) {
      console.warn("Posts load error:", error);
    }
  };

  const loadVideos = async (profileUserId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${VIDEO_API_URL}/videos`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const data = await response.json();
      const userVideos = (data || []).filter((v: any) => v.user_id === profileUserId);
      setVideos(userVideos);
    } catch (error) {
      console.warn("Videos load error:", error);
    }
  };

  const loadMusic = async (profileUserId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${MUSIC_API_URL}/tracks`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const data = await response.json();
      const userTracks = (data || []).filter((t: any) => t.user_id === profileUserId);
      setTracks(userTracks);
    } catch (error) {
      console.warn("Music load error:", error);
    }
  };

  const loadVideoPlaylists = async (profileUserId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${VIDEO_API_URL}/playlists/public`);
      const data = await response.json();
      const userPlaylists = (data || []).filter((p: any) => p.user_id === profileUserId && p.is_public);
      setVideoPlaylists(userPlaylists);
    } catch (error) {
      console.warn("Video playlists load error:", error);
    }
  };

  const loadMusicPlaylists = async (profileUserId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${MUSIC_API_URL}/playlists/public`);
      const data = await response.json();
      const userPlaylists = (data || []).filter((p: any) => p.user_id === profileUserId && p.is_public);
      setMusicPlaylists(userPlaylists);
    } catch (error) {
      console.warn("Music playlists load error:", error);
    }
  };

  useEffect(() => {
      fetchProfileData();
  }, [userId]);

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
          const url = await uploadFile(file, type);
          
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

	const navigateToPost = (postId: number) => {
    router.push(`/post/${postId}`);
  };

  const navigateToVideo = (videoId: number) => {
    router.push(`/doubleyou/watch/${videoId}`);
  };

  const navigateToTrack = (trackId: number) => {
    router.push(`/symphonya/track/${trackId}`);
  };

  const navigateToVideoPlaylist = (playlistId: number) => {
    router.push(`/doubleyou/playlist/${playlistId}`);
  };

  const navigateToMusicPlaylist = (playlistId: number) => {
    router.push(`/symphonya/playlist/${playlistId}`);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) return <div className="flex h-screen items-center justify-center dark:text-white"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div></div>;
  if (!profile) return <div className="flex h-screen items-center justify-center dark:text-white">Профиль не найден</div>;

	const tabs = [
		{ id: 'home', label: 'Главная', icon: Home, count: posts.length + videos.length + tracks.length },
		{ id: 'videos', label: 'Видео', icon: Video, count: videos.length }, 
		{ id: 'streams', label: 'Стримы', icon: Radio, count: 0 }, 
		{ id: 'posts', label: 'Посты', icon: MessageCircle, count: posts.length }, 
		{ id: 'music', label: 'Музыка', icon: Music, count: tracks.length }, 
		{ id: 'playlists', label: 'Плейлисты', icon: Layers, count: videoPlaylists.length + musicPlaylists.length },
	];

  // Объединенный контент для ленты
  const allContent = [
    ...videos.map(v => ({ ...v, type: 'video', date: new Date(v.created_at) })),
    ...posts.map(p => ({ ...p, type: 'post', date: new Date(p.created_at) })),
    ...tracks.map(t => ({ ...t, type: 'music', date: new Date(t.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-10">
      
      {/* HEADER / COVER */}
      <div className="relative h-64 md:h-80 bg-gray-300 dark:bg-gray-800 overflow-hidden group">
        {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-emerald-600"></div>
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
                    {profile.role === 'admin' && <CheckCircle className="w-6 h-6 text-blue-500" />}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
                </div>

                {/* BUTTONS */}
                <div className="flex gap-3">
                  {isMyProfile ? (
                      isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"><Save size={18} /> Сохранить</button>
                            <button onClick={() => setIsEditing(false)} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"><X size={18} /></button>
                          </div>
                      ) : (
                          <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-2 font-medium">
                              <Settings size={18} /> Редактировать
                          </button>
                      )
                  ) : (
                      <button onClick={() => setIsFollowing(!isFollowing)} className={`px-6 py-2 rounded-lg font-bold transition-all ${isFollowing ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
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
            
            {/* HOME TAB */}
						{activeTab === 'home' && (
							<div>
								{/* View Mode Toggle */}
								<div className="flex justify-end mb-4">
									<div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
										<button
											onClick={() => setViewMode('compact')}
											className={`px-4 py-2 rounded-l-lg transition ${viewMode === 'compact' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}
										>
											Компактный
										</button>
										<button
											onClick={() => setViewMode('feed')}
											className={`px-4 py-2 rounded-r-lg transition ${viewMode === 'feed' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}
										>
											Лента
										</button>
									</div>
								</div>

								{viewMode === 'compact' ? (
									<div className="space-y-8">
										{/* Videos Section */}
										{videos.length > 0 && (
											<div>
												<div className="flex items-center justify-between mb-4">
													<h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
														<Video size={20} />
														Видео
													</h3>
													{videos.length > 5 && (
														<button
															onClick={() => toggleSection('videos')}
															className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
														>
															{expandedSections.videos ? (
																<>Скрыть <ChevronUp size={18} /></>
															) : (
																<>Показать еще <ChevronDown size={18} /></>
															)}
														</button>
													)}
												</div>
												<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
													{videos.slice(0, expandedSections.videos ? videos.length : 5).map((video) => (
														<div 
															key={video.id} 
															onClick={() => navigateToVideo(video.id)}
															className="cursor-pointer group"
														>
															<div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
																{video.thumbnail_url && <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition" />}
															</div>
															<h4 className="text-sm font-medium dark:text-white line-clamp-2">{video.title}</h4>
														</div>
													))}
												</div>
											</div>
										)}

										{/* Posts Section */}
										{posts.length > 0 && (
											<div>
												<div className="flex items-center justify-between mb-4">
													<h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
														<MessageCircle size={20} />
														Посты
													</h3>
													{posts.length > 5 && (
														<button
															onClick={() => toggleSection('posts')}
															className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
														>
															{expandedSections.posts ? (
																<>Скрыть <ChevronUp size={18} /></>
															) : (
																<>Показать еще <ChevronDown size={18} /></>
															)}
														</button>
													)}
												</div>
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
													{posts.slice(0, expandedSections.posts ? posts.length : 5).map((post) => (
														<div 
															key={post.id} 
															onClick={() => navigateToPost(post.id)}
															className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
														>
															{post.image_url && <img src={post.image_url} alt="" className="w-full h-48 object-cover rounded-lg mb-3" />}
															<h4 className="font-bold text-sm dark:text-white mb-2 line-clamp-2">{post.title}</h4>
															<p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">{post.content}</p>
														</div>
													))}
												</div>
											</div>
										)}

										{/* Music Section */}
										{tracks.length > 0 && (
											<div>
												<div className="flex items-center justify-between mb-4">
													<h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
														<Music size={20} />
														Музыка
													</h3>
													{tracks.length > 5 && (
														<button
															onClick={() => toggleSection('music')}
															className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
														>
															{expandedSections.music ? (
																<>Скрыть <ChevronUp size={18} /></>
															) : (
																<>Показать еще <ChevronDown size={18} /></>
															)}
														</button>
													)}
												</div>
												<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
													{tracks.slice(0, expandedSections.music ? tracks.length : 5).map((track) => (
														<div 
															key={track.id} 
															onClick={() => navigateToTrack(track.id)}
															className="cursor-pointer group"
														>
															<div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
																{track.cover_url && <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition" />}
															</div>
															<h4 className="text-sm font-medium dark:text-white line-clamp-1">{track.title}</h4>
															<p className="text-xs text-gray-500">{track.artist}</p>
														</div>
													))}
												</div>
											</div>
										)}

										{/* Playlists Section - ДОБАВЛЕНО */}
										{(videoPlaylists.length > 0 || musicPlaylists.length > 0) && (
											<div>
												<h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
													<Layers size={20} />
													Плейлисты
												</h3>
												
												<div className="space-y-6">
													{/* Video Playlists */}
													{videoPlaylists.length > 0 && (
														<div>
															<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Видео</h4>
															<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
																{videoPlaylists.map((playlist) => (
																	<div 
																		key={playlist.id} 
																		onClick={() => navigateToVideoPlaylist(playlist.id)}
																		className="cursor-pointer group"
																	>
																		<div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-emerald-600 mb-2">
																			{playlist.thumbnail_url && <img src={playlist.thumbnail_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
																		</div>
																		<h4 className="text-sm font-medium dark:text-white line-clamp-2">{playlist.name}</h4>
																	</div>
																))}
															</div>
														</div>
													)}

													{/* Music Playlists */}
													{musicPlaylists.length > 0 && (
														<div>
															<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Музыка</h4>
															<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
																{musicPlaylists.map((playlist) => (
																	<div 
																		key={playlist.id} 
																		onClick={() => navigateToMusicPlaylist(playlist.id)}
																		className="cursor-pointer group"
																	>
																		<div className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 mb-2">
																			{playlist.cover_url && <img src={playlist.cover_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
																		</div>
																		<h4 className="text-sm font-medium dark:text-white line-clamp-1">{playlist.name}</h4>
																	</div>
																))}
															</div>
														</div>
													)}
												</div>
											</div>
										)}

										{allContent.length === 0 && (
											<div className="text-center py-12 text-gray-500">
												<Home size={48} className="mx-auto mb-2 opacity-20" />
												<p>Контент пока не опубликован</p>
											</div>
										)}
									</div>
								) : (
									/* FEED VIEW */
									<div className="space-y-6">
										<div className="space-y-4">
											{allContent.length > 0 ? (
												allContent.map((item, index) => (
													<div 
														key={`${item.type}-${item.id}-${index}`} 
														onClick={() => {
															if (item.type === 'post') navigateToPost(item.id);
															if (item.type === 'video') navigateToVideo(item.id);
															if (item.type === 'music') navigateToTrack(item.id);
														}}
														className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
													>
														<div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
															{item.type === 'post' && <MessageCircle size={16} />}
															{item.type === 'video' && <Video size={16} />}
															{item.type === 'music' && <Music size={16} />}
															<span className="capitalize">{item.type === 'post' ? 'Пост' : item.type === 'video' ? 'Видео' : 'Музыка'}</span>
															<span>•</span>
															<span>{item.date.toLocaleDateString('ru-RU')}</span>
														</div>
														
														{item.type === 'post' && (
															<>
																{item.image_url && <img src={item.image_url} alt="" className="w-full h-64 object-cover rounded-lg mb-4" />}
																<h3 className="font-bold text-lg dark:text-white mb-2">{item.title}</h3>
																<p className="text-gray-600 dark:text-gray-300">{item.content}</p>
															</>
														)}
														
														{item.type === 'video' && (
															<div className="flex gap-4">
																<div className="w-48 aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
																	{item.thumbnail_url && <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />}
																</div>
																<div>
																	<h3 className="font-bold dark:text-white mb-2">{item.title}</h3>
																	<p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>
																</div>
															</div>
														)}
														
														{item.type === 'music' && (
															<div className="flex gap-4">
																<div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
																	{item.cover_url && <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />}
																</div>
																<div>
																	<h3 className="font-bold dark:text-white">{item.title}</h3>
																	<p className="text-sm text-gray-600 dark:text-gray-300">{item.artist}</p>
																</div>
															</div>
														)}
													</div>
												))
											) : (
												<div className="text-center py-12 text-gray-500">
													<List size={48} className="mx-auto mb-2 opacity-20" />
													<p>Лента пуста</p>
												</div>
											)}
										</div>

										{/* Playlists в Feed mode - ДОБАВЛЕНО */}
										{(videoPlaylists.length > 0 || musicPlaylists.length > 0) && (
											<div className="border-t dark:border-gray-700 pt-6">
												<h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
													<Layers size={20} />
													Плейлисты
												</h3>
												
												{videoPlaylists.length > 0 && (
													<div className="mb-6">
														<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Видео</h4>
														<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
															{videoPlaylists.map((playlist) => (
																<div 
																	key={playlist.id} 
																	onClick={() => navigateToVideoPlaylist(playlist.id)}
																	className="cursor-pointer group"
																>
																	<div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-emerald-600 mb-2">
																		{playlist.thumbnail_url && <img src={playlist.thumbnail_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
																	</div>
																	<h4 className="text-sm font-medium dark:text-white line-clamp-2">{playlist.name}</h4>
																</div>
															))}
														</div>
													</div>
												)}

												{musicPlaylists.length > 0 && (
													<div>
														<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Музыка</h4>
														<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
															{musicPlaylists.map((playlist) => (
																<div 
																	key={playlist.id} 
																	onClick={() => navigateToMusicPlaylist(playlist.id)}
																	className="cursor-pointer group"
																>
																	<div className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 mb-2">
																		{playlist.cover_url && <img src={playlist.cover_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
																	</div>
																	<h4 className="text-sm font-medium dark:text-white line-clamp-1">{playlist.name}</h4>
																</div>
															))}
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{/* Остальные вкладки тоже добавьте onClick */}
						{activeTab === 'videos' && (
								videos.length > 0 ? (
										<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
												{videos.map((video) => (
														<div 
															key={video.id} 
															onClick={() => navigateToVideo(video.id)}
															className="cursor-pointer group"
														>
															<div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
																{video.thumbnail_url && <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition" />}
															</div>
															<h4 className="text-sm font-medium dark:text-white line-clamp-2">{video.title}</h4>
															<p className="text-xs text-gray-500">{video.view_count} просмотров</p>
														</div>
												))}
										</div>
								) : (
										<div className="flex flex-col items-center justify-center h-64 text-gray-400">
												<Video size={48} className="mb-2 opacity-20" />
												<p>Видео пока нет</p>
										</div>
								)
						)}

							{activeTab === 'posts' && (
								posts.length > 0 ? (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												{posts.map((post) => (
														<div 
															key={post.id} 
															onClick={() => navigateToPost(post.id)}
															className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
														>
																{post.image_url && <img src={post.image_url} alt="" className="w-full h-64 object-cover rounded-lg mb-4" />}
																<h3 className="font-bold text-lg dark:text-white mb-2">{post.title}</h3>
																<p className="text-gray-600 dark:text-gray-300 leading-relaxed">{post.content}</p>
																<div className="mt-4 flex items-center gap-4 text-sm text-gray-500 border-t dark:border-gray-700 pt-3">
																		<span className="flex items-center gap-1"><span className="text-red-500">❤️ </span> {post.likes_count}</span>
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
						)}

						{activeTab === 'music' && (
								tracks.length > 0 ? (
										<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
												{tracks.map((track) => (
														<div 
															key={track.id} 
															onClick={() => navigateToTrack(track.id)}
															className="cursor-pointer group"
														>
															<div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
																{track.cover_url && <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition" />}
															</div>
															<h4 className="text-sm font-medium dark:text-white line-clamp-1">{track.title}</h4>
															<p className="text-xs text-gray-500">{track.artist}</p>
														</div>
												))}
										</div>
								) : (
										<div className="flex flex-col items-center justify-center h-64 text-gray-400">
												<Music size={48} className="mb-2 opacity-20" />
												<p>Музыки пока нет</p>
										</div>
								)
						)}

						{activeTab === 'playlists' && (
								<div className="space-y-8">
									{videoPlaylists.length > 0 && (
										<div>
											<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
												<PlaySquare size={20} />
												Плейлисты видео
											</h3>
											<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
												{videoPlaylists.map((playlist) => (
													<div 
														key={playlist.id} 
														onClick={() => navigateToVideoPlaylist(playlist.id)}
														className="cursor-pointer group"
													>
														<div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-emerald-600 mb-2">
															{playlist.thumbnail_url && <img src={playlist.thumbnail_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
														</div>
														<h4 className="text-sm font-medium dark:text-white line-clamp-2">{playlist.name}</h4>
													</div>
												))}
											</div>
										</div>
									)}

									{musicPlaylists.length > 0 && (
										<div>
											<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
												<Music size={20} />
												Плейлисты музыки
											</h3>
											<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
												{musicPlaylists.map((playlist) => (
													<div 
														key={playlist.id} 
														onClick={() => navigateToMusicPlaylist(playlist.id)}
														className="cursor-pointer group"
													>
														<div className="relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 mb-2">
															{playlist.cover_url && <img src={playlist.cover_url} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
														</div>
														<h4 className="text-sm font-medium dark:text-white line-clamp-1">{playlist.name}</h4>
													</div>
												))}
											</div>
										</div>
									)}

									{videoPlaylists.length === 0 && musicPlaylists.length === 0 && (
										<div className="flex flex-col items-center justify-center h-64 text-gray-400">
											<Layers size={48} className="mb-2 opacity-20" />
											<p>Плейлистов пока нет</p>
										</div>
									)}
								</div>
						)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;




// import React, { useEffect, useState } from 'react';
// import { 
//   MapPin, Calendar, ExternalLink, Users, Eye, Video, 
//   MessageCircle, Music, Radio, Share2, Settings,
//   CheckCircle, Plus, Grid, List, Camera, Save, X
// } from 'lucide-react';
// import axios from '@/lib/axiosInstance'; // Используем НАСТРОЕННЫЙ инстанс (он сам ставит токен)
// import { useAuth } from '@/context/AuthContext';
// import { uploadFile } from '@/services/uploadService';
// import toast from 'react-hot-toast';
// import { CityAutocomplete } from '@/components/ui/CityAutocomplete';

// interface ProfilePageProps {
//     userId?: string; 
// }

// // URL сервисов (без /api/v1, так как axiosInstance уже имеет baseURL, но тут мы обращаемся к разным портам)
// // ВАЖНО: axiosInstance настроен на 8084 (Post). Для Auth (8080) нужно указывать полный путь.
// const AUTH_API_URL = 'http://localhost:8080/api/v1';
// // const POST_API_URL = 'http://localhost:8084/api/v1';
// // const POST_API_URL = 'https://collabhub.cloudpub.ru/api/v1';
// const POST_API_URL = process.env.NEXT_PUBLIC_POSTS_API_URL;

// const ProfilePage = ({ userId }: ProfilePageProps) => {
//   const { user: currentUser } = useAuth();
  
//   // STATE
//   const [profile, setProfile] = useState<any>(null);
//   const [posts, setPosts] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [activeTab, setActiveTab] = useState('posts');
//   const [isFollowing, setIsFollowing] = useState(false);
//   const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

//   // EDIT STATE
//   const [isEditing, setIsEditing] = useState(false);
//   const [editForm, setEditForm] = useState({
//       bio: '',
//       location: '',
//       website: ''
//   });
//   const [uploading, setUploading] = useState(false);

//   // ЛОГИКА ОПРЕДЕЛЕНИЯ ПРОФИЛЯ
//   // Если userId нет ВООБЩЕ (мы на /profile) -> это "Мой профиль".
//   // Если userId есть, и он совпадает с моим username или id -> это тоже "Мой профиль".
//   const isMyProfile = !userId || 
//                       (currentUser && (String(currentUser.id) === userId || currentUser.username === userId));
  
//   // Кого грузить?
//   const fetchEndpoint = isMyProfile ? `${AUTH_API_URL}/users/me` : `${AUTH_API_URL}/users/${userId}`;
  
//   // --- ЗАГРУЗКА ДАННЫХ ---
//   const fetchProfileData = async () => {
//       setLoading(true);
//       try {
//           // 1. Профиль (Auth Service 8080)
//           // axiosInstance сам подставит токен из Cookies
//           const endpoint = userId ? `${AUTH_API_URL}/users/${userId}` : `${AUTH_API_URL}/users/me`;
//           const userRes = await axios.get(endpoint);
          
//           setProfile(userRes.data);
//           setEditForm({
//               bio: userRes.data.bio || '',
//               location: userRes.data.location || '',
//               website: userRes.data.website || ''
//           });

//           // 2. Посты (Post Service 8084)
//           // axiosInstance по дефолту стучится на 8084, можно писать просто '/posts'
//           // Но для надежности укажем полный путь
//           try {
//               const postsRes = await axios.get(`${POST_API_URL}/posts`);
//               const allPosts = postsRes.data || [];
//               const userPosts = allPosts.filter((p: any) => String(p.user_id) === String(userRes.data.id));
//               setPosts(userPosts);
//           } catch (postErr) {
//               console.warn("Posts load error:", postErr); // Не крашим профиль из-за постов
//           }

//       } catch (e: any) {
//           console.error("Profile Error:", e);
//           if (e.response?.status === 401) {
//               toast.error("Сессия истекла. Пожалуйста, войдите снова.");
//           } else {
//               toast.error("Не удалось загрузить профиль");
//           }
//       } finally {
//           setLoading(false);
//       }
//   };

//   useEffect(() => {
//       fetchProfileData();
//   }, [userId]); // Убрал currentUser из зависимостей, чтобы не дёргалось лишний раз

//   // --- HANDLERS ---

//   const handleSaveProfile = async () => {
//       try {
//           await axios.put(`${AUTH_API_URL}/users/me`, {
//               bio: editForm.bio,
//               location: editForm.location,
//               website: editForm.website
//           });
          
//           toast.success("Профиль обновлен!");
//           setIsEditing(false);
//           fetchProfileData();
//       } catch (e) {
//           toast.error("Ошибка сохранения");
//       }
//   };

//   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
//       const file = e.target.files?.[0];
//       if (!file) return;
//       setUploading(true);
//       try {
//           // 1. Загрузка на Media Service (8084)
//           // uploadFile использует свой axios вызов, убедитесь, что там токен берется верно
//           const url = await uploadFile(file, type); // type у нас уже есть ('avatar' или 'cover')
          
//           // 2. Сохранение URL в профиль
//           const payload = type === 'avatar' ? { avatar_url: url } : { cover_url: url };
//           await axios.put(`${AUTH_API_URL}/users/me`, payload);

//           toast.success("Загружено!");
//           fetchProfileData();
//       } catch (error) {
//           console.error(error);
//           toast.error("Ошибка загрузки");
//       } finally {
//           setUploading(false);
//       }
//   };

//   if (loading) return <div className="flex h-screen items-center justify-center dark:text-white"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
//   if (!profile) return <div className="flex h-screen items-center justify-center dark:text-white">Профиль не найден</div>;

//   const tabs = [
//     { id: 'posts', label: 'Посты', icon: MessageCircle, count: posts.length },
//     { id: 'videos', label: 'Видео', icon: Video, count: 0 },
//     { id: 'streams', label: 'Стримы', icon: Radio, count: 0 },
//     { id: 'music', label: 'Музыка', icon: Music, count: 0 },
//   ];

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-10">
      
//       {/* HEADER / COVER */}
//       <div className="relative h-64 md:h-80 bg-gray-300 dark:bg-gray-800 overflow-hidden group">
//         {profile.cover_url ? (
//             <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
//         ) : (
//             <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-600"></div>
//         )}
//         <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
        
//         {isMyProfile && (
//             <label className="absolute top-4 right-4 px-4 py-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-black/70 transition-colors flex items-center gap-2 cursor-pointer">
//                 <Camera size={16} />
//                 <span>{uploading ? '...' : 'Обложка'}</span>
//                 <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} disabled={uploading} />
//             </label>
//         )}
//       </div>

//       {/* INFO CARD */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
//         <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
//           <div className="flex flex-col md:flex-row gap-6">
            
//             {/* AVATAR */}
//             <div className="relative group">
//               <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-700 shadow-xl overflow-hidden bg-gray-200">
//                   {profile.avatar_url ? (
//                       <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
//                   ) : (
//                       <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-4xl font-bold">
//                           {profile.username?.[0]?.toUpperCase()}
//                       </div>
//                   )}
//               </div>
//               {isMyProfile && (
//                   <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
//                       <Camera size={24} />
//                       <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} disabled={uploading} />
//                   </label>
//               )}
//             </div>

//             {/* DETAILS */}
//             <div className="flex-1">
//               <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
//                 <div>
//                   <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
//                     {profile.username}
//                     {profile.role === 'admin' && <CheckCircle className="w-6 h-6 text-blue-500" name="Admin" />}
//                   </h1>
//                   <p className="text-gray-500 dark:text-gray-400">@{profile.username}</p>
//                 </div>

//                 {/* BUTTONS */}
//                 <div className="flex gap-3">
//                   {isMyProfile ? (
//                       isEditing ? (
//                           <div className="flex gap-2">
//                             <button onClick={handleSaveProfile} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"><Save size={18} /> Сохранить</button>
//                             <button onClick={() => setIsEditing(false)} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300"><X size={18} /></button>
//                           </div>
//                       ) : (
//                           <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-2 font-medium">
//                               <Settings size={18} /> Редактировать
//                           </button>
//                       )
//                   ) : (
//                       <button onClick={() => setIsFollowing(!isFollowing)} className={`px-6 py-2 rounded-lg font-bold transition-all ${isFollowing ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-blue-600 text-white'}`}>
//                           {isFollowing ? 'Подписан' : 'Подписаться'}
//                       </button>
//                   )}
//                 </div>
//               </div>

//               {/* BIO SECTION */}
//               {isEditing ? (
//                   <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border dark:border-gray-700 animate-fadeIn">
//                       <textarea 
//                         value={editForm.bio} 
//                         onChange={e => setEditForm({...editForm, bio: e.target.value})} 
//                         placeholder="О себе..." 
//                         className="w-full p-2 rounded border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
//                       />
//                       <div className="flex gap-4 flex-col md:flex-row">
//                           <div className="flex-1">
//                               <CityAutocomplete 
//                                   value={editForm.location} 
//                                   onChange={(val) => setEditForm({...editForm, location: val})} 
//                               />
//                           </div>
//                           <input 
//                             value={editForm.website} 
//                             onChange={e => setEditForm({...editForm, website: e.target.value})} 
//                             placeholder="Сайт (https://...)" 
//                             className="flex-1 p-2 rounded border dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
//                           />
//                       </div>
//                   </div>
//               ) : (
//                   <>
//                     <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{profile.bio || "Информация о себе не указана."}</p>
//                     <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
//                         {profile.location && <div className="flex items-center gap-1"><MapPin size={16}/> {profile.location}</div>}
//                         {profile.website && <div className="flex items-center gap-1"><ExternalLink size={16}/> <a href={profile.website} target="_blank" className="text-blue-500 hover:underline">{profile.website}</a></div>}
//                         <div className="flex items-center gap-1"><Calendar size={16}/> На проекте с {new Date(profile.created_at).toLocaleDateString()}</div>
//                     </div>
//                   </>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* TABS & CONTENT */}
//         <div className="mt-8">
//           <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-1 flex overflow-x-auto">
//               {tabs.map((tab) => (
//                 <button
//                     key={tab.id}
//                     onClick={() => setActiveTab(tab.id)}
//                     className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap flex-1 justify-center
//                       ${activeTab === tab.id
//                         ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400'
//                         : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
//                     }`}
//                   >
//                     <tab.icon size={18} />
//                     {tab.label}
//                     <span className="bg-gray-200 dark:bg-gray-600 text-xs py-0.5 px-2 rounded-full text-gray-600 dark:text-gray-300">{tab.count}</span>
//                   </button>
//               ))}
//           </div>

//           <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-sm border-x border-b border-gray-200 dark:border-gray-700 p-6 min-h-[300px]">
//             {activeTab === 'posts' ? (
//                 posts.length > 0 ? (
//                     <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
//                         {posts.map((post) => (
//                             <div key={post.id} className="p-5 rounded-xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 hover:shadow-md transition-shadow">
//                                 {post.image_url && <img src={post.image_url} alt="" className="w-full h-64 object-cover rounded-lg mb-4" />}
//                                 <h3 className="font-bold text-lg dark:text-white mb-2">{post.title}</h3>
//                                 <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{post.content}</p>
//                                 <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 border-t dark:border-gray-700 pt-3">
//                                     <span className="flex items-center gap-1"><span className="text-red-500">❤️</span> {post.likes_count}</span>
//                                     <span className="flex items-center gap-1 text-blue-500"><MessageCircle size={16}/> {post.comments_count}</span>
//                                     <span className="ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 ) : (
//                     <div className="flex flex-col items-center justify-center h-40 text-gray-400">
//                         <MessageCircle size={48} className="mb-2 opacity-20" />
//                         <p>Постов пока нет</p>
//                     </div>
//                 )
//             ) : (
//                 <div className="flex flex-col items-center justify-center h-64 text-gray-400">
//                     <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
//                         {activeTab === 'videos' && <Video size={32} />}
//                         {activeTab === 'music' && <Music size={32} />}
//                         {activeTab === 'streams' && <Radio size={32} />}
//                       </div>
//                     <p className="font-medium">Раздел пуст</p>
//                     <p className="text-sm opacity-70">Здесь пока ничего нет</p>
//                 </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ProfilePage;