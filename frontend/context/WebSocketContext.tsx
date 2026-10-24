// frontend/context/WebSocketContext.tsx
// ИЗМЕНЕНИЯ:
// 1. ЗАЩИТА ОТ СКЛЕЕННЫХ КАДРОВ: если сервер всё-таки пришлёт несколько
//    JSON в одном кадре (или придёт кэш старых фреймов), разбиваем по "\n"
//    и парсим каждый отдельно. Один битый чанк больше НЕ убивает остальные —
//    раньше SyntaxError ронял весь onmessage, и call_ended терялся.
// 2. Все call-события идут через callSignalBus (синхронная доставка,
//    без потерь на батчинге React).
// 3. getUserMedia синхронно в onClick — обязательно для Android/iOS.
// 4. Keepalive-пинг + переподключение при возврате вкладки в фокус
//    (мобильный NAT убивает idle-соединения → звонки приходили "через раз").

"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import axios from '@/lib/axiosMessenger';
import { startRingtone, stopSounds } from '@/lib/ringtone';
import { emitCallSignal, clearCallSignals } from '@/lib/callSignalBus';

export interface Message {
  id: number;
  conversation_id?: number;
  group_id?: number;
  sender_id: number;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
}

interface WebSocketContextType {
  sendMessage: (payload: any, content: string) => void;
  lastJsonMessage: Message | null;
  isConnected: boolean;
  incomingCall: any | null;
  voiceSignal: any | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const CLIENT_PING_INTERVAL_MS = 25000;
const RECONNECT_DELAY_MS = 2500;

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, user } = useAuth();

  const [lastJsonMessage, setLastJsonMessage] = useState<Message | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [voiceSignal, setVoiceSignal] = useState<any>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const userRef = useRef(user);
  const incomingCallToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const dismissIncomingToast = () => {
    if (incomingCallToastIdRef.current !== null) {
      toast.dismiss(incomingCallToastIdRef.current);
      incomingCallToastIdRef.current = null;
    }
  };

  const stopKeepAlive = () => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const startKeepAlive = (socket: WebSocket) => {
    stopKeepAlive();
    pingIntervalRef.current = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        } catch (e) {
          console.warn('keepalive failed', e);
        }
      }
    }, CLIENT_PING_INTERVAL_MS);
  };

  // ══════════════════════════════════════════════════════════════
  // Обработка ОДНОГО распарсенного события
  // ══════════════════════════════════════════════════════════════
  const handleSocketEvent = (data: any) => {
    switch (data.type) {
      case 'pong':
        break;

      case 'new_message': {
        const msg = data.payload;
        setLastJsonMessage(msg);

        window.dispatchEvent(new CustomEvent('ws-new-message', { detail: msg }));

        const currentUser = userRef.current;
        if (currentUser && Number(msg.sender_id) !== Number(currentUser.id)) {
          setTimeout(() => {
            toast.custom(
              (t) => (
                <div
                  className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer border-l-4 border-blue-500`}
                  onClick={() => {
                    toast.dismiss(t.id);
                    window.location.href = '/bubble';
                  }}
                >
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                          {msg.sender_username?.[0]?.toUpperCase() || '?'}
                        </div>
                      </div>
                      <div className="ml-3 flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {msg.sender_username}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-300 line-clamp-2 break-words">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ),
              { duration: 4000, position: 'top-right' }
            );
          }, 0);
        }
        break;
      }

      case 'message_updated':
        window.dispatchEvent(
          new CustomEvent('message-updated', { detail: data.payload })
        );
        break;

      case 'message_deleted':
        window.dispatchEvent(
          new CustomEvent('message-deleted', { detail: data.payload })
        );
        break;

      case 'message_pinned':
        window.dispatchEvent(
          new CustomEvent('message-pinned', { detail: data.payload })
        );
        break;

      // кто-то прочитал сообщения → обновляем галочки ✓✓ ═══
      case 'messages_read':
        window.dispatchEvent(
          new CustomEvent('messages-read', { detail: data.payload })
        );
        break;

      case 'group_updated':
        window.dispatchEvent(
          new CustomEvent('group-updated', { detail: data.payload })
        );
        break;

      // пользователя удалили из группы 
      case 'removed_from_group':
        window.dispatchEvent(
          new CustomEvent('removed-from-group', { detail: data.payload })
        );
        toast.error(`Вас удалили из группы «${data.payload?.group_name || ''}»`);
        break;

      case 'contact_updated':
        window.dispatchEvent(
          new CustomEvent('contact-updated', { detail: data.payload })
        );
        break;

      case 'incoming_call': {
        clearCallSignals();
        setIncomingCall(data.payload);
        setVoiceSignal(null);

        startRingtone();

        const callerName = data.payload.initiator_name || 'Собеседник';
        const isVideo = data.payload.type === 'video';

        incomingCallToastIdRef.current = toast.custom(
          (t) => (
            <div className="bg-blue-600 text-white p-4 rounded-lg shadow-xl max-w-md">
              <p className="font-bold text-lg mb-2">📞 Входящий звонок</p>
              <p className="text-sm mb-1 font-semibold">От: {callerName}</p>
              <p className="text-sm mb-3">{isVideo ? '📹 Видеозвонок' : '📞 Аудиозвонок'}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    stopSounds();
                    toast.dismiss(t.id);
                    setIncomingCall(null);

                    // ═══ КРИТИЧНО ДЛЯ ANDROID/iOS ═══
                    // getUserMedia вызывается СИНХРОННО в обработчике клика.
                    // Любой await до него снимает user-activation, и мобильный
                    // браузер блокирует микрофон.
                    let mediaPromise: Promise<MediaStream> | undefined;
                    try {
                      mediaPromise = navigator.mediaDevices.getUserMedia({
                        audio: {
                          echoCancellation: true,
                          noiseSuppression: true,
                          autoGainControl: true,
                        },
                        video: isVideo,
                      });
                      mediaPromise.catch(() => {});
                    } catch (e) {
                      console.error('getUserMedia sync failed:', e);
                    }

                    window.dispatchEvent(
                      new CustomEvent('accept-call', {
                        detail: {
                          callId: data.payload.call_id,
                          partnerId: data.payload.initiator_id,
                          partnerName: callerName,
                          callType: data.payload.type,
                          isInitiator: false,
                          offerSdp: data.payload.offer_sdp || undefined,
                          mediaPromise,
                        },
                      })
                    );

                    (async () => {
                      try {
                        await axios.post(`/calls/${data.payload.call_id}/answer`, {});
                      } catch (error: any) {
                        console.error('Failed to answer call:', error);
                        toast.error(error?.response?.data?.error || 'Не удалось принять звонок');

                        const stream = await mediaPromise?.catch(() => null);
                        stream?.getTracks().forEach((tr) => tr.stop());

                        window.dispatchEvent(
                          new CustomEvent('close-call-modal', {
                            detail: { reason: 'ended', call_id: data.payload.call_id },
                          })
                        );
                      }
                    })();
                  }}
                  className="flex-1 bg-green-500 px-4 py-2 rounded hover:bg-green-600 font-semibold"
                >
                  Принять
                </button>
                <button
                  onClick={async () => {
                    stopSounds();
                    toast.dismiss(t.id);
                    setIncomingCall(null);
                    try {
                      await axios.post(`/calls/${data.payload.call_id}/decline`);
                    } catch (e) {
                      console.warn('Decline error:', e);
                    }
                  }}
                  className="flex-1 bg-red-500 px-4 py-2 rounded hover:bg-red-600 font-semibold"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ),
          { duration: 30000, position: 'top-right' }
        );
        break;
      }

      case 'call_answered':
        toast.success('Звонок принят');
        emitCallSignal({
          call_id: data.payload.call_id,
          from_id: data.payload.receiver_id ?? data.payload.from_id,
          signal_type: 'answered',
        });
        break;

      case 'call_declined':
        stopSounds();
        dismissIncomingToast();
        clearCallSignals();
        toast.error('Звонок отклонён');
        setIncomingCall(null);
        setVoiceSignal(null);
        window.dispatchEvent(
          new CustomEvent('close-call-modal', {
            detail: { reason: 'declined', call_id: data.payload?.call_id },
          })
        );
        break;

      case 'call_ended':
        stopSounds();
        dismissIncomingToast();
        clearCallSignals();
        setIncomingCall(null);
        setVoiceSignal(null);

        if (data.payload?.reason === 'expired') {
          toast('Звонок истёк', { icon: '⌛' });
        } else {
          toast('Звонок завершён');
        }

        window.dispatchEvent(
          new CustomEvent('close-call-modal', {
            detail: {
              reason: 'ended',
              call_id: data.payload?.call_id,
              duration: data.payload?.duration,
            },
          })
        );
        break;

      case 'ice_candidate':
        emitCallSignal({
          call_id: data.payload.call_id,
          from_id: data.payload.from_id,
          signal_type: 'ice',
          data: data.payload.data ?? data.payload.candidate,
        });
        break;

      case 'voice_signal':
        emitCallSignal({
          call_id: data.payload.call_id,
          from_id: data.payload.from_id,
          signal_type: data.payload.signal_type,
          data: data.payload.data,
        });
        break;

      case 'user_joined_voice':
        toast('Пользователь присоединился к голосовому каналу');
        break;

      case 'user_left_voice':
        toast('Пользователь покинул голосовой канал');
        break;

      case 'screen_share_started':
        toast('Началась демонстрация экрана');
        break;

      case 'screen_share_stopped':
        toast('Демонстрация экрана завершена');
        break;

      default:
        console.log('Unknown WS event:', data.type);
    }
  };

  const connect = useCallback(() => {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');

    if (!token) {
      console.error('❌ No token found for WebSocket');
      return;
    }

    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL
      ? `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`
      : `${wsProtocol}//${wsHost}/ws?token=${token}`;

    console.log('🔗 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ Global WS Connected');
      setIsConnected(true);
      startKeepAlive(socket);
      toast.success('Подключено к чату', { duration: 2000, position: 'bottom-right' });
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    socket.onclose = (e) => {
      console.log('⚠️ Global WS Disconnected', {
        code: e.code,
        reason: e.reason || 'No reason provided',
        wasClean: e.wasClean,
      });

      setIsConnected(false);
      stopKeepAlive();
      socketRef.current = null;

      if (e.code === 1006) {
        toast.error('Соединение прервано. Переподключение...', {
          duration: 3000,
          position: 'bottom-right',
        });
      }

      if (isLoggedIn && e.code !== 1000) {
        if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          console.log('🔄 Reconnecting WebSocket...');
          connect();
        }, RECONNECT_DELAY_MS);
      }
    };

    // ══════════════════════════════════════════════════════════
    // ИСПРАВЛЕНО: SyntaxError "Unexpected non-whitespace character
    // after JSON at position 332 (line 2 column 1)"
    //
    // Сервер мог прислать несколько JSON-объектов в одном кадре
    // (склейка через "\n"). JSON.parse по всему кадру падал, и
    // ВСЁ содержимое терялось — включая call_ended.
    //
    // Теперь: режем кадр по переводам строк и парсим каждый чанк
    // отдельно. Битый чанк логируется и пропускается, остальные
    // обрабатываются штатно.
    // ══════════════════════════════════════════════════════════
    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw) return;

      const chunks = raw.indexOf('\n') !== -1 ? raw.split('\n') : [raw];

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;

        let data: any;
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          console.warn(
            '⚠️ WS chunk parse error (пропущен):',
            trimmed.slice(0, 150),
            e
          );
          continue;
        }

        try {
          handleSocketEvent(data);
        } catch (e) {
          console.error('❌ WS event handler error:', data?.type, e);
        }
      }
    };

    socketRef.current = socket;
  }, [isLoggedIn]);

  const sendMessage = useCallback(
    (payload: any, content: string) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
      } else {
        console.warn('WS not open, trying to reconnect...');
        connect();
        toast.error('Соединение восстанавливается... Повторите попытку.');
      }
    },
    [connect]
  );

  useEffect(() => {
    if (isLoggedIn) {
      connect();
    } else {
      socketRef.current?.close();
    }

    // На телефоне после разблокировки экрана сокет уже мёртв,
    // а onclose может не прийти → входящие звонки не долетали
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || !isLoggedIn) return;

      const socket = socketRef.current;
      if (
        !socket ||
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      ) {
        console.log('👁️ Tab visible but WS dead → reconnecting');
        socketRef.current = null;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleVisibility);
      stopKeepAlive();
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
    };
  }, [isLoggedIn, connect]);

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, lastJsonMessage, isConnected, incomingCall, voiceSignal }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};




