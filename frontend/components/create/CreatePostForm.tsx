// frontend/components/create/CreatePostForm.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import axios from '@/lib/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import { useTheme } from '@/context/ThemeContext';
import ObsidianMdEditor, { ObsidianMdEditorHandle } from './ObsidianMdEditor';
import { uploadImage, uploadVideo } from '@/services/uploadService';
import { getMediaURL, getMediaKind } from '@/lib/mediaUtils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, FileText, LayoutGrid, Loader2, UploadCloud, X, FilePlus2,
} from 'lucide-react';

const POSTS_API_URL = 'https://collabhub.cloudpub.ru/api/v1/posts/';
// Ключ черновика в localStorage
const DRAFT_KEY = 'postogram_post_draft';

type PostStyle = 'reddit' | 'article';

interface Draft {
  title: string;
  content: string;
  postStyle: PostStyle;
  imageUrls: string[];
  savedAt: number;
}

interface CreatePostFormProps {
  onPostCreated: () => void;
  onClose: () => void;
  // НОВОЕ (п.6): регистрация "guard" для крестика внешней модалки
  // registerGuard?: (fn: (() => void) | null) => void;
  guardRef?: { current: (() => void) | null };
}

export default function CreatePostForm({ onPostCreated, onClose, guardRef }: CreatePostFormProps) {
  const { isLoggedIn } = useAuth();
  const { effectiveTheme } = useTheme();
  const [postStyle, setPostStyle] = useState<PostStyle>('reddit');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // пустое по умолчанию
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // п.6: отложенное действие (уход или смена стиля), ждущее решения по черновику
  const [pendingAction, setPendingAction] = useState<null | { type: 'close' } | { type: 'switch'; to: PostStyle }>(null);

  const carouselInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ObsidianMdEditorHandle>(null);

  useEffect(() => {
    setHasDraft(!!localStorage.getItem(DRAFT_KEY));
  }, []);

  // Есть ли что сохранять в черновик
  const hasData = title.trim() !== '' || content.trim() !== '' || imageUrls.length > 0;

  const saveDraft = () => {
    const draft: Draft = { title, content, postStyle, imageUrls, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setHasDraft(false); // черновик "забран" в текущую сессию
    toast.success('Черновик сохранён');
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d: Draft = JSON.parse(raw);
      setTitle(d.title || '');
      setContent(d.content || '');
      setPostStyle(d.postStyle === 'article' ? 'article' : 'reddit');
      setImageUrls(Array.isArray(d.imageUrls) ? d.imageUrls : []);
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      toast.success('Черновик загружен');
    } catch {
      toast.error('Не удалось прочитать черновик');
    }
  };

  // п.6: предупреждение перед уходом
  const requestClose = () => {
    if (hasData) setPendingAction({ type: 'close' });
    else onClose();
  };
  // п.6: предупреждение перед сменой стиля
  const requestSwitch = (to: PostStyle) => {
    if (to === postStyle) return;
    if (hasData) setPendingAction({ type: 'switch', to });
    else setPostStyle(to);
  };

  // Регистрируем guard для крестика внешней модалки
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    if (guardRef) {
      guardRef.current = () => requestCloseRef.current();
    }
    return () => {
      if (guardRef) guardRef.current = null;
    };
  }, [guardRef]);

  const uploadOneImage = async (file: File): Promise<string> => uploadImage(file);

  const handleCarouselFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError('');
    try {
      for (const file of Array.from(files)) {
        const url = file.type.startsWith('video/') ? await uploadVideo(file) : await uploadImage(file);
        setImageUrls((prev) => [...prev, url]);
      }
    } catch (e) {
      console.error("Failed to upload image:", e);
      setError('Не удалось загрузить изображение. Попробуйте ещё раз.');
    } finally {
      setUploading(false);
      if (carouselInputRef.current) carouselInputRef.current.value = '';
    }
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    setImageUrls((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const removeImage = (index: number) => setImageUrls((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLoggedIn) { setIsModalOpen(true); return; }
    setLoading(true);
    try {
      await axios.post(POSTS_API_URL, {
        title,
        content,
        post_style: postStyle,
        image_urls: postStyle === 'reddit' ? imageUrls : [],
        image_url: postStyle === 'reddit' ? (imageUrls[0] || '') : '',
      });
      // Успех -> черновик больше не нужен
      localStorage.removeItem(DRAFT_KEY);
      onPostCreated();
      onClose();
    } catch (err: any) {
      console.error("Failed to create post:", err);
      setError(err.response?.data?.error || "Произошла ошибка при создании поста.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* ===== ВЫБОР СТИЛЯ (с guard, п.6) ===== */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Стиль поста</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => requestSwitch('reddit')}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${postStyle === 'reddit' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
              <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                <LayoutGrid size={18} className="text-indigo-600 dark:text-indigo-400" /> В стиле Reddit
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">все картинки — каруселью</span>
            </button>
            <button type="button" onClick={() => requestSwitch('article')}
              className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${postStyle === 'article' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'}`}>
              <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                <FileText size={18} className="text-violet-600 dark:text-violet-400" /> В стиле статей
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">картинки в любом месте текста (как на Хабр)</span>
            </button>
          </div>
        </div>

        {/* Заголовок */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Заголовок</label>
          <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 bg-white dark:bg-gray-700/60 text-gray-900 dark:text-gray-100"
            required />
        </div>

        {/* ===== КАРУСЕЛЬ (reddit) ===== */}
        {postStyle === 'reddit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Изображения (карусель)</label>
            <input ref={carouselInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={(e) => handleCarouselFiles(e.target.files)} />
            <button type="button" onClick={() => carouselInputRef.current?.click()} disabled={uploading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 dark:border-indigo-800 rounded-xl p-4 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-400 transition-colors disabled:opacity-60">
              {uploading ? <Loader2 size={20} className="animate-spin text-indigo-500" /> : <UploadCloud size={20} className="text-indigo-500" />}
              {uploading ? 'Загрузка...' : 'Добавить изображения / gif / видео'}
            </button>
            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {imageUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group w-24">
                    <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shadow-sm bg-black/10 dark:bg-black/30">
                      {getMediaKind(url) === 'video' ? (
                        <>
                          <video src={getMediaURL(url)} muted preload="metadata" className="h-24 w-24 object-cover" />
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded shadow">VIDEO</span>
                        </>
                      ) : (
                        <>
                          <img src={getMediaURL(url)} alt={`Изображение ${idx + 1}`} className="h-24 w-24 object-cover" />
                          {getMediaKind(url) === 'gif' && (
                            <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded border border-white/40 shadow">GIF</span>
                          )}
                        </>
                      )}
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow">обложка</span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeImage(idx)} aria-label="Удалить"
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                      <X size={12} />
                    </button>
                    <div className="flex justify-center gap-2 mt-1">
                      <button type="button" disabled={idx === 0} onClick={() => moveImage(idx, -1)}
                        className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowLeft size={14} /></button>
                      <button type="button" disabled={idx === imageUrls.length - 1} onClick={() => moveImage(idx, 1)}
                        className="p-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowRight size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== РЕДАКТОР (CodeMirror, тулбар внутри) ===== */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Содержание (Markdown)</label>
          <ObsidianMdEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            dark={effectiveTheme === 'dark'}
            allowImages={postStyle === 'article'} // в стиле reddit картинки в текст не вставляются
            placeholder="Пишите в Markdown… (# заголовок, **жирный**, *курсив*, ~~зачёркнутый~~, > цитата, ![картинка](url)). Shift+Enter — перенос строки."
          />
        </div>

        <div className="flex items-center justify-between mt-3 gap-3">
          {/* п.6: продолжить черновик */}
          <div>
            {hasDraft && (
              <button type="button" onClick={loadDraft}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-sm font-medium transition-colors">
                <FilePlus2 size={16} /> Продолжить черновик
              </button>
            )}
          </div>
          <button type="submit" disabled={loading || uploading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors">
            {loading ? 'Публикация...' : uploading ? 'Загрузка изображений...' : 'Опубликовать'}
          </button>
        </div>
      </form>

      {/* ===== МОДАЛКА-ПРЕДУПРЕЖДЕНИЕ (п.6) ===== */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {pendingAction.type === 'close' ? 'Перед уходом сохраните в черновик' : 'Сменить стиль поста?'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              В форме есть несохранённый текст/изображения. Сохранить их в черновик, чтобы вернуться позже?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button"
                onClick={() => {
                  saveDraft();
                  if (pendingAction.type === 'switch') setPostStyle(pendingAction.to);
                  setPendingAction(null);
                  if (pendingAction.type === 'close') onClose();
                }}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors">
                Сохранить в черновик
              </button>
              <button type="button"
                onClick={() => {
                  if (pendingAction.type === 'switch') setPostStyle(pendingAction.to);
                  setPendingAction(null);
                  if (pendingAction.type === 'close') onClose();
                }}
                className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors">
                Всё равно уйти
              </button>
              <button type="button" onClick={() => setPendingAction(null)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
