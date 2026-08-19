// frontend/components/messenger/FriendsPage.tsx
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MessageCircle, X, Check, Clock, Trash2 } from 'lucide-react';
import axiosMessenger from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import { User } from '@/types/messenger';

interface Friend {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status?: string;
}

interface FriendRequest {
  friendship_id: number;
  user_id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

interface SearchResult {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  friendship_status: 'none' | 'friends' | 'request_sent' | 'request_received';
}

interface FriendsPageProps {
  currentUser: User | null;
  onStartChat: (userId: number) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({ currentUser, onStartChat }) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'friends') {
      loadFriends();
    } else if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data } = await axiosMessenger.get('/friends');
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
      toast.error('Не удалось загрузить друзей');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data } = await axiosMessenger.get('/friends/requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
        toast.error('Минимум 2 символа');
        return;
    }

    setLoading(true);
    try {
        const { data } = await axiosMessenger.get(`/users/search?q=${searchQuery}`);
        
        // ИСПРАВЛЕНО: проверяем структуру ответа
        console.log('Search response:', data);
        
        setSearchResults(data.results || []);
    } catch (error) {
        console.error('Search error:', error);
        toast.error('Ошибка поиска');
    } finally {
        setLoading(false);
    }
};

  const sendFriendRequest = async (userId: number) => {
    try {
      await axiosMessenger.post('/friends/request', { friend_id: userId });
      toast.success('Запрос отправлен');
      handleSearch(); // Обновляем результаты
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка отправки запроса');
    }
  };

  const acceptRequest = async (friendshipId: number) => {
    try {
      await axiosMessenger.post(`/friends/accept/${friendshipId}`);
      toast.success('Запрос принят');
      loadRequests();
      loadFriends();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const rejectRequest = async (friendshipId: number) => {
    try {
      await axiosMessenger.post(`/friends/reject/${friendshipId}`);
      toast.success('Запрос отклонён');
      loadRequests();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const removeFriend = async (friendId: number) => {
    try {
      await axiosMessenger.delete(`/friends/${friendId}`);
      toast.success('Друг удалён');
      loadFriends();
    } catch (error) {
      toast.error('Ошибка');
    }
  };

  const handleUserClick = (userId: number) => {
    onStartChat(userId);
  };

  const getInitials = (name: string) => name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Табы */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'friends'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Друзья ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'requests'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Запросы
          {requests.length > 0 && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Поиск
        </button>
      </div>

      {/* Поиск */}
      {activeTab === 'search' && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по username..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Search size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Список друзей */}
            {activeTab === 'friends' && (
              <div className="p-4 space-y-2">
                {friends.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="mb-4">У вас пока нет друзей</p>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Найти друзей
                    </button>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <div
                        onClick={() => handleUserClick(friend.id)}
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
                            {friend.avatar_url ? (
                              <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(friend.username)}</span>
                            )}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                            friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {friend.display_name || friend.username}
                          </p>
                          {friend.display_name && (
                            <p className="text-sm text-gray-500 truncate">@{friend.username}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleUserClick(friend.id)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Написать сообщение"
                        >
                          <MessageCircle size={20} />
                        </button>
                        <button
                          onClick={() => removeFriend(friend.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Удалить из друзей"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Запросы в друзья */}
            {activeTab === 'requests' && (
              <div className="p-4 space-y-2">
                {requests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Нет входящих запросов
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.friendship_id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
                        {request.avatar_url ? (
                          <img src={request.avatar_url} alt={request.username} className="w-full h-full object-cover" />
                        ) : (
                          <span>{getInitials(request.username)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {request.display_name || request.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => acceptRequest(request.friendship_id)}
                          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          title="Принять"
                        >
                          <Check size={20} />
                        </button>
                        <button
                          onClick={() => rejectRequest(request.friendship_id)}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          title="Отклонить"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Результаты поиска */}
            {activeTab === 'search' && (
              <div className="p-4 space-y-2">
                {searchResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchQuery ? 'Ничего не найдено' : 'Введите запрос для поиска'}
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <div
                        onClick={() => handleUserClick(result.id)}
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
                          {result.avatar_url ? (
                            <img src={result.avatar_url} alt={result.username} className="w-full h-full object-cover" />
                          ) : (
                            <span>{getInitials(result.username)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {result.display_name || result.username}
                          </p>
                          {result.display_name && (
                            <p className="text-sm text-gray-500 truncate">@{result.username}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        {result.friendship_status === 'none' && (
                          <button
                            onClick={() => sendFriendRequest(result.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <UserPlus size={18} />
                            <span className="text-sm font-medium">Добавить</span>
                          </button>
                        )}
                        {result.friendship_status === 'friends' && (
                          <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium">
                            ✓ Друзья
                          </span>
                        )}
                        {result.friendship_status === 'request_sent' && (
                          <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium">
                            <Clock size={18} />
                            Запрос отправлен
                          </span>
                        )}
                        {result.friendship_status === 'request_received' && (
                          <button
                            onClick={() => setActiveTab('requests')}
                            className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            Ответить на запрос
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
