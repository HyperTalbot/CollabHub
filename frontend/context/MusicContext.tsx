'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Track, PlayerState, MusicContextType, PlayMode, DockPosition } from '@/types/music';
import { musicService } from '@/services/musicService';

const initialPlayerState: PlayerState = {
  currentTrack: null,
  queue: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playMode: 'normal',
  position: 'bottom-right',
};

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(initialPlayerState);

  const playTrack = useCallback(async (track: Track, queue: Track[] = []) => {
    setPlayerState(prev => ({
      ...prev,
      currentTrack: track,
      queue,
      isPlaying: true,
    }));

    // Увеличиваем счетчик прослушиваний
    try {
      await musicService.incrementPlayCount(track.id);
    } catch (error) {
      console.error('Failed to increment play count:', error);
    }
  }, []);

  const playNext = useCallback(() => {
    setPlayerState(prev => {
      if (prev.queue.length === 0) {
        return { ...prev, isPlaying: false };
      }

      const [nextTrack, ...remainingQueue] = prev.queue;
      
      // Увеличиваем счетчик для следующего трека
      musicService.incrementPlayCount(nextTrack.id).catch(console.error);

      return {
        ...prev,
        currentTrack: nextTrack,
        queue: remainingQueue,
        isPlaying: true,
      };
    });
  }, []);

  const playPrevious = useCallback(() => {
    setPlayerState(prev => {
      if (!prev.currentTrack) return prev;

      // Для простоты, просто перезапускаем текущий трек
      return {
        ...prev,
        currentTime: 0,
        isPlaying: true,
      };
    });
  }, []);

  const togglePlay = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setPlayerState(prev => ({
      ...prev,
      volume: Math.max(0, Math.min(1, volume)),
    }));
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayerState(prev => ({
      ...prev,
      playMode: mode,
    }));
  }, []);

  const setPosition = useCallback((position: DockPosition) => {
    setPlayerState(prev => ({
      ...prev,
      position,
    }));
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setPlayerState(prev => ({
      ...prev,
      queue: [...prev.queue, track],
    }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setPlayerState(prev => ({
      ...prev,
      queue: prev.queue.filter((_, i) => i !== index),
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      queue: [],
    }));
  }, []);

  const value: MusicContextType = {
    playerState,
    playTrack,
    playNext,
    playPrevious,
    togglePlay,
    setVolume,
    setPlayMode,
    setPosition,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export const useMusic = (): MusicContextType => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};