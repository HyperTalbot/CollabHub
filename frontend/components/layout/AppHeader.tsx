// /frontend/components/AppHeader.tsx

// НОВОЕ ПОВЕДЕНИЕ: по умолчанию header в 2 раза меньше (scale-50)
// и полупрозрачный (opacity-60); при наведении мыши — прежний размер
// (scale-100) и непрозрачный (opacity-100).
// Хитбокс = границы обёртки header: уменьшается/увеличивается вместе
// с контентом (transform масштабирует и визуал, и область наведения).
// НАСТРОЙКА: scale-50 / opacity-60 / duration-300 — меняй в классах обёртки.
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from "@/context/AuthContext";
import { 
  Home, MessageCircle, Music, Mail, LayoutGrid, Brain, Shield, X, Menu,
  Plus, Search, Bell, User, Settings, Heart, RotateCcw, UserCheck, Bot,
  Pencil, Star, LogOut, Palette, Languages, LucideIcon, NotebookPen
} from 'lucide-react';
import CreateFanMenu, { CreationMode } from '../create/CreateFanMenu';
import CreateContentModal from '../create/CreateContentModal';
import ThemeModal from '../theme/ThemeModal';
import { useTheme } from '@/context/ThemeContext';

const ICON_SIZE_PANEL1 = 24;
const ICON_SIZE_PANEL2 = 20;

// --- Вспомогательный компонент NavLink ---
function NavLink({ href, iconSrc, label }: { href: string, iconSrc: string, label: string }) {
    const router = useRouter();
    return (
        <button
          onClick={() => router.push(href)}
          className="flex flex-col items-center justify-center w-20 h-16 py-1.5 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-700"
          title={label}
        >
        <div className="relative" style={{ width: ICON_SIZE_PANEL1, height: ICON_SIZE_PANEL1 }}>
            <Image 
              src={iconSrc} 
              alt={label} 
              layout="fill" 
              style={{ objectFit: "contain" }}
            />
        </div>
        <span className="text-xs mt-1 text-black font-medium dark:text-gray-300">{label}</span> 
      </button>
    );
}

// --- Вспомогательный компонент IconLink ---
function IconLink({ iconSrc, label }: { iconSrc: string, label: string }) {
  return (
    <button 
      className="flex flex-col items-center justify-center h-12 py-0 rounded-lg hover:bg-gray-100 w-16 dark:hover:bg-gray-700" 
    >
      <div className="relative" style={{ width: ICON_SIZE_PANEL2, height: ICON_SIZE_PANEL2 }}>
        <Image 
            src={iconSrc} 
            alt={label} 
            style={{ objectFit: "cover"}}
            width={25}
            height={25}
        />
      </div>
      <span className="text-xs mt-0 text-black dark:text-gray-300">{label}</span>
    </button>
  );
}

function DropdownItem(
  { icon: Icon, label, onClick, extraLabel }: 
  { icon: LucideIcon, label: string, onClick: () => void; extraLabel?: string}) {
	return (
		<button
      onClick={onClick}
      className='flex item-center w-full space-x-3 p-2 rounded-md hover:bg-gray-100 text-black dark:text-gray-300 dark:hover:bg-gray-600'
    >
      <Icon size={20} className='flex-shrink-0' />
      <span className='text-sm font-medium'>{label}</span>
      {extraLabel && (
        <span className="ml-1 bg-blue-500 text-white text-xs font-bold px-1 py-0.5 rounded-md">{extraLabel}</span>
      )}
    </button>
	);
}

interface AppHeaderProps {
  panel1Visible: boolean;
  setPanel1Visible: (visible: boolean) => void;
  panel2Visible: boolean;
  setPanel2Visible: (visible: boolean) => void;
}

