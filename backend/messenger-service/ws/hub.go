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
			// Если старое соединение висит, закрываем его
			if oldClient, ok := h.Clients[client.UserID]; ok {
				close(oldClient.Send)
			}
			h.Clients[client.UserID] = client
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.UserID]; ok {
				delete(h.Clients, client.UserID)
				close(client.Send)
			}
			h.mu.Unlock()

		// Обработка рассылки от MessageHandler
		case msg := <-h.Broadcast:
			h.mu.RLock()
			for _, userID := range msg.UserIDs {
				if client, ok := h.Clients[userID]; ok {
					select {
					case client.Send <- msg.Data:
					default:
						// Буфер полон, пропускаем или отключаем
						close(client.Send)
						delete(h.Clients, userID)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// SendToUser - вспомогательный метод (используется внутри client.go)
func (h *Hub) SendToUser(userID uint, message []byte) {
	h.mu.RLock()
	client, ok := h.Clients[userID]
	h.mu.RUnlock()

	if ok {
		select {
		case client.Send <- message:
		default:
			h.mu.Lock()
			delete(h.Clients, userID)
			close(client.Send)
			h.mu.Unlock()
		}
	}
}