// "use client";

// import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
// import Cookies from 'js-cookie';
// import toast from 'react-hot-toast';
// import { useAuth } from './AuthContext';
// import axios from '@/lib/axiosMessenger';

// export interface Message {
//   id: number;
//   conversation_id?: number;
//   group_id?: number;
//   sender_id: number;
//   sender_username: string;
//   sender_avatar?: string;
//   content: string;
//   created_at: string;
// }

// interface WebSocketContextType {
//   sendMessage: (payload: any, content: string) => void;
//   lastJsonMessage: Message | null;
//   isConnected: boolean;
//   incomingCall: any | null;
//   voiceSignal: any | null;
// }

// const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
//   const { isLoggedIn, user } = useAuth();

//   const [lastJsonMessage, setLastJsonMessage] = useState<Message | null>(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [incomingCall, setIncomingCall] = useState<any>(null);
//   const [voiceSignal, setVoiceSignal] = useState<any>(null);

//   const socketRef = useRef<WebSocket | null>(null);
//   const userRef = useRef(user);

//   useEffect(() => {
//     userRef.current = user;
//   }, [user]);

//   const connect = useCallback(() => {
//     const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
//     console.log('🔑 Token for WS:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    
//     if (!token) {
//         console.error('❌ No token found for WebSocket');
//         return;
//     }
    
