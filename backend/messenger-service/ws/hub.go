// backend/messenger-service/ws/hub.go
//
// ══════════════════════════════════════════════════════════════════
// ПОЛНАЯ ПЕРЕРАБОТКА ХАБА. Что было сломано:
//
//  1. Clients map[uint]*Client — ОДНО соединение на пользователя.
//     Телефон и ноут под одним аккаунтом убивали друг друга.
//     → map[uint]map[*Client]bool: все устройства получают события.
//
//  2. Unregister удалял запись ПО UserID, не проверяя, тот ли это клиент:
//     if _, ok := h.Clients[client.UserID]; ok { delete(...) }
//     Старое соединение закрывалось → слало Unregister → удаляло НОВОЕ.
//     Результат: пользователь исчезал из хаба и не получал incoming_call.
//     → удаляем только конкретного клиента и только если он реально в мапе.
//
//  3. client.Send <- data в ЗАКРЫТЫЙ канал → паника в h.Run() →
//     goroutine хаба умирала НАВСЕГДА, WebSocket глох у всех пользователей.
//     → TrySend с recover + закрытие через sync.Once + автоперезапуск Run().
//
//  4. В Broadcast был апгрейд блокировки RUnlock→Lock внутри цикла
//     по мапе (гонка + потенциальный deadlock).
//     → мёртвые клиенты собираются в срез и чистятся после цикла.
//
//  5. Канал Broadcast был небуферизованный: если Run() занят/мёртв,
//     HTTP-хендлер (POST /calls) блокировался навсегда.
//     → буфер 512.
//
// ══════════════════════════════════════════════════════════════════
package ws

import (
	"log"
	"sync"
)

// BroadcastMessage - структура для внутренней рассылки через хаб
type BroadcastMessage struct {
	UserIDs []uint // Кому отправить. Если пусто — никому (безопасность)
	Data    []byte // JSON байты
}

type Hub struct {
	// ВАЖНО: UserID -> НАБОР соединений (телефон + ноут + несколько вкладок)
	Clients map[uint]map[*Client]bool

	mu sync.RWMutex

	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan BroadcastMessage
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[uint]map[*Client]bool),
		Register:   make(chan *Client, 64),
		Unregister: make(chan *Client, 64),
		Broadcast:  make(chan BroadcastMessage, 512), // буфер, чтобы хендлеры не блокировались
	}
}

func (h *Hub) Run() {
	// Страховка: если где-то всё же случится паника — хаб перезапустится,
	// а не умрёт навсегда (раньше именно так глох весь WebSocket).
	defer func() {
		if r := recover(); r != nil {
			log.Printf("❌ Hub panic recovered: %v — restarting hub goroutine", r)
			go h.Run()
		}
	}()

	for {
		select {
		// ─────────── РЕГИСТРАЦИЯ ───────────
		case client := <-h.Register:
			h.mu.Lock()
			if h.Clients[client.UserID] == nil {
				h.Clients[client.UserID] = make(map[*Client]bool)
			}
			// НЕ закрываем старое соединение — это другое устройство/вкладка
			h.Clients[client.UserID][client] = true
			count := len(h.Clients[client.UserID])
			h.mu.Unlock()

			log.Printf("✅ WS registered: user_id=%d (active connections: %d)", client.UserID, count)

		// ─────────── ОТКЛЮЧЕНИЕ ───────────
		case client := <-h.Unregister:
			h.mu.Lock()
			if set, ok := h.Clients[client.UserID]; ok {
				// КРИТИЧНО: удаляем только ЕСЛИ это именно тот клиент,
				// который отключается. Раньше здесь удалялась вся запись
				// по UserID — и новое соединение исчезало вместе со старым.
				if set[client] {
					delete(set, client)
					client.CloseSendChannel()

					if len(set) == 0 {
						delete(h.Clients, client.UserID)
					}

					log.Printf("🔌 WS unregistered: user_id=%d (active left: %d)",
						client.UserID, len(set))
				}
			}
			h.mu.Unlock()

		// ─────────── РАССЫЛКА ───────────
		case msg := <-h.Broadcast:
			if len(msg.UserIDs) == 0 || len(msg.Data) == 0 {
				continue
			}

			var dead []*Client

			h.mu.RLock()
			for _, userID := range msg.UserIDs {
				// Шлём ВСЕМ устройствам пользователя (телефон + ноут + вкладки)
				for client := range h.Clients[userID] {
					if !client.TrySend(msg.Data) {
						dead = append(dead, client)
					}
				}
			}
			h.mu.RUnlock()

			// Чистим мёртвых ОТДЕЛЬНЫМ проходом под write-lock
			// (нельзя мутировать мапу во время range по ней)
			if len(dead) > 0 {
				h.mu.Lock()
				for _, client := range dead {
					if set, ok := h.Clients[client.UserID]; ok {
						if set[client] {
							delete(set, client)
							client.CloseSendChannel()
							if len(set) == 0 {
								delete(h.Clients, client.UserID)
							}
						}
					}
				}
				h.mu.Unlock()
			}
		}
	}
}

// SendToUser - отправить сообщение ВСЕМ соединениям пользователя
func (h *Hub) SendToUser(userID uint, message []byte) {
	h.mu.RLock()
	var targets []*Client
	for client := range h.Clients[userID] {
		targets = append(targets, client)
	}
	h.mu.RUnlock()

	for _, client := range targets {
		if !client.TrySend(message) {
			h.removeDeadClient(client)
		}
	}
}

// SendToUserExcept - всем соединениям пользователя, КРОМЕ указанного
// (полезно, чтобы не дублировать эхо на устройство-отправитель)
func (h *Hub) SendToUserExcept(userID uint, except *Client, message []byte) {
	h.mu.RLock()
	var targets []*Client
	for client := range h.Clients[userID] {
		if client != except {
			targets = append(targets, client)
		}
	}
	h.mu.RUnlock()

	for _, client := range targets {
		if !client.TrySend(message) {
			h.removeDeadClient(client)
		}
	}
}

// IsUserOnline - есть ли хоть одно живое соединение у пользователя
func (h *Hub) IsUserOnline(userID uint) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.Clients[userID]) > 0
}

func (h *Hub) removeDeadClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if set, ok := h.Clients[client.UserID]; ok {
		if set[client] {
			delete(set, client)
			client.CloseSendChannel()
			if len(set) == 0 {
				delete(h.Clients, client.UserID)
			}
		}
	}
}

// BroadcastToAll - отправить сообщение ВСЕМ подключённым пользователям
// (используется в main.go для системного уведомления о перезапуске сервиса)
func (h *Hub) BroadcastToAll(data []byte) {
	if len(data) == 0 {
		return
	}
	h.mu.RLock()
	userIDs := make([]uint, 0, len(h.Clients))
	for uid := range h.Clients {
		userIDs = append(userIDs, uid)
	}
	h.mu.RUnlock()

	if len(userIDs) > 0 {
		h.Broadcast <- BroadcastMessage{UserIDs: userIDs, Data: data}
	}
}
