package ws

import (
	"backend/messenger-service/models"
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
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID uint
	DB     *gorm.DB
}

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

	go client.WritePump()
	go client.ReadPump()
}

type IncomingMessage struct {
	ConversationID *uint  `json:"conversation_id"`
	ChannelID      *uint  `json:"channel_id"`
	GroupID        *uint  `json:"group_id"` // Добавили поддержку групп
	Content        string `json:"content"`
}

type OutgoingMessage struct {
	ID             uint      `json:"id"`
	ConversationID *uint     `json:"conversation_id,omitempty"`
	ChannelID      *uint     `json:"channel_id,omitempty"`
	GroupID        *uint     `json:"group_id,omitempty"`
	SenderID       uint      `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	SenderAvatar   string    `json:"sender_avatar"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
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

		var msgReq IncomingMessage
		if err := json.Unmarshal(messageBytes, &msgReq); err != nil {
			log.Printf("Invalid JSON: %v", err)
			continue
		}

		// --- ЛИЧНЫЕ ЧАТЫ ---
		if msgReq.ConversationID != nil {
			newMessage := models.Message{
				ConversationID: msgReq.ConversationID, // Убрали *, так как это уже *uint
				SenderID:       c.UserID,
				Content:        msgReq.Content,
				CreatedAt:      time.Now(),
			}

			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("DB Error: %v", err)
				continue
			}

			// Обновляем курсор прочтения
			c.DB.Model(&models.ConversationParticipant{}).
				Where("conversation_id = ? AND user_id = ?", *msgReq.ConversationID, c.UserID).
				Update("last_read_message_id", newMessage.ID)

			var sender models.User
			c.DB.First(&sender, c.UserID)

			outMsg := OutgoingMessage{
				ID:             newMessage.ID,
				ConversationID: newMessage.ConversationID, // Убрали &, так как это уже *uint
				SenderID:       newMessage.SenderID,
				SenderUsername: sender.Username,
				SenderAvatar:   sender.AvatarURL,
				Content:        newMessage.Content,
				CreatedAt:      newMessage.CreatedAt,
			}

			// КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Формируем правильный WebSocket payload
			wsPayload := map[string]interface{}{
				"type": "new_message",
				"payload": map[string]interface{}{
					"id":              outMsg.ID,
					"conversation_id": outMsg.ConversationID,
					"sender_id":       outMsg.SenderID,
					"sender_username": outMsg.SenderUsername,
					"sender_avatar":   outMsg.SenderAvatar,
					"content":         outMsg.Content,
					"created_at":      outMsg.CreatedAt,
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
				log.Printf("DB Error: %v", err)
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
			c.DB.Table("group_members").Where("group_id = ?", *msgReq.GroupID).Pluck("user_id", &members)

			for _, memberID := range members {
				c.Hub.SendToUser(memberID, responseBytes)
			}
		}
	}
}

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