//     if (socketRef.current?.readyState === WebSocket.OPEN || 
//         socketRef.current?.readyState === WebSocket.CONNECTING) {
//         console.log('⚠️ WebSocket already connecting/connected');
//         return;
//     }

//     // ИСПРАВЛЕНО: Всегда добавляем токен в URL
//     const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const wsHost = window.location.host;
    
//     // Формируем URL с токеном
//     let wsUrl: string;
//     if (process.env.NEXT_PUBLIC_WS_URL) {
//         // Если задан полный URL в env, используем его и добавляем токен
//         wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;
//     } else {
//         // Иначе формируем динамически
//         wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}`;
//     }

//     console.log('🔗 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

//     const socket = new WebSocket(wsUrl);

//     socket.onopen = () => {
//         console.log('✅ Global WS Connected');
//         setIsConnected(true);
//         toast.success('Подключено к чату', { duration: 2000, position: 'bottom-right' });
//     };

//     socket.onerror = (error) => {
//         console.error('❌ WebSocket error:', error);
//     };

//     socket.onclose = (e) => {
//         console.log('⚠️ Global WS Disconnected', {
//             code: e.code,
//             reason: e.reason || 'No reason provided',
//             wasClean: e.wasClean
//         });
        
//         setIsConnected(false);
//         socketRef.current = null;
        
