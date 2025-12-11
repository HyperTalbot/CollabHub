import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function MessengerLayout() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  return (
    <div className="h-[calc(100vh-80px)] w-full bg-gray-900 flex">
      
      {/* 1. Navigation Rail (Сервера) - Фиксированная ширина */}
      <nav className="w-[72px] flex-shrink-0 bg-gray-950 flex flex-col items-center py-4 border-r border-gray-800 z-20">
         {/* Иконки серверов... */}
      </nav>

      {/* Resizable Group */}
      <PanelGroup direction="horizontal" autoSaveId="messenger-panels">
        
        {/* 2. Middle Sidebar (Чаты/Каналы) */}
        {isSidebarVisible && (
          <>
            <Panel defaultSize={25} minSize={20} maxSize={40} className="bg-gray-900 min-w-[250px]">
               {/* Здесь условный рендеринг: ChatList или ServerChannels */}
               <div className="h-full flex flex-col">
                  {/* Хедер панели */}
                  <div className="p-4 border-b border-gray-800 flex justify-between">
                      <span>Личные сообщения</span>
                      <button onClick={() => setIsSidebarVisible(false)}>
                          <ChevronLeft size={16} />
                      </button>
                  </div>
                  {/* Список... */}
               </div>
            </Panel>
            
            {/* Ручка для изменения ширины */}
            <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-500 transition-colors cursor-col-resize" />
          </>
        )}

        {/* 3. Main Content (Чат) */}
        <Panel minSize={30}>
          <div className="h-full bg-gray-700 flex flex-col relative">
             {/* Кнопка "Показать меню", если оно скрыто */}
             {!isSidebarVisible && (
                 <button 
                    onClick={() => setIsSidebarVisible(true)}
                    className="absolute top-4 left-4 z-10 p-2 bg-gray-800 rounded-md shadow-md text-white hover:bg-gray-600"
                 >
                    <ChevronRight size={20} />
                 </button>
             )}
             
             {/* Сам чат */}
             <div className="flex-1 flex items-center justify-center text-gray-400">
                 Окно чата
             </div>
          </div>
        </Panel>
        
      </PanelGroup>
    </div>
  );
}