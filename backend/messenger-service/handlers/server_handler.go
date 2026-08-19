// /backend/messenger-service/handlers/server_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ServerHandler struct {
	DB *gorm.DB
}

// Input для создания сервера
type CreateServerInput struct {
	Name        string `json:"name" binding:"required"`
	AvatarURL   string `json:"avatar_url"`
	Description string `json:"description"`
	Tags        string `json:"tags"` // "tag1,tag2"
}

// Вспомогательная функция для получения ID (ИСПРАВЛЕНО)
func getUserID(c *gin.Context) uint {
	// ВАЖНО: middleware должен устанавливать "user_id" (с маленькой буквы)
	id, exists := c.Get("user_id")
	if !exists {
		// Если не установлено, возвращаем 0 (или можно паниковать)
		return 0
	}

	// Безопасное приведение типа
	userID, ok := id.(uint)
	if !ok {
		return 0
	}
	return userID
}

// CreateServer - Создает сервер и дефолтный канал
func (h *ServerHandler) CreateServer(c *gin.Context) {
	var input CreateServerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	tx := h.DB.Begin()

	// 1. Сервер
	newServer := models.Server{
		Name:        input.Name,
		AvatarURL:   input.AvatarURL,
		Description: input.Description,
		Tags:        input.Tags,
		OwnerID:     myUserID,
	}

	if err := tx.Create(&newServer).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to create server"})
		return
	}

	// 2. Дефолтные каналы
	defaultChannels := []models.Channel{
		{
			ServerID: newServer.ID,
			Name:     "general",
			Type:     models.ChannelTypeText,
		},
		{
			ServerID: newServer.ID,
			Name:     "voice",
			Type:     models.ChannelTypeVoice,
		},
	}

	if err := tx.Create(&defaultChannels).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to create default channels"})
		return
	}

	// 3. Добавляем владельца
	member := map[string]interface{}{
		"server_id": newServer.ID,
		"user_id":   myUserID,
	}
	if err := tx.Table("server_members").Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to add member"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, newServer)
}

// GetServers - Возвращает сервера, где пользователь участник
func (h *ServerHandler) GetServers(c *gin.Context) {
	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var servers []models.Server

	// Простой JOIN запрос
	err := h.DB.Joins("JOIN server_members sm ON sm.server_id = servers.id").
		Where("sm.user_id = ?", myUserID).
		Find(&servers).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch servers"})
		return
	}
	c.JSON(http.StatusOK, servers)
}

// AdminDeleteServer - Снос сервера за нарушения
func (h *ServerHandler) AdminDeleteServer(c *gin.Context) {
	id := c.Param("id")
	if err := h.DB.Delete(&models.Server{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete server"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "server destroyed"})
}

// JoinServer - Вступить на сервер (по ID, позже по инвайт-ссылке)
func (h *ServerHandler) JoinServer(c *gin.Context) {
	var input struct {
		ServerID uint `json:"server_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Проверяем дубликат
	var count int64
	h.DB.Table("server_members").Where("server_id = ? AND user_id = ?", input.ServerID, myUserID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Already a member"})
		return
	}

	member := map[string]interface{}{"server_id": input.ServerID, "user_id": myUserID}
	if err := h.DB.Table("server_members").Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "joined"})
}

// UpdateServer - Обновить название или аватарку (Только владелец)
func (h *ServerHandler) UpdateServer(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		Name        string `json:"name"`
		AvatarURL   string `json:"avatar_url"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	if server.OwnerID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can update server"})
		return
	}

	// Обновляем поля, если они присланы
	if input.Name != "" {
		server.Name = input.Name
	}
	if input.AvatarURL != "" {
		server.AvatarURL = input.AvatarURL
	}
	if input.Description != "" {
		server.Description = input.Description
	}

	h.DB.Save(&server)
	c.JSON(http.StatusOK, server)
}

// LeaveServer - Покинуть сервер
func (h *ServerHandler) LeaveServer(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Нельзя выйти, если ты владелец
	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err == nil {
		if server.OwnerID == myUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Owner cannot leave server. Delete it instead."})
			return
		}
	}

	// Удаляем запись
	res := h.DB.Table("server_members").Where("server_id = ? AND user_id = ?", serverID, myUserID).Delete(nil)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave server"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "left"})
}

// DeleteServer - Удалить сервер целиком (Только владелец)
func (h *ServerHandler) DeleteServer(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	if server.OwnerID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can delete server"})
		return
	}

	if err := h.DB.Delete(&server).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete server"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
