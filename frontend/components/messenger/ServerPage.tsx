// /components/messenger/ServerPage.tsx
import React, { useState, useEffect } from 'react';
import { Hash, Volume2, Settings, UserPlus, ChevronDown, Lock, Plus } from 'lucide-react';
import axios from '@/lib/axiosInstance';
import Cookies from 'js-cookie';

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

interface ServerPageProps {
  serverId: number;
  serverName: string;
  onClose?: () => void;
}

const MESSENGER_API_URL = 'http://localhost:8082/api/v1';

export const ServerPage: React.FC<ServerPageProps> = ({ serverId, serverName, onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Загрузка каналов с бэкенда
  useEffect(() => {
    const fetchChannels = async () => {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      try {
        const res = await axios.get(`${MESSENGER_API_URL}/servers/${serverId}/channels`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Группируем каналы по категориям (если они есть, иначе создаем дефолтные)
        const channels: Channel[] = res.data || [];
        
        // Временная логика группировки (когда у вас будет поле category_id, используйте его)
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

        // Автовыбор первого текстового канала
        if (textChannels.length > 0) {
          setSelectedChannelId(textChannels[0].id);
        }
      } catch (err) {
        console.error('Failed to load channels', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [serverId]);

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

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Хедер сервера */}
      <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 dark:text-white truncate">{serverName}</h2>
          <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Пригласить">
            <UserPlus size={18} className="text-gray-500" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Настройки">
            <Settings size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Список каналов */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Загрузка каналов...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-4">На сервере пока нет каналов</p>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors">
              Создать первый канал
            </button>
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="mb-4">
              {/* Заголовок категории */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown 
                    size={12} 
                    className={`text-gray-500 transition-transform ${collapsedCategories.has(category.id) ? '-rotate-90' : ''}`}
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {category.name}
                  </span>
                </div>
                <Plus size={14} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Каналы */}
              {!collapsedCategories.has(category.id) && (
                <div className="mt-1 space-y-0.5">
                  {category.channels.map(channel => {
                    const isSelected = selectedChannelId === channel.id;
                    const isVoice = channel.type === 'voice';

                    return (
                      <button
                        key={channel.id}
                        onClick={() => !isVoice && setSelectedChannelId(channel.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all group ${
                          isSelected 
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {isVoice ? (
                          <Volume2 size={18} className="flex-shrink-0" />
                        ) : (
                          <Hash size={18} className="flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate flex-1 text-left">
                          {channel.name}
                        </span>
                        {channel.is_private && (
                          <Lock size={14} className="text-gray-500 flex-shrink-0" />
                        )}
                        <Settings 
                          size={14} 
                          className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Футер с профилем пользователя */}
      <div className="h-14 bg-gray-200 dark:bg-gray-950 border-t border-gray-300 dark:border-gray-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex-shrink-0"></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">Пользователь</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">#1234</p>
        </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-gray-300 dark:hover:bg-gray-800 rounded transition-colors">
            <Settings size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};