//         // Расшифровка кодов закрытия
//         if (e.code === 1006) {
//             console.error('❌ Abnormal closure - likely authentication or network issue');
//             toast.error('Соединение прервано. Переподключение...', { 
//                 duration: 3000, 
//                 position: 'bottom-right' 
//             });
//         } else if (e.code === 1000) {
//             console.log('✅ Normal closure');
//         } else if (e.code === 1001) {
//             console.log('⚠️ Going away');
//         }
        
//         // Автореконнект через 3 секунды (только если залогинен)
//         if (isLoggedIn && e.code !== 1000) {
//             setTimeout(() => {
//                 console.log('🔄 Attempting to reconnect WebSocket...');
//                 connect();
//             }, 3000);
//         }
//     };

//     socket.onmessage = (event) => {
//         try {
//             const data = JSON.parse(event.data);
            
//             // Обработка разных типов событий
//             switch (data.type) {
//                 case 'new_message':
//                     const msg = data.payload;
//                     setLastJsonMessage(msg);

//                     const currentUser = userRef.current;
                    
//                     console.log("WS Notification Check:", { 
//                         me: currentUser?.id, 
//                         sender: msg.sender_id, 
//                         match: Number(msg.sender_id) !== Number(currentUser?.id) 
//                     });

//                     if (currentUser && Number(msg.sender_id) !== Number(currentUser.id)) {
//                         setTimeout(() => {
//                             toast.custom((t) => (
//                                 <div 
//                                     className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer border-l-4 border-blue-500`}
//                                     onClick={() => {
//                                         toast.dismiss(t.id);
//                                         window.location.href = '/misable'; 
//                                     }}
//                                 >
//                                     <div className="flex-1 w-0 p-4">
//                                         <div className="flex items-start">
//                                             <div className="flex-shrink-0 pt-0.5">
//                                                 <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
//                                                     {msg.sender_username?.[0]?.toUpperCase() || "?"}
//                                                 </div>
//                                             </div>
//                                             <div className="ml-3 flex-1 overflow-hidden">
//                                                 <p className="text-sm font-bold text-gray-900 dark:text-white">
//                                                     {msg.sender_username}
//                                                 </p>
//                                                 <p className="mt-1 text-sm text-gray-500 dark:text-gray-300 line-clamp-2 break-words">
//                                                     {msg.content}
//                                                 </p>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             ), { duration: 4000, position: 'top-right' });
//                         }, 0);
//                     }
//                     break;

