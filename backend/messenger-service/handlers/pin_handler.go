// backend/messenger-service/handlers/pin_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PinHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

type pinnedMessageResponse struct {
	ID             uint      `json:"id"` // ID самого сообщения (фронт использует как key)
	PinID          uint      `json:"pin_id"`
	MessageID      uint      `json:"message_id"`
	Content        string    `json:"content"`
	SenderID       uint      `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	CreatedAt      time.Time `json:"created_at"` // дата СООБЩЕНИЯ (fix Invalid Date)
	PinnedAt       time.Time `json:"pinned_at"`
	PinnedByUserID uint      `json:"pinned_by_user_id"`
	AttachmentURL  string    `json:"attachment_url,omitempty"`
	AttachmentType string    `json:"attachment_type,omitempty"`
}

// upsertPin — вставляет запись или «воскрешает» soft-deleted.
// ВАЖНО: уникальный индекс idx_pinned_message физически включает
// soft-deleted строки, поэтому повторный Create после Unpin падал с
// SQLSTATE 23505. Вместо вставки обновляем существующую строку.
func (h *PinHandler) upsertPin(msg models.Message, pinnedBy uint) error {
	var cnt int64
	h.DB.Unscoped().Model(&models.PinnedMessage{}).Where("message_id = ?", msg.ID).Count(&cnt)
	if cnt > 0 {
		return h.DB.Unscoped().Model(&models.PinnedMessage{}).
			Where("message_id = ?", msg.ID).
			Updates(map[string]interface{}{
				"deleted_at":        nil,
				"pinned_at":         time.Now(),
				"pinned_by_user_id": pinnedBy,
				"conversation_id":   msg.ConversationID,
				"group_id":          msg.GroupID,
				"channel_id":        msg.ChannelID,
			}).Error
	}
	return h.DB.Create(&models.PinnedMessage{
		MessageID:      msg.ID,
		ConversationID: msg.ConversationID,
		GroupID:        msg.GroupID,
		ChannelID:      msg.ChannelID,
		PinnedByUserID: pinnedBy,
		PinnedAt:       time.Now(),
	}).Error
}

func (h *PinHandler) scopeRecipients(msg models.Message) []uint {
	var recipients []uint
	switch {
	case msg.ConversationID != nil:
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *msg.ConversationID).
			Pluck("user_id", &recipients)
	case msg.GroupID != nil:
		h.DB.Table("group_members").
			Where("group_id = ?", *msg.GroupID).
			Pluck("user_id", &recipients)
	case msg.ChannelID != nil:
		var channel models.Channel
		h.DB.First(&channel, *msg.ChannelID)
		h.DB.Table("server_members").
			Where("server_id = ?", channel.ServerID).
			Pluck("user_id", &recipients)
	}
	return recipients
}

func (h *PinHandler) broadcastPin(msg models.Message, pinned bool) {
	if h.Hub == nil {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"type": "message_pinned",
		"payload": map[string]interface{}{
			"message_id": msg.ID,
			"is_pinned":  pinned,
		},
	})
	for _, id := range h.scopeRecipients(msg) {
		h.Hub.SendToUser(id, payload)
	}
}

// PinMessageToChat — POST /pin
func (h *PinHandler) PinMessageToChat(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		MessageID uint `json:"message_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var msg models.Message
	if err := h.DB.First(&msg, input.MessageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}
	if err := h.upsertPin(msg, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pin"})
		return
	}
	h.DB.Model(&msg).Update("is_pinned", true)
	h.broadcastPin(msg, true)
	c.JSON(http.StatusOK, gin.H{"status": "pinned", "message_id": msg.ID})
}

// UnpinMessage — DELETE /pin/:message_id
func (h *PinHandler) UnpinMessage(c *gin.Context) {
	msgID := c.Param("message_id")
	var msg models.Message
	if err := h.DB.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}
	h.DB.Where("message_id = ?", msg.ID).Delete(&models.PinnedMessage{})
	h.DB.Model(&msg).Update("is_pinned", false)
	h.broadcastPin(msg, false)
	c.JSON(http.StatusOK, gin.H{"status": "unpinned"})
}

// GetPinnedMessages — GET /pinned?conversation_id=|group_id=|channel_id=
// Возвращает ДАННЫЕ СООБЩЕНИЙ (content, sender, created_at), а не голые пины.
func (h *PinHandler) GetPinnedMessages(c *gin.Context) {
	userID := c.GetUint("user_id")
	convID := c.Query("conversation_id")
	groupID := c.Query("group_id")
	channelID := c.Query("channel_id")

	query := h.DB.Model(&models.PinnedMessage{})
	switch {
	case convID != "":
		var cnt int64
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id = ?", convID, userID).Count(&cnt)
		if cnt == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
		query = query.Where("conversation_id = ?", convID)
	case groupID != "":
		var cnt int64
		h.DB.Model(&models.GroupMember{}).
			Where("group_id = ? AND user_id = ?", groupID, userID).Count(&cnt)
		if cnt == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
		query = query.Where("group_id = ?", groupID)
	case channelID != "":
		query = query.Where("channel_id = ?", channelID)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id, group_id or channel_id required"})
		return
	}

	var pins []models.PinnedMessage
	query.Order("pinned_at desc").Limit(100).Find(&pins)

	items := make([]pinnedMessageResponse, 0, len(pins))
	for _, p := range pins {
		var msg models.Message
		if err := h.DB.Preload("Sender").First(&msg, p.MessageID).Error; err != nil {
			continue // сообщение удалено — пропускаем
		}
		name := msg.Sender.Username
		if u := utils.GetUserByID(msg.SenderID); u != nil {
			if u.DisplayName != "" {
				name = u.DisplayName
			} else if u.Username != "" {
				name = u.Username
			}
		}
		items = append(items, pinnedMessageResponse{
			ID:             msg.ID,
			PinID:          p.ID,
			MessageID:      p.MessageID,
			Content:        msg.Content,
			SenderID:       msg.SenderID,
			SenderUsername: name,
			CreatedAt:      msg.CreatedAt,
			PinnedAt:       p.PinnedAt,
			PinnedByUserID: p.PinnedByUserID,
			AttachmentURL:  msg.AttachmentURL,
			AttachmentType: msg.AttachmentType,
		})
	}

	c.JSON(http.StatusOK, gin.H{"pinned_messages": items})
}