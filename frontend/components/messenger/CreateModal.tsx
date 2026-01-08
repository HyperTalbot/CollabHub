// // components/messenger/CreateModal.tsx
// import React, { useState, useEffect, useRef } from 'react';
// import { Users, Server, X, Upload, Camera } from 'lucide-react';
// import axios from '@/lib/axiosInstance';
// import Cookies from 'js-cookie';
// import toast from 'react-hot-toast';

// const MESSENGER_API_URL = 'http://localhost:8086/api/v1';

// interface CreateModalProps {
//     isOpen: boolean;
//     onClose: () => void;
//     onCreated: () => void;
// }

// type Step = 'choice' | 'group' | 'server';

// export const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreated }) => {
//     const [step, setStep] = useState<Step>('choice');
//     const [loading, setLoading] = useState(false);

//     // Данные форм
//     const [groupName, setGroupName] = useState('');
//     // const [groupAvatar, setGroupAvatar] = useState<File | null>(null); // Временно отключено для JSON
    
//     const [serverName, setServerName] = useState('');
//     const [serverDesc, setServerDesc] = useState('');
//     const [serverTags, setServerTags] = useState('');

//     useEffect(() => {
//         if (isOpen) document.body.style.overflow = 'hidden';
//         else document.body.style.overflow = 'unset';
//         return () => { document.body.style.overflow = 'unset'; };
//     }, [isOpen]);

//     const handleClose = () => {
//         setStep('choice');
//         setGroupName('');
//         setServerName('');
//         setServerDesc('');
//         setServerTags('');
//         onClose();
//     };

//     // Создание Группы (JSON, чтобы убрать ошибку 400)
//     const handleCreateGroup = async (e: React.FormEvent) => {
//         e.preventDefault();
//         if (!groupName.trim()) return;
//         setLoading(true);
//         const token = Cookies.get('authToken') || localStorage.getItem('authToken');
        
//         try {
//             // Исправление: Шлем JSON, так как бэкенд ожидает его. 
//             // Аватарки заработают, когда бэкенд будет принимать Multipart/form-data.
//             await axios.post(`${MESSENGER_API_URL}/groups`, {
//                 name: groupName,
//                 participant_ids: [] // Пустой массив, сервер добавит создателя сам
//             }, { 
//                 headers: { 'Authorization': `Bearer ${token}` } 
//             });
            
//             toast.success("Группа создана!");
//             onCreated();
//             handleClose();
//         } catch (err) {
//             console.error(err);
//             toast.error("Ошибка создания группы");
//         } finally {
//             setLoading(false);
//         }
//     };

//     // Создание Сервера + Канал general
//     const handleCreateServer = async (e: React.FormEvent) => {
//         e.preventDefault();
//         if (!serverName.trim()) return;
//         setLoading(true);
//         const token = Cookies.get('authToken') || localStorage.getItem('authToken');
//         try {
//             // 1. Создаем сервер
//             const serverRes = await axios.post(`${MESSENGER_API_URL}/servers`, {
//                 name: serverName,
//                 description: serverDesc,
//                 tags: serverTags
//             }, { headers: { 'Authorization': `Bearer ${token}` } });

//             const newServerId = serverRes.data.id;

//             // 2. Исправление: Сразу создаем канал "general"
//             if (newServerId) {
//                 await axios.post(`${MESSENGER_API_URL}/channels`, {
//                     name: "general",
//                     type: "text",
//                     server_id: newServerId
//                 }, { headers: { 'Authorization': `Bearer ${token}` } });
//             }

//             toast.success("Сервер создан!");
//             onCreated();
//             handleClose();
//         } catch (err) {
//             console.error(err);
//             toast.error("Ошибка создания сервера");
//         } finally {
//             setLoading(false);
//         }
//     };

//     if (!isOpen) return null;

//     const renderContent = () => {
//         switch (step) {
//             case 'choice':
//                 return (
//                     <div className="grid grid-cols-2 gap-4 mt-6">
//                         <button onClick={() => setStep('group')} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 border-2 border-transparent hover:border-blue-500 transition-all group">
//                             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
//                                 <Users size={32} className="text-blue-500" />
//                             </div>
//                             <span className="font-bold text-gray-700 dark:text-gray-200">Групповой чат</span>
//                         </button>
//                         <button onClick={() => setStep('server')} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-green-50 border-2 border-transparent hover:border-green-500 transition-all group">
//                              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
//                                 <Server size={32} className="text-green-500" />
//                             </div>
//                             <span className="font-bold text-gray-700 dark:text-gray-200">Сервер</span>
//                         </button>
//                     </div>
//                 );
            
