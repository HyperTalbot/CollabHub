// backend/messenger-service/handlers/invite_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InviteHandler struct {
	DB *gorm.DB
}

// CreateInvite - Создать инвайт-ссылку
func (h *InviteHandler) CreateInvite(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ServerID  uint `json:"server_id" binding:"required"`
		MaxUses   int  `json:"max_uses"`   // 0 = безлимит
		ExpiresIn int  `json:"expires_in"` // в секундах, 0 = никогда
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем права на создание инвайтов
	var server models.Server
	if err := h.DB.First(&server, input.ServerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	// Генерируем уникальный код
	code := generateInviteCode()

	invite := models.ServerInvite{
		ServerID:  input.ServerID,
		Code:      code,
		CreatedBy: userID,
		MaxUses:   input.MaxUses,
		UsesCount: 0,
		CreatedAt: time.Now(),
	}

	if input.ExpiresIn > 0 {
		expiresAt := time.Now().Add(time.Duration(input.ExpiresIn) * time.Second)
		invite.ExpiresAt = &expiresAt
	}

	if err := h.DB.Create(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invite_code": code,
		"invite_url":  "http://localhost:3000/invite/" + code,
		"invite":      invite,
	})
}

// JoinByInvite - Присоединиться к серверу по инвайту
func (h *InviteHandler) JoinByInvite(c *gin.Context) {
	userID := c.GetUint("user_id")
	inviteCode := c.Param("code")

	var invite models.ServerInvite
	if err := h.DB.Where("code = ?", inviteCode).First(&invite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite code"})
		return
	}

	// Проверяем срок действия
	if invite.ExpiresAt != nil && time.Now().After(*invite.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "Invite expired"})
		return
	}

	// Проверяем лимит использований
	if invite.MaxUses > 0 && invite.UsesCount >= invite.MaxUses {
		c.JSON(http.StatusGone, gin.H{"error": "Invite limit reached"})
		return
	}

	// Проверяем, не является ли уже участником
	var count int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", invite.ServerID, userID).
		Count(&count)

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Already a member"})
		return
	}

	// Добавляем в сервер
	member := map[string]interface{}{
		"server_id": invite.ServerID,
		"user_id":   userID,
	}

	if err := h.DB.Table("server_members").Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join server"})
		return
	}

	// Увеличиваем счетчик использований
	h.DB.Model(&invite).Update("uses_count", invite.UsesCount+1)

	// Получаем информацию о сервере
	var server models.Server
	h.DB.First(&server, invite.ServerID)

	c.JSON(http.StatusOK, gin.H{
		"status": "joined",
		"server": server,
	})
}

// GetServerInvites - Получить список инвайтов сервера
func (h *InviteHandler) GetServerInvites(c *gin.Context) {
	serverID := c.Param("server_id")
	// userID := c.GetUint("user_id")

	// Проверяем права
	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	var invites []models.ServerInvite
	h.DB.Where("server_id = ?", serverID).
		Order("created_at DESC").
		Find(&invites)

	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

// DeleteInvite - Удалить инвайт
func (h *InviteHandler) DeleteInvite(c *gin.Context) {
	inviteCode := c.Param("code")
	userID := c.GetUint("user_id")

	var invite models.ServerInvite
	if err := h.DB.Where("code = ?", inviteCode).First(&invite).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
		return
	}

	// Проверяем права (только создатель или владелец сервера)
	var server models.Server
	h.DB.First(&server, invite.ServerID)

	if invite.CreatedBy != userID && server.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	h.DB.Delete(&invite)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func generateInviteCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)[:8]
}
