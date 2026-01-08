// components/messenger/VoiceChannel.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Users } from 'lucide-react';
import axios from '@/lib/axiosMessenger';
import toast from 'react-hot-toast';

interface VoiceChannelProps {
  channelId: number;
  channelName: string;
  serverId: number;
  onLeave: () => void;
}

interface Participant {
  userId: number;
  username: string;
  avatarUrl?: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

export const VoiceChannel: React.FC<VoiceChannelProps> = ({
  channelId,
  channelName,
  serverId,
  onLeave
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());

  useEffect(() => {
    joinVoiceChannel();
    return () => {
      leaveVoiceChannel();
    };
  }, [channelId]);

  const joinVoiceChannel = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      localStreamRef.current = stream;

      const response = await axios.post(`/channels/${channelId}/voice/join`, {
        stream_id: stream.id
      });

      setParticipants(response.data.participants || []);
      setIsConnected(true);
      toast.success(`Подключено к ${channelName}`);

      for (const participantId of response.data.participants) {
        if (participantId !== getCurrentUserId()) {
          await createPeerConnection(participantId, true);
        }
      }

    } catch (error) {
      console.error('Failed to join voice channel:', error);
      toast.error('Не удалось подключиться к голосовому каналу');
    }
  };

  const createPeerConnection = async (userId: number, isInitiator: boolean) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionsRef.current.set(userId, peerConnection);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      let audioElement = audioElementsRef.current.get(userId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElementsRef.current.set(userId, audioElement);
      }
      
      audioElement.srcObject = remoteStream;
      
      detectSpeaking(remoteStream, userId);
    };

    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await axios.post('/voice/signal', {
          channel_id: channelId,
          target_id: userId,
          type: 'ice',
          data: JSON.stringify(event.candidate)
        });
      }
    };

    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await axios.post('/voice/signal', {
        channel_id: channelId,
        target_id: userId,
        type: 'offer',
        data: JSON.stringify(offer)
      });
    }

    return peerConnection;
  };

  const detectSpeaking = (stream: MediaStream, userId: number) => {
    const audioContext = new AudioContext();

    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 512;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const isSpeaking = average > 10;
      
      setParticipants(prev => 
        prev.map(p => p.userId === userId ? { ...p, isSpeaking } : p)
      );
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast.success(audioTrack.enabled ? 'Микрофон включен' : 'Микрофон выключен');
      }
    }
  };

  const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);

    audioElementsRef.current.forEach(audio => {
      audio.muted = newDeafenState;
    });

    if (newDeafenState && !isMuted) {
      toggleMute();
    }

    toast.success(newDeafenState ? 'Звук отключен' : 'Звук включен');
  };

  const leaveVoiceChannel = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();

      audioElementsRef.current.forEach(audio => audio.pause());
      audioElementsRef.current.clear();

      await axios.post(`/channels/${channelId}/voice/leave`);

      setIsConnected(false);
      onLeave();

    } catch (error) {
      console.error('Failed to leave voice channel:', error);
    }
  };

  const getCurrentUserId = (): number => {
    // TODO: Получить из useAuth()
    return 0;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-green-500">
            <Volume2 size={20} />
            <span className="font-semibold">{channelName}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-sm text-gray-400">{participants.length}</span>
          </div>

          <div className="flex -space-x-2">
            {participants.slice(0, 5).map((participant) => (
              <div
                key={participant.userId}
                className={`relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border-2 ${
                  participant.isSpeaking ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-700'
                } flex items-center justify-center text-white text-xs font-bold overflow-hidden transition-all`}
                title={participant.username}
              >
                {participant.avatarUrl ? (
                  <img src={participant.avatarUrl} alt={participant.username} className="w-full h-full object-cover" />
                ) : (
                  <span>{participant.username[0].toUpperCase()}</span>
                )}
                
                {participant.isMuted && (
                  <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-0.5">
                    <MicOff size={8} className="text-white" />
                  </div>
                )}
              </div>
            ))}
            {participants.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-700 flex items-center justify-center text-white text-xs">
                +{participants.length - 5}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-lg ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            } transition-colors`}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
          </button>

          <button
            onClick={toggleDeafen}
            className={`p-3 rounded-lg ${
              isDeafened ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            } transition-colors`}
            title={isDeafened ? 'Включить звук' : 'Выключить звук'}
          >
            {isDeafened ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
          </button>

          <button
            onClick={leaveVoiceChannel}
            className="p-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
            title="Отключиться"
          >
            <PhoneOff size={20} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};