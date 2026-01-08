// backend/messenger-service/handlers/block_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BlockHandler struct {
	DB *gorm.DB
}

// BlockUser - Заблокировать пользователя
func (h *BlockHandler) BlockUser(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		BlockedUserID uint `json:"blocked_user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if userID == input.BlockedUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot block yourself"})
		return
	}

	// Проверяем, не заблокирован ли уже
	var existing models.UserBlock
	result := h.DB.Where("blocker_id = ? AND blocked_id = ?", userID, input.BlockedUserID).
		First(&existing)

	if result.Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already blocked"})
		return
	}

	block := models.UserBlock{
		BlockerID: userID,
		BlockedID: input.BlockedUserID,
		CreatedAt: time.Now(),
	}

	if err := h.DB.Create(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to block user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "blocked"})
}

// UnblockUser - Разблокировать пользователя
func (h *BlockHandler) UnblockUser(c *gin.Context) {
	userID := c.GetUint("user_id")
	blockedUserID := c.Param("user_id")

	result := h.DB.Where("blocker_id = ? AND blocked_id = ?", userID, blockedUserID).
		Delete(&models.UserBlock{})

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Block not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unblocked"})
}

// GetBlockedUsers - Список заблокированных пользователей
func (h *BlockHandler) GetBlockedUsers(c *gin.Context) {
	userID := c.GetUint("user_id")

	var blocks []models.UserBlock
	h.DB.Where("blocker_id = ?", userID).Find(&blocks)

	blockedIDs := make([]uint, len(blocks))
	for i, b := range blocks {
		blockedIDs[i] = b.BlockedID
	}

	var users []models.User
	if len(blockedIDs) > 0 {
		h.DB.Where("id IN ?", blockedIDs).Find(&users)
	}

	c.JSON(http.StatusOK, gin.H{"blocked_users": users})
}

// IsBlocked - Проверить, заблокирован ли пользователь
func (h *BlockHandler) IsBlocked(blockerID, blockedID uint) bool {
	var count int64
	h.DB.Model(&models.UserBlock{}).
		Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Count(&count)

	return count > 0
}
