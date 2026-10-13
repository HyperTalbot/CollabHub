// frontend/components/messenger/CallModal.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Mic, MicOff, VideoOff, PhoneOff, Monitor, Volume2 } from 'lucide-react';
import axios from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import { startRingback, stopSounds } from '@/lib/ringtone';
import { subscribeCallSignals, type CallSignal } from '@/lib/callSignalBus';
import { getIceServers, getCandidateType, incrementType, formatIceStats } from '@/lib/iceConfig';

interface CallModalProps {
  callId: number;
  isInitiator: boolean;
  partnerId: number;
  partnerName: string;
  callType: 'audio' | 'video';
  offerSdp?: string;
  mediaPromise?: Promise<MediaStream>;
  onClose: () => void;
}

const CALL_ANSWER_TIMEOUT_MS = 15000;
const ICE_RESTART_AFTER_MS = 12000;
const CONNECT_TIMEOUT_MS = 30000;
// Окно на восстановление после 'disconnected' (собеседник нажал "завершить")
const PEER_GONE_GRACE_MS = 2500;

// ── Детект платформ ──
const getUA = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '');
const isIOS = () => /iP(ad|hone|od)/.test(getUA()) || (getUA().includes('Mac') && 'ontouchend' in document);
const supportsScreenShare = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getDisplayMedia &&
  !isIOS(); // iOS Safari: getDisplayMedia нет

