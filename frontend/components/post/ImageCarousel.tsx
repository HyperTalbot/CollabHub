// frontend/components/post/ImageCarousel.tsx
// карусель изображений для постов в стиле "reddit"
"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMediaKind } from '@/lib/mediaUtils';
import { getMediaURL } from '@/lib/mediaUtils';

// НОВОЕ: универсальный рендер медиа (картинка / gif / видео).
// gif — без проигрывателя + бейдж "GIF" в правом верхнем углу;
// видео — простой html-проигрыватель (<video controls>).
export function MediaContent({
  src,
  alt = '',
  className = '',
  mediaClass = 'w-full h-full object-contain',
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  mediaClass?: string;
  eager?: boolean;
}) {
  const kind = getMediaKind(src);
  const url = getMediaURL(src);
  return (
    <div className={`relative ${className}`}>
      {kind === 'video' ? (
        <video
          src={url}
          controls
          preload="metadata"
          className={`${mediaClass} bg-black`}
        />
      ) : (
        <img
          src={url}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          className={mediaClass}
        />
      )}
      {kind === 'gif' && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white bg-black/70 rounded border border-white/40 shadow pointer-events-none select-none">
          GIF
        </span>
      )}
    </div>
  );
}

interface ImageCarouselProps {
  images: string[];      // URL картинок/gif/видео (относительные пути media-service)
  alt?: string;
  heightClass?: string;
}

// Карусель для постов в стиле "reddit" (теперь общая для картинок, gif и видео)
export default function ImageCarousel({ images, alt = '', heightClass = 'h-[420px]' }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;

  const goTo = useCallback((next: number) => {
    if (total <= 1) return;
    setIndex(((next % total) + total) % total);
  }, [total]);

  useEffect(() => {
    if (index >= total && total > 0) setIndex(0);
  }, [total, index]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      goTo(delta > 0 ? index - 1 : index + 1);
    }
    touchStartX.current = null;
  };

  if (!images || images.length === 0) return null;

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 select-none shadow-sm`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Лента слайдов */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="w-full h-full shrink-0">
            <MediaContent src={src} alt={alt || `Медиа ${i + 1}`} className="w-full h-full" eager={i === 0} />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Предыдущее"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors shadow"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Следующее"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors shadow"
          >
            <ChevronRight size={20} />
          </button>

          <span className="absolute top-2 left-2 text-xs text-white bg-black/50 rounded-full px-2 py-0.5">
            {index + 1} / {total}
          </span>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((src, i) => {
              const kind = getMediaKind(src);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Слайд ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === index
                      ? kind === 'video' ? 'w-5 bg-emerald-500' : 'w-5 bg-indigo-500'
                      : 'w-2 bg-white/70 hover:bg-white'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}