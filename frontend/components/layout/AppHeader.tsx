// /frontend/components/AppHeader.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from "@/context/AuthContext";
import { 
  Home, MessageCircle, Music, Mail, LayoutGrid, Brain, Shield, X, Menu,
  Plus, Search, Bell, User, Settings, Heart, RotateCcw, UserCheck, Bot,
  Pencil, Star, LogOut, Palette, LucideIcon // <-- Импортируем тип LucideIcon
} from 'lucide-react';
import CreateFanMenu, { CreationMode } from '../create/CreateFanMenu';
import CreateContentModal from '../create/CreateContentModal';


const ICON_SIZE_PANEL1 = 24;
const ICON_SIZE_PANEL2 = 20;

// --- Вспомогательный компонент NavLink (Исправлено) ---
// Принимает Icon: LucideIcon (тип компонента) или string (путь)
function NavLink({ href, content, label }: { href: string, content: LucideIcon | string, label: string }) {
    const router = useRouter();
    const isLogoPath = typeof content === 'string';
    
    // Если это не путь, то 'content' - это компонент, например, 'Home'
    const IconComponent = !isLogoPath ? content as LucideIcon : null;

    return (
        <button
          onClick={() => router.push(href)}
          className="flex flex-col items-center justify-center w-20 h-16 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title={label}
        >
        {isLogoPath ? (
            <Image 
                src={content as string} 
                alt={`${label} logo`} 
                width={ICON_SIZE_PANEL1} 
                height={ICON_SIZE_PANEL1} 
                className={`w-[${ICON_SIZE_PANEL1}px] h-[${ICON_SIZE_PANEL1}px] object-contain mt-0`}
            />
        ) : (
            // Создаем элемент с нужным size
            <span className="text-black"> 
                {IconComponent && <IconComponent size={ICON_SIZE_PANEL1} strokeWidth={2} />}
            </span>
        )}
        <span className="text-xs mt-1 text-black font-medium">{label}</span> 
      </button>
    );
}

// --- Вспомогательный компонент IconLink (Исправлено) ---
function IconLink({ icon: IconComponent, label }: { icon: LucideIcon, label: string }) { // Принимаем LucideIcon
  return (
    <button 
      className="flex flex-col items-center justify-center h-12 py-0 rounded-lg hover:bg-gray-100" 
    >
      <span className="text-black">
        {/* Создаем элемент с нужным size */}
        <IconComponent size={ICON_SIZE_PANEL2} strokeWidth={2} />
      </span>
      <span className="text-xs mt-0 text-black">{label}</span>
    </button>
  );
}