export const CallModal: React.FC<CallModalProps> = ({
  callId,
  isInitiator,
  partnerId,
  partnerName,
  callType,
  offerSdp,
  mediaPromise,
  onClose,
}) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [callStatus, setCallStatus] = useState<'waiting' | 'connecting' | 'active'>('waiting');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [needsPlayGesture, setNeedsPlayGesture] = useState(false);
  const [canScreenShare] = useState<boolean>(() => supportsScreenShare());

  // Отладка
  const [pcState, setPcState] = useState('new');
  const [iceState, setIceState] = useState('new');
  // Медиастатистика: «соединение есть, а звука нет» = bytesReceived ~ 0.
  // Обновляется каждые 2 с во время активного разговора.
  const [mediaStats, setMediaStats] = useState<{ inAudio: number; outAudio: number }>({ inAudio: 0, outAudio: 0 });
  // Выбранная ICE-пара (host/host, host/srflx, relay/relay …) — по ней видно,
  // КАКОЙ маршрут реально использует медиа.
  const [selectedRoute, setSelectedRoute] = useState('—');
  const [localIce, setLocalIce] = useState<Record<string, number>>({});
  const [remoteIce, setRemoteIce] = useState<Record<string, number>>({});
  const [remoteKinds, setRemoteKinds] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<any>(null);
  const peerGoneTimerRef = useRef<number | null>(null);

  const pcReadyRef = useRef(false);
  const offerSentRef = useRef(false);
  const answerReceivedRef = useRef(false);
  const remoteDescSetRef = useRef(false);
  const lastOfferSdpRef = useRef<string | null>(null);
  const lastAnswerSdpRef = useRef<string | null>(null);
  const pendingSignalsRef = useRef<CallSignal[]>([]);
  const pendingCandidatesRef = useRef<any[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const iceRestartedRef = useRef(false);
  const hasRelayRef = useRef(false);

  // ─────────────────────────────────────────────────────────────
  // Screen Wake Lock — экран не гаснет во время звонка
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let released = false;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('🔆 Wake Lock acquired');

          wakeLockRef.current.addEventListener?.('release', () => {
            console.log('🔅 Wake Lock released');
          });
        }
      } catch (e) {
        console.warn('Wake Lock unavailable:', e);
      }
    };

    // При возврате вкладки в фокус lock снимается браузером — перевзводим
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && !released && !closedRef.current) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisible);
      try {
        wakeLockRef.current?.release?.();
      } catch (e) {
        /* ignore */
      }
      wakeLockRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Медиа
  // ─────────────────────────────────────────────────────────────
  const attachRemoteStream = useCallback(
    (stream: MediaStream) => {
      // ВАЖНО: подключаем ОБА элемента. На iOS аудио-дорожка из
      // <video> с display:none не играет — нужен живой <audio>.
      const videoEl = remoteVideoRef.current;
      const audioEl = remoteAudioRef.current;

      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.play?.().catch(() => {});
      }
      if (audioEl) {
        audioEl.srcObject = stream;
        audioEl.play?.().catch(() => {
          // Android/iOS заблокировали autoplay → покажем кнопку
          setNeedsPlayGesture(true);
        });
      }
    },
    []
  );

  const forcePlayRemote = () => {
    remoteVideoRef.current?.play?.().catch(() => {});
    remoteAudioRef.current
      ?.play?.()
      .then(() => setNeedsPlayGesture(false))
      .catch((e) => console.warn('Play failed:', e));
  };

  // Тап в любом месте модалки — снимаем блокировку autoplay (мобильные).
  // Вызываем forcePlayRemote ВСЕГДА, а не только при needsPlayGesture:
  // если play() «молча» не стартовал, кнопка могла не появиться, а звука нет.
  const handleRootPointerDown = () => {
    forcePlayRemote();
  };

  const markActive = useCallback(() => {
    if (closedRef.current) return;
    // НЕ сбрасываем needsPlayGesture здесь: если автоплей заблокирован,
    // кнопка «включить звук» должна остаться видимой, а не прятаться
    // ровно в момент, когда она нужна.
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    setCallStatus('active');
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Инициализация
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        let stream: MediaStream;

        if (mediaPromise) {
          stream = await mediaPromise;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video:
              callType === 'video'
                ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
                : false,
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }

        setupPeerConnection(stream);
        pcReadyRef.current = true;

        if (!isInitiator) setCallStatus('connecting');

        const queued = pendingSignalsRef.current;
        pendingSignalsRef.current = [];
        for (const sig of queued) await handleSignal(sig);

        if (!isInitiator && offerSdp) {
          await handleSignal({
            call_id: callId,
            from_id: partnerId,
            signal_type: 'offer',
            data: offerSdp,
          });
        }

        await maybeCreateOffer();
      } catch (error: any) {
        console.error('Failed to initialize call:', error);
        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          toast.error('Разрешите доступ к микрофону и позвоните снова');
        } else if (error?.name === 'NotFoundError') {
          toast.error('Микрофон не найден');
        } else if (error?.name === 'NotReadableError') {
          toast.error('Микрофон занят другим приложением');
        } else {
          toast.error('Не удалось получить доступ к камере/микрофону');
        }
        endCall();
      }
    };

    init();

    return () => {
      cancelled = true;
      stopSounds();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Шина сигналов
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeCallSignals((signal: CallSignal) => {
      if (Number(signal.call_id) !== Number(callId)) return;
      if (closedRef.current) return;

      if (signal.signal_type === 'answered') {
        console.log('✅ Partner answered');
        answerReceivedRef.current = true;
        if (isInitiator) setCallStatus('connecting');
        maybeCreateOffer();
        return;
      }

      if (!pcReadyRef.current) {
        pendingSignalsRef.current.push(signal);
        return;
      }

      handleSignal(signal);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // ─────────────────────────────────────────────────────────────
  // Гудки + автосброс 15 сек
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitiator) return;

    if (callStatus === 'waiting') {
      startRingback();
      const t = setTimeout(() => {
        if (!answerReceivedRef.current && !closedRef.current) {
          toast.error('Собеседник не ответил');
          endCall();
        }
      }, CALL_ANSWER_TIMEOUT_MS);

      return () => {
        clearTimeout(t);
        stopSounds();
      };
    }

    stopSounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, isInitiator]);

  // ─────────────────────────────────────────────────────────────
  // Таймаут соединения + диагностика TURN
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus !== 'connecting') return;

    let stopped = false;

    const isConnectedNow = () => {
      const pc = peerConnectionRef.current;
      if (!pc) return false;
      return (
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed'
      );
    };

    const restartTimer = setTimeout(() => {
      if (stopped || closedRef.current || isConnectedNow()) return;

      if (!hasRelayRef.current) {
        console.error(
          '❌ Нет relay-кандидатов: TURN недоступен, за NAT мобильного оператора P2P не поднимется'
        );
        toast.error('TURN-сервер недоступен (нет relay-кандидатов)', { duration: 6000 });
      }

      if (iceRestartedRef.current) return;
      iceRestartedRef.current = true;
      console.warn('⚠️ Slow connection → ICE restart');
      performIceRestart();
    }, ICE_RESTART_AFTER_MS);

    const failTimer = setTimeout(() => {
      if (stopped || closedRef.current) return;
      if (isConnectedNow()) {
        markActive();
        return;
      }
      stopped = true;
      toast.error(hasRelayRef.current ? 'Не удалось установить соединение' : 'Соединение невозможно: нет TURN-relay');
      endCall();
    }, CONNECT_TIMEOUT_MS);

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      clearTimeout(failTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  // ─────────────────────────────────────────────────────────────
  // Закрытие по WS-событию
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleCloseModal = (event: any) => {
      if (closedRef.current) return;

      const { reason, duration, call_id } = event.detail || {};
      if (call_id != null && Number(call_id) !== Number(callId)) return;

      if (reason === 'declined') {
        toast.error('Собеседник отклонил звонок');
      } else if (reason === 'ended') {
        toast(`Звонок завершён${duration ? ` (${formatTime(duration)})` : ''}`, { icon: '📞' });
      }

      closedRef.current = true;
      stopSounds();
      cleanup();
      onClose();
    };

    window.addEventListener('close-call-modal', handleCloseModal);
    return () => window.removeEventListener('close-call-modal', handleCloseModal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, callId]);

  // ─────────────────────────────────────────────────────────────
  // Таймер разговора
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus !== 'active') return;
    const id = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [callStatus]);

  // ─────────────────────────────────────────────────────────────
  // Опрос медиастатистики каждые 2 с. Ключевой диагностический
  // признак: pcState=connected, но inAudio≈0 → медиапакеты от
  // собеседника не долетают (пробит только signaling-канал, RTP
  // режется NAT/провайдером). inAudio растёт, а звука нет → проблема
  // на стороне вывода (autoplay-блокировка, системный ввод/вывод).
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus !== 'active') return;
    let stopped = false;
    const poll = async () => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        const stats = await pc.getStats();
        let inAudio = 0;
        let outAudio = 0;
        // Определяем выбранный ICE-маршрут по candidate-pair.selected
        const candById = new Map<string, any>();
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio') inAudio = r.bytesReceived || 0;
          if (r.type === 'outbound-rtp' && r.kind === 'audio') outAudio = r.bytesSent || 0;
          if (r.type === 'local-candidate' || r.type === 'remote-candidate') {
            candById.set(r.id, r);
          }
        });

        let route = '—';
        stats.forEach((r) => {
          if (r.type === 'candidate-pair' && (r as any).selected) {
            const lc = candById.get(r.localCandidateId);
            const rc = candById.get(r.remoteCandidateId);
            const lt = lc?.candidateType ?? '?';
            const rt = rc?.candidateType ?? '?';
            const lip = lc?.ip || lc?.address || '';
            const rip = rc?.ip || rc?.address || '';
            route = `${lt} → ${rt} (${lip} ↔ ${rip})`;
            console.log('🧊 selected ICE pair:', route);
          }
        });

        if (!stopped) {
          setMediaStats({ inAudio, outAudio });
          setSelectedRoute(route);
        }
      } catch {
        /* getStats недоступен — игнорируем */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [callStatus]);

  // ═════════════════════════════════════════════════════════════
  // WebRTC
  // ═════════════════════════════════════════════════════════════

  const setupPeerConnection = (stream: MediaStream) => {
    const configuration: RTCConfiguration = {
      iceServers: getIceServers(),
      iceCandidatePoolSize: 4,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      // ВАЖНО: на части Android-браузеров event.streams пустой — тогда звук
      // просто не подключался («звонок идёт, но тихо»). Собираем поток из
      // трека вручную как fallback.
      const stream = event.streams?.[0] ?? new MediaStream([event.track]);
      console.log('🎥 Remote stream:', stream.getTracks().map((t) => t.kind));
      attachRemoteStream(stream);
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        console.log('📡 ICE gathering complete');
        return;
      }

      const type = getCandidateType(event.candidate);
      if (type === 'relay') hasRelayRef.current = true;
      setLocalIce((prev) => incrementType(prev, type));

      axios
        .post(`/calls/${callId}/signal`, {
          target_id: partnerId,
          type: 'ice',
          data: JSON.stringify(event.candidate.toJSON()),
        })
        .catch((e) => console.warn('Failed to send ICE:', e));
    };

    pc.onconnectionstatechange = () => {
      const cur = peerConnectionRef.current;
      if (!cur) return;
      const state = cur.connectionState;
      console.log('🔗 connectionState:', state);
      setPcState(state);

      if (state === 'connected') {
        clearPeerGoneTimer();
        markActive();
      } else if (state === 'disconnected') {
        schedulePeerGoneCheck();
      } else if (state === 'failed' || state === 'closed') {
        if (!closedRef.current) {
          toast.error('Соединение оборвалось');
          endCall();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const cur = peerConnectionRef.current;
      if (!cur) return;
      const state = cur.iceConnectionState;
      console.log('🧊 iceConnectionState:', state);
      setIceState(state);

      if (state === 'connected' || state === 'completed') {
        clearPeerGoneTimer();
        markActive();
      } else if (state === 'disconnected') {
        // ═══ ФИКС "висел 5 секунд на линии" ═══
        // Собеседник нажал "завершить" → его peer закрылся → у нас
        // 'disconnected'. Раньше ждали ICE-таймаут (~30 сек).
        // Теперь даём 2.5 сек на восстановление и закрываемся сами.
        schedulePeerGoneCheck();
      } else if (state === 'failed' && !closedRef.current) {
        if (!iceRestartedRef.current) {
          iceRestartedRef.current = true;
          performIceRestart();
        } else {
          toast.error('Соединение потеряно');
          endCall();
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('📡 iceGatheringState:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('📶 signalingState:', pc.signalingState);
    };
  };

  // ── Быстрое определение "собеседник ушёл" ──
  const schedulePeerGoneCheck = () => {
    if (closedRef.current || peerGoneTimerRef.current !== null) return;
    if (callStatus === 'waiting') return; // ещё не соединялись

    peerGoneTimerRef.current = window.setTimeout(() => {
      peerGoneTimerRef.current = null;
      if (closedRef.current) return;

      const pc = peerConnectionRef.current;
      const state = pc?.iceConnectionState;

      if (state === 'connected' || state === 'completed') return; // восстановилось

      console.log('👋 Peer gone (disconnected >', PEER_GONE_GRACE_MS, 'ms) → closing call');
      closedRef.current = true;
      stopSounds();
      toast('Собеседник завершил звонок', { icon: '📞' });
      cleanup();
      onClose();
    }, PEER_GONE_GRACE_MS);
  };

  const clearPeerGoneTimer = () => {
    if (peerGoneTimerRef.current !== null) {
      clearTimeout(peerGoneTimerRef.current);
      peerGoneTimerRef.current = null;
    }
  };

  const maybeCreateOffer = async () => {
    if (!isInitiator) return;
    if (!answerReceivedRef.current) return;
    if (offerSentRef.current) return;
    const pc = peerConnectionRef.current;
    if (!pc || !pcReadyRef.current) return;

    offerSentRef.current = true;
    setCallStatus('connecting');
    await createOffer(false);
  };

  const createOffer = async (iceRestart: boolean) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);

      console.log(`📤 Sending offer${iceRestart ? ' (ICE restart)' : ''}`);
      await axios.post(`/calls/${callId}/signal`, {
        target_id: partnerId,
        type: 'offer',
        data: JSON.stringify(offer),
      });
      lastOfferSdpRef.current = offer.sdp || null;
    } catch (error) {
      console.error('Failed to create offer:', error);
      toast.error('Ошибка отправки сигнала');
    }
  };

  const sendSignal = async (type: string, data: any, target?: number) => {
    try {
      await axios.post(`/calls/${callId}/signal`, {
        target_id: target ?? partnerId,
        type,
        data: typeof data === 'string' ? data : JSON.stringify(data),
      });
    } catch (e) {
      console.error(`Failed to send ${type}:`, e);
    }
  };

  const handleSignal = async (signal: CallSignal) => {
    const pc = peerConnectionRef.current;
    if (!pc || closedRef.current) return;

    try {
      if (signal.signal_type === 'offer') {
        const offer = JSON.parse(signal.data);
        const offerKey = offer.sdp || JSON.stringify(offer);

        if (lastOfferSdpRef.current === offerKey) {
          console.log('⚠️ Duplicate offer ignored');
          return;
        }
        lastOfferSdpRef.current = offerKey;

        if (pc.signalingState === 'have-local-offer') {
          console.warn('♻️ Glare → rollback local offer');
          await pc.setLocalDescription({ type: 'rollback' } as any);
        }

        console.log('📥 Received offer');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        lastAnswerSdpRef.current = answer.sdp || null;

        console.log('📤 Sending answer');
        await sendSignal('answer', answer, signal.from_id);
        return;
      }

      if (signal.signal_type === 'answer') {
        const answer = JSON.parse(signal.data);
        const answerKey = answer.sdp || JSON.stringify(answer);

        if (lastAnswerSdpRef.current === answerKey && remoteDescSetRef.current) {
          console.log('⚠️ Duplicate answer ignored');
          return;
        }

        if (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'stable') {
          console.warn('Ignoring answer in state:', pc.signalingState);
          return;
        }

        console.log('📥 Received answer');
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        lastAnswerSdpRef.current = answerKey;
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        return;
      }

      if (signal.signal_type === 'ice') {
        const raw = signal.data ?? signal.candidate;
        if (!raw) return;

        const candidateInit = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!candidateInit || (!candidateInit.candidate && candidateInit.sdpMid == null)) return;

        const type = getCandidateType(candidateInit);
        if (type === 'relay') hasRelayRef.current = true;
        setRemoteIce((prev) => incrementType(prev, type));

        if (!remoteDescSetRef.current || !pc.remoteDescription) {
          pendingCandidatesRef.current.push(candidateInit);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          console.warn('addIceCandidate failed:', e);
        }
      }
    } catch (error) {
      console.error('❌ handleSignal error:', signal.signal_type, error);
    }
  };

  const flushPendingCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];

    for (const candidateInit of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (e) {
        console.warn('Failed to add queued ICE candidate:', e);
      }
    }
    if (candidates.length) console.log(`✅ Flushed ${candidates.length} queued candidates`);
  };

  const performIceRestart = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || closedRef.current) return;

    try {
      lastOfferSdpRef.current = null;
      if (isInitiator) {
        offerSentRef.current = true;
        await createOffer(true);
      } else {
        pc.restartIce();
      }
    } catch (e) {
      console.warn('ICE restart failed:', e);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // Управление
  // ═════════════════════════════════════════════════════════════

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsAudioEnabled(track.enabled);
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoEnabled(track.enabled);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;

      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          const screenTrack = screenStream.getVideoTracks()[0];
          await sender.replaceTrack(screenTrack);
          screenTrack.onended = () => stopScreenShare();
        }
      }

      await axios.post(`/calls/${callId}/screen-share`, { stream_id: screenStream.id });
      setIsScreenSharing(true);
      toast.success('Демонстрация экрана началась');
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Не удалось начать демонстрацию экрана');
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      const pc = peerConnectionRef.current;
      if (pc && localStreamRef.current) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) await sender.replaceTrack(videoTrack);
        }
      }

      setIsScreenSharing(false);
    } catch (error) {
      console.error('Stop screen share error:', error);
    }
  };

  const endCall = async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopSounds();
    clearPeerGoneTimer();

    try {
      await axios.post(`/calls/${callId}/end`);
    } catch (error) {
      console.error('Failed to end call:', error);
    }

    cleanup();
    onClose();
  };

  const cleanup = () => {
    clearPeerGoneTimer();

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;
      pc.onsignalingstatechange = null;
      try {
        pc.close();
      } catch (e) {
        /* ignore */
      }
      peerConnectionRef.current = null;
    }
    pcReadyRef.current = false;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}:${String(secs).padStart(2, '0')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const statusText = () => {
    if (callStatus === 'active') return formatTime(elapsed);
    if (callStatus === 'connecting') return 'Соединение...';
    return isInitiator ? 'Вызов...' : 'Соединение...';
  };

  // ═════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onPointerDown={handleRootPointerDown}
    >
      <div className="relative w-full h-full max-w-6xl max-h-screen p-4">
        {/*
          iOS-ФИКС: НЕ используем `hidden` (display:none) —
          iOS Safari не воспроизводит звук у скрытого медиа-элемента.
          Вместо этого: 1px, прозрачный, вне потока взаимодействия.
        */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          className="absolute bottom-0 left-0 w-px h-px opacity-0 pointer-events-none"
        />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={
            callType === 'video'
              ? 'w-full h-full object-contain rounded-lg'
              : 'absolute bottom-0 left-0 w-px h-px opacity-0 pointer-events-none'
          }
        />

        {callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
          />
        )}

        {callType === 'audio' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div
              className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-5xl font-bold mb-6 shadow-2xl ${
                callStatus !== 'active' ? 'animate-pulse' : ''
              }`}
            >
              {partnerName?.[0]?.toUpperCase() || '?'}
            </div>
            <h2 className="text-3xl font-bold mb-2">{partnerName}</h2>
            <p className="text-gray-300 text-lg">{statusText()}</p>
          </div>
        )}

        {callType === 'video' && (
          <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg text-white">
            <p className="font-semibold">{partnerName}</p>
            <p className="text-xs text-gray-300">{statusText()}</p>
          </div>
        )}

        {needsPlayGesture && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              forcePlayRemote();
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-2xl z-20 animate-pulse"
          >
            <Volume2 size={20} /> Нажмите, чтобы включить звук
          </button>
        )}

        {isScreenSharing && (
          <div className="absolute top-20 left-4 bg-red-600 px-4 py-2 rounded-lg animate-pulse">
            <p className="text-white font-bold">🔴 Вы демонстрируете экран</p>
          </div>
        )}

        {/* Отладочная плашка:
            relay:0 у обоих = TURN не работает → телефон↔телефон невозможен
            peer ice "нет"  = сигналы не доходят → проблема в WS-хабе
            active + inAudio≈0 = RTP-медиа не долетает (см. ниже) */}
        {callStatus === 'active' && mediaStats.inAudio < 1000 && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-900/85 px-4 py-2 rounded-lg text-xs text-white font-mono text-center leading-relaxed max-w-[90vw] pointer-events-none z-30">
            🔇 Входящий звук НЕ приходит ({Math.round(mediaStats.inAudio / 1024)} КБ).
            <div className="mt-1 text-[10px] text-red-200">
              маршрут медиа: {selectedRoute}
            </div>
            {/srflx/.test(selectedRoute) && !/relay/.test(selectedRoute) ? (
              <div className="mt-1 text-yellow-300">
                ⚠️ ICE выбрал внешний адрес через STUN, но оба пира за ОДНИМ
                NAT провайдера — пакеты уходят наружу и не возвращаются внутрь
                (нет hairpinning). Нужен TURN-relay на сервере с белым IP.
              </div>
            ) : (
              <div className="mt-1">
                Сигнал есть, но RTP-медиа режется NAT/провайдером — нужен
                рабочий TURN-relay.
              </div>
            )}
          </div>
        )}
        {callStatus !== 'active' && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-2 rounded-lg text-[10px] text-gray-300 font-mono text-center leading-relaxed max-w-[90vw] pointer-events-none">
            <div>
              pc: <span className="text-yellow-300">{pcState}</span> · ice:{' '}
              <span className="text-yellow-300">{iceState}</span> ·{' '}
              {isInitiator ? 'звонящий' : 'принимающий'}
            </div>
            <div>
              my ice: <span className="text-cyan-300">{formatIceStats(localIce)}</span>
            </div>
            <div>
              peer ice: <span className="text-cyan-300">{formatIceStats(remoteIce)}</span>
              {Object.keys(remoteIce).length === 0 && (
                <span className="text-red-400"> ← сигналы не доходят</span>
              )}
            </div>
            {!hasRelayRef.current && (
              <div className="text-red-400">⚠ нет relay — TURN не отвечает</div>
            )}
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 sm:gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAudio();
            }}
            className={`p-4 rounded-full ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all active:scale-95`}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {isAudioEnabled ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-white" />}
          </button>

          {callType === 'video' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVideo();
              }}
              className={`p-4 rounded-full ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all active:scale-95`}
              title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isVideoEnabled ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
            </button>
          )}

          {canScreenShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                isScreenSharing ? stopScreenShare() : startScreenShare();
              }}
              className={`p-4 rounded-full ${isScreenSharing ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all active:scale-95`}
              title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
            >
              <Monitor size={24} className="text-white" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all active:scale-95"
            title="Завершить звонок"
          >
            <PhoneOff size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};




// import React, { useEffect, useRef, useState } from 'react';
// import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Monitor } from 'lucide-react';
// import axios from '@/lib/axiosMessenger';
// import toast from 'react-hot-toast';
// import { useWebSocket } from '@/context/WebSocketContext';

// interface CallModalProps {
//   callId: number;
//   isInitiator: boolean;
//   partnerId: number;
//   partnerName: string;
//   callType: 'audio' | 'video';
//   offerSdp?: string; // ДОБАВЛЕНО: для принимающего звонок
//   onClose: () => void;
// }

// export const CallModal: React.FC<CallModalProps> = ({
//   callId,
//   isInitiator,
//   partnerId,
//   partnerName,
//   callType,
//   offerSdp,
//   onClose
// }) => {
//   const [isAudioEnabled, setIsAudioEnabled] = useState(true);
//   const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
//   const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
//   const [isScreenSharing, setIsScreenSharing] = useState(false);

//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
//   const localStreamRef = useRef<MediaStream | null>(null);
//   const screenStreamRef = useRef<MediaStream | null>(null);

//   const { voiceSignal } = useWebSocket();

//   useEffect(() => {
//     initializeCall();
//     return () => cleanup();
//   }, []);

//   // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Обработка WebRTC сигналов
//   useEffect(() => {
//     if (!voiceSignal || voiceSignal.call_id !== callId) return;

//     handleSignal(voiceSignal);
//   }, [voiceSignal]);

//   // ДОБАВЛЕНО: Слушаем событие закрытия модалки
//   useEffect(() => {
//     const handleCloseModal = (event: any) => {
//       const { reason, duration } = event.detail || {};
      
//       console.log('🔴 Closing call modal:', reason);
      
//       if (reason === 'declined') {
//         toast.error('Собеседник отклонил звонок');
//       } else if (reason === 'ended' && duration) {
//         toast.success(`Звонок завершён (${formatTime(duration)})`);
//       }
      
//       cleanup();
//       onClose();
//     };

//     window.addEventListener('close-call-modal', handleCloseModal);
    
//     return () => {
//       window.removeEventListener('close-call-modal', handleCloseModal);
//     };
//   }, [onClose]);

//   const initializeCall = async () => {
//     try {
//       const constraints: MediaStreamConstraints = {
//         audio: true,
//         video: callType === 'video'
//       };

//       const stream = await navigator.mediaDevices.getUserMedia(constraints);
//       localStreamRef.current = stream;

//       if (localVideoRef.current) {
//         localVideoRef.current.srcObject = stream;
//       }

//       await setupPeerConnection(stream);

//       // ИСПРАВЛЕНО: Если это принимающий и есть offer, сразу обрабатываем
//       if (!isInitiator && offerSdp) {
//         console.log('📥 Processing initial offer');
//         const peerConnection = peerConnectionRef.current;
//         if (peerConnection) {
//           await peerConnection.setRemoteDescription(
//             new RTCSessionDescription(JSON.parse(offerSdp))
//           );

//           const answer = await peerConnection.createAnswer();
//           await peerConnection.setLocalDescription(answer);

//           console.log('📤 Sending answer');
//           await axios.post(`/calls/${callId}/signal`, {
//             target_id: partnerId,
//             type: 'answer',
//             data: JSON.stringify(answer)
//           });
//         }
//       } else if (isInitiator) {
//         await createOffer();
//       }

//     } catch (error) {
//       console.error('Failed to initialize call:', error);
//       toast.error('Не удалось получить доступ к камере/микрофону');
//       onClose();
//     }
//   };

//   const setupPeerConnection = async (stream: MediaStream) => {
//     const configuration: RTCConfiguration = {
//       iceServers: [
//         { urls: 'stun:stun.l.google.com:19302' },
//         { urls: 'stun:stun1.l.google.com:19302' },
//         { urls: 'stun:stun2.l.google.com:19302' }
//       ]
//     };

//     const peerConnection = new RTCPeerConnection(configuration);
//     peerConnectionRef.current = peerConnection;

//     stream.getTracks().forEach(track => {
//       peerConnection.addTrack(track, stream);
//     });

//     peerConnection.ontrack = (event) => {
//       console.log('🎥 Received remote stream');
//       if (remoteVideoRef.current && event.streams[0]) {
//         remoteVideoRef.current.srcObject = event.streams[0];
//         setCallStatus('active');
//       }
//     };

//     peerConnection.onicecandidate = async (event) => {
//       if (event.candidate) {
//         console.log('📡 Sending ICE candidate');
//         await axios.post(`/calls/${callId}/ice`, {
//           candidate: JSON.stringify(event.candidate)
//         });
//       }
//     };

//     peerConnection.oniceconnectionstatechange = () => {
//       console.log('ICE connection state:', peerConnection.iceConnectionState);
//       if (peerConnection.iceConnectionState === 'disconnected') {
//         toast.error('Соединение потеряно');
//         endCall();
//       }
//     };
//   };

//   const createOffer = async () => {
//     const peerConnection = peerConnectionRef.current;
//     if (!peerConnection) return;

//     try {
//       const offer = await peerConnection.createOffer();
//       await peerConnection.setLocalDescription(offer);

//       console.log('📤 Sending offer');
      
//       // ИСПРАВЛЕНО: Используем правильный endpoint
//       await axios.post(`/calls/${callId}/signal`, {
//         target_id: partnerId,
//         type: 'offer',
//         data: JSON.stringify(offer)
//       });

//     } catch (error) {
//       console.error('Failed to create offer:', error);
//       toast.error('Ошибка отправки сигнала');
//     }
//   };

//    const handleSignal = async (signal: any) => {
//     const peerConnection = peerConnectionRef.current;
//     if (!peerConnection) return;

//     try {
//       if (signal.signal_type === 'offer') {
//         console.log('📥 Received offer');
//         const offer = JSON.parse(signal.data);
//         await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

//         const answer = await peerConnection.createAnswer();
//         await peerConnection.setLocalDescription(answer);

//         console.log('📤 Sending answer');
        
//         // ИСПРАВЛЕНО: Используем правильный endpoint
//         await axios.post(`/calls/${callId}/signal`, {
//           target_id: signal.from_id, // Отправляем ответ тому, кто звонит
//           type: 'answer',
//           data: JSON.stringify(answer)
//         });

//       } else if (signal.signal_type === 'answer') {
//         console.log('📥 Received answer');
//         const answer = JSON.parse(signal.data);
//         await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

//       } else if (signal.signal_type === 'ice') {
//         console.log('📥 Received ICE candidate');
//         const candidate = JSON.parse(signal.data);
//         await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
//       }

//     } catch (error) {
//       console.error('Error handling signal:', error);
//       toast.error('Ошибка обработки сигнала');
//     }
//   };

//   const toggleAudio = () => {
//     if (localStreamRef.current) {
//       const audioTrack = localStreamRef.current.getAudioTracks()[0];
//       if (audioTrack) {
//         audioTrack.enabled = !audioTrack.enabled;
//         setIsAudioEnabled(audioTrack.enabled);
//       }
//     }
//   };

//   const toggleVideo = () => {
//     if (localStreamRef.current) {
//       const videoTrack = localStreamRef.current.getVideoTracks()[0];
//       if (videoTrack) {
//         videoTrack.enabled = !videoTrack.enabled;
//         setIsVideoEnabled(videoTrack.enabled);
//       }
//     }
//   };

//   const startScreenShare = async () => {
//     try {
//       const screenStream = await navigator.mediaDevices.getDisplayMedia({
//         video: { 
//           // @ts-ignore
//           cursor: 'always' 
//         } as MediaTrackConstraints,
//         audio: false
//       });

//       screenStreamRef.current = screenStream;

//       const peerConnection = peerConnectionRef.current;
//       if (peerConnection) {
//         const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
//         if (sender) {
//           const screenTrack = screenStream.getVideoTracks()[0];
//           await sender.replaceTrack(screenTrack);

//           screenTrack.onended = () => {
//             stopScreenShare();
//           };
//         }
//       }

//       const response = await axios.post(`/calls/${callId}/screen-share`, {
//         stream_id: screenStream.id
//       });

//       setIsScreenSharing(true);
//       toast.success('Демонстрация экрана началась');

//     } catch (error) {
//       console.error('Screen share error:', error);
//       toast.error('Не удалось начать демонстрацию экрана');
//     }
//   };

//   const stopScreenShare = async () => {
//     try {
//       if (screenStreamRef.current) {
//         screenStreamRef.current.getTracks().forEach(track => track.stop());
//         screenStreamRef.current = null;
//       }

//       const peerConnection = peerConnectionRef.current;
//       if (peerConnection && localStreamRef.current) {
//         const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
//         if (sender) {
//           const videoTrack = localStreamRef.current.getVideoTracks()[0];
//           if (videoTrack) {
//             await sender.replaceTrack(videoTrack);
//           }
//         }
//       }

//       setIsScreenSharing(false);
//       toast.success('Демонстрация экрана завершена');

//     } catch (error) {
//       console.error('Stop screen share error:', error);
//     }
//   };

//   const endCall = async () => {
//     try {
//       await axios.post(`/calls/${callId}/end`);
      
//       // ИСПРАВЛЕНО: Не вызываем onClose сразу, ждём WebSocket события
//       cleanup();
      
//     } catch (error) {
//       console.error('Failed to end call:', error);
//       toast.error('Ошибка завершения звонка');
      
//       // Закрываем принудительно при ошибке
//       cleanup();
//       onClose();
//     }
//   };

//   const cleanup = () => {
//     if (isScreenSharing) {
//       stopScreenShare();
//     }
//     if (localStreamRef.current) {
//       localStreamRef.current.getTracks().forEach(track => track.stop());
//     }
//     if (peerConnectionRef.current) {
//       peerConnectionRef.current.close();
//     }
//   };

//   // Вспомогательная функция форматирования времени
//   const formatTime = (seconds: number) => {
//     if (seconds < 60) return `${seconds} сек`;
//     const minutes = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     if (minutes < 60) return `${minutes}:${String(secs).padStart(2, '0')}`;
//     const hours = Math.floor(minutes / 60);
//     const mins = minutes % 60;
//     return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
//       <div className="relative w-full h-full max-w-6xl max-h-screen p-4">

//         <video
//           ref={remoteVideoRef}
//           autoPlay
//           playsInline
//           className="w-full h-full object-contain rounded-lg"
//         />

//         {callType === 'video' && (
//           <video
//             ref={localVideoRef}
//             autoPlay
//             playsInline
//             muted
//             className="absolute top-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
//           />
//         )}

//         {isScreenSharing && (
//           <div className="absolute top-4 left-4 bg-red-600 px-4 py-2 rounded-lg animate-pulse">
//             <p className="text-white font-bold">🔴 Вы демонстрируете экран</p>
//           </div>
//         )}

//         {callStatus === 'connecting' && (
//           <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
//             <p className="text-white">Соединение с {partnerName}...</p>
//           </div>
//         )}

//         <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
//           <button
//             onClick={toggleAudio}
//             className={`p-4 rounded-full ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all`}
//             title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
//           >
//             {isAudioEnabled ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-white" />}
//           </button>

//           {callType === 'video' && (
//             <button
//               onClick={toggleVideo}
//               className={`p-4 rounded-full ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all`}
//               title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
//             >
//               {isVideoEnabled ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
//             </button>
//           )}

//           <button
//             onClick={isScreenSharing ? stopScreenShare : startScreenShare}
//             className={`p-4 rounded-full ${isScreenSharing ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all`}
//             title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
//           >
//             <Monitor size={24} className="text-white" />
//           </button>

//           <button
//             onClick={endCall}
//             className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
//             title="Завершить звонок"
//           >
//             <PhoneOff size={24} className="text-white" />
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };