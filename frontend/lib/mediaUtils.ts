// frontend/lib/mediaUtils.ts

const getMediaBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'collabhub.cloudpub.ru') {
      return 'https://collabhub.cloudpub.ru';
    }
    if (hostname === 'localhost') {
      return 'http://localhost:90'; // Через Nginx
    }
  }
  return process.env.NEXT_PUBLIC_MEDIA_BASE_URL || '';
};

export const getMediaURL = (path?: string): string => {
  if (!path) return '';
  // Если путь уже полный URL, возвращаем как есть (для старых данных)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const baseURL = getMediaBaseURL();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseURL}${cleanPath}`;
};

// НОВОЕ: тип медиа по расширению файла
export type MediaKind = 'image' | 'gif' | 'video';

export const getMediaKind = (path?: string): MediaKind => {
  if (!path) return 'image';
  const clean = path.toLowerCase().split('?')[0];
  if (clean.endsWith('.gif')) return 'gif';
  if (/\.(mp4|webm|ogg|mov|mkv|avi)$/.test(clean)) return 'video';
  return 'image';
};