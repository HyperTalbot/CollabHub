package ws

import "sync"

type Hub struct {
	// Карта зарегистрированных клиентов: UserID -> *Client
	Clients map[uint]*Client

	// Мбютекс для безопасной работы с картой в многопоточной среде
	mu sync.RWMutex

	// Каналы для регистрации/удаления
	Register   chan *Client
	Unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[uint]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client.UserID] = client
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.UserID]; ok {
				delete(h.Clients, client.UserID)
				close(client.Send)
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) SendToUser(userID uint, message []byte) {
	h.mu.RLock()
	client, ok := h.Clients[userID]
	h.mu.RUnlock()

	if ok {
		select {
		case client.Send <- message:
		default:
			// Если буфер клиента переполнен, отключаем его
			h.mu.Lock()
			delete(h.Clients, userID)
			close(client.Send)
			h.mu.Unlock()
		}
	}
}
