// utils/chatUtils.ts
import { Conversation, Group, User } from '@/types/messenger';

// Объединяем типы для функции
type ChatItem = Conversation | Group;

export const getChatMetadata = (chat: ChatItem, currentUserId: number) => {
    // Проверяем: если есть поле 'name', считаем это Группой
    if ('name' in chat && chat.name) {
        const group = chat as Group;
        return {
            name: group.name,
            avatar: group.avatar_url,
            isOnline: false,
            type: 'group' as const
        };
    }

    // Иначе это ЛС (Conversation)
    const conversation = chat as Conversation;
    
    // Ищем собеседника. Важно: приводим ID к числу для надежности
    const partner = conversation.participants?.find(
        p => Number(p.id) !== Number(currentUserId)
    );

    if (!partner) {
        return {
            name: 'Неизвестный', // Если вдруг массив participants пуст
            avatar: '',
            isOnline: false,
            type: 'dm' as const
        };
    }

    return {
        name: partner.username || 'Пользователь',
        avatar: partner.avatar_url || '',
        isOnline: true, // В будущем здесь можно проверить статус
        type: 'dm' as const
    };
};