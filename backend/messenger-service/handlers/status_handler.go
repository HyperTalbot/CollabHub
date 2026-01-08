// backend/messenger-service/handlers/status_handler.go
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

type StatusHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// UpdateStatus - Обновить статус пользователя
func (h *StatusHandler) UpdateStatus(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		Status       string `json:"status" binding:"required"` // online, offline, away, dnd
		CustomStatus string `json:"custom_status"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var userStatus models.UserStatus
	result := h.DB.Where("user_id = ?", userID).First(&userStatus)

	if result.Error == gorm.ErrRecordNotFound {
		userStatus = models.UserStatus{
			UserID:       userID,
			Status:       input.Status,
			CustomStatus: input.CustomStatus,
			LastSeenAt:   time.Now(),
			UpdatedAt:    time.Now(),
		}
		h.DB.Create(&userStatus)
	} else {
		userStatus.Status = input.Status
		userStatus.CustomStatus = input.CustomStatus
		userStatus.LastSeenAt = time.Now()
		userStatus.UpdatedAt = time.Now()
		h.DB.Save(&userStatus)
	}

	// Получаем всех друзей/контактов пользователя
	var contactIDs []uint
	h.DB.Raw(`
        SELECT DISTINCT user_id FROM conversation_participants 
        WHERE conversation_id IN (
            SELECT conversation_id FROM conversation_participants WHERE user_id = ?
        ) AND user_id != ?
    `, userID, userID).Pluck("user_id", &contactIDs)

	// Уведомляем о смене статуса
	wsPayload := map[string]interface{}{
		"type": "user_status_changed",
		"payload": map[string]interface{}{
			"user_id":       userID,
			"status":        userStatus.Status,
			"custom_status": userStatus.CustomStatus,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: contactIDs,
		Data:    data,
	}

	c.JSON(http.StatusOK, userStatus)
}

// GetUserStatus - Получить статус пользователя
func (h *StatusHandler) GetUserStatus(c *gin.Context) {
	targetUserID := c.Param("user_id")

	var userStatus models.UserStatus
	if err := h.DB.Where("user_id = ?", targetUserID).First(&userStatus).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":       "offline",
			"last_seen_at": nil,
		})
		return
	}

	c.JSON(http.StatusOK, userStatus)
}

// SendTypingIndicator - Отправить индикатор печати
func (h *StatusHandler) SendTypingIndicator(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID *uint `json:"conversation_id"`
		ChannelID      *uint `json:"channel_id"`
		GroupID        *uint `json:"group_id"`
		IsTyping       bool  `json:"is_typing"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var recipients []uint

	if input.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id != ?", *input.ConversationID, userID).
			Pluck("user_id", &recipients)
	} else if input.GroupID != nil {
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id != ?", *input.GroupID, userID).
			Pluck("user_id", &recipients)
	} else if input.ChannelID != nil {
		var channel models.Channel
		h.DB.First(&channel, *input.ChannelID)
		h.DB.Table("server_members").
			Where("server_id = ? AND user_id != ?", channel.ServerID, userID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "typing_indicator",
		"payload": map[string]interface{}{
			"user_id":         userID,
			"conversation_id": input.ConversationID,
			"channel_id":      input.ChannelID,
			"group_id":        input.GroupID,
			"is_typing":       input.IsTyping,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}
