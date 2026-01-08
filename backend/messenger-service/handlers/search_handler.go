// backend/messenger-service/handlers/search_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SearchHandler struct {
	DB *gorm.DB
}

// SearchMessages - Поиск по сообщениям
func (h *SearchHandler) SearchMessages(c *gin.Context) {
	userID := c.GetUint("user_id")
	query := c.Query("q")
	conversationID := c.Query("conversation_id")
	channelID := c.Query("channel_id")
	groupID := c.Query("group_id")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter required"})
		return
	}

	// Базовый запрос
	db := h.DB.Model(&models.Message{}).
		Where("LOWER(content) LIKE ?", "%"+strings.ToLower(query)+"%").
		Preload("Sender")

	// Фильтр по беседе
	if conversationID != "" {
		// Проверяем доступ
		var count int64
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id = ?", conversationID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		db = db.Where("conversation_id = ?", conversationID)
	}

	// Фильтр по группе
	if groupID != "" {
		var count int64
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id = ?", groupID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		db = db.Where("group_id = ?", groupID)
	}

	// Фильтр по каналу
	if channelID != "" {
		var channel models.Channel
		h.DB.First(&channel, channelID)

		var count int64
		h.DB.Table("server_members").
			Where("server_id = ? AND user_id = ?", channel.ServerID, userID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		db = db.Where("channel_id = ?", channelID)
	}

	var messages []models.Message
	db.Order("created_at DESC").Limit(50).Find(&messages)

	c.JSON(http.StatusOK, gin.H{
		"query":    query,
		"count":    len(messages),
		"messages": messages,
	})
}

// SearchUsers - Поиск пользователей
func (h *SearchHandler) SearchUsers(c *gin.Context) {
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter required"})
		return
	}

	var users []models.User
	h.DB.Where("LOWER(username) LIKE ?", "%"+strings.ToLower(query)+"%").
		Limit(20).
		Find(&users)

	c.JSON(http.StatusOK, gin.H{
		"query": query,
		"users": users,
	})
}