//             case 'group':
//                 return (
//                     <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
//                         <div className="flex justify-center mb-6">
//                             <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-500">
//                                 <Users size={32} className="text-gray-400" />
//                             </div>
//                         </div>
                        
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название группы</label>
//                             <input 
//                                 type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
//                                 placeholder="Например: Друзья" 
//                                 className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
//                                 required autoFocus
//                             />
//                         </div>
                        
//                         <div className="flex justify-between items-center mt-8">
//                              <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700">← Назад</button>
//                              <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-all">
//                                  {loading ? "Создание..." : "Создать группу"}
//                              </button>
//                         </div>
//                     </form>
//                 );

//             case 'server':
//                 return (
//                     <form onSubmit={handleCreateServer} className="mt-4 space-y-4">
//                          <div className="flex justify-center mb-6">
//                             <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 relative group">
//                                 <Server size={32} className="text-gray-400" />
//                             </div>
//                         </div>
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название сервера</label>
//                             <input type="text" value={serverName} onChange={e => setServerName(e.target.value)} placeholder="Например: Gaming Club" className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" required autoFocus/>
//                         </div>
//                         <div>
//                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
//                             <textarea value={serverDesc} onChange={e => setServerDesc(e.target.value)} placeholder="О чем этот сервер?" className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" />
//                         </div>
//                          <div>
//                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Хештеги</label>
//                             <input type="text" value={serverTags} onChange={e => setServerTags(e.target.value)} placeholder="gaming, news" className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
//                         </div>
//                         <div className="flex justify-between items-center mt-8">
//                              <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700">← Назад</button>
//                              <button type="submit" disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-all">
//                                  {loading ? "Создание..." : "Создать сервер"}
//                              </button>
//                         </div>
//                     </form>
//                 );
//         }
//     };

//     return (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={handleClose}>
//             <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 m-4 animate-scaleIn" onClick={e => e.stopPropagation()}>
//                 <div className="flex justify-between items-center mb-2">
//                     <h2 className="text-2xl font-bold text-black dark:text-white">
//                         {step === 'choice' ? 'Создать новое' : step === 'group' ? 'Новая группа' : 'Новый сервер'}
//                     </h2>
//                     <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
//                 </div>
//                 {renderContent()}
//             </div>
//         </div>
//     );
// };


// /components/messenger/CreateModal.tsx
import React, { useState, useEffect } from 'react';
import { Users, Server, X, Search, Check } from 'lucide-react';
import axiosMessenger from '@/lib/axiosMessenger';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const MESSENGER_API_URL = 'http://localhost:8086/api/v1';

interface CreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

interface Contact {
    id: number;
    username: string;
    avatar_url?: string;
}

type Step = 'choice' | 'group' | 'group-members' | 'server';

