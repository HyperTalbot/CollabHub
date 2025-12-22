// components/messenger/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Reply, Copy, Trash2, Edit2, Pin, Forward, CheckCheck, X, Languages } from 'lucide-react';
import { Message } from '@/types/messenger';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
    msg: Message;
    isMe: boolean;
    senderName?: string;
    senderAvatar?: string;
    time: string;

    // Новые пропсы для централизованного управления меню
    menuPosition: { x: number, y: number } | null; 
    onContextMenu: (e: React.MouseEvent, msgId: number) => void;
    closeMenu: () => void;

    onReply: (msg: Message) => void;
    onPin: (msg: Message) => void;
    onEdit: (msg: Message) => void;
    onDelete: (msgId: number, deleteForBoth: boolean) => void;
    onForward: (msg: Message) => void;
    replyToMessage: Message | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    msg, isMe, senderName, senderAvatar, time, 
    menuPosition, onContextMenu, closeMenu,
    onReply, onPin, onEdit, onDelete, onForward, replyToMessage 
}) => {
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [deleteForBoth, setDeleteForBoth] = React.useState(true);
    const bubbleRef = useRef<HTMLDivElement>(null);

    const getInitials = (name: string) => name?.[0]?.toUpperCase() || '?';

    // Действия меню
    const handleCopy = () => {
        navigator.clipboard.writeText(msg.content);
        toast.success('Скопировано');
        closeMenu();
    };

    const handleDeleteClick = () => {
        closeMenu();
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        onDelete(msg.id, deleteForBoth);
        setShowDeleteModal(false);
        toast.success('Сообщение удалено');
    };

    return (
        <>
             <div className={`group relative mb-2 flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                
                 {/* Аватар собеседника */}
                 {!isMe && senderName && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-sm mb-1">
                        {senderAvatar ? (
                            <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
                        ) : (
                            <span>{getInitials(senderName)}</span>
                        )}
                    </div>
                )}

                <div 
                    ref={bubbleRef}
                    onContextMenu={(e) => onContextMenu(e, msg.id)}
                    className={`relative px-4 py-3 shadow-sm max-w-full break-words
                        ${isMe 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-sm' // Острый угол справа внизу
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm border border-gray-200 dark:border-gray-700' // Острый угол слева внизу
                        }
                        transition-all duration-200 hover:shadow-md cursor-default select-text
                    `}
                >
                    {!isMe && senderName && (
                        <p className="text-xs font-bold text-blue-500 mb-1">{senderName}</p>
                    )}

                    {replyToMessage && (
                        <div className={`mb-1 pl-2 border-l-2 text-xs opacity-90 cursor-pointer 
                            ${isMe ? 'border-white/50 text-blue-100' : 'border-blue-500 text-gray-500 dark:text-gray-400'}`}
                        >
                            <div className="font-semibold">{replyToMessage.sender_id === msg.sender_id ? 'Вы' : 'Собеседник'}</div>
                            <div className="truncate opacity-80">{replyToMessage.content}</div>
                        </div>
                    )}
                    
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {msg.content}
                    </p>
                    
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                        {msg.is_edited && <span>(ред.)</span>}
                        <span>{time}</span>
                        {isMe && <CheckCheck size={12} className="opacity-80" />}
                        {msg.is_pinned && <Pin size={10} className="opacity-80 ml-1" />}
                    </div>
                </div>
            </div>

            {/* Рендерим меню, только если menuPosition передан (значит это сообщение активно) */}
            {menuPosition && (
                <div 
                    className="fixed z-50 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden animate-fadeIn"
                    style={{ top: menuPosition.y, left: menuPosition.x }}
                    onClick={(e) => e.stopPropagation()} 
                >
                    <MenuItem icon={<Reply size={16} />} text="Ответить" onClick={() => { onReply(msg); closeMenu(); }} />
                    <MenuItem icon={<Copy size={16} />} text="Скопировать" onClick={handleCopy} />
                    <MenuItem icon={<Forward size={16} />} text="Переслать" onClick={() => { onForward(msg); closeMenu(); }} />
                    <MenuItem icon={<Pin size={16} />} text="Закрепить" onClick={() => { onPin(msg); closeMenu(); }} />
                    <MenuItem icon={<Languages size={16} />} text="Перевести" onClick={() => { toast.success('Перевод...'); closeMenu(); }} />
                    
                    {isMe && (
                        <>
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <MenuItem icon={<Edit2 size={16} />} text="Изменить" onClick={() => { onEdit(msg); closeMenu(); }} />
                            <MenuItem icon={<Trash2 size={16} />} text="Удалить" color="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleDeleteClick} />
                        </>
                    )}
                </div>
            )}

            {/* Модалка удаления */}
            {showDeleteModal && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
                    onClick={() => setShowDeleteModal(false)}
                >
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 m-4 max-w-sm w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Удалить сообщение?</h3>
                            <button onClick={() => setShowDeleteModal(false)}><X size={20} className="text-gray-500" /></button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Это действие нельзя отменить.</p>
                        {isMe && (
                            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                                <input type="checkbox" checked={deleteForBoth} onChange={(e) => setDeleteForBoth(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Удалить у всех</span>
                            </label>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 rounded-lg font-medium">Отмена</button>
                            <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">Удалить</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const MenuItem = ({ icon, text, onClick, color = "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" }: any) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${color}`}>
        {icon} <span className="font-medium">{text}</span>
    </button>
);