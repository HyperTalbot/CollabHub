// backend/messenger-service/handlers/role_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RoleHandler struct {
	DB *gorm.DB
}

// CreateRole - Создать роль на сервере
func (h *RoleHandler) CreateRole(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ServerID           uint   `json:"server_id" binding:"required"`
		Name               string `json:"name" binding:"required"`
		Color              string `json:"color"`
		CanManageServer    bool   `json:"can_manage_server"`
		CanManageChannels  bool   `json:"can_manage_channels"`
		CanManageRoles     bool   `json:"can_manage_roles"`
		CanKickMembers     bool   `json:"can_kick_members"`
		CanBanMembers      bool   `json:"can_ban_members"`
		CanManageMessages  bool   `json:"can_manage_messages"`
		CanMentionEveryone bool   `json:"can_mention_everyone"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем права (только владелец или админ с правом управления ролями)
	var server models.Server
	if err := h.DB.First(&server, input.ServerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	if server.OwnerID != userID {
		// Проверяем, есть ли право на управление ролями
		if !h.hasPermission(userID, input.ServerID, "can_manage_roles") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
			return
		}
	}

	role := models.ServerRole{
		ServerID:           input.ServerID,
		Name:               input.Name,
		Color:              input.Color,
		CanManageServer:    input.CanManageServer,
		CanManageChannels:  input.CanManageChannels,
		CanManageRoles:     input.CanManageRoles,
		CanKickMembers:     input.CanKickMembers,
		CanBanMembers:      input.CanBanMembers,
		CanManageMessages:  input.CanManageMessages,
		CanMentionEveryone: input.CanMentionEveryone,
		CreatedAt:          time.Now(),
	}

	if err := h.DB.Create(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
		return
	}

	c.JSON(http.StatusOK, role)
}

// AssignRole - Назначить роль пользователю
func (h *RoleHandler) AssignRole(c *gin.Context) {
	adminID := c.GetUint("user_id")

	var input struct {
		ServerID uint `json:"server_id" binding:"required"`
		UserID   uint `json:"user_id" binding:"required"`
		RoleID   uint `json:"role_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем права
	var server models.Server
	h.DB.First(&server, input.ServerID)

	if server.OwnerID != adminID && !h.hasPermission(adminID, input.ServerID, "can_manage_roles") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	memberRole := models.ServerMemberRole{
		ServerID: input.ServerID,
		UserID:   input.UserID,
		RoleID:   input.RoleID,
	}

	h.DB.Create(&memberRole)

	c.JSON(http.StatusOK, gin.H{"status": "role assigned"})
}

// GetServerRoles - Получить роли сервера
func (h *RoleHandler) GetServerRoles(c *gin.Context) {
	serverID := c.Param("server_id")

	var roles []models.ServerRole
	h.DB.Where("server_id = ?", serverID).Order("position DESC").Find(&roles)

	c.JSON(http.StatusOK, gin.H{"roles": roles})
}

func (h *RoleHandler) hasPermission(userID, serverID uint, permission string) bool {
	var count int64
	h.DB.Table("server_member_roles").
		Joins("JOIN server_roles ON server_roles.id = server_member_roles.role_id").
		Where("server_member_roles.server_id = ? AND server_member_roles.user_id = ? AND server_roles."+permission+" = true",
			serverID, userID).
		Count(&count)

	return count > 0
}