export const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreated }) => {
    const [step, setStep] = useState<Step>('choice');
    const [loading, setLoading] = useState(false);

    // Данные форм
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [serverName, setServerName] = useState('');
    const [serverDesc, setServerDesc] = useState('');
    const [serverTags, setServerTags] = useState('');

    // Загрузка контактов
    useEffect(() => {
        if (step === 'group-members') {
            loadContacts();
        }
    }, [step]);

    const loadContacts = async () => {
        try {
            // Загружаем всех пользователей из чатов как потенциальных участников
            const { data } = await axiosMessenger.get('/conversations');
            
            const uniqueUsers = new Map<number, Contact>();
            
            data.forEach((conv: any) => {
                conv.participants?.forEach((p: Contact) => {
                    if (!uniqueUsers.has(p.id)) {
                        uniqueUsers.set(p.id, p);
                    }
                });
            });
            
            setContacts(Array.from(uniqueUsers.values()));
        } catch (err) {
            console.error('Failed to load contacts', err);
            toast.error('Не удалось загрузить контакты');
        }
    };

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleClose = () => {
        setStep('choice');
        setGroupName('');
        setSelectedMembers([]);
        setSearchTerm('');
        setServerName('');
        setServerDesc('');
        setServerTags('');
        onClose();
    };

    const toggleMember = (userId: number) => {
        setSelectedMembers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Создание Группы
    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error('Введите название группы');
            return;
        }
        
        setLoading(true);
        const token = Cookies.get('authToken') || localStorage.getItem('authToken');
        
        try {
            await axiosMessenger.post('/groups', {
                name: groupName,
                participant_ids: selectedMembers
            }, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
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
            const serverRes = await axiosMessenger.post('/servers', {
                name: serverName,
                description: serverDesc,
                tags: serverTags
            }, { headers: { 'Authorization': `Bearer ${token}` } });

            const newServerId = serverRes.data.id;

            if (newServerId) {
                await axiosMessenger.post('/channels', {
                    name: "general",
                    type: "text",
                    server_id: newServerId
                }, { headers: { 'Authorization': `Bearer ${token}` } });
            }

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

    const filteredContacts = contacts.filter(c => 
        c.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderContent = () => {
        switch (step) {
            case 'choice':
                return (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button onClick={() => setStep('group')} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 border-2 border-transparent hover:border-blue-500 transition-all group">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Users size={32} className="text-blue-500" />
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-200">Групповой чат</span>
                        </button>
                        <button onClick={() => setStep('server')} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-green-50 border-2 border-transparent hover:border-green-500 transition-all group">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Server size={32} className="text-green-500" />
                            </div>
                            <span className="font-bold text-gray-700 dark:text-gray-200">Сервер</span>
                        </button>
                    </div>
                );
            
            case 'group':
                return (
                    <div className="mt-4 space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-500">
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
                                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required 
                                autoFocus
                            />
                        </div>
                        
                        <div className="flex justify-between items-center mt-8">
                            <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700">
                                ← Назад
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setStep('group-members')} 
                                disabled={!groupName.trim()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-all"
                            >
                                Далее →
                            </button>
                        </div>
                    </div>
                );

            case 'group-members':
                return (
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Добавить участников ({selectedMembers.length})
                            </label>
                            
                            {/* Поиск */}
                            <div className="relative mb-3">
                                <input
                                    type="text"
                                    placeholder="Поиск контактов..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            </div>

                            {/* Список контактов */}
                            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                {filteredContacts.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        Контакты не найдены
                                    </div>
                                ) : (
                                    filteredContacts.map(contact => (
                                        <div
                                            key={contact.id}
                                            onClick={() => toggleMember(contact.id)}
                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                                                {contact.avatar_url ? (
                                                    <img src={contact.avatar_url} alt={contact.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{contact.username[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {contact.username}
                                            </span>
                                            {selectedMembers.includes(contact.id) && (
                                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                                    <Check size={16} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-6">
                            <button type="button" onClick={() => setStep('group')} className="text-sm text-gray-500 hover:text-gray-700">
                                ← Назад
                            </button>
                            <button 
                                type="button" 
                                onClick={handleCreateGroup}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-all"
                            >
                                {loading ? "Создание..." : "Создать группу"}
                            </button>
                        </div>
                    </div>
                );
                            
            case 'server':
                return (
                    <form onSubmit={handleCreateServer} className="mt-4 space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 relative group">
                                <Server size={32} className="text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название сервера</label>
                            <input 
                                type="text" 
                                value={serverName} 
                                onChange={e => setServerName(e.target.value)} 
                                placeholder="Например: Gaming Club" 
                                className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                required 
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
                            <textarea 
                                value={serverDesc} 
                                onChange={e => setServerDesc(e.target.value)} 
                                placeholder="О чем этот сервер?" 
                                className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Хештеги</label>
                            <input 
                                type="text" 
                                value={serverTags} 
                                onChange={e => setServerTags(e.target.value)} 
                                placeholder="gaming, news" 
                                className="w-full p-2.5 rounded-lg border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            />
                        </div>
                        <div className="flex justify-between items-center mt-8">
                            <button type="button" onClick={() => setStep('choice')} className="text-sm text-gray-500 hover:text-gray-700">
                                ← Назад
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-all"
                            >
                                {loading ? "Создание..." : "Создать сервер"}
                            </button>
                        </div>
                    </form>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={handleClose}>
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 m-4 animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold text-black dark:text-white">
                        {step === 'choice' ? 'Создать новое' : 
                         step === 'group' ? 'Новая группа' : 
                         step === 'group-members' ? 'Добавить участников' : 
                         'Новый сервер'}
                    </h2>
                    <button onClick={handleClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                        <X size={24} />
                    </button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};
