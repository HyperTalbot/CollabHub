'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, MessageSquare, 
  Share2, Download, Radio, FileText, Music2,
  ThumbsDown, Plus, RotateCcw, RotateCw, Shuffle, Repeat, Repeat1, GripVertical,
  ChevronDown, ChevronUp
} from 'lucide-react';

interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  cover_url: string;
  audio_url: string;
  duration: number;
}

interface MusicPlayerProps {
  currentTrack: Track | null;
  queue: Track[];
  onNext: () => void;
  onPrevious: () => void;
  onTrackEnd: () => void;
  onClose?: () => void;
}

type PlayMode = 'normal' | 'shuffle' | 'repeat-all' | 'repeat-one';
type TabType = 'queue' | 'lyrics' | 'similar';
type DockPosition = 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left';

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack,
  queue,
  onNext,
  onPrevious,
  onTrackEnd,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>('normal');
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [position, setPosition] = useState<DockPosition>('bottom-right');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Воспроизведение/пауза
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Обработка окончания трека
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (playMode === 'repeat-one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        onTrackEnd();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playMode, onTrackEnd]);

  // Обновление времени
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  // Загрузка нового трека
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = currentTrack.audio_url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [currentTrack]);

  // Прыжок по треку
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += seconds;
  };

  const cyclePlayMode = () => {
    const modes: PlayMode[] = ['normal', 'shuffle', 'repeat-all', 'repeat-one'];
    const currentIndex = modes.indexOf(playMode);
    setPlayMode(modes[(currentIndex + 1) % modes.length]);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Магнитное позиционирование
  const snapToPosition = (x: number, y: number): DockPosition => {
    const { innerWidth: w, innerHeight: h } = window;

    const vZone =
      y < h / 3 ? 'top' :
      y > (2 * h) / 3 ? 'bottom' :
      'middle';

    const hZone =
      x < w / 3 ? 'left' :
      x > (2 * w) / 3 ? 'right' :
      'center';

    if (vZone === 'top' && hZone === 'left') return 'top-left';
    if (vZone === 'top' && hZone === 'center') return 'top';
    if (vZone === 'top' && hZone === 'right') return 'top-right';

    if (vZone === 'middle' && hZone === 'left') return 'left';
    if (vZone === 'middle' && hZone === 'right') return 'right';

    if (vZone === 'bottom' && hZone === 'left') return 'bottom-left';
    if (vZone === 'bottom' && hZone === 'center') return 'bottom';
    if (vZone === 'bottom' && hZone === 'right') return 'bottom-right';

    return 'bottom-right';
  };

  const getPositionStyles = (pos: DockPosition): React.CSSProperties => {
    const margin = 20;
    const styles: Record<DockPosition, React.CSSProperties> = {
      'top': { top: margin, left: '50%', transform: 'translateX(-50%)' },
      'top-right': { top: margin, right: margin },
      'right': { top: '50%', right: margin, transform: 'translateY(-50%)' },
      'bottom-right': { bottom: margin, right: margin },
      'bottom': { bottom: margin, left: '50%', transform: 'translateX(-50%)' },
      'bottom-left': { bottom: margin, left: margin },
      'left': { top: '50%', left: margin, transform: 'translateY(-50%)' },
      'top-left': { top: margin, left: margin },
    };
    return styles[pos];
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    
    e.preventDefault(); // Предотвращаем выделение текста
    
    const rect = playerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setIsDragging(true);
      setHasMoved(false);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    // Отключаем выделение текста во время перетаскивания
    const disableSelection = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', disableSelection);
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      // Проверяем, что мышь действительно двигается (минимум 5px)
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      
      if (!hasMoved && (deltaX > 5 || deltaY > 5)) {
        setHasMoved(true);
      }

      if (hasMoved || deltaX > 5 || deltaY > 5) {
        const player = playerRef.current;
        if (player) {
          // Плавное перемещение за курсором с ограничением по краям экрана
          const playerWidth = player.offsetWidth;
          const playerHeight = player.offsetHeight;
          
          let newX = e.clientX - dragOffset.x;
          let newY = e.clientY - dragOffset.y;
          
          // Ограничиваем по границам окна
          newX = Math.max(0, Math.min(newX, window.innerWidth - playerWidth));
          newY = Math.max(0, Math.min(newY, window.innerHeight - playerHeight));
          
          player.style.left = `${newX}px`;
          player.style.top = `${newY}px`;
          player.style.right = 'auto';
          player.style.bottom = 'auto';
          player.style.transform = 'none';
          player.style.transition = 'none';
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      const player = playerRef.current;
      if (!player || !hasMoved) return;

      const rect = player.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const newPos = snapToPosition(centerX, centerY);
      setPosition(newPos);

      player.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      requestAnimationFrame(() => {
        player.style.left = '';
        player.style.top = '';
        player.style.right = '';
        player.style.bottom = '';
        player.style.transform = '';
      });

      setHasMoved(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectstart', disableSelection);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset, hasMoved]);

  const playerStyles: React.CSSProperties = {
    position: 'fixed',
    ...(isDragging ? {} : getPositionStyles(position)),
  };

  if (!currentTrack) return null;

  return (
    <>
      <audio ref={audioRef} />
      
      <style jsx>{`
        .music-player-fixed {
          position: fixed !important;
          z-index: 9999 !important;
        }
      `}</style>
      
      <div
        ref={playerRef}
        className={`music-player-fixed w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden`}
        style={playerStyles}
        onMouseDown={handleMouseDown}
      >
        {/* Drag Handle */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Перетащите плеер</span>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="no-drag px-2 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Обложка */}
        <div className="relative h-52 bg-gradient-to-br from-purple-500 to-pink-500">
          <img 
            src={currentTrack.cover_url} 
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
          {isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-4 border-white/30 rounded-full animate-pulse"></div>
              <div className="absolute w-20 h-20 border-4 border-white/20 rounded-full animate-ping"></div>
            </div>
          )}
        </div>

        {/* Информация о треке */}
        <div className="p-3 no-drag">
          <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
            {currentTrack.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex items-center gap-1.5">
            <span>{currentTrack.artist}</span>
            {currentTrack.album && (
              <>
                <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                <span>{currentTrack.album}</span>
              </>
            )}
          </p>
        </div>
        
        {/* Кнопки действий (верхний ряд) */}
        <div className="px-4 pb-2 flex items-center justify-around no-drag">
          <button 
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition ${isLiked ? 'text-red-500' : 'text-gray-600'}`}
            title="Нравится"
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600" title="Не нравится">
            <ThumbsDown size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600" title="Комментарии">
            <MessageSquare size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600" title="Добавить в плейлист">
            <Plus size={18} />
          </button>
          <button 
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600"
            title="Скопировать ссылку"
          >
            <Share2 size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600" title="Скачать">
            <Download size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600" title="Радио">
            <Radio size={18} />
          </button>
        </div>

        {/* Прогресс-бар */}
        <div className="px-4 py-2 no-drag">
          <div 
            className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Управление воспроизведением */}
        <div className="px-4 pb-5 flex items-center justify-center gap-3 no-drag">
          <button onClick={onPrevious} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            <SkipBack size={22} className="text-gray-700 dark:text-gray-300" />
          </button>
          
          <button onClick={() => skip(-10)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            <RotateCcw size={20} className="text-gray-700 dark:text-gray-300" />
          </button>

          <button 
            onClick={togglePlay}
            className="p-3.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full hover:scale-110 transition relative"
          >
            {isPlaying ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white ml-0.5" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
            )}
          </button>

          <button onClick={() => skip(10)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            <RotateCw size={20} className="text-gray-700 dark:text-gray-300" />
          </button>

          <button onClick={onNext} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            <SkipForward size={22} className="text-gray-700 dark:text-gray-300" />
          </button>
          
          <button onClick={cyclePlayMode} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
            {playMode === 'shuffle' && <Shuffle size={20} className="text-blue-500" />}
            {playMode === 'repeat-all' && <Repeat size={20} className="text-blue-500" />}
            {playMode === 'repeat-one' && <Repeat1 size={20} className="text-blue-500" />}
            {playMode === 'normal' && <Repeat size={20} className="text-gray-400" />}
          </button>
        </div>

        {/* Вкладки */}
        <div className="border-t border-gray-200 dark:border-gray-700 no-drag">
          <div className="flex">
            <button 
              onClick={() => setActiveTab(activeTab === 'queue' ? null : 'queue')}
              className={`flex-1 py-2 text-xs font-medium transition flex items-center justify-center gap-1 ${activeTab === 'queue' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>Далее ({queue.length})</span>
              {activeTab === 'queue' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button 
              onClick={() => setActiveTab(activeTab === 'lyrics' ? null : 'lyrics')}
              className={`flex-1 py-2 text-xs font-medium transition flex items-center justify-center gap-1 ${activeTab === 'lyrics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>Текст</span>
              {activeTab === 'lyrics' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button 
              onClick={() => setActiveTab(activeTab === 'similar' ? null : 'similar')}
              className={`flex-1 py-2 text-xs font-medium transition flex items-center justify-center gap-1 ${activeTab === 'similar' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>Похожие</span>
              {activeTab === 'similar' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Содержимое вкладок */}
          {activeTab && (
            <div className="max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-800/50">
              {activeTab === 'queue' && (
                <div className="space-y-2">
                  {queue.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">Очередь пуста</p>
                  ) : (
                    queue.map((track, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition cursor-pointer">
                        <img src={track.cover_url} alt={track.title} className="w-10 h-10 rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate dark:text-white">{track.title}</p>
                          <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'lyrics' && (
                <div className="text-xs text-gray-700 dark:text-gray-300 text-center py-8">
                  <FileText size={32} className="mx-auto mb-2 text-gray-400" />
                  <p>Текст песни пока недоступен</p>
                </div>
              )}
              {activeTab === 'similar' && (
                <div className="text-xs text-gray-500 text-center py-8">
                  <Music2 size={32} className="mx-auto mb-2 text-gray-400" />
                  <p>Загрузка похожих треков...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};