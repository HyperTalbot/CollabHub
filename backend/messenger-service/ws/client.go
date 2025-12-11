package ws

// Логика:
// 1. Клиент присылает JSON: { "conversation_id": 1, "content": "Привет" }.
// 2. Мы сохраняем его в БД
// 3. Мы находим участников чата.
// 4. Мы отправляем это сообщение всем участникам через Hub.SendToUser

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Разрешаем CORS
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Client - посредник между websocket соединением и Hub
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID uint
	DB     *gorm.DB
}

// ServeWs - обрабатывает HTTP-запрос и переключает его на WebSocket
// Эту функцию мы вызываем из main.go
func ServeWs(hub *Hub, db *gorm.DB, w http.ResponseWriter, r *http.Request, userID uint) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
		DB:     db,
	}

	client.Hub.Register <- client

	// Запускаем горутины для чтения и записи
	go client.WritePump()
	go client.ReadPump()
}

// IncomingMessage - то, что присылает фронтенд
type IncomingMessage struct {
	ConversationID *uint  `json:"conversation_id"`
	ChannelID      *uint  `json:"channel_id"`
	Content        string `json:"content"`
}

// OutgoingMessage - то, что мы отправляем обратно клиентам
type OutgoingMessage struct {
	ID             uint      `json:"id"`
	ConversationID *uint     `json:"conversation_id,omitempty"`
	ChannelID      *uint     `json:"channel_id,omitempty"`
	SenderID       uint      `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

// ReadPump - читает сообщения от браузера, сохраняет в БД и рассылает
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c // Исправлено: Unregister с большой буквы
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS Error: %v", err)
			}
			break
		}

		// 1. Парсинг
		var msgReq IncomingMessage
		if err := json.Unmarshal(messageBytes, &msgReq); err != nil {
			log.Printf("Invalid JSON: %v", err)
			continue
		}

		// Валидация
		if (msgReq.ConversationID == nil && msgReq.ChannelID == nil) || (msgReq.ConversationID != nil && msgReq.ChannelID != nil) {
			continue
		}

		// --- ЛОГИКА ДЛЯ ЛИЧНЫХ ЧАТОВ ---
		if msgReq.ConversationID != nil {
			// Сохраняем в БД
			newMessage := models.Message{
				ConversationID: msgReq.ConversationID,
				SenderID:       c.UserID,
				Content:        msgReq.Content,
			}
			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("DB Error: %v", err)
				continue
			}

			// Обновляем "Прочитано" для себя
			c.DB.Model(&models.ConversationParticipant{}).
				Where("conversation_id = ? AND user_id = ?", *msgReq.ConversationID, c.UserID).
				Update("last_read_message_id", newMessage.ID)

			// Подготавливаем ответ
			username := utils.GetUsernameByID(c.UserID)
			outMsg := OutgoingMessage{
				ID:             newMessage.ID,
				ConversationID: newMessage.ConversationID,
				SenderID:       newMessage.SenderID,
				SenderUsername: username,
				Content:        newMessage.Content,
				CreatedAt:      newMessage.CreatedAt,
			}
			responseBytes, _ := json.Marshal(outMsg)

			// РАССЫЛКА: Ищем участников и отправляем каждому лично через Hub.SendToUser

			var participants []models.User
			// Используем сложный JOIN или Preload, чтобы найти ID участников
			c.DB.Joins("JOIN conversation_participants cp ON cp.user_id = users.id").
				Where("cp.conversation_id = ?", *msgReq.ConversationID).
				Find(&participants)

			for _, p := range participants {
				c.Hub.SendToUser(p.ID, responseBytes)
			}
		}

		// --- ЛОГИКА ДЛЯ КАНАЛОВ СЕРВЕРА ---
		if msgReq.ChannelID != nil {
			// Находим канал, чтобы узнать сервер
			var channel models.Channel
			if err := c.DB.First(&channel, *msgReq.ChannelID).Error; err != nil {
				continue
			}

			// Проверка прав (участник ли сервера?)
			var count int64
			c.DB.Table("server_members").
				Where("server_id = ? AND user_id = ?", channel.ServerID, c.UserID).
				Count(&count)
			if count == 0 {
				continue
			}

			// Сохраняем
			newMessage := models.Message{
				ChannelID: msgReq.ChannelID,
				SenderID:  c.UserID,
				Content:   msgReq.Content,
			}
			if err := c.DB.Create(&newMessage).Error; err != nil {
				continue
			}

			// Подготавливаем ответ
			username := utils.GetUsernameByID(c.UserID)
			outMsg := OutgoingMessage{
				ID:             newMessage.ID,
				ChannelID:      newMessage.ChannelID,
				SenderID:       newMessage.SenderID,
				SenderUsername: username,
				Content:        newMessage.Content,
				CreatedAt:      newMessage.CreatedAt,
			}
			responseBytes, _ := json.Marshal(outMsg)

			// РАССЫЛКА: Ищем всех членов сервера
			var memberIDs []uint
			c.DB.Table("server_members").
				Where("server_id = ?", channel.ServerID).
				Pluck("user_id", &memberIDs)

			for _, memberID := range memberIDs {
				c.Hub.SendToUser(memberID, responseBytes)
			}
		}
	}
}

// WritePump отправляет сообщения из канала Send в WebSocket
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
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
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
