// // /frontend/components/theme/ThemeModal.tsx
// "use client";

// import React from 'react';
// import { useTheme } from '@/context/ThemeContext';
// import { Sun, Moon } from 'lucide-react';

// interface ThemeModalProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

// export default function ThemeModal({ isOpen, onClose }: ThemeModalProps) {
//   const { theme, setTheme } = useTheme();

//   if (!isOpen) return null;

//   const handleSetTheme = (newTheme: 'light' | 'dark') => {
//     setTheme(newTheme);
//     onClose(); // Закрываем модалку после выбора
//   };

//   return (
//     <div 
//       className="fixed inset-0 bg-gray-900 bg-opacity-30 backdrop-blur-md z-40 flex justify-center items-center" // z-40 (под модалкой, над хедером)
//       onClick={onClose}
//     >
//       <div 
//         className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm relative dark:bg-gray-800"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <button 
//           onClick={onClose}
//           className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-300"
//           aria-label="Закрыть"
//         >
//           &times;
//         </button>
        
//         <h2 className="text-xl font-bold mb-6 text-center text-black dark:text-white">Выберите тему</h2>
        
//         <div className="flex justify-around space-x-4">
//           {/* Кнопка Светлой темы */}
//           <button
//             onClick={() => handleSetTheme('light')}
//             className={`flex flex-col items-center justify-center p-4 w-1/2 rounded-lg border-2 ${
//               theme === 'light' 
//                 ? 'border-blue-500 bg-blue-50' 
//                 : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
//             }`}
//           >
//             <Sun size={28} className="text-yellow-500" />
//             <span className="mt-2 font-medium text-black dark:text-white">Светлая</span>
//           </button>

//           {/* Кнопка Темной темы */}
//           <button
//             onClick={() => handleSetTheme('dark')}
//             className={`flex flex-col items-center justify-center p-4 w-1/2 rounded-lg border-2 ${
//               theme === 'dark' 
//                 ? 'border-blue-500 bg-blue-900' 
//                 : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
//             }`}
//           >
//             <Moon size={28} className="text-blue-300" />
//             <span className="mt-2 font-medium text-black dark:text-white">Темная</span>
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }