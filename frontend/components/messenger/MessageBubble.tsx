// /components/messenger/MessageBubble.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Reply, Copy, Forward, Pin, Languages, Pen, Trash2 } from 'lucide-react';
import { Message } from '@/types/messenger';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
    msg: Message;
    isMe: boolean;
    time: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isMe, time }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Закрытие меню при клике вне
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); // Блокируем стандартное меню браузера
        setShowMenu(true);
    };

    const handleAction = (action: string) => {
        toast.success(`Действие: ${action}`); // Заглушка
        setShowMenu(false);
    };

    return (
        <div className={`relative group ${isMe ? 'self-end' : 'self-start'} max-w-[60%]`}>
            {/* Само сообщение */}
            <div 
                onContextMenu={handleContextMenu}
                className={`
                    relative px-4 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-wrap break-words w-fit cursor-pointer
                    ${isMe 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-gray-700 text-black dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-gray-600'
                    }
                `}
            >
                {msg.content}
                <div className={`text-[10px] mt-1 text-right w-full opacity-70 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                    {time}
                </div>
            </div>

            {/* Контекстное меню (Telegram Style) */}
            {showMenu && (
                <div 
                    ref={menuRef}
                    className={`absolute z-50 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden animate-fadeIn
                        ${isMe ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'}
                    `}
                >
                    <MenuItem icon={<Reply size={16} />} text="Ответить" onClick={() => handleAction('Ответить')} />
                    <MenuItem icon={<Copy size={16} />} text="Скопировать" onClick={() => { navigator.clipboard.writeText(msg.content); handleAction('Скопировано'); }} />
                    <MenuItem icon={<Forward size={16} />} text="Переслать" onClick={() => handleAction('Переслать')} />
                    <MenuItem icon={<Pin size={16} />} text="Закрепить" onClick={() => handleAction('Закрепить')} />
                    <MenuItem icon={<Languages size={16} />} text="Перевести" onClick={() => handleAction('Перевести')} />
                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                    {isMe && <MenuItem icon={<Pen size={16} />} text="Изменить" onClick={() => handleAction('Изменить')} />}
                    <MenuItem icon={<Trash2 size={16} />} text="Удалить" color="text-red-500" onClick={() => handleAction('Удалить')} />
                </div>
            )}
        </div>
    );
};

const MenuItem = ({ icon, text, onClick, color = "text-gray-700 dark:text-gray-200" }: any) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors ${color}`}
    >
        {icon}
        {text}
    </button>
);