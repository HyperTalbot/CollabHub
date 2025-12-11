// /components/messenger/NavigationRail.tsx
import React from 'react';
import { MessageCircleMore, Plus, Users, MapPinned } from 'lucide-react';
import { Server, ViewMode } from '@/types/messenger';
import { CreateModal } from './CreateModal'; // Ваша существующая модалка

interface NavigationRailProps {
  servers: Server[];
  activeView: ViewMode;
  selectedServerId: number | null;
  onNavigate: (view: ViewMode, serverId?: number) => void;
  onCreateClick: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  servers,
  activeView,
  selectedServerId,
  onNavigate,
  onCreateClick,
}) => {
    // Хелпер для класса активной кнопки
    const getBtnClass = (viewName: ViewMode) => 
    `w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center transition-all cursor-pointer shadow-sm text-lg font-bold group relative mb-2
    ${activeView === viewName 
      ? 'bg-blue-500 text-white rounded-[16px]' 
      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-blue-500 hover:text-white'}`;

  return (
    <nav className="w-[72px] flex-shrink-0 bg-gray-100 dark:bg-gray-950 flex flex-col items-center py-4 space-y-2 border-r border-gray-200 dark:border-gray-800 z-10 h-full">
      
      {/* 1. ДОМОЙ (ЛС) */}
      <div onClick={() => onNavigate('dm')} className={getBtnClass('dm')} title="Личные сообщения">
        <MessageCircleMore size={24} />
      </div>

      {/* 2. ДРУЗЬЯ */}
      <div onClick={() => onNavigate('friends')} className={getBtnClass('friends')} title="Список друзей">
        <Users size={24} />
      </div>

      {/* 3. КАРТА */}
      <div onClick={() => onNavigate('map')} className={getBtnClass('map')} title="Карта">
        <MapPinned size={24} />
      </div>

      {/* Разделитель */}
      <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-800 rounded-full my-2"></div>

      {/* СПИСОК СЕРВЕРОВ */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center space-y-3 no-scrollbar pb-4">
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => onNavigate('server', server.id)}
            className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center transition-all cursor-pointer text-gray-700 dark:text-gray-200 shadow-sm text-sm font-bold group relative shrink-0
                ${activeView === 'server' && selectedServerId === server.id
                  ? 'bg-blue-500 text-white rounded-[16px]' 
                  : 'bg-white dark:bg-gray-800 hover:bg-blue-500 hover:text-white'}`}
            title={server.name}
          >
            {server.avatar_url ? (
              <img src={server.avatar_url} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" />
            ) : (
              <span>{(server.name || "?").substring(0, 2).toUpperCase()}</span>
            )}
            <div className={`absolute -left-4 w-2 h-2 bg-black dark:bg-white rounded-r-lg transition-all duration-300 
                ${activeView === 'server' && selectedServerId === server.id ? 'h-10 -left-3' : 'group-hover:h-5 group-hover:-left-3 opacity-0 group-hover:opacity-100'}`} 
            />
          </div>
        ))}
        
        <div onClick={onCreateClick} className="w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center bg-white dark:bg-gray-800 hover:bg-green-500 hover:text-white transition-all cursor-pointer text-green-500 shadow-sm shrink-0">
          <Plus size={24} />
        </div>
      </div>
    </nav>
  );
};