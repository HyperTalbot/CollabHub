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