function DropdownItem(
  { icon: Icon, label, onClick, extraLabel }: 
  { icon: LucideIcon, label: string, onClick: () => void; extraLabel?: string}) {
	return (
		<button
      onClick={onClick}
      className='flex item-center w-full space-x-3 p-2 rounded-md hover:bg-gray-100 text-black'
    >
      <Icon size={20} className='flex-shrink-0' />
      <span className='text-sm font-medium'>{label}</span>
      {extraLabel && (
        <span className="ml-1 bg-blue-500 text-white text-xs font-bold px-1 py-0.5 rounded-md">{extraLabel}</span>
      )}
    </button>
	)
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

  const [settingsOpen, setSettingsOpen] = useState(false);

	// Состояние для модального окна
	const [isFanOpen, setIsFanOpen] = useState(false);
	const [creationMode, setCreationMode] = useState<CreationMode | null>(null);

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
  
  // Функция для обновления ленты (будет передана в модалку)
  const refreshPostogram = () => {
      // Это плохая практика, но для простоты мы просто перезагрузим страницу
      // TODO: Заменить на SWR revalidate или React Query
      if (window.location.pathname.includes('/postogram')) {
          window.location.reload();
      }
  };

  return (
		<>
			<header className="fixed top-0 left-0 right-0 z-40 p-2 flex flex-col items-center space-y-2">
				
				{/* === ПАНЕЛЬ 1 (Верхняя, Платформы, 80%) === */}
				{panel1Visible ? (
					// ВОССТАНОВЛЕНИЕ: py-2 и более крупные кнопки "X"
					<div className="w-4/5 mx-auto bg-white shadow-lg rounded-full flex items-center py-2 transition-all"> 
						<div className="flex-1 flex justify-center items-center space-x-0">
							<NavLink href="/doubleyou" content={Shield} label="DoubleYou" /> {/* Было: content={<Shield />} */}
							<NavLink href="/flashcards" content={Brain} label="FlashCards" />
							<NavLink href="/kvach" content={LayoutGrid} label="Kvach" />
							<NavLink href="/homepage" content={Home} label="Home" />
							<NavLink href="/postogram" content={MessageCircle} label="Postogram" />
							<NavLink href="/symphonya" content={Music} label="Symphonya" />
							<NavLink href="/messenger" content={Mail} label="Misable" />
						</div>
						<button
							onClick={() => setPanel1Visible(false)}
						// Более крупная кнопка "X"
							className="w-10 h-10 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white flex items-center justify-center flex-shrink-0 text-black mr-2" 
							title="Скрыть панель"
						>
							<X size={ICON_SIZE_PANEL1} />
						</button>
					</div>
				) : (
					// Увеличиваем высоту заглушки для правильного выравнивания
          // Кнопка Открыть
					<div className="w-4/5 mx-auto h-14 flex justify-end"> 
						<button
							onClick={() => setPanel1Visible(true)}
							className="px-4 py-2 bg-white shadow-lg rounded-full"
							title="Развернуть панель платформ"
						>
							<Menu size={ICON_SIZE_PANEL1} className="text-black" />
						</button>
					</div>
				)}

				{/* === ПАНЕЛЬ 2 (Нижняя, Инструменты, 60%) === */}
				{panel2Visible ? (
					<div className="w-3/5 mx-auto bg-white shadow-lg rounded-full flex items-center py-0 transition-all"> 
						
						{/* ИЗМЕНЕНИЕ: space-x-6 для увеличения интервала */}
						<div className="flex-1 flex justify-end space-x-4 pr-4 items-center">
							<IconLink icon={Heart} label="Избранное" /> {/* Было: icon={<Heart />} */}
							<IconLink icon={RotateCcw} label="История" />
							<IconLink icon={UserCheck} label="Подписки" />
							<IconLink icon={Star} label="Наши звезды" />
						</div>
						
            {/* Центральная кнопка (+) - теперь она контейнер для веера */}
            <div className="relative">
              <button 
                onClick={() => setIsFanOpen(!isFanOpen)} // Открывает/Закрывает веер
                className={`flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center mx-2 transition-transform duration-200 ${
                  isFanOpen ? 'rotate-45' : 'rotate-0' // Крутится при открытии
                }`}
              >
                <Plus size={ICON_SIZE_PANEL2 + 4} />
              </button>

						{/* РЕНДЕРИМ "ВЕЕР" (пальцы) */}
              <CreateFanMenu isOpen={isFanOpen} onSelect={handleSelectMode} />
            </div>
						
						{/* Правая часть, иконки ИЗМЕНЕНИЕ: space-x-6 для увеличения интервала */}
						<div className="flex-1 flex justify-start space-x-6 pl-4 items-center">
							<button className="flex flex-col items-center justify-center h-12 py-0 rounded-lg hover:bg-gray-100">
								<div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1 rounded-full text-white my-1">
									<Bot size={ICON_SIZE_PANEL2} />
								</div>
								<span className="text-xs mt-0 text-black">AI</span>
							</button>

							<IconLink icon={Search} label="Поиск" />
							<IconLink icon={Bell} label="Уведомления" />
							<IconLink icon={User} label="Профиль" />

              <div className='relative'>
                <button 
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className='flex flex-col items-center justify-center h-12 py-0 rounded-lg hover:bg-gray-100 w-16'
                >
                  <span className='text-black'>
                    <Settings size={ICON_SIZE_PANEL2} strokeWidth={2} />
                  </span>
                  <span className='text-xs mt-0 text-black'>Настройки</span>

                </button>

                {/* Выпадающий список */}
                {settingsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-60 bg-white shadow-xl rounded-lg p-2 z-50">
                      <DropdownItem
                        icon={Pencil}
                        label="Режим редактора"
                        onClick={() => alert('Режим редактора (TODO)')} 
                        extraLabel="Max"
                      />
                    <DropdownItem
                      icon={Palette}
                      label="Темы"
                      onClick={() => alert('Смена темы (TODO)')}
                    />
                    <div className="border-t my-1"></div> {/* Разделитель */}
                    <DropdownItem
                      icon={LogOut}
                      label="Выйти"
                      onClick={logout} // <-- Функция выхода
                    />
                  </div>
                )}
              </div>
						</div>
						
						{/* Кнопка "X" (справа) */}
						<button
							onClick={() => setPanel2Visible(false)}
							className="w-8 h-8 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white flex items-center justify-center flex-shrink-0 text-black mr-1"
							title="Скрыть панель"
						>
							<X size={ICON_SIZE_PANEL2} />
						</button>
					</div>
				) : (
					<div className="w-4/5 mx-auto h-10 flex justify-end">
						<button
							onClick={() => setPanel2Visible(true)}
							className="p-4 py-2 bg-white shadow-lg rounded-full"
							title="Развернуть панель инструментов"
						>
							<Menu size={ICON_SIZE_PANEL2} className="text-black" />
						</button>
					</div>
				)}
			</header>
			
			{/* Модальное окно (рендерится здесь, но управляется AppHeader) */}
			<CreateContentModal
				mode={creationMode}
				onClose={handleCloseAll}
				onPostCreated={refreshPostogram}
			/>
		</>
  );
}
