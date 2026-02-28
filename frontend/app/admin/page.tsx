"use client";
import React, { useState, useEffect } from 'react';
import { 
    Users, Trash2, Shield, ShieldOff, Search, Edit2, 
    Video, Music, Radio, Server, Film, LayoutGrid, ArrowUp, ArrowDown, X, Save
} from 'lucide-react';
import axios from '@/lib/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { AccessDenied } from '@/components/admin/AccessDenied';

// const AUTH_API_URL = 'http://localhost:8080/api/v1';
// const POST_API_URL = 'http://localhost:8081/api/v1'; // Проверьте порт Post Service

const AUTH_API_URL = "https://collabhub.cloudpub.ru/api/v1";
const POST_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts/';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
}

interface Post {
    id: number;
    content: string;
    user_id: number;
    created_at: string;
    // user?: { username: string }; // Если бэк возвращает Preload
}

export default function AdminPage() {
  const { user: currentUser, isLoggedIn } = useAuth();
  
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Данные
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // Сортировка
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Редактирование юзера
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- ЗАЩИТА ---
  if (!isLoggedIn || currentUser?.role !== 'admin') {
      return <AccessDenied />;
  }

  // --- ЗАГРУЗКА ---
  const fetchData = async () => {
    setLoading(true);
    try {
        const orderParams = `sort_by=${sortBy}&order=${sortOrder}&q=${search}`;
        
        if (activeTab === 'users') {
            const res = await axios.get(`${AUTH_API_URL}/admin/users?${orderParams}`);
            setUsers(res.data.data || []);
        } else if (activeTab === 'posts') {
            const res = await axios.get(`${POST_API_URL}/admin/posts?${orderParams}`);
            setPosts(res.data.data || []);
        }
    } catch (e) {
        toast.error("Ошибка загрузки данных");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      const timer = setTimeout(() => fetchData(), 500);
      return () => clearTimeout(timer);
  }, [activeTab, search, sortBy, sortOrder]);

  // --- ХЕНДЛЕРЫ ---
  const handleSort = (field: string) => {
      if (sortBy === field) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(field);
          setSortOrder('asc');
      }
  };

  // User Actions
  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      try {
          await axios.put(`${AUTH_API_URL}/admin/users/${editingUser.id}`, {
              username: editingUser.username,
              email: editingUser.email,
              role: editingUser.role
          });
          toast.success("Пользователь обновлен");
          setEditingUser(null);
          fetchData();
      } catch(e) { toast.error("Ошибка обновления"); }
  };

  const deleteItem = async (id: number, type: 'user' | 'post') => {
      if(!confirm("Удалить?")) return;
      try {
          const url = type === 'user' 
            ? `${AUTH_API_URL}/admin/users/${id}` 
            : `${POST_API_URL}/admin/posts/${id}`;
          await axios.delete(url);
          toast.success("Удалено");
          fetchData();
      } catch(e) { toast.error("Ошибка удаления"); }
  };

  // --- РЕНДЕР ТАБЛИЦЫ ЮЗЕРОВ ---
  const renderUsersTable = () => (
      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
        <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase font-medium">
            <tr>
                <SortableTh label="ID" field="id" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableTh label="User" field="username" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableTh label="Email" field="email" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableTh label="Role" field="role" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <th className="px-6 py-3 text-right">Actions</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">{u.id}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{u.username}</td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {u.role}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => setEditingUser(u)} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600">
                            <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteItem(u.id, 'user')} className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600">
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
      </table>
  );

  // --- РЕНДЕР ТАБЛИЦЫ ПОСТОВ ---
  const renderPostsTable = () => (
      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
        <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase font-medium">
            <tr>
                <SortableTh label="ID" field="id" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <th className="px-6 py-3">Content</th>
                <th className="px-6 py-3">Author ID</th>
                <SortableTh label="Date" field="created_at" currentSort={sortBy} order={sortOrder} onSort={handleSort} />
                <th className="px-6 py-3 text-right">Actions</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {posts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">{p.id}</td>
                    <td className="px-6 py-4 truncate max-w-xs" title={p.content}>{p.content}</td>
                    <td className="px-6 py-4">{p.user_id}</td>
                    <td className="px-6 py-4">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteItem(p.id, 'post')} className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600">
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
      </table>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar (можно вынести в компонент) */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:block">
          <div className="p-6 text-2xl font-bold dark:text-white">🛡️ Admin</div>
          <nav className="px-4 space-y-1">
            
            <NavButton active={activeTab === 'users'} onClick={() => {setActiveTab('users'); setSortBy('id');}} icon={<Users size={20}/>} label="Пользователи" />
              <NavButton active={activeTab === 'posts'} onClick={() => {setActiveTab('posts'); setSortBy('created_at');}} icon={<LayoutGrid size={20}/>} label="Посты" />
              {/* Другие кнопки заглушки */}
          </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
               <h1 className="text-2xl font-bold dark:text-white capitalize">{activeTab} Management</h1>
               <div className="relative">
                    <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
               </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                  {loading ? <div className="p-10 text-center">Загрузка...</div> : 
                   activeTab === 'users' ? renderUsersTable() : 
                   activeTab === 'posts' ? renderPostsTable() : 
                   <div className="p-10 text-center">Раздел в разработке</div>
                  }
              </div>
          </div>
      </main>

      {/* MODAL: EDIT USER */}
      {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <form onSubmit={handleUpdateUser} className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-xl w-96 space-y-4">
                  <h3 className="text-xl font-bold dark:text-white">Редактировать пользователя</h3>
                  <div>
                      <label className="text-sm dark:text-gray-400">Username</label>
                      <input value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  </div>
                  <div>
                      <label className="text-sm dark:text-gray-400">Email</label>
                      <input value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  </div>
                  <div>
                      <label className="text-sm dark:text-gray-400">Role</label>
                      <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                      </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-500">Отмена</button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Сохранить</button>
                  </div>
              </form>
          </div>
      )}
    </div>
  );
}

// Компоненты для таблицы
const SortableTh = ({ label, field, currentSort, order, onSort }: any) => (
    <th 
        className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none"
        onClick={() => onSort(field)}
    >
        <div className="flex items-center gap-1">
            {label}
            {currentSort === field && (
                order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            )}
        </div>
    </th>
);

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
        {icon} {label}
    </button>
);