// --- Основной компонент AppHeader ---
export default function AppHeader({
  panel1Visible, 
  setPanel1Visible,
  panel2Visible,
  setPanel2Visible
}: AppHeaderProps) {
  const { logout } = useAuth();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toggleTheme, setTheme } = useTheme();

  const [settingsOpen, setSettingsOpen] = useState(false);

	// Состояние для модального окна
	const [isFanOpen, setIsFanOpen] = useState(false);
	const [creationMode, setCreationMode] = useState<CreationMode | null>(null);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false); 

  // Функция "Выбрать режим"
  const handleSelectMode = (mode: CreationMode) => {
    setIsFanOpen(false); // Закрываем веер
    setCreationMode(mode); // Открываем модалку
  };

  // Функция "Закрыть всё"
  const handleCloseAll = () => {
    setIsFanOpen(false);
    setCreationMode(null);
  };
  
  const refreshContent = () => {
    const path = window.location.pathname;
    if (path.includes('/postogram')) {
      window.location.reload();
    } else if (path.includes('/symphonya')) {
      window.location.reload();
    }
  };

  return (
		<>
			{/* Сам header НЕ ловит мышь (pointer-events-none): ловит только обёртка ниже,
			    поэтому хитбокс = границы видимого header */}
			<header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
				{/* ===== ОБЁРТКА-МАСШТАБ =====
				    По умолчанию: scale-50 (в 2 раза меньше) + opacity-60 (полупрозрачный).
				    При hover: scale-100 (прежний размер) + opacity-100 (непрозрачный).
				    origin-top — растёт вниз от верхнего края.
				    Хитбокс и границы масштабируются вместе с контентом. */}
				<div className="pointer-events-auto w-4/5 mx-auto p-2 flex flex-col items-center space-y-2 origin-top transition-all duration-300 ease-out scale-50 opacity-60 hover:scale-100 hover:opacity-100">
					
					{/* === ПАНЕЛЬ 1 (Верхняя, Платформы) === */}
					{panel1Visible ? (
						<div className="w-full mx-auto bg-white shadow-lg rounded-full flex items-center py-2 transition-all dark:bg-gray-800 dark:border dark:border-gray-700"> 
							<div className="flex-1 flex justify-center items-center space-x-0">
								<NavLink href="/doubleyou" iconSrc="/logo/doubleyou.svg" label="Quasar" />
								<NavLink href="/flip" iconSrc="/logo/flashcards.jpg" label="Flip" />
								<NavLink href="/kvach" iconSrc="/logo/telescope.svg" label="Telescope" />
								<NavLink href="/homepage" iconSrc="/logo/home.svg" label="Home" />
								<NavLink href="/postogram" iconSrc="/logo/postogram.svg" label="Postogram" />
								<NavLink href="/symphonya" iconSrc="/logo/symphonya.svg" label="Symphonya" />
								<NavLink href="/bubble" iconSrc="/logo/misable.svg" label="Bubble" />
							</div>
							<button
								onClick={() => setPanel1Visible(false)}
								className="w-10 h-10 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white 
								flex items-center justify-center flex-shrink-0 text-black mr-2 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-600" 
								title="Скрыть панель"
							>
								<X size={ICON_SIZE_PANEL1} />
							</button>
						</div>
					) : (
						// Заглушка, когда панель 1 скрыта
						<div className="w-full mx-auto h-14 flex justify-end"> 
							<button
								onClick={() => setPanel1Visible(true)}
								className="px-4 py-2 bg-white shadow-lg rounded-full dark:bg-gray-800 dark:border dark:border-gray-700"
								title="Развернуть панель платформ"
							>
								<Menu size={ICON_SIZE_PANEL1} className="text-black dark:text-gray-300" />
							</button>
						</div>
					)}

					{/* === ПАНЕЛЬ 2 (Нижняя, Инструменты) === */}
					{panel2Visible ? (
						<div className="w-3/4 mx-auto bg-white shadow-lg rounded-full flex items-center py-0 transition-all dark:bg-gray-800 dark:border dark:border-gray-700"> 
							
							<div className="flex-1 flex justify-end space-x-4 pr-4 items-center">
								<IconLink iconSrc="/icons/notes.svg" label="Заметки" />
								<IconLink iconSrc="/icons/heart.svg" label="Избранное" />
								<IconLink iconSrc="/icons/history.svg" label="История" />
								<IconLink iconSrc="/icons/heart.svg" label="Подписки" />
								<IconLink iconSrc="/icons/stars.svg" label="Наши звезды" />
							</div>
							
							{/* Центральная кнопка (+) - контейнер для веера */}
							<div className="relative">
								<button 
									onClick={() => setIsFanOpen(!isFanOpen)}
									className={`flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center mx-2 transition-transform duration-200 ${
										isFanOpen ? 'rotate-45' : 'rotate-0'
									}`}
								>
									<Plus size={ICON_SIZE_PANEL2 + 4} />
								</button>

								{/* РЕНДЕРИМ "ВЕЕР" (пальцы) */}
								<CreateFanMenu isOpen={isFanOpen} onSelect={handleSelectMode} />
							</div>
							
							<div className="flex-1 flex justify-start space-x-6 pl-4 items-center">
								{/* AI Ассистент */}
								<button
									className="relative flex flex-col items-center gap-1 px-2 py-2 rounded-2xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all group"
									title="AI Ассистент"
								>
									<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
										<span className="text-white font-bold text-m">AI</span>
									</div>
								</button>

								<IconLink iconSrc="/icons/search.svg" label="Поиск" />
								<IconLink iconSrc="/icons/bell.svg" label="Уведомления" />

								<div className="overflow-hidden">
									{currentUser ? (
										<button
											onClick={() => router.push(`/profile/${currentUser.id}`)}
											title={currentUser.username}
											className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-gray-300 dark:border-gray-600 hover:ring-2 hover:ring-blue-400 transition-all flex-shrink-0"
										>
											{currentUser.avatar_url ? (
												<img src={currentUser.avatar_url} alt={currentUser.username} className="w-full h-full object-cover" />
											) : (
												<div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-300">
													{currentUser.username?.[0]?.toUpperCase()}
												</div>
											)}
										</button>
									) : (
										<button
											onClick={() => router.push('/login')}
											className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow transition-colors flex-shrink-0"
										>
											Войти
										</button>
									)}
								</div>

								<div className='relative'>
									<button 
										onClick={() => setSettingsOpen(!settingsOpen)}
										className='flex flex-col items-center justify-center h-12 py-0 rounded-lg hover:bg-gray-100 w-16 dark:hover:bg-gray-700'
									>
										<div className="relative" style={{ width: ICON_SIZE_PANEL2, height: ICON_SIZE_PANEL2 }}>
											<Image src="/icons/settings.svg" alt="Настройки" layout="fill" objectFit="contain" />
										</div>
										<span className='text-xs mt-0 text-black dark:text-gray-300'>Настройки</span>
									</button>

									{/* Выпадающий список */}
									{settingsOpen && (
										<div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-xl rounded-lg p-2 z-50 dark:bg-gray-700">
											<DropdownItem icon={User} label="Профиль" onClick={() => alert('Профиль в разработке')} />
											<DropdownItem icon={Bell} label="Уведомления" onClick={() => alert('Уведомления в разработке')} />
											<DropdownItem icon={Pencil} label="Режим редактора" onClick={() => alert('Режим редактора (TODO)')} extraLabel="Plus" />
											<DropdownItem
												icon={Palette}
												label="Темы"
												onClick={() => {
													setIsThemeModalOpen(true);
													setSettingsOpen(false);
												}}
											/>
											<DropdownItem icon={Languages} label="Языки" onClick={() => alert('Языки в разработке')} />
											<DropdownItem icon={Bot} label="Кола" onClick={() => alert('Кола в разработке')} />
											<div className="border-t my-1"></div>
											<DropdownItem icon={LogOut} label="Выйти" onClick={logout} />
										</div>
									)}
								</div>
							</div>
							
							{/* Кнопка "X" (справа) */}
							<button
								onClick={() => setPanel2Visible(false)}
								className="w-8 h-8 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white 
								flex items-center justify-center flex-shrink-0 text-black mr-1 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-600"
								title="Скрыть панель"
							>
								<X size={ICON_SIZE_PANEL2} />
							</button>
						</div>
					) : (
						<div className="w-full mx-auto h-10 flex justify-end">
							<button
								onClick={() => setPanel2Visible(true)}
								className="p-4 py-2 bg-white shadow-lg rounded-full dark:bg-gray-800 dark:border dark:border-gray-700"
								title="Развернуть панель инструментов"
							>
								<Menu size={ICON_SIZE_PANEL2} className="text-black dark:text-gray-300" />
							</button>
						</div>
					)}
				</div>
			</header>
			
			{/* Модальные окна ВНЕ header — не масштабируются */}
			<CreateContentModal
				mode={creationMode}
				onClose={handleCloseAll}
				onPostCreated={refreshContent}
			/>
			<ThemeModal 
				isOpen={isThemeModalOpen}
				onClose={() => setIsThemeModalOpen(false)}
			/>
		</>
  );
}
