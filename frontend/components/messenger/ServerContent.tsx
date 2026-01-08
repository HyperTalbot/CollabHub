// components/messenger/ServerContent.tsx
import React from 'react';

interface ServerContentProps {
  serverId: number;
}

export const ServerContent: React.FC<ServerContentProps> = ({ serverId }) => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Здесь только область сообщений канала и инпут */}
      <div className="flex-1 p-4">
        {/* Сообщения текущего канала */}
      </div>
      <div className="p-4 border-t">
        {/* Инпут для отправки сообщения */}
      </div>
    </div>
  );
};