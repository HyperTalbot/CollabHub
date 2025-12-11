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

// CreateServer - Создает сервер и дефолтный канал
func (h *ServerHandler) CreateServer(c *gin.Context) {
	var input CreateServerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// ensureUserExists не нужен, т.к. для создания сервера пользователь должен быть онлайн
	// и его данные уже должны быть в БД из-за WS соединения, но для надежности можно оставить.

	tx := h.DB.Begin()

	// 1. Создаем Сервер
	newServer := models.Server{
		Name:        input.Name,
		AvatarURL:   input.AvatarURL,
		Description: input.Description,
		Tags:        input.Tags,
		OwnerID:     myUserID,
	}

	if err := tx.Create(&newServer).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create server"})
		return
	}

	// 2. Добавляем владельца в участники (server_members)
	// Явно добавляем владельца в server_members
	// GORM по умолчанию именует таблицу для Many2Many как "server_members"
	// Структура: server_id, user_id
	member := map[string]interface{}{
		"server_id": newServer.ID,
		"user_id":   myUserID,
	}

	if err := tx.Table("server_members").Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add owner to members"})
		return
	}

	// 3. Создаем дефолтный канал "general"
	defaultChannel := models.Channel{
		ServerID: newServer.ID,
		Name:     "general",
		Type:     models.ChannelTypeText,
	}
	if err := tx.Create(&defaultChannel).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create default channel"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, newServer)
}

// GetMyServers - Получает список серверов пользователя (заглушка для будущего)
func (h *ServerHandler) GetMyServers(c *gin.Context) {
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	var servers []models.Server
	// Ищем сервера, где пользователь является участником
	err := h.DB.
		Joins("JOIN server_members sm ON sm.server_id = servers.id").
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
		// ...
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

	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// Проверяем, существует ли сервер
	var server models.Server
	if err := h.DB.First(&server, input.ServerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	// Проверяем, не вступил ли уже (чтобы не было дублей)
	var count int64
	h.DB.Table("server_members").Where("server_id = ? AND user_id = ?", input.ServerID, myUserID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Already a member"})
		return
	}

	// Добавляем в таблицу
	member := map[string]interface{}{
		"server_id": input.ServerID,
		"user_id":   myUserID,
	}
	if err := h.DB.Table("server_members").Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join server"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "joined", "server": server})
}

// LeaveServer - Покинуть сервер
func (h *ServerHandler) LeaveServer(c *gin.Context) {
	serverID := c.Param("id")
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// Нельзя выйти, если ты владелец (нужно сначала передать права или удалить сервер)
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
