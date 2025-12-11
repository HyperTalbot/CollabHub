"use client";
import React, { useState } from 'react';
import { Scroll, Shield, FileCheck, ArrowRight } from 'lucide-react';

type Section = 'rules' | 'privacy' | 'agreement';

export default function PoliciesPage() {
  const [activeSection, setActiveSection] = useState<Section>('rules');

  const renderContent = () => {
    switch (activeSection) {
      case 'rules':
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Правила Сообщества</h2>
            <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
              <p className="text-lg">Мы стремимся создать безопасное и комфортное пространство для общения. Соблюдение данных правил обязательно для всех участников.</p>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg mb-2">1. Политический нейтралитет</h3>
                <p>Платформа вне политики. Запрещено инициировать дискуссии на острые политические темы, призывать к политическим действиям или использовать площадку для агитации.</p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 dark:border-red-800">
                <h3 className="font-bold text-red-800 dark:text-red-300 text-lg mb-2">2. Нетерпимость и дискриминация</h3>
                <p>Категорически запрещено разжигание ненависти, оскорбления или дискриминация по признаку расы, национальности, религии, пола или любых других признаков. Мы придерживаемся политики нулевой толерантности к подобному контенту.</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-2">3. Авторское право</h3>
                <p>Уважайте чужой труд. При публикации контента, созданного не вами (изображения, тексты, видео), <strong>обязательно</strong> указывайте первоисточник или автора. Плагиат может привести к удалению контента.</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-2">4. Нормы морали</h3>
                <p>Запрещена публикация контента с излишней сексуализацией, порнографии, а также материалов, выходящих за рамки общепринятых норм приличия.</p>
              </div>

              <p className="text-sm text-gray-500 mt-8">* Администрация оставляет за собой право блокировать аккаунты (временно или бессрочно) за нарушение данных правил без предварительного уведомления.</p>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Политика Конфиденциальности</h2>
            <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300 space-y-4">
              <p>Настоящая Политика конфиденциальности описывает, как мы собираем, используем и защищаем вашу информацию.</p>
              <h3 className="text-xl font-semibold">1. Сбор данных</h3>
              <p>Мы собираем только минимально необходимый набор данных: адрес электронной почты, имя пользователя и хэш пароля. Мы не храним пароли в открытом виде.</p>
              <h3 className="text-xl font-semibold">2. Использование данных</h3>
              <p>Ваши данные используются исключительно для обеспечения функционирования сервиса: авторизации, восстановления доступа и персонализации интерфейса.</p>
              <h3 className="text-xl font-semibold">3. Передача третьим лицам</h3>
              <p>Мы не передаем ваши личные данные третьим лицам, за исключением случаев, предусмотренных законодательством.</p>
            </div>
          </div>
        );
      case 'agreement':
        return (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Пользовательское Соглашение</h2>
            <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300 space-y-4">
              <p>Добро пожаловать в CollabHub. Используя наш сервис, вы соглашаетесь со следующими условиями:</p>
              <h3 className="text-xl font-semibold">1. Общие положения</h3>
              <p>Сервис предоставляется "как есть". Администрация не несет ответственности за любой ущерб, прямой или косвенный, возникший в результате использования сервиса.</p>
              <h3 className="text-xl font-semibold">2. Ответственность пользователя</h3>
              <p>Вы несете полную ответственность за контент, который вы публикуете, и за сохранность данных вашей учетной записи.</p>
              <h3 className="text-xl font-semibold">3. Изменения условий</h3>
              <p>Мы оставляем за собой право изменять условия данного соглашения в любое время. Продолжение использования сервиса означает ваше согласие с новыми условиями.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        
        {/* ASIDE (Навигация) */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-10 space-y-2">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6 px-4">
              Правовая информация
            </h1>
            <NavButton 
                active={activeSection === 'rules'} 
                onClick={() => setActiveSection('rules')} 
                icon={<Scroll size={18} />} 
                text="Правила" 
            />
            <NavButton 
                active={activeSection === 'privacy'} 
                onClick={() => setActiveSection('privacy')} 
                icon={<Shield size={18} />} 
                text="Конфиденциальность" 
            />
            <NavButton 
                active={activeSection === 'agreement'} 
                onClick={() => setActiveSection('agreement')} 
                icon={<FileCheck size={18} />} 
                text="Соглашение" 
            />
          </div>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-950 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[500px]">
          {renderContent()}
        </main>

      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, text }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium
      ${active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }
    `}
  >
    <div className="flex items-center gap-3">
        {icon}
        <span>{text}</span>
    </div>
    {active && <ArrowRight size={16} className="animate-pulse" />}
  </button>
);