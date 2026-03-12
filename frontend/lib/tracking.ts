// frontend/lib/tracking.ts
import Cookies from 'js-cookie';

interface TrackViewParams {
  contentType: 'post' | 'video' | 'short' | 'stream' | 'music';
  contentId: number;
  watchTime: number;
  contentDuration?: number;
}

interface TrackInteractionParams {
  contentType: 'post' | 'video' | 'short' | 'stream' | 'music';
  contentId: number;
  interactionType: 'like' | 'comment' | 'share';
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export async function trackView(params: TrackViewParams): Promise<void> {
  const { contentType, contentId, watchTime, contentDuration = 0 } = params;
  
  if (watchTime < 3) return;

  const progress = contentDuration > 0 
    ? Math.min((watchTime / contentDuration) * 100, 100)
    : 100;
  
  const completed = progress >= 90;
  const skipped = watchTime < 5;

  try {
    const token = Cookies.get('token');
    
    await fetch('/api/tracking/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        'X-Session-ID': getSessionId(),
        'X-Device-Type': getDeviceType(),
      },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        watch_time: watchTime,
        progress,
        completed,
        content_duration: contentDuration,
        skipped,
      }),
    });
  } catch (error) {
    console.error('Failed to track view:', error);
  }
}

export async function trackInteraction(params: TrackInteractionParams): Promise<void> {
  const { contentType, contentId, interactionType } = params;
  
  try {
    const token = Cookies.get('token');
    
    await fetch('/api/tracking/interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        content_type: contentType,
        content_id: contentId,
        interaction_type: interactionType,
      }),
    });
  } catch (error) {
    console.error('Failed to track interaction:', error);
  }
}