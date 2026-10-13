// /backend/messenger-service/ws/client.go
package ws

import (
	"backend/messenger-service/models"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

const (
	writeWait  = 15 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10

	// БЫЛО 512 байт — любое длинное сообщение рвало соединение
	maxMessageSize = 64 * 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	// Мобильные браузеры ходят через прокси оператора — origin меняется
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID uint
	DB     *gorm.DB

	closeOnce sync.Once
	closed    atomic.Bool
}

func ServeWs(hub *Hub, db *gorm.DB, w http.ResponseWriter, r *http.Request, userID uint) {
	log.Printf("🔌 WebSocket upgrade request from user_id=%d", userID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed for user_id=%d: %v", userID, err)
		return
	}

	client := &Client{
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 512),
		UserID: userID,
		DB:     db,
	}

	client.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

func (c *Client) CloseSendChannel() {
	c.closeOnce.Do(func() {
		c.closed.Store(true)
		close(c.Send)
	})
}

func (c *Client) IsClosed() bool {
	return c.closed.Load()
}

// TrySend - безопасная неблокирующая отправка с recover.
// Без recover гонка с CloseSendChannel роняла goroutine хаба навсегда.
func (c *Client) TrySend(data []byte) (ok bool) {
	if c.IsClosed() {
		return false
	}

	defer func() {
		if r := recover(); r != nil {
			ok = false
		}
	}()

	select {
	case c.Send <- data:
		return true
	default:
		log.Printf("⚠️ Send buffer full for user_id=%d", c.UserID)
		return false
	}
}

type IncomingMessage struct {
	ConversationID *uint  `json:"conversation_id"`
	ChannelID      *uint  `json:"channel_id"`
	GroupID        *uint  `json:"group_id"`
	Content        string `json:"content"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
				websocket.CloseNormalClosure) {
				log.Printf("⚠️ WS read error user_id=%d: %v", c.UserID, err)
			}
			break
		}

		var msgReq IncomingMessage
		if err := json.Unmarshal(messageBytes, &msgReq); err != nil {
			// Сервисный keepalive от клиента — не ошибка
			log.Printf("⚠️ Non-message frame from user_id=%d (ignore): %v", c.UserID, err)
			continue
		}

		if msgReq.Content == "" {
			continue
		}

		// --- ЛИЧНЫЕ ЧАТЫ ---
		if msgReq.ConversationID != nil {
			newMessage := models.Message{
				ConversationID: msgReq.ConversationID,
				SenderID:       c.UserID,
				Content:        msgReq.Content,
				CreatedAt:      time.Now(),
			}

			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("❌ DB Error: %v", err)
				continue
			}

			c.DB.Model(&models.ConversationParticipant{}).
				Where("conversation_id = ? AND user_id = ?", *msgReq.ConversationID, c.UserID).
				Update("last_read_message_id", newMessage.ID)

			var sender models.User
			c.DB.First(&sender, c.UserID)

			wsPayload := map[string]interface{}{
				"type": "new_message",
				"payload": map[string]interface{}{
					"id":              newMessage.ID,
					"conversation_id": newMessage.ConversationID,
					"sender_id":       newMessage.SenderID,
					"sender_username": sender.Username,
					"sender_avatar":   sender.AvatarURL,
					"content":         newMessage.Content,
					"created_at":      newMessage.CreatedAt,
				},
			}
			responseBytes, _ := json.Marshal(wsPayload)

			var participants []models.User
			c.DB.Joins("JOIN conversation_participants cp ON cp.user_id = users.id").
				Where("cp.conversation_id = ?", *msgReq.ConversationID).
				Find(&participants)

			for _, p := range participants {
				c.Hub.SendToUser(p.ID, responseBytes)
			}
		}

		// --- ГРУППЫ ---
		if msgReq.GroupID != nil {
			newMessage := models.Message{
				GroupID:   msgReq.GroupID,
				SenderID:  c.UserID,
				Content:   msgReq.Content,
				CreatedAt: time.Now(),
			}

			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("❌ DB Error (Group): %v", err)
				continue
			}

			var sender models.User
			c.DB.First(&sender, c.UserID)

			wsPayload := map[string]interface{}{
				"type": "new_message",
				"payload": map[string]interface{}{
					"id":              newMessage.ID,
					"group_id":        newMessage.GroupID,
					"sender_id":       newMessage.SenderID,
					"sender_username": sender.Username,
					"sender_avatar":   sender.AvatarURL,
					"content":         newMessage.Content,
					"created_at":      newMessage.CreatedAt,
				},
			}
			responseBytes, _ := json.Marshal(wsPayload)

			var members []uint
			c.DB.Table("group_members").
				Where("group_id = ?", *msgReq.GroupID).
				Pluck("user_id", &members)

			for _, memberID := range members {
				c.Hub.SendToUser(memberID, responseBytes)
			}
		}
	}
}

// WritePump — ИСПРАВЛЕНО: строго один JSON-объект на один фрейм.
// Никакой склейки через "\n" — именно она ломала JSON.parse на клиенте.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))

			if !ok {
				// Канал закрыт — корректно прощаемся
				c.Conn.WriteMessage(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("❌ WS write error user_id=%d: %v", c.UserID, err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// package ws

// import (
// 	"backend/messenger-service/models"
// 	"encoding/json"
// 	"log"
// 	"net/http"
// 	"time"

// 	"github.com/gorilla/websocket"
// 	"gorm.io/gorm"
// )

// const (
// 	writeWait      = 10 * time.Second
// 	pongWait       = 60 * time.Second
// 	pingPeriod     = (pongWait * 9) / 10
// 	maxMessageSize = 512
// )

// var upgrader = websocket.Upgrader{
// 	ReadBufferSize:  1024,
// 	WriteBufferSize: 1024,
// 	CheckOrigin:     func(r *http.Request) bool { return true },
// }

// type Client struct {
// 	Hub    *Hub
// 	Conn   *websocket.Conn
// 	Send   chan []byte
// 	UserID uint
// 	DB     *gorm.DB
// }

// func ServeWs(hub *Hub, db *gorm.DB, w http.ResponseWriter, r *http.Request, userID uint) {
// 	log.Printf("🔌 WebSocket upgrade request from user_id=%d", userID)

// 	conn, err := upgrader.Upgrade(w, r, nil)
// 	if err != nil {
// 		log.Printf("❌ WebSocket upgrade failed for user_id=%d: %v", userID, err)
// 		return
// 	}

// 	log.Printf("✅ WebSocket connected: user_id=%d", userID)

// 	client := &Client{
// 		Hub:    hub,
// 		Conn:   conn,
// 		Send:   make(chan []byte, 256),
// 		UserID: userID,
// 		DB:     db,
// 	}

// 	client.Hub.Register <- client

// 	go client.WritePump()
// 	go client.ReadPump()
// }

// type IncomingMessage struct {
// 	ConversationID *uint  `json:"conversation_id"`
// 	ChannelID      *uint  `json:"channel_id"`
// 	GroupID        *uint  `json:"group_id"` // Добавили поддержку групп
// 	Content        string `json:"content"`
// }

// type OutgoingMessage struct {
// 	ID             uint      `json:"id"`
// 	ConversationID *uint     `json:"conversation_id,omitempty"`
// 	ChannelID      *uint     `json:"channel_id,omitempty"`
// 	GroupID        *uint     `json:"group_id,omitempty"`
// 	SenderID       uint      `json:"sender_id"`
// 	SenderUsername string    `json:"sender_username"`
// 	SenderAvatar   string    `json:"sender_avatar"`
// 	Content        string    `json:"content"`
// 	CreatedAt      time.Time `json:"created_at"`
// }

// func (c *Client) ReadPump() {
// 	defer func() {
// 		c.Hub.Unregister <- c
// 		c.Conn.Close()
// 	}()

// 	c.Conn.SetReadLimit(maxMessageSize)
// 	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
// 	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

// 	for {
// 		_, messageBytes, err := c.Conn.ReadMessage()
// 		if err != nil {
// 			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
// 				log.Printf("WS Error: %v", err)
// 			}
// 			break
// 		}

// 		var msgReq IncomingMessage
// 		if err := json.Unmarshal(messageBytes, &msgReq); err != nil {
// 			log.Printf("Invalid JSON: %v", err)
// 			continue
// 		}

// 		// --- ЛИЧНЫЕ ЧАТЫ ---
// 		if msgReq.ConversationID != nil {
// 			newMessage := models.Message{
// 				ConversationID: msgReq.ConversationID, // Убрали *, так как это уже *uint
// 				SenderID:       c.UserID,
// 				Content:        msgReq.Content,
// 				CreatedAt:      time.Now(),
// 			}

// 			if err := c.DB.Create(&newMessage).Error; err != nil {
// 				log.Printf("DB Error: %v", err)
// 				continue
// 			}

// 			// Обновляем курсор прочтения
// 			c.DB.Model(&models.ConversationParticipant{}).
// 				Where("conversation_id = ? AND user_id = ?", *msgReq.ConversationID, c.UserID).
// 				Update("last_read_message_id", newMessage.ID)

// 			var sender models.User
// 			c.DB.First(&sender, c.UserID)

// 			outMsg := OutgoingMessage{
// 				ID:             newMessage.ID,
// 				ConversationID: newMessage.ConversationID, // Убрали &, так как это уже *uint
// 				SenderID:       newMessage.SenderID,
// 				SenderUsername: sender.Username,
// 				SenderAvatar:   sender.AvatarURL,
// 				Content:        newMessage.Content,
// 				CreatedAt:      newMessage.CreatedAt,
// 			}

// 			// КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Формируем правильный WebSocket payload
// 			wsPayload := map[string]interface{}{
// 				"type": "new_message",
// 				"payload": map[string]interface{}{
// 					"id":              outMsg.ID,
// 					"conversation_id": outMsg.ConversationID,
// 					"sender_id":       outMsg.SenderID,
// 					"sender_username": outMsg.SenderUsername,
// 					"sender_avatar":   outMsg.SenderAvatar,
// 					"content":         outMsg.Content,
// 					"created_at":      outMsg.CreatedAt,
// 				},
// 			}

// 			responseBytes, _ := json.Marshal(wsPayload)

// 			var participants []models.User
// 			c.DB.Joins("JOIN conversation_participants cp ON cp.user_id = users.id").
// 				Where("cp.conversation_id = ?", *msgReq.ConversationID).
// 				Find(&participants)

// 			for _, p := range participants {
// 				c.Hub.SendToUser(p.ID, responseBytes)
// 			}
// 		}

// 		// --- ГРУППЫ ---
// 		if msgReq.GroupID != nil {
// 			newMessage := models.Message{
// 				GroupID:   msgReq.GroupID,
// 				SenderID:  c.UserID,
// 				Content:   msgReq.Content,
// 				CreatedAt: time.Now(),
// 			}

// 			if err := c.DB.Create(&newMessage).Error; err != nil {
// 				log.Printf("DB Error (Group): %v", err)
// 				continue
// 			}

// 			var sender models.User
// 			c.DB.First(&sender, c.UserID)

// 			wsPayload := map[string]interface{}{
// 				"type": "new_message",
// 				"payload": map[string]interface{}{
// 					"id":              newMessage.ID,
// 					"group_id":        newMessage.GroupID,
// 					"sender_id":       newMessage.SenderID,
// 					"sender_username": sender.Username,
// 					"sender_avatar":   sender.AvatarURL,
// 					"content":         newMessage.Content,
// 					"created_at":      newMessage.CreatedAt,
// 				},
// 			}

// 			responseBytes, _ := json.Marshal(wsPayload)

// 			var members []uint
// 			c.DB.Table("group_members").Where("group_id = ?", *msgReq.GroupID).Pluck("user_id", &members)

// 			for _, memberID := range members {
// 				c.Hub.SendToUser(memberID, responseBytes)
// 			}
// 		}
// 	}
// }

// func (c *Client) WritePump() {
// 	ticker := time.NewTicker(pingPeriod)

// 	defer func() {
// 		ticker.Stop()
// 		c.Conn.Close()
// 	}()
// 	for {
// 		select {
// 		case message, ok := <-c.Send:
// 			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
// 			if !ok {
// 				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
// 				return
// 			}
// 			w, err := c.Conn.NextWriter(websocket.TextMessage)
// 			if err != nil {
// 				return
// 			}
// 			w.Write(message)
// 			if err := w.Close(); err != nil {
// 				return
// 			}
// 		case <-ticker.C:
// 			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
// 			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
// 				return
// 			}
// 		}
// 	}
// }
