// /backend/messenger-service/ws/client.go
package ws

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
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

	maxMessageSize = 64 * 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
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
	ReplyToID      *uint  `json:"reply_to_id"`
	ReplyToIDs     []uint `json:"reply_to_ids"`
	ForwardedFrom  *uint  `json:"forwarded_from"`
	AttachmentURL  string `json:"attachment_url"`
	AttachmentType string `json:"attachment_type"`
}

// joinIDs — []uint → "12,15,19"
func joinIDs(ids []uint) string {
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			parts = append(parts, strconv.FormatUint(uint64(id), 10))
		}
	}
	return strings.Join(parts, ",")
}

// parseReplyIDs — "12,15,19" → []uint
func parseReplyIDs(s string) []uint {
	out := []uint{}
	if strings.TrimSpace(s) == "" {
		return out
	}
	for _, p := range strings.Split(s, ",") {
		if v, err := strconv.Atoi(strings.TrimSpace(p)); err == nil && v > 0 {
			out = append(out, uint(v))
		}
	}
	return out
}

// resolveForwardedName — display_name автора пересланного сообщения
func resolveForwardedName(from *uint) string {
	if from == nil {
		return ""
	}
	u := utils.GetUserByID(*from)
	if u == nil {
		return ""
	}
	if u.DisplayName != "" {
		return u.DisplayName
	}
	return u.Username
}

// buildReplyPreview — превью сообщения, на которое отвечаем
func (c *Client) buildReplyPreview(replyToID *uint) map[string]interface{} {
	if replyToID == nil {
		return nil
	}
	var original models.Message
	if err := c.DB.Preload("Sender").First(&original, *replyToID).Error; err != nil {
		return nil
	}
	return map[string]interface{}{
		"id":              original.ID,
		"content":         original.Content,
		"sender_id":       original.SenderID,
		"sender_username": original.Sender.Username,
		"attachment_type": original.AttachmentType,
	}
}

// buildReplyPreviews — превью для ответа на несколько сообщений
func (c *Client) buildReplyPreviews(ids []uint) []map[string]interface{} {
	out := []map[string]interface{}{}
	if len(ids) == 0 {
		return out
	}
	var originals []models.Message
	c.DB.Preload("Sender").Where("id IN ?", ids).Find(&originals)
	byID := map[uint]models.Message{}
	for _, o := range originals {
		byID[o.ID] = o
	}
	for _, id := range ids {
		if o, ok := byID[id]; ok {
			out = append(out, map[string]interface{}{
				"id":              o.ID,
				"content":         o.Content,
				"sender_id":       o.SenderID,
				"sender_username": o.Sender.Username,
				"attachment_type": o.AttachmentType,
			})
		}
	}
	return out
}

// buildMessagePayload — единый WS-payload нового сообщения
// (ИЗМЕНЕНО: всегда включает conversation_id / group_id / channel_id —
//
//	нужное поле заполнено, остальные null)
func (c *Client) buildMessagePayload(m models.Message, sender models.User) map[string]interface{} {
	inner := map[string]interface{}{
		"id":                m.ID,
		"conversation_id":   m.ConversationID,
		"group_id":          m.GroupID,
		"channel_id":        m.ChannelID,
		"sender_id":         m.SenderID,
		"sender_username":   sender.Username,
		"sender_avatar":     sender.AvatarURL,
		"content":           m.Content,
		"created_at":        m.CreatedAt,
		"reply_to_id":       m.ReplyToID,
		"forwarded_from":    m.ForwardedFrom,
		"attachment_url":    m.AttachmentURL,
		"attachment_type":   m.AttachmentType,
		"is_edited":         m.IsEdited,
		"is_pinned":         m.IsPinned,
		"is_system_message": m.IsSystemMessage,
	}

	if m.ForwardedFrom != nil {
		inner["forwarded_from_name"] = resolveForwardedName(m.ForwardedFrom)
	}
	if preview := c.buildReplyPreview(m.ReplyToID); preview != nil {
		inner["reply_preview"] = preview
	}
	if ids := parseReplyIDs(m.ReplyToIDs); len(ids) > 0 {
		inner["reply_to_ids"] = ids
		inner["reply_previews"] = c.buildReplyPreviews(ids)
	}
	return map[string]interface{}{"type": "new_message", "payload": inner}
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
			log.Printf("⚠️ Non-message frame from user_id=%d (ignore): %v", c.UserID, err)
			continue
		}

		// пустой текст допустим только если пересылаем вложение
		if msgReq.Content == "" && msgReq.AttachmentURL == "" {
			continue
		}

		// валидация reply_to_id — сообщение должно существовать
		if msgReq.ReplyToID != nil {
			var cnt int64
			c.DB.Model(&models.Message{}).Where("id = ?", *msgReq.ReplyToID).Count(&cnt)
			if cnt == 0 {
				msgReq.ReplyToID = nil
			}
		}

		var sender models.User
		c.DB.First(&sender, c.UserID)

		// --- ЛИЧНЫЕ ЧАТЫ ---
		if msgReq.ConversationID != nil {
			newMessage := models.Message{
				ConversationID: msgReq.ConversationID,
				SenderID:       c.UserID,
				Content:        msgReq.Content,
				ReplyToID:      msgReq.ReplyToID,
				ReplyToIDs:     joinIDs(msgReq.ReplyToIDs),
				ForwardedFrom:  msgReq.ForwardedFrom,
				AttachmentURL:  msgReq.AttachmentURL,
				AttachmentType: msgReq.AttachmentType,
				CreatedAt:      time.Now(),
			}
			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("❌ DB Error: %v", err)
				continue
			}

			c.DB.Model(&models.ConversationParticipant{}).
				Where("conversation_id = ? AND user_id = ?", *msgReq.ConversationID, c.UserID).
				Update("last_read_message_id", newMessage.ID)

			wsPayload := c.buildMessagePayload(newMessage, sender)
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
			// ═══ КРИТИЧНО: проверка членства. Удалённый из группы
			// пользователь больше не может писать (раньше сообщение
			// принималось и успешно доставлялось всем) ═══
			var isMember int64
			c.DB.Model(&models.GroupMember{}).
				Where("group_id = ? AND user_id = ?", *msgReq.GroupID, c.UserID).
				Count(&isMember)
			if isMember == 0 {
				log.Printf("⛔ user_id=%d не является участником group_id=%d — сообщение отклонено", c.UserID, *msgReq.GroupID)
				errPayload, _ := json.Marshal(map[string]interface{}{
					"type": "error",
					"payload": map[string]interface{}{
						"error": "You are not a member of this group",
					},
				})
				c.TrySend(errPayload)
				continue
			}

			newMessage := models.Message{
				GroupID:        msgReq.GroupID,
				SenderID:       c.UserID,
				Content:        msgReq.Content,
				ReplyToID:      msgReq.ReplyToID,
				ReplyToIDs:     joinIDs(msgReq.ReplyToIDs),
				ForwardedFrom:  msgReq.ForwardedFrom,
				AttachmentURL:  msgReq.AttachmentURL,
				AttachmentType: msgReq.AttachmentType,
				CreatedAt:      time.Now(),
			}

			// НОВОЕ: отправитель своё сообщение точно «прочитал» —
			// обновляем last_read, чтобы плашка не ставилась на собственные сообщения
			c.DB.Model(&models.GroupMember{}).
				Where("group_id = ? AND user_id = ?", *msgReq.GroupID, c.UserID).
				Update("last_read_message_id", newMessage.ID)

			wsPayload := c.buildMessagePayload(newMessage, sender)
			responseBytes, _ := json.Marshal(wsPayload)

			var members []uint
			c.DB.Table("group_members").
				Where("group_id = ?", *msgReq.GroupID).
				Pluck("user_id", &members)

			for _, memberID := range members {
				c.Hub.SendToUser(memberID, responseBytes)
			}
		}

		// ═══ НОВОЕ: КАНАЛЫ СЕРВЕРОВ ═══
		if msgReq.ChannelID != nil {
			var channel models.Channel
			if err := c.DB.First(&channel, *msgReq.ChannelID).Error; err != nil {
				log.Printf("❌ Channel %v not found", *msgReq.ChannelID)
				continue
			}

			// проверка членства на сервере
			var isMember int64
			c.DB.Table("server_members").
				Where("server_id = ? AND user_id = ?", channel.ServerID, c.UserID).
				Count(&isMember)
			if isMember == 0 {
				errPayload, _ := json.Marshal(map[string]interface{}{
					"type":    "error",
					"payload": map[string]interface{}{"error": "You are not a member of this server"},
				})
				c.TrySend(errPayload)
				continue
			}

			newMessage := models.Message{
				ChannelID:      msgReq.ChannelID,
				SenderID:       c.UserID,
				Content:        msgReq.Content,
				ReplyToID:      msgReq.ReplyToID,
				ReplyToIDs:     joinIDs(msgReq.ReplyToIDs),
				ForwardedFrom:  msgReq.ForwardedFrom,
				AttachmentURL:  msgReq.AttachmentURL,
				AttachmentType: msgReq.AttachmentType,
				CreatedAt:      time.Now(),
			}
			if err := c.DB.Create(&newMessage).Error; err != nil {
				log.Printf("❌ DB Error (Channel): %v", err)
				continue
			}

			wsPayload := c.buildMessagePayload(newMessage, sender)
			responseBytes, _ := json.Marshal(wsPayload)

			var serverMemberIDs []uint
			c.DB.Table("server_members").
				Where("server_id = ?", channel.ServerID).
				Pluck("user_id", &serverMemberIDs)

			for _, memberID := range serverMemberIDs {
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
