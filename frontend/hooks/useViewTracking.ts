// frontend/hooks/useViewTracking.ts
"use client";

import { useEffect, useRef } from 'react';
import { trackView, trackInteraction } from '@/lib/tracking';

interface UseViewTrackingProps {
  contentType: 'post' | 'video' | 'short' | 'stream' | 'music';
  contentId: number;
  contentDuration?: number;
}

export function useViewTracking({ 
  contentType, 
  contentId,
  contentDuration = 0,
}: UseViewTrackingProps) {
  const startTimeRef = useRef<number>(Date.now());
  const trackedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    trackedRef.current = false;

    return () => {
      if (!trackedRef.current) {
        const watchTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        trackView({ contentType, contentId, watchTime, contentDuration });
        trackedRef.current = true;
      }
    };
  }, [contentId]);

  return {
    trackLike: () => trackInteraction({ contentType, contentId, interactionType: 'like' }),
    trackComment: () => trackInteraction({ contentType, contentId, interactionType: 'comment' }),
    trackShare: () => trackInteraction({ contentType, contentId, interactionType: 'share' }),
  };
}