// frontend/components/create/CreateContentModal.tsx

"use client";

import React from 'react';
import { X } from 'lucide-react';
import CreatePostForm from './CreatePostForm';
import CreateMusicModal from '@/components/create/CreateMusicModal';

export type CreationMode = 'post' | 'video' | 'short' | 'stream' | 'music' | 'dm';

interface CreateContentModalProps {
  mode: CreationMode | null;
  onClose: () => void;
  onPostCreated?: () => void; // ОСТАВЛЯЕМ ОПЦИОНАЛЬНЫМ
}

export default function CreateContentModal({ mode, onClose, onPostCreated }: CreateContentModalProps) {
  if (!mode) return null;

  // Для music
  if (mode === 'music') {
    return (
      <CreateMusicModal
        isOpen={true}
        onClose={onClose}
        onTrackCreated={onPostCreated} // Передаем как есть (может быть undefined)
      />
    );
  }

  // Для post
  if (mode === 'post') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white">Создать пост</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <X size={24} />
            </button>
          </div>
          <div className="p-4">
            <CreatePostForm 
              onPostCreated={onPostCreated || (() => {})} // ИСПРАВЛЕНО: передаем пустую функцию если undefined
              onClose={onClose} 
            />
          </div>
        </div>
      </div>
    );
  }

  // Для остальных - заглушка
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold dark:text-white">
            Создать {mode === 'video' ? 'видео' : mode === 'short' ? 'клип' : mode === 'stream' ? 'стрим' : 'сообщение'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X size={24} />
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Здесь будет форма для создания "{mode}". Этот функционал в разработке.
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}





// // /frontend/components/create/CreateContentModal.tsx
// "use client";

// import React from 'react';
// import CreatePostForm from '@/components/create/CreatePostForm';
// import { CreationMode } from './CreateFanMenu';
// import CreateMusicModal from './CreateMusicModal';
// import { LucideIcon } from 'lucide-react'

// interface CreateContentModalProps {
//   mode: CreationMode | null;
//   onClose: () => void;
//   onPostCreated: () => void;
// }

// export default function CreateContentModal({ mode, onClose, onPostCreated }: CreateContentModalProps) {
//   if (!mode) return null;

//   const title = {
//     video: 'Загрузить видео',
//     short: 'Создать короткое видео',
//     stream: 'Начать прямую трансляцию',
//     post: 'Создать новый пост',
//     music: 'Создать музыкальный трек',
//     dm: 'Написать личное сообщение',
//   }[mode] ?? 'Создать контент';

//   return (
//     <div className="fixed inset-0 z-50 flex justify-center items-center p-4">
//       <div 
//         className="bg-white p-6 rounded-lg shadow-2xl max-w-lg w-full relative dark:bg-gray-800"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <button 
//           onClick={onClose}
//           className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
//         >
//           &times;
//         </button>
        
//         <h2 className="text-xl font-bold mb-6 text-center text-black dark:text-white">
//           {title}
//         </h2>

//         {mode === 'post' ? (
//           <CreatePostForm
//             onPostCreated={onPostCreated}
//             onClose={onClose} // ✅ ИСПРАВЛЕНО: Передаем onClose
//           />
//         ) : (
//           <p className="text-center text-black dark:text-gray-300">
//             Здесь будет форма для создания "{mode}". Этот функционал в разработке.
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }

// // Вспомогательный компонент для кружочков
// function CreateButton({ icon: Icon, label, onClick }: { icon: LucideIcon, label: string, onClick: () => void }) {
//   return (
//     <button 
//       onClick={onClick}
//       className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-100 transition-colors"
//     >
//       <div className="w-16 h-16 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
//         <Icon size={28} />
//       </div>
//       <span className="text-sm mt-2 font-medium text-black text-center">{label}</span>
//     </button>
//   );
// }
