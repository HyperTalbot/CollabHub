// backend/messenger-service/handlers/reaction_handler.go
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

type ReactionHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// AddReaction - Добавить реакцию на сообщение
func (h *ReactionHandler) AddReaction(c *gin.Context) {
	userID := c.GetUint("user_id")
	messageID := c.Param("message_id")

	var input struct {
		Emoji string `json:"emoji" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем, что сообщение существует
	var msg models.Message
	if err := h.DB.First(&msg, messageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	// Проверяем, нет ли уже такой реакции от этого пользователя
	var existing models.MessageReaction
	result := h.DB.Where("message_id = ? AND user_id = ? AND emoji = ?",
		messageID, userID, input.Emoji).First(&existing)

	if result.Error == nil {
		// Реакция уже есть, удаляем её (toggle)
		h.DB.Delete(&existing)

		h.broadcastReactionUpdate(msg, "reaction_removed", existing.Emoji, userID)

		c.JSON(http.StatusOK, gin.H{"status": "removed"})
		return
	}

	// Создаем новую реакцию
	reaction := models.MessageReaction{
		MessageID: msg.ID,
		UserID:    userID,
		Emoji:     input.Emoji,
		CreatedAt: time.Now(),
	}

	if err := h.DB.Create(&reaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add reaction"})
		return
	}

	h.broadcastReactionUpdate(msg, "reaction_added", input.Emoji, userID)

	c.JSON(http.StatusOK, reaction)
}

// GetReactions - Получить все реакции на сообщение
func (h *ReactionHandler) GetReactions(c *gin.Context) {
	messageID := c.Param("message_id")

	var reactions []models.MessageReaction
	if err := h.DB.Where("message_id = ?", messageID).Find(&reactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reactions"})
		return
	}

	// Группируем по эмодзи
	reactionMap := make(map[string][]uint)
	for _, r := range reactions {
		reactionMap[r.Emoji] = append(reactionMap[r.Emoji], r.UserID)
	}

	c.JSON(http.StatusOK, gin.H{"reactions": reactionMap})
}

func (h *ReactionHandler) broadcastReactionUpdate(msg models.Message, eventType, emoji string, userID uint) {
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
			"emoji":      emoji,
			"user_id":    userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}
}
