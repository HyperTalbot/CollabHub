// frontend/lib/mediaUrl.ts
// Единый резолвер URL изображений/файлов.
//
// Проблемы, которые решает:
// 1. media-service возвращает относительные "/uploads/image/xxx.jpg" —
//    на collabhub.cloudpub.ru их некому отдавать (403) → в prod ходим
//    через same-origin (nginx проксирует /uploads и /media на :8088),
//    в dev — напрямую на http://localhost:8088.
// 2. Старые абсолютные ссылки "http://localhost:8084/uploads/xxx" —
//    заменяем host на media-сервис, сохраняем путь.

// Резолвер URL медиа:
// - dev (localhost:3000): напрямую на media-service http://localhost:8088
// - prod (cloudpub): через публичный прокси messenger-сервиса
//   /api/v1/messenger/media/... (nginx уже проксирует /api/v1/messenger → :8086,
//   а :8086 проксирует → localhost:8088/uploads). Правки nginx не требуются.

const isProdHost =
  typeof window !== 'undefined' && window.location.hostname === 'collabhub.cloudpub.ru';

function toMediaUrl(pathAfterUploads: string): string {
  if (process.env.NEXT_PUBLIC_MEDIA_URL) {
    return `${process.env.NEXT_PUBLIC_MEDIA_URL}/uploads${pathAfterUploads}`;
  }
  if (isProdHost) {
    return `/api/v1/messenger/media${pathAfterUploads}`;
  }
  return `http://localhost:8088/uploads${pathAfterUploads}`;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // относительные пути media-service
  if (url.startsWith('/uploads/')) return toMediaUrl(url.slice('/uploads'.length));
  if (url.startsWith('/media/')) return toMediaUrl(url.slice('/media'.length));

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const u = new URL(url);
      const isLocalhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      const isSameHost = typeof window !== 'undefined' && u.hostname === window.location.hostname;

      if (u.pathname.startsWith('/uploads/')) {
        if (isLocalhost || isSameHost) {
          return toMediaUrl(u.pathname.slice('/uploads'.length));
        }
      }
    } catch {
      /* не URL */
    }
    return url;
  }

  return url;
}