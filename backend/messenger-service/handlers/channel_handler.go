// backend/messenger-service/handlers/channel_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ChannelHandler struct {
	DB *gorm.DB
}

type CreateChannelInput struct {
	ServerID uint   `json:"server_id" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type"` // "text" или "voice"
}

// CreateChannel - Создать канал внутри сервера
func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	var input CreateChannelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// 1. Проверка прав (является ли юзер владельцем сервера?)
	// В будущем тут будет проверка ролей, пока проверяем OwnerID
	var server models.Server
	if err := h.DB.First(&server, input.ServerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	if server.OwnerID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can create channels"})
		return
	}

	// 2. Создаем канал
	newChannel := models.Channel{
		ServerID: input.ServerID,
		Name:     input.Name,
		Type:     models.ChannelType(input.Type),
	}
	// Дефолт, если не указано
	if newChannel.Type == "" {
		newChannel.Type = models.ChannelTypeText
	}

	if err := h.DB.Create(&newChannel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}

	c.JSON(http.StatusCreated, newChannel)
}

// GetChannelsByServerID - Получить список каналов сервера
func (h *ChannelHandler) GetChannelsByServerID(c *gin.Context) {
	serverID := c.Param("server_id")

	// ДОБАВИТЬ ВАЛИДАЦИЮ
	if serverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "server_id is required"})
		return
	}

	// Проверка, что serverID - число
	_, err := strconv.ParseUint(serverID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server_id format"})
		return
	}

	// Проверка доступа пользователя к серверу
	userID := c.GetUint("user_id")
	var count int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to this server"})
		return
	}

	var channels []models.Channel
	if err := h.DB.Where("server_id = ?", serverID).
		Order("position ASC, created_at ASC").
		Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channels"})
		return
	}

	c.JSON(http.StatusOK, channels)
}

// GetChannelMessages - История сообщений канала
func (h *ChannelHandler) GetChannelMessages(c *gin.Context) {
	channelID := c.Param("id")

	// (Тут можно добавить проверку прав доступа к серверу)

	var messages []models.Message
	if err := h.DB.Where("channel_id = ?", channelID).
		Order("created_at desc").Limit(50).Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	if err := h.DB.Preload("Sender").
		Where("channel_id = ?", channelID).
		Order("created_at asc").
		Find(&messages).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to load messages"})
		return
	}

	// Reverse
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	c.JSON(http.StatusOK, messages)
}

// DeleteChannel - Удалить канал
func (h *ChannelHandler) DeleteChannel(c *gin.Context) {
	channelID := c.Param("id")
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// Проверка прав (сложный запрос: найти сервер этого канала и проверить владельца)
	var channel models.Channel
	if err := h.DB.Preload("Server").First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	// channel.Server недоступен напрямую, если не настроена связь в структуре,
	// поэтому проверим через сервер вручную
	var server models.Server
	h.DB.First(&server, channel.ServerID)

	if server.OwnerID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	h.DB.Delete(&channel)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
