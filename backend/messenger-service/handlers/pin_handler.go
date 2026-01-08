// backend/messenger-service/handlers/pin_handler.go
package handlers

import (
	"backend/messenger-service/models"
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

// PinMessageToChat - Закрепить сообщение в чате
func (h *PinHandler) PinMessageToChat(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		MessageID      uint  `json:"message_id" binding:"required"`
		ConversationID *uint `json:"conversation_id"`
		GroupID        *uint `json:"group_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем существование сообщения
	var message models.Message
	if err := h.DB.First(&message, input.MessageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	// Проверяем доступ
	if input.ConversationID != nil {
		var count int64
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id = ?", *input.ConversationID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	} else if input.GroupID != nil {
		var count int64
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id = ?", *input.GroupID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}

	// Проверяем, не закреплено ли уже
	var existingPin models.PinnedMessage
	result := h.DB.Where("message_id = ?", input.MessageID).First(&existingPin)

	if result.Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Message already pinned"})
		return
	}

	// Создаём закрепление
	pinnedMsg := models.PinnedMessage{
		MessageID:      input.MessageID,
		ConversationID: input.ConversationID,
		GroupID:        input.GroupID,
		PinnedByUserID: userID,
		PinnedAt:       time.Now(),
	}

	if err := h.DB.Create(&pinnedMsg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pin message"})
		return
	}

	// Обновляем флаг в самом сообщении
	h.DB.Model(&message).Update("is_pinned", true)

	// WebSocket уведомление
	var recipients []uint
	if input.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *input.ConversationID).
			Pluck("user_id", &recipients)
	} else if input.GroupID != nil {
		h.DB.Table("group_members").
			Where("group_id = ?", *input.GroupID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "message_pinned",
		"payload": map[string]interface{}{
			"message_id":      input.MessageID,
			"conversation_id": input.ConversationID,
			"group_id":        input.GroupID,
			"pinned_by":       userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, pinnedMsg)
}

// UnpinMessage - Открепить сообщение
func (h *PinHandler) UnpinMessage(c *gin.Context) {
	userID := c.GetUint("user_id")
	messageID := c.Param("message_id")

	var pinnedMsg models.PinnedMessage
	if err := h.DB.Where("message_id = ?", messageID).First(&pinnedMsg).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pinned message not found"})
		return
	}

	// Проверяем доступ
	if pinnedMsg.ConversationID != nil {
		var count int64
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id = ?", *pinnedMsg.ConversationID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	} else if pinnedMsg.GroupID != nil {
		var count int64
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id = ?", *pinnedMsg.GroupID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}

	// Удаляем закрепление
	if err := h.DB.Delete(&pinnedMsg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unpin"})
		return
	}

	// Обновляем флаг в сообщении
	h.DB.Model(&models.Message{}).Where("id = ?", messageID).Update("is_pinned", false)
	// WebSocket уведомление
	var recipients []uint
	if pinnedMsg.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *pinnedMsg.ConversationID).
			Pluck("user_id", &recipients)
	} else if pinnedMsg.GroupID != nil {
		h.DB.Table("group_members").
			Where("group_id = ?", *pinnedMsg.GroupID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "message_unpinned",
		"payload": map[string]interface{}{
			"message_id":      pinnedMsg.MessageID,
			"conversation_id": pinnedMsg.ConversationID,
			"group_id":        pinnedMsg.GroupID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "unpinned"})
}

// GetPinnedMessages - Получить закреплённые сообщения
func (h *PinHandler) GetPinnedMessages(c *gin.Context) {
	userID := c.GetUint("user_id")
	conversationID := c.Query("conversation_id")
	groupID := c.Query("group_id")

	query := h.DB.Model(&models.PinnedMessage{}).
		Joins("JOIN messages ON messages.id = pinned_messages.message_id").
		Select("pinned_messages.*, messages.content, messages.sender_id, messages.created_at as message_created_at")

	if conversationID != "" {
		// Проверка доступа
		var count int64
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id = ?", conversationID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		query = query.Where("pinned_messages.conversation_id = ?", conversationID)
	} else if groupID != "" {
		var count int64
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id = ?", groupID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		query = query.Where("pinned_messages.group_id = ?", groupID)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id or group_id required"})
		return
	}

	var pinnedMessages []struct {
		models.PinnedMessage
		Content          string    `json:"content"`
		SenderID         uint      `json:"sender_id"`
		MessageCreatedAt time.Time `json:"message_created_at"`
		SenderUsername   string    `json:"sender_username"`
	}

	if err := query.Order("pinned_messages.pinned_at DESC").Find(&pinnedMessages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pinned messages"})
		return
	}

	// Загружаем имена отправителей
	for i := range pinnedMessages {
		var sender models.User
		h.DB.First(&sender, pinnedMessages[i].SenderID)
		pinnedMessages[i].SenderUsername = sender.Username
	}

	c.JSON(http.StatusOK, gin.H{"pinned_messages": pinnedMessages})
}

func (h *PinHandler) broadcastPinUpdate(msg models.Message, eventType string, userID uint) {
	var recipients []uint

	if msg.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *msg.ConversationID).
			Pluck("user_id", &recipients)
	} else if msg.GroupID != nil {
		h.DB.Table("group_members").
			Where("group_id = ?", *msg.GroupID).
			Pluck("user_id", &recipients)
	} else if msg.ChannelID != nil {
		var channel models.Channel
		h.DB.First(&channel, *msg.ChannelID)
		h.DB.Table("server_members").
			Where("server_id = ?", channel.ServerID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": eventType,
		"payload": map[string]interface{}{
			"message_id": msg.ID,
			"user_id":    userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}
}
