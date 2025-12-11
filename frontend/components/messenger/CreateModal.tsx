// /frontend/components/messenger/CreateModal.tsx
import React, { useState, useEffect } from 'react';
import { Users, Server, X, Upload } from 'lucide-react';
import axios from '@/lib/axiosInstance';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const MESSENGER_API_URL = 'http://localhost:8082/api/v1';

interface CreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

type Step = 'choice' | 'group' | 'server';

export const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreated }) => {
    const [step, setStep] = useState<Step>('choice');
    const [loading, setLoading] = useState(false);

    // Данные форм
    const [groupName, setGroupName] = useState('');
    const [serverName, setServerName] = useState('');
    const [serverDesc, setServerDesc] = useState('');
    const [serverTags, setServerTags] = useState('');

    // Блокировка скролла при открытии
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Сброс при закрытии
    const handleClose = () => {
        setStep('choice');
        setGroupName('');
        setServerName('');
        setServerDesc('');
        setServerTags('');
        onClose();
    };

    // Создание Группы
    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim()) return;
        setLoading(true);
        const token = Cookies.get('authToken') || localStorage.getItem('authToken');
        try {
            await axios.post(`${MESSENGER_API_URL}/groups`, {
                name: groupName,
                participant_ids: [] // Пока только я
            }, { headers: { 'Authorization': `Bearer ${token}` } });
            
            toast.success("Группа создана!");
            onCreated();
            handleClose();
        } catch (err) {
            console.error(err);
            toast.error("Ошибка создания группы");
        } finally {
            setLoading(false);
        }
    };

    // Создание Сервера
    const handleCreateServer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serverName.trim()) return;
        setLoading(true);
        const token = Cookies.get('authToken') || localStorage.getItem('authToken');
        try {
            await axios.post(`${MESSENGER_API_URL}/servers`, {
                name: serverName,
                description: serverDesc,
                tags: serverTags
            }, { headers: { 'Authorization': `Bearer ${token}` } });

            toast.success("Сервер создан!");
            onCreated();
            handleClose();
        } catch (err) {
            console.error(err);
            toast.error("Ошибка создания сервера");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // --- РЕНДЕР КОНТЕНТА ВНУТРИ ---
    const renderContent = () => {
        switch (step) {
            case 'choice':
                return (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button 
                            onClick={() => setStep('group')}
                            className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 border-2 border-transparent hover:border-blue-500 transition-all group"
                        >
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Users size={32} className="text-blue-500" />
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-200">Групповой чат</span>
                            <span className="text-xs text-gray-500 mt-1 text-center">Общение с друзьями</span>
                        </button>

                        <button 
                            onClick={() => setStep('server')}
                            className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-green-50 dark:hover:bg-gray-700 border-2 border-transparent hover:border-green-500 transition-all group"
                        >
                             <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Server size={32} className="text-green-500" />
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-200">Сервер</span>
                            <span className="text-xs text-gray-500 mt-1 text-center">Сообщества и каналы</span>
                        </button>
                    </div>
                );
            
            case 'group':
                return (
                    <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 border-2 border-dashed border-gray-400 dark:border-gray-500">
                                <Users size={32} className="text-gray-400" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название группы</label>
                            <input 
                                type="text" 
                                value={groupName} 
                                onChange={e => setGroupName(e.target.value)}
                                placeholder="Например: Друзья" 
                                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                                autoFocus
                            />
                        </div>
                        
                        <div className="flex justify-between items-center mt-8">
                             <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← Назад</button>
                             <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-lg shadow-blue-500/30 transition-all">
                                 {loading ? "Создание..." : "Создать группу"}
                             </button>
                        </div>
                    </form>
                );

            case 'server':
                return (
                    <form onSubmit={handleCreateServer} className="mt-4 space-y-4">
                         <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 border-2 border-dashed border-gray-400 dark:border-gray-500 relative group">
                              <Server size={32} className="text-gray-400" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload size={24} className="text-white" />
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название сервера</label>
                            <input 
                                type="text" 
                                value={serverName} 
                                onChange={e => setServerName(e.target.value)} 
                                placeholder="Например: Postogram Devs" 
                                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                required 
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                            <textarea 
                                value={serverDesc} 
                                onChange={e => setServerDesc(e.target.value)} 
                                placeholder="О чем этот сервер? (опционально)" 
                                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-20 custom-scrollbar" 
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Хештеги</label>
                            <input 
                                type="text" 
                                value={serverTags} 
                                onChange={e => setServerTags(e.target.value)} 
                                placeholder="gaming, dev, news" 
                                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                            />
                        </div>

                        <div className="flex justify-between items-center mt-8">
                             <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← Назад</button>
                             <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium shadow-lg shadow-green-500/30 transition-all">
                                 {loading ? "Создание..." : "Создать сервер"}
                             </button>
                        </div>
                    </form>
                );
        }
    };

    return (
        // БЭКДРОП (Фон)
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={handleClose} // Закрытие по клику на фон
        >
            {/* МОДАЛЬНОЕ ОКНО */}
            <div 
                className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 m-4 animate-scaleIn transform transition-all"
                onClick={e => e.stopPropagation()} // Чтобы клик внутри не закрывал окно
            >
                {/* Заголовок и Крестик */}
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold text-black dark:text-white">
                        {step === 'choice' ? 'Создать новое' : step === 'group' ? 'Новая группа' : 'Новый сервер'}
                    </h2>
                    <button 
                        onClick={handleClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400">
                     {step === 'choice' ? 'Выберите тип сообщества, которое хотите создать.' : 'Заполните информацию ниже.'}
                </p>

                {renderContent()}
            </div>
        </div>
    );
};