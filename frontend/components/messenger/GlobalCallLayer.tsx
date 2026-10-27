// frontend/components/messenger/GlobalCallLayer.tsx

// ГЛАВНОЕ АРХИТЕКТУРНОЕ ИСПРАВЛЕНИЕ:
// Раньше CallModal рендерился внутри ChatHeader, а ChatHeader существует
// ТОЛЬКО когда открыт нужный чат. Поэтому:
//   • принял звонок не находясь в чате → модалка не открывалась → у звонящего
//     вечное "Соединение..." (offer некому принять);
//   • переключился на другой чат во время звонка → звонок "умирал".
// Теперь модалка звонка живёт на уровне всего приложения (layout) и работает
// независимо от того, какой чат/страница открыты.
//
// Слушает window-события:
//   'open-call-modal'  — звонящий (из ChatHeader после POST /calls)
//   'accept-call'      — принимающий (из WebSocketContext после POST /answer)
//   'close-call-modal' — звонок отклонён/завершён (из WebSocketContext)

"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CallModal } from './CallModal';

interface ActiveCall {
  callId: number;
  partnerId: number;
  partnerName: string;
  callType: 'audio' | 'video';
  isInitiator: boolean;
  offerSdp?: string;
  mediaPromise?: Promise<MediaStream>;
}

export const GlobalCallLayer: React.FC = () => {
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
  const currentCallRef = useRef<ActiveCall | null>(null);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  const openCall = useCallback((event: any) => {
    const d = event.detail || {};
    setCurrentCall((prev) => {
      if (prev && Number(prev.callId) === Number(d.callId)) return prev;
      return {
        callId: d.callId,
        partnerId: d.partnerId,
        partnerName: d.partnerName || 'Собеседник',
        callType: d.callType === 'video' ? 'video' : 'audio',
        isInitiator: !!d.isInitiator,
        offerSdp: d.offerSdp,
        mediaPromise: d.mediaPromise,
      };
    });
  }, []);

  const closeCall = useCallback((event?: any) => {
    const callIdFromEvent = event?.detail?.call_id;
    const active = currentCallRef.current;

    if (
      callIdFromEvent !== undefined &&
      callIdFromEvent !== null &&
      active &&
      Number(callIdFromEvent) !== Number(active.callId)
    ) {
      return; // событие про другой звонок
    }

    setCurrentCall(null);
  }, []);

  useEffect(() => {
    window.addEventListener('open-call-modal', openCall);
    window.addEventListener('accept-call', openCall);
    window.addEventListener('close-call-modal', closeCall as EventListener);
    return () => {
      window.removeEventListener('open-call-modal', openCall);
      window.removeEventListener('accept-call', openCall);
      window.removeEventListener('close-call-modal', closeCall as EventListener);
    };
  }, [openCall, closeCall]);

  if (!currentCall) return null;

  return (
    <CallModal
      key={currentCall.callId}
      callId={currentCall.callId}
      isInitiator={currentCall.isInitiator}
      partnerId={currentCall.partnerId}
      partnerName={currentCall.partnerName}
      callType={currentCall.callType}
      offerSdp={currentCall.offerSdp}
      mediaPromise={currentCall.mediaPromise}
      onClose={() => setCurrentCall(null)}
    />
  );
};