//                 case 'incoming_call':
//                     setIncomingCall(data.payload);
                    
//                     toast.custom((t) => (
//                         <div className="bg-blue-600 text-white p-4 rounded-lg shadow-xl max-w-md">
//                             <p className="font-bold text-lg mb-2">📞 Входящий звонок</p>
//                             <p className="text-sm mb-3">
//                                 {data.payload.type === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок'}
//                             </p>
//                             <div className="flex gap-2">
//                                 <button
//                                     onClick={async () => {
//                                         try {
//                                             await axios.post(`/calls/${data.payload.call_id}/answer`, {});
                                            
//                                             window.dispatchEvent(new CustomEvent('accept-call', {
//                                                 detail: {
//                                                     callId: data.payload.call_id,
//                                                     partnerId: data.payload.initiator_id,
//                                                     callType: data.payload.type,
//                                                     isInitiator: false
//                                                 }
//                                             }));
                                            
//                                             toast.dismiss(t.id);
//                                         } catch (error) {
//                                             console.error('Failed to answer call:', error);
//                                             toast.error('Не удалось принять звонок');
//                                         }
//                                     }}
//                                     className="flex-1 bg-green-500 px-4 py-2 rounded hover:bg-green-600 font-semibold">
//                                     Принять
//                                 </button>
//                                 <button
//                                     onClick={async () => {
//                                         await axios.post(`/calls/${data.payload.call_id}/decline`);
//                                         toast.dismiss(t.id);
//                                     }}
//                                     className="flex-1 bg-red-500 px-4 py-2 rounded hover:bg-red-600 font-semibold"
//                                 >
//                                     Отклонить
//                                 </button>
//                             </div>
//                         </div>
//                     ), { duration: 30000, position: 'top-right' });
//                     break;

//                 case 'call_answered':
//                     toast.success('Звонок принят');
//                     setVoiceSignal(data.payload);
//                     break;

//                 case 'call_declined':
//                     toast.error('Звонок отклонён');
//                     setIncomingCall(null);
                    
//                     window.dispatchEvent(new CustomEvent('close-call-modal', {
//                         detail: { reason: 'declined' }
//                     }));
//                     break;

//                 case 'call_ended':
//                     toast('Звонок завершён');
//                     setIncomingCall(null);
                    
//                     window.dispatchEvent(new CustomEvent('close-call-modal', {
//                         detail: { 
//                             reason: 'ended',
//                             duration: data.payload.duration 
//                         }
//                     }));
//                     break;

//                 case 'ice_candidate':
//                     setVoiceSignal(data.payload);
//                     break;

//                 case 'voice_signal':
//                     setVoiceSignal(data.payload);
//                     break;

//                 case 'user_joined_voice':
//                     toast('Пользователь присоединился к голосовому каналу');
//                     break;

//                 case 'user_left_voice':
//                     toast('Пользователь покинул голосовой канал');
//                     break;

//                 case 'screen_share_started':
//                     toast('Началась демонстрация экрана');
//                     break;

//                 case 'screen_share_stopped':
//                     toast('Демонстрация экрана завершена');
//                     break;

//                 default:
//                     console.log('Unknown WS event:', data.type);
//             }

//         } catch (e) {
//             console.error("WS Parse error", e);
//         }
//     };

//     socketRef.current = socket;
// }, [isLoggedIn]);

//   const sendMessage = useCallback((payload: any, content: string) => {
//     if (socketRef.current?.readyState === WebSocket.OPEN) {
//       socketRef.current.send(JSON.stringify(payload));
//     } else {
//       console.warn("WS not open, trying to reconnect...");
//       connect();
//       toast.error("Соединение восстанавливается... Повторите попытку.");
//     }
//   }, [connect]);

//   useEffect(() => {
//     if (isLoggedIn) {
//       connect();
//     } else {
//       socketRef.current?.close();
//     }

//     return () => {
//       // В dev-режиме лучше не закрывать
//       // if (socketRef.current) socketRef.current.close();
//     };
//   }, [isLoggedIn, connect]);

//   return (
//     <WebSocketContext.Provider value={{
//       sendMessage,
//       lastJsonMessage,
//       isConnected,
//       incomingCall,
//       voiceSignal
//     }}>
//       {children}
//     </WebSocketContext.Provider>
//   );
// };

// export const useWebSocket = () => {
//   const context = useContext(WebSocketContext);
//   if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
//   return context;
// };