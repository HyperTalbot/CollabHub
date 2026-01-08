// components/messenger/ServerPage.tsx
import React, { useState, useEffect } from 'react';
import { Hash, Volume2, Settings, UserPlus, ChevronDown, Lock, Plus, Users as UsersIcon } from 'lucide-react';
import axios from '@/lib/axiosInstance';
import Cookies from 'js-cookie';
import { User } from '@/types/messenger';
import { VoiceChannel } from './VoiceChannel';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  server_id: number;
  is_private?: boolean;
}

interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

interface ServerMember {
  id: number;
  username: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'idle' | 'dnd';
  role?: string;
}

interface ServerPageProps {
  serverId: number;
  serverName: string;
  currentUser: User | null;
  onClose?: () => void;
}

const MESSENGER_API_URL = 'http://localhost:8086/api/v1';

export const ServerPage: React.FC<ServerPageProps> = ({ 
  serverId, 
  serverName, 
  onClose, 
  currentUser, 
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showMembersList, setShowMembersList] = useState(true);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // НОВОЕ: Состояние для голосового канала
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<number | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      try {
        const res = await axios.get(`${MESSENGER_API_URL}/servers/${serverId}/channels`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const channels: Channel[] = res.data || [];
        const textChannels = channels.filter(c => c.type === 'text');
        const voiceChannels = channels.filter(c => c.type === 'voice');
        
        setCategories([
          {
            id: 'text',
            name: 'ТЕКСТОВЫЕ КАНАЛЫ',
            channels: textChannels
          },
          {
            id: 'voice',
            name: 'ГОЛОСОВЫЕ КАНАЛЫ',
            channels: voiceChannels
          }
        ]);

        if (textChannels.length > 0) {
          setSelectedChannelId(textChannels[0].id);
          setSelectedChannel(textChannels[0]);
        }
      } catch (err) {
        console.error('Failed to load channels', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [serverId]);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      try {
        const res = await axios.get(`${MESSENGER_API_URL}/servers/${serverId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setMembers(res.data || []);
      } catch (err) {
        console.error('Failed to load members', err);
        setMembers([
          { 
            id: currentUser?.id || 1, 
            username: currentUser?.username || 'Вы', 
            avatar_url: currentUser?.avatar_url,
            status: 'online',
            role: 'owner'
          }
        ]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [serverId, currentUser]);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleChannelSelect = (channel: Channel) => {
    if (channel.type === 'text') {
      setSelectedChannelId(channel.id);
      setSelectedChannel(channel);
      setActiveVoiceChannel(null); // Отключаем голосовой канал
    } else if (channel.type === 'voice') {
      // НОВОЕ: Подключаемся к голосовому каналу
      setActiveVoiceChannel(channel.id);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <div className="h-full flex bg-gray-100 dark:bg-gray-900">
        {/* ЛЕВАЯ ПАНЕЛЬ - Список каналов */}
        <div className="w-60 flex-shrink-0 flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-white truncate text-sm">{serverName}</h2>
              <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Пригласить">
                <UserPlus size={16} className="text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Загрузка...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-xs mb-3">Нет каналов</p>
                <button className="bg-blue-500 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-600">
                  Создать канал
                </button>
              </div>
            ) : (
              categories.map(category => (
                <div key={category.id} className="mb-3">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown 
                        size={10} 
                        className={`text-gray-500 transition-transform ${collapsedCategories.has(category.id) ? '-rotate-90' : ''}`}
                      />
                      <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {category.name}
                      </span>
                    </div>
                    <Plus size={12} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  {!collapsedCategories.has(category.id) && (
                    <div className="mt-1 space-y-0.5">
                      {category.channels.map(channel => {
                        const isSelected = selectedChannelId === channel.id;
                        const isVoice = channel.type === 'voice';
                        const isInVoiceChannel = activeVoiceChannel === channel.id;

                        return (
                          <button
                            key={channel.id}
                            onClick={() => handleChannelSelect(channel)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all group ${
                              isSelected || isInVoiceChannel
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white' 
                                : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {isVoice ? (
                              <Volume2 
                                size={16} 
                                className={`flex-shrink-0 ${isInVoiceChannel ? 'text-green-500' : ''}`} 
                              />
                            ) : (
                              <Hash size={16} className="flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate flex-1 text-left">
                              {channel.name}
                            </span>
                            {channel.is_private && (
                              <Lock size={12} className="text-gray-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Профиль внизу */}
          <div className="p-2 bg-gray-50 dark:bg-gray-950 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer flex-1 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden flex-shrink-0">
                {currentUser?.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.username || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-black dark:text-white truncate">
                  {currentUser?.username || 'Пользователь'}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  В сети
                </span>
              </div>
            </div>
            <Settings size={16} className="text-gray-500 hover:text-black dark:hover:text-white cursor-pointer flex-shrink-0" />
          </div>
        </div>

        {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ - Чат канала */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
          {selectedChannel ? (
            <>
              <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <Hash size={20} className="text-gray-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">{selectedChannel.name}</h3>
                </div>
                <button 
                  onClick={() => setShowMembersList(!showMembersList)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <UsersIcon size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Hash size={32} className="text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    Добро пожаловать в #{selectedChannel.name}!
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    Это начало канала #{selectedChannel.name}
                  </p>
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <Plus size={20} className="text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
                  <input
                    type="text"
                    placeholder={`Написать в #${selectedChannel.name}`}
                    className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Выберите канал
            </div>
          )}
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ - Список участников */}
        {showMembersList && (
          <div className="w-60 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Участники — {members.length}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {loadingMembers ? (
                <div className="text-center py-8 text-gray-400 text-sm">Загрузка...</div>
              ) : (
                <div className="space-y-1">
                  {['owner', 'admin', 'member'].map(role => {
                    const roleMembers = members.filter(m => (m.role || 'member') === role);
                    if (roleMembers.length === 0) return null;

                    const roleNames: Record<string, string> = {
                      owner: 'ВЛАДЕЛЕЦ',
                      admin: 'АДМИНИСТРАТОРЫ',
                      member: 'УЧАСТНИКИ'
                    };

                    return (
                      <div key={role} className="mb-3">
                        <h4 className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-2 mb-1">
                          {roleNames[role]} — {roleMembers.length}
                        </h4>
                        {roleMembers.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
                          >
                            <div className="relative">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs overflow-hidden">
                                {member.avatar_url ? (
                                  <img
                                    src={member.avatar_url}
                                    alt={member.username}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span>{member.username[0].toUpperCase()}</span>
                                )}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getStatusColor(member.status)} rounded-full border-2 border-gray-50 dark:border-gray-900`}></div>
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {member.username}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* НОВОЕ: Голосовой канал (подключение внизу экрана) */}
      {activeVoiceChannel && (
        <VoiceChannel
          channelId={activeVoiceChannel}
          channelName={categories
            .flatMap(c => c.channels)
            .find(ch => ch.id === activeVoiceChannel)?.name || 'Voice'}
          serverId={serverId}
          onLeave={() => setActiveVoiceChannel(null)}
        />
      )}
    </>
  );
};