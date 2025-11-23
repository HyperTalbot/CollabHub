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
	// Разрешаем CORS для веб-сокетов (важно для localhost:3000)
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	UserID uint
	DB     *gorm.DB // Ссылка на БД для сохранения сообщений
}

// Входящее сообщение от фронтенда
type IncomingMessage struct {
	ConversationID uint   `json:"conversation_id"`
	Content        string `json:"content"`
}

// Исходящее сообщение (то, что увидит фронтенд)
type OutgoingMessage struct {
	ID             uint      `json:"id"`
	ConversationID uint      `json:"conversation_id"`
	SenderID       uint      `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
	// Можно добавить Username отправителя
}

// ReadPump читает сообщения от WebSocket (от браузера)
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
				log.Printf("error: %v", err)
			}
			break
		}

		// 1. Парсим JSON от фронтенда
		var msgReq IncomingMessage
		if err := json.Unmarshal(messageBytes, &msgReq); err != nil {
			log.Printf("Invalid JSON format: %v", err)
			continue
		}

		// 2. Сохраняем в БД
		newMessage := models.Message{
			ConversationID: msgReq.ConversationID,
			SenderID:       c.UserID,
			Content:        msgReq.Content,
		}

		if err := c.DB.Create(&newMessage).Error; err != nil {
			log.Printf("Failed to save message: %v", err)
			continue
		}

		// Автоматически обновляем курсор прочтения для ОТПРАВИТЕЛЯ
		// "Я прочитал сообщение, которое только что отправил"
		c.DB.Model(&models.ConversationParticipant{}).
			Where("conversation_id = ? AND user_id = ?", newMessage.ConversationID, c.UserID).
			Update("last_read_message_id", newMessage.ID)

		// Получаем имя пользователя (можно оптимизировать, храня в Client, но пока так)
		username := utils.GetUsernameByID(c.UserID)

		// 3. Подготавливаем ответ (JSON) для рассылки
		outMsg := OutgoingMessage{
			ID:             newMessage.ID,
			ConversationID: newMessage.ConversationID,
			SenderID:       newMessage.SenderID,
			SenderUsername: username,
			Content:        newMessage.Content,
			CreatedAt:      newMessage.CreatedAt,
		}

		responseBytes, _ := json.Marshal(outMsg)

		// 4. Находим участников чата и рассылаем им
		var conversation models.Conversation
		// Загружаем участников чата
		if err := c.DB.Preload("Participants").First(&conversation, msgReq.ConversationID).Error; err == nil {
			for _, p := range conversation.Participants {
				// Отправляем всем участникам (включая отправителя, чтобы он увидел свое сообщение)
				c.Hub.SendToUser(p.ID, responseBytes)
			}
		}
	}
}

// WritePump отправляет сообщения в WebSocket (в браузер)
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

// ServeWs обрабатывает HTTP-запрос и превращает его в WebSocket
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
