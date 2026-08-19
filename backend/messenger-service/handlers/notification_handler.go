// backend/messenger-service/handlers/notification_handler.go - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
package handlers

import (
	"backend/messenger-service/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	DB *gorm.DB
}

// GetNotificationSettings - Получить настройки уведомлений
func (h *NotificationHandler) GetNotificationSettings(c *gin.Context) {
	userID := c.GetUint("user_id")

	var settings models.NotificationSettings
	result := h.DB.Where("user_id = ?", userID).First(&settings)

	if result.Error == gorm.ErrRecordNotFound {
		settings = models.NotificationSettings{
			UserID:             userID,
			MuteAll:            false,
			MutedConversations: models.UintArray{},
			MutedGroups:        models.UintArray{},
			MutedServers:       models.UintArray{},
			MutedChannels:      models.UintArray{},
			ShowMessagePreview: true,
			PlaySound:          true,
			UpdatedAt:          time.Now(),
		}
		h.DB.Create(&settings)
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateNotificationSettings - Обновить настройки уведомлений
func (h *NotificationHandler) UpdateNotificationSettings(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		MuteAll            *bool `json:"mute_all"`
		ShowMessagePreview *bool `json:"show_message_preview"`
		PlaySound          *bool `json:"play_sound"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.NotificationSettings
	result := h.DB.Where("user_id = ?", userID).First(&settings)

	if result.Error == gorm.ErrRecordNotFound {
		settings = models.NotificationSettings{
			UserID:             userID,
			MutedConversations: models.UintArray{},
			MutedGroups:        models.UintArray{},
			MutedServers:       models.UintArray{},
			MutedChannels:      models.UintArray{},
		}
		h.DB.Create(&settings)
	}

	if input.MuteAll != nil {
		settings.MuteAll = *input.MuteAll
	}
	if input.ShowMessagePreview != nil {
		settings.ShowMessagePreview = *input.ShowMessagePreview
	}
	if input.PlaySound != nil {
		settings.PlaySound = *input.PlaySound
	}

	settings.UpdatedAt = time.Now()
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, settings)
}

// MuteConversation - Отключить уведомления для беседы
func (h *NotificationHandler) MuteConversation(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID uint `json:"conversation_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.NotificationSettings
	result := h.DB.Where("user_id = ?", userID).First(&settings)

	if result.Error == gorm.ErrRecordNotFound {
		settings = models.NotificationSettings{
			UserID:             userID,
			MutedConversations: models.UintArray{},
			MutedGroups:        models.UintArray{},
			MutedServers:       models.UintArray{},
			MutedChannels:      models.UintArray{},
		}
		h.DB.Create(&settings)
	}

	// Проверяем, не добавлен ли уже
	for _, id := range settings.MutedConversations {
		if id == input.ConversationID {
			c.JSON(http.StatusOK, gin.H{"status": "already muted"})
			return
		}
	}

	// Добавляем ID
	settings.MutedConversations = append(settings.MutedConversations, input.ConversationID)
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "muted"})
}

// UnmuteConversation - Включить уведомления для беседы
func (h *NotificationHandler) UnmuteConversation(c *gin.Context) {
	userID := c.GetUint("user_id")
	conversationID := c.Param("conversation_id")

	convID, _ := strconv.ParseUint(conversationID, 10, 64)

	var settings models.NotificationSettings
	h.DB.Where("user_id = ?", userID).First(&settings)

	// Удаляем ID из массива
	newMuted := models.UintArray{}
	for _, id := range settings.MutedConversations {
		if id != uint(convID) {
			newMuted = append(newMuted, id)
		}
	}

	settings.MutedConversations = newMuted
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "unmuted"})
}

// MuteGroup - Отключить уведомления для группы
func (h *NotificationHandler) MuteGroup(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		GroupID uint `json:"group_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.NotificationSettings
	h.DB.Where("user_id = ?", userID).First(&settings)

	// Проверяем дубликат
	for _, id := range settings.MutedGroups {
		if id == input.GroupID {
			c.JSON(http.StatusOK, gin.H{"status": "already muted"})
			return
		}
	}

	settings.MutedGroups = append(settings.MutedGroups, input.GroupID)
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "muted"})
}

// UnmuteGroup - Включить уведомления для группы
func (h *NotificationHandler) UnmuteGroup(c *gin.Context) {
	userID := c.GetUint("user_id")
	groupID := c.Param("group_id")

	gID, _ := strconv.ParseUint(groupID, 10, 64)

	var settings models.NotificationSettings
	h.DB.Where("user_id = ?", userID).First(&settings)

	newMuted := models.UintArray{}
	for _, id := range settings.MutedGroups {
		if id != uint(gID) {
			newMuted = append(newMuted, id)
		}
	}

	settings.MutedGroups = newMuted
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "unmuted"})
}

// MuteServer - Отключить уведомления для сервера
func (h *NotificationHandler) MuteServer(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ServerID uint `json:"server_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.NotificationSettings
	h.DB.Where("user_id = ?", userID).First(&settings)

	for _, id := range settings.MutedServers {
		if id == input.ServerID {
			c.JSON(http.StatusOK, gin.H{"status": "already muted"})
			return
		}
	}

	settings.MutedServers = append(settings.MutedServers, input.ServerID)
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "muted"})
}

// UnmuteServer - Включить уведомления для сервера
func (h *NotificationHandler) UnmuteServer(c *gin.Context) {
	userID := c.GetUint("user_id")
	serverID := c.Param("server_id")

	sID, _ := strconv.ParseUint(serverID, 10, 64)

	var settings models.NotificationSettings
	h.DB.Where("user_id = ?", userID).First(&settings)

	newMuted := models.UintArray{}
	for _, id := range settings.MutedServers {
		if id != uint(sID) {
			newMuted = append(newMuted, id)
		}
	}

	settings.MutedServers = newMuted
	h.DB.Save(&settings)

	c.JSON(http.StatusOK, gin.H{"status": "unmuted"})
}
