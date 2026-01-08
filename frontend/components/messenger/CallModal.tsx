// frontend/components/messenger/CallModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Monitor } from 'lucide-react';
import axios from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';
import { useWebSocket } from '@/context/WebSocketContext';

interface CallModalProps {
  callId: number;
  isInitiator: boolean;
  partnerId: number;
  partnerName: string;
  callType: 'audio' | 'video';
  offerSdp?: string; // ДОБАВЛЕНО: для принимающего звонок
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callId,
  isInitiator,
  partnerId,
  partnerName,
  callType,
  offerSdp,
  onClose
}) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const { voiceSignal } = useWebSocket();

  useEffect(() => {
    initializeCall();
    return () => cleanup();
  }, []);

  // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Обработка WebRTC сигналов
  useEffect(() => {
    if (!voiceSignal || voiceSignal.call_id !== callId) return;

    handleSignal(voiceSignal);
  }, [voiceSignal]);

  // ДОБАВЛЕНО: Слушаем событие закрытия модалки
  useEffect(() => {
    const handleCloseModal = (event: any) => {
      const { reason, duration } = event.detail || {};
      
      console.log('🔴 Closing call modal:', reason);
      
      if (reason === 'declined') {
        toast.error('Собеседник отклонил звонок');
      } else if (reason === 'ended' && duration) {
        toast.success(`Звонок завершён (${formatTime(duration)})`);
      }
      
      cleanup();
      onClose();
    };

    window.addEventListener('close-call-modal', handleCloseModal);
    
    return () => {
      window.removeEventListener('close-call-modal', handleCloseModal);
    };
  }, [onClose]);

  const initializeCall = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await setupPeerConnection(stream);

      // ИСПРАВЛЕНО: Если это принимающий и есть offer, сразу обрабатываем
      if (!isInitiator && offerSdp) {
        console.log('📥 Processing initial offer');
        const peerConnection = peerConnectionRef.current;
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(offerSdp))
          );

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          console.log('📤 Sending answer');
          await axios.post(`/calls/${callId}/signal`, {
            target_id: partnerId,
            type: 'answer',
            data: JSON.stringify(answer)
          });
        }
      } else if (isInitiator) {
        await createOffer();
      }

    } catch (error) {
      console.error('Failed to initialize call:', error);
      toast.error('Не удалось получить доступ к камере/микрофону');
      onClose();
    }
  };

  const setupPeerConnection = async (stream: MediaStream) => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      console.log('🎥 Received remote stream');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('active');
      }
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('📡 Sending ICE candidate');
        await axios.post(`/calls/${callId}/ice`, {
          candidate: JSON.stringify(event.candidate)
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'disconnected') {
        toast.error('Соединение потеряно');
        endCall();
      }
    };
  };

  const createOffer = async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      console.log('📤 Sending offer');
      
      // ИСПРАВЛЕНО: Используем правильный endpoint
      await axios.post(`/calls/${callId}/signal`, {
        target_id: partnerId,
        type: 'offer',
        data: JSON.stringify(offer)
      });

    } catch (error) {
      console.error('Failed to create offer:', error);
      toast.error('Ошибка отправки сигнала');
    }
  };

   const handleSignal = async (signal: any) => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    try {
      if (signal.signal_type === 'offer') {
        console.log('📥 Received offer');
        const offer = JSON.parse(signal.data);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        console.log('📤 Sending answer');
        
        // ИСПРАВЛЕНО: Используем правильный endpoint
        await axios.post(`/calls/${callId}/signal`, {
          target_id: signal.from_id, // Отправляем ответ тому, кто звонит
          type: 'answer',
          data: JSON.stringify(answer)
        });

      } else if (signal.signal_type === 'answer') {
        console.log('📥 Received answer');
        const answer = JSON.parse(signal.data);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      } else if (signal.signal_type === 'ice') {
        console.log('📥 Received ICE candidate');
        const candidate = JSON.parse(signal.data);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }

    } catch (error) {
      console.error('Error handling signal:', error);
      toast.error('Ошибка обработки сигнала');
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          // @ts-ignore
          cursor: 'always' 
        } as MediaTrackConstraints,
        audio: false
      });

      screenStreamRef.current = screenStream;

      const peerConnection = peerConnectionRef.current;
      if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          const screenTrack = screenStream.getVideoTracks()[0];
          await sender.replaceTrack(screenTrack);

          screenTrack.onended = () => {
            stopScreenShare();
          };
        }
      }

      const response = await axios.post(`/calls/${callId}/screen-share`, {
        stream_id: screenStream.id
      });

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
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      const peerConnection = peerConnectionRef.current;
      if (peerConnection && localStreamRef.current) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }

      setIsScreenSharing(false);
      toast.success('Демонстрация экрана завершена');

    } catch (error) {
      console.error('Stop screen share error:', error);
    }
  };

  const endCall = async () => {
    try {
      await axios.post(`/calls/${callId}/end`);
      
      // ИСПРАВЛЕНО: Не вызываем onClose сразу, ждём WebSocket события
      cleanup();
      
    } catch (error) {
      console.error('Failed to end call:', error);
      toast.error('Ошибка завершения звонка');
      
      // Закрываем принудительно при ошибке
      cleanup();
      onClose();
    }
  };

  const cleanup = () => {
    if (isScreenSharing) {
      stopScreenShare();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  // Вспомогательная функция форматирования времени
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}:${String(secs).padStart(2, '0')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative w-full h-full max-w-6xl max-h-screen p-4">

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain rounded-lg"
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

        {isScreenSharing && (
          <div className="absolute top-4 left-4 bg-red-600 px-4 py-2 rounded-lg animate-pulse">
            <p className="text-white font-bold">🔴 Вы демонстрируете экран</p>
          </div>
        )}

        {callStatus === 'connecting' && (
          <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
            <p className="text-white">Соединение с {partnerName}...</p>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all`}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            {isAudioEnabled ? <Mic size={24} className="text-white" /> : <MicOff size={24} className="text-white" />}
          </button>

          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'} hover:opacity-80 transition-all`}
              title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isVideoEnabled ? <Video size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
            </button>
          )}

          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`p-4 rounded-full ${isScreenSharing ? 'bg-red-600' : 'bg-gray-700'} hover:opacity-80 transition-all`}
            title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
          >
            <Monitor size={24} className="text-white" />
          </button>

          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
            title="Завершить звонок"
          >
            <PhoneOff size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};