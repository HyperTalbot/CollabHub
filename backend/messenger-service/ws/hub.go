package ws

import (
	"sync"
)

// BroadcastMessage - структура для внутренней рассылки через хаб
type BroadcastMessage struct {
	UserIDs []uint // Кому отправить. Если пусто — не отправляем никому (безопасность)
	Data    []byte // JSON байты
}

type Hub struct {
	// Карта зарегистрированных клиентов: UserID -> *Client
	Clients map[uint]*Client

	// Мьютекс для безопасной работы с картой
	mu sync.RWMutex

	// Каналы
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan BroadcastMessage // <--- ДОБАВИЛИ ЭТОТ КАНАЛ
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[uint]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastMessage), // Инициализация
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			// Если старое соединение висит, закрываем его безопасно
			if oldClient, ok := h.Clients[client.UserID]; ok {
				h.safeClose(oldClient)
			}
			h.Clients[client.UserID] = client
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.UserID]; ok {
				delete(h.Clients, client.UserID)
				h.safeClose(client)
			}
			h.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			for _, userID := range msg.UserIDs {
				if client, ok := h.Clients[userID]; ok {
					select {
					case client.Send <- msg.Data:
					default:
						// Буфер полон
						h.mu.RUnlock()
						h.mu.Lock()
						if _, stillExists := h.Clients[userID]; stillExists {
							delete(h.Clients, userID)
							h.safeClose(client)
						}
						h.mu.Unlock()
						h.mu.RLock()
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// safeClose безопасно закрывает канал клиента
func (h *Hub) safeClose(client *Client) {
	defer func() {
		if r := recover(); r != nil {
			// Канал уже закрыт, игнорируем панику
		}
	}()
	close(client.Send)
}

func (h *Hub) SendToUser(userID uint, message []byte) {
	h.mu.RLock()
	client, ok := h.Clients[userID]
	h.mu.RUnlock()

	if ok {
		select {
		case client.Send <- message:
		default:
			h.mu.Lock()
			if _, stillExists := h.Clients[userID]; stillExists {
				delete(h.Clients, userID)
				h.safeClose(client)
			}
			h.mu.Unlock()
		}
	}
}
