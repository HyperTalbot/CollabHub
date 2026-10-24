// components/messenger/ChatInput.tsx
import React, { useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, X, Image as ImageIcon, FileText, Paperclip, Mic, Smile } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_MESSAGE_LENGTH = 4096;

interface ChatInputProps {
  onSendMessage: (text: string, replyToId?: number, files?: File[], replyToIds?: number[]) => void;
  onEditMessage?: (messageId: number, newContent: string) => void;
  replyingTo: any | any[] | null; // Message | Message[] | null
  editingMessage: any | null;
  onCancelReply: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage, onEditMessage, replyingTo, editingMessage, onCancelReply
}) => {
  const [messageContent, setMessageContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ═══ НОВОЕ: лимит 4096 символов ═══
  const overLimit = messageContent.length > MAX_MESSAGE_LENGTH;
  const wasOverLimitRef = React.useRef(false);

  React.useEffect(() => {
    if (overLimit && !wasOverLimitRef.current) {
      // toast с фиксированным id — не спамит при каждом символе
      toast.error(
        `Сообщение превышает ${MAX_MESSAGE_LENGTH} символов, сократите его содержимое`,
        { id: 'msg-over-limit', duration: 4000 }
      );
    }
    wasOverLimitRef.current = overLimit;
  }, [overLimit]);

  // Список сообщений, на которые отвечаем (может быть несколько)
  const replyList: any[] = Array.isArray(replyingTo)
    ? replyingTo
    : replyingTo
      ? [replyingTo]
      : [];

  React.useEffect(() => {
    if (editingMessage) {
      setMessageContent(editingMessage.content);
    }
  }, [editingMessage]);

  // Синхронизация при редактировании + ОЧИСТКА после его закрытия.
  // Отслеживаем переход «редактировали → перестали»: если блок
  // редактирования закрыли крестиком, поле ввода очищается.
  const prevEditingRef = React.useRef<any>(null);
  React.useEffect(() => {
      if (editingMessage) {
          setMessageContent(editingMessage.content);
      } else if (prevEditingRef.current) {
          // editingMessage только что стал null — закрываем редактирование
          setMessageContent('');
      }
      prevEditingRef.current = editingMessage;
  }, [editingMessage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);

      for (const file of newFiles) {
        const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;

        if (file.size > maxSize) {
          toast.error(`Файл ${file.name} слишком большой`);
          continue;
        }

        setSelectedFiles(prev => [...prev, file]);
      }
    }
    setShowAttachMenu(false);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileSelect = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Нет доступа к микрофону");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], "voice_message.webm", { type: 'audio/webm' });

      onSendMessage('', replyingTo?.id, [audioFile]);

      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setRecordingTime(0);
      audioChunksRef.current = [];
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageContent.trim() && selectedFiles.length === 0) return;

    // Блокируем отправку при превышении лимита
    if (messageContent.length > MAX_MESSAGE_LENGTH) {
      toast.error(
        `Сообщение превышает ${MAX_MESSAGE_LENGTH} символов, сократите его содержимое`,
        { id: 'msg-over-limit' }
      );
      return;
    }

    if (editingMessage && onEditMessage) {
      onEditMessage(editingMessage.id, messageContent.trim());
      setMessageContent('');
      onCancelReply();
      return;
    }

    const replyIds = replyList.map((m) => m.id).filter(Boolean);
    onSendMessage(
      messageContent,
      replyIds[0],
      selectedFiles,
      replyIds.length > 1 ? replyIds : undefined
    );

    setMessageContent('');
    setSelectedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 flex-none w-full z-20">
      {(replyingTo || editingMessage) && (
        <div className="mb-3 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500 animate-fadeIn">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
              {editingMessage
                ? 'Редактирование'
                : replyList.length > 1
                  ? `Ответ на ${replyList.length} сообщ.`
                  : 'Ответ на:'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {editingMessage
                ? editingMessage.content
                : replyList[0]?.content || '📎 Вложение'}
              {replyList.length > 1 && ` · + ещё ${replyList.length - 1}`}
            </p>
          </div>
          <button onClick={onCancelReply} className="ml-3 p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar mb-2 animate-fadeIn">
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="relative flex-none w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl border flex items-center justify-center overflow-hidden">
              {file.type.startsWith('image/')
                ? <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                : <FileText size={24} className="text-gray-500" />}
              <button
                onClick={() => removeFile(idx)}
                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 p-3 rounded-xl animate-pulse">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
          <span className="flex-1 font-mono text-red-600 dark:text-red-400 font-bold">{formatTime(recordingTime)}</span>
          <button onClick={cancelRecording} className="text-sm text-gray-500 hover:text-gray-700">Отмена</button>
          <button onClick={stopRecording} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600">
            <Send size={18} />
          </button>
        </div>
      ) : (
        <form className="flex items-end gap-3" onSubmit={handleSend}>
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-3 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            >
              <Paperclip size={22} />
            </button>
            {showAttachMenu && (
              <div className="absolute bottom-14 left-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-scaleIn">
                <button
                  type="button"
                  onClick={() => triggerFileSelect('image/*,video/*')}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                >
                  <ImageIcon size={18} className="text-blue-500" />
                  <span className="text-sm font-medium">Фото/Видео</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileSelect('*/*')}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                >
                  <FileText size={18} className="text-gray-500" />
                  <span className="text-sm font-medium">Файл</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 relative bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
            <TextareaAutosize
              minRows={1}
              maxRows={6}
              placeholder={editingMessage ? "Редактировать..." : "Написать сообщение..."}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none text-sm resize-none custom-scrollbar"
            />
            {/* Счётчик при редактировании / превышении */}
            {(editingMessage || overLimit) && (
              <span className={`text-[11px] font-mono flex-shrink-0 ${overLimit ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {messageContent.length}/{MAX_MESSAGE_LENGTH}
              </span>
            )}
            <button type="button" className="text-gray-400 hover:text-yellow-500 transition-colors">
              <Smile size={20} />
            </button>
          </div>

          {messageContent.trim() || selectedFiles.length > 0 ? (
            <button
              type="submit"
              disabled={overLimit}
              className={`p-3 ${editingMessage ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:hover:scale-100`}
            >
              <Send size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <Mic size={22} />
            </button>
          )}
        </form>
      )}
    </div>
  );
};