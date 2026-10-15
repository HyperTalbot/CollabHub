// /backend/messenger-service/handlers/group_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"encoding/json"
	"backend/messenger-service/ws"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type GroupHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

type CreateGroupInput struct {
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description"`
	AvatarURL      string `json:"avatar_url"` // ДОБАВЛЕНО
	ParticipantIDs []uint `json:"participant_ids" `
}

// CreateGroup - Создать группу
func (h *GroupHandler) CreateGroup(c *gin.Context) {
	var input CreateGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetUint("user_id")

	// Создаем запись группы
	newGroup := models.Group{
		Name:        input.Name,
		Description: input.Description,
		AvatarURL:   input.AvatarURL, // ДОБАВЛЕНО
		OwnerID:     userID,
		CreatedAt:   time.Now(),
	}

	tx := h.DB.Begin()
	if err := tx.Create(&newGroup).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to create group"})
		return
	}

	// Добавляем создателя как владельца
	members := []models.GroupMember{
		{GroupID: newGroup.ID, UserID: userID, Role: "owner", JoinedAt: time.Now()},
	}

	// Добавляем остальных участников
	for _, pid := range input.ParticipantIDs {
		if pid != userID {
			members = append(members, models.GroupMember{
				GroupID: newGroup.ID, UserID: pid, Role: "member", JoinedAt: time.Now(),
			})
		}
	}

	if err := tx.Create(&members).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to add members"})
		return
	}

	tx.Commit()

	// WS уведомление (опционально)
	c.JSON(http.StatusCreated, newGroup)
}

// GetGroups - Получить список моих групп
func (h *GroupHandler) GetGroups(c *gin.Context) {
	userID := c.GetUint("user_id")
	var groups []models.Group

	// Ищем группы, где юзер есть в members
	err := h.DB.Model(&models.Group{}).
		Joins("JOIN group_members gm ON gm.group_id = groups.id").
		Where("gm.user_id = ?", userID).
		Preload("Members"). // Можно подгрузить участников
		Find(&groups).Error

	if err != nil {
		c.JSON(500, gin.H{"error": "Fetch failed"})
		return
	}

	// Заполняем LastMessage для групп
	for i := range groups {
		var lastMsg models.Message
		h.DB.Where("group_id = ?", groups[i].ID).Order("created_at DESC").Limit(1).Find(&lastMsg)

		if lastMsg.ID != 0 {
			groups[i].LastMessageContent = lastMsg.Content
			groups[i].LastMessageAt = lastMsg.CreatedAt
			groups[i].LastMessageSenderID = lastMsg.SenderID
		} else {
			groups[i].LastMessageAt = groups[i].CreatedAt
		}
	}

	c.JSON(http.StatusOK, groups)
}

// GetGroupByID - Получить данные конкретной группы
func (h *GroupHandler) GetGroupByID(c *gin.Context) {
	groupID := c.Param("id")
	userID := c.GetUint("user_id")

	// Проверяем, является ли пользователь участником
	var count int64
	h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Получаем группу с участниками
	var group models.Group
	if err := h.DB.Preload("Members").First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// GetGroupMessages - Сообщения группы
func (h *GroupHandler) GetGroupMessages(c *gin.Context) {
	groupID := c.Param("id")
	userID := c.GetUint("user_id")

	// Проверка: является ли участником
	var count int64
	h.DB.Model(&models.GroupMember{}).Where("group_id = ? AND user_id = ?", groupID, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var messages []models.Message
	h.DB.Preload("Sender").
		Where("group_id = ?", groupID). // Ищем по group_id
		Order("created_at asc").
		Find(&messages)

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// UpdateGroup - Обновить название или аватарку группы
func (h *GroupHandler) UpdateGroup(c *gin.Context) {
	groupID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Ищем группу
	var group models.Group
	if err := h.DB.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// 2. Проверяем права: менять настройки группы может только её участник
	// с ролью owner/admin (или владелец группы).
	if err := h.DB.Preload("Members").First(&group, group.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	canEdit := group.OwnerID == userID
	for _, m := range group.Members {
		if m.UserID == userID && (m.Role == "owner" || m.Role == "admin") {
			canEdit = true
		}
	}
	if !canEdit {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner or admin can update group info"})
		return
	}

	// 3. Обновляем поля
	if input.Name != "" {
		group.Name = input.Name
	}
	if input.AvatarURL != "" {
		group.AvatarURL = input.AvatarURL
	}

	if err := h.DB.Save(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update group"})
		return
	}

	// WS-уведомление всем участникам, чтобы группа (название/аватарка)
	// обновилась у всех в списке чатов и в шапке в реальном времени.
	if h.Hub != nil {
		updatePayload, _ := json.Marshal(map[string]interface{}{
			"type": "group_updated",
			"payload": map[string]interface{}{
				"id":         group.ID,
				"name":       group.Name,
				"avatar_url": group.AvatarURL,
			},
		})
		for _, m := range group.Members {
			h.Hub.SendToUser(m.UserID, updatePayload)
		}
	}

	c.JSON(http.StatusOK, group)
}

// DeleteGroup - Удалить группу (доступно только владельцу)
func (h *GroupHandler) DeleteGroup(c *gin.Context) {
	groupID := c.Param("id")
	userID := c.GetUint("user_id")

	// 1. Ищем группу
	var group models.Group
	if err := h.DB.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}

	// 2. Проверяем права
	if group.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can delete the group"})
		return
	}

	// 3. Удаляем (Soft Delete, если в модели есть gorm.DeletedAt)
	if err := h.DB.Delete(&group).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete group"})
		return
	}

	// Опционально: можно отправить WS уведомление участникам, что группа удалена,
	// чтобы она пропала из списка чатов в реальном времени.

	c.JSON(http.StatusOK, gin.H{"status": "group deleted", "id": group.ID})
}

// MarkGroupAsRead - Пометить группу как прочитанную
func (h *GroupHandler) MarkGroupAsRead(c *gin.Context) {
	userID := c.GetUint("user_id")
	groupID := c.Param("id")

	// Проверяем, является ли пользователь участником группы
	var count int64
	h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Находим последнее сообщение в группе
	var lastMsgs []models.Message
	result := h.DB.Where("group_id = ?", groupID).
		Order("created_at desc").
		Limit(1).
		Find(&lastMsgs)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Если сообщений нет, просто возвращаем успех
	if len(lastMsgs) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "no messages to mark"})
		return
	}

	lastMsg := lastMsgs[0]

	// Обновляем или создаём запись о прочтении
	// Для групп можно использовать отдельную таблицу или поле в group_members
	// Для простоты используем аналогичную логику с conversation_participants

	// ВАРИАНТ 1: Если у вас есть поле last_read_message_id в group_members
	if err := h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Update("last_read_message_id", lastMsg.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update read status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":               "updated",
		"last_read_message_id": lastMsg.ID,
	})
}
