// /backend/messenger-service/handlers/group_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
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

// AddMembersInput — тело запроса добавления участников
type AddMembersInput struct {
	UserIDs []uint `json:"user_ids" binding:"required"`
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

// AddMembers — POST /groups/:id/members
// Добавить участников в группу (может любой участник группы)
func (h *GroupHandler) AddMembers(c *gin.Context) {
	groupID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group id"})
		return
	}
	userID := c.GetUint("user_id")

	// 1. Вызывающий должен быть участником группы
	var isMember int64
	h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Count(&isMember)
	if isMember == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input AddMembersInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. Добавляем, пропуская тех, кто уже в группе
	added := make([]uint, 0)
	skipped := make([]uint, 0)
	for _, uid := range input.UserIDs {
		var exists int64
		h.DB.Model(&models.GroupMember{}).
			Where("group_id = ? AND user_id = ?", groupID, uid).
			Count(&exists)
		if exists > 0 {
			skipped = append(skipped, uid)
			continue
		}
		member := models.GroupMember{
			GroupID:  uint(groupID),
			UserID:   uid,
			Role:     "member",
			JoinedAt: time.Now(),
		}
		if err := h.DB.Create(&member).Error; err != nil {
			continue
		}
		added = append(added, uid)
	}

	// 3. Системные сообщения в чат группы:
	// «Пользователь Display_name (@username) был добавлен в группу»
	// (видят ВСЕ участники, включая только что добавленных)
	for _, uid := range added {
		h.broadcastMemberEvent(uint(groupID), userID, memberEventContent(uid, "был добавлен в группу"))
	}

	// 4. WS-уведомление ВСЕМ участникам (включая новых) — чтобы группа
	// появилась/обновилась в списке чатов и модалке в реальном времени
	if h.Hub != nil {
		var group models.Group
		h.DB.First(&group, groupID)

		allMemberIDs := make([]uint, 0)
		h.DB.Table("group_members").Where("group_id = ?", groupID).Pluck("user_id", &allMemberIDs)

		payload, _ := json.Marshal(map[string]interface{}{
			"type": "group_updated",
			"payload": map[string]interface{}{
				"id":            group.ID,
				"name":          group.Name,
				"avatar_url":    group.AvatarURL,
				"members_added": added,
			},
		})
		for _, id := range allMemberIDs {
			h.Hub.SendToUser(id, payload)
		}
	}
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

		// ═══ НЕПРОЧИТАННЫЕ: после last_read_message_id из group_members ═══
		var gm models.GroupMember
		h.DB.Where("group_id = ? AND user_id = ?", groups[i].ID, userID).First(&gm)

		var unread int64
		unreadQ := h.DB.Model(&models.Message{}).
			Where("group_id = ? AND sender_id <> ?", groups[i].ID, userID)
		if gm.LastReadMessageID > 0 {
			unreadQ = unreadQ.Where("id > ?", gm.LastReadMessageID)
		}
		unreadQ.Count(&unread)
		groups[i].UnreadCount = int(unread)
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

	var count int64
	h.DB.Model(&models.GroupMember{}).Where("group_id = ? AND user_id = ?", groupID, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var messages []models.Message
	query := h.DB.Preload("Sender").Where("group_id = ?", groupID)

	if beforeID := c.Query("before_id"); beforeID != "" {
		query = query.Where("id < ?", beforeID)
	}

	query.Order("created_at desc").Limit(50).Find(&messages)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	enrichMessages(h.DB, messages)

	// ═══ СТАТУСЫ ПРОЧТЕНИЯ: минимум last_read среди ОСТАЛЬНЫХ участников
	// (✓✓ появляется, когда сообщение прочитали ВСЕ) ═══
	var minRead uint
	row := h.DB.Table("group_members").
		Select("COALESCE(MIN(last_read_message_id), 0)").
		Where("group_id = ? AND user_id <> ?", groupID, userID).
		Row()
	_ = row.Scan(&minRead)
	for i := range messages {
		messages[i].IsReadByRecipient = minRead > 0 && messages[i].ID <= minRead
	}

	// ═══ last_read_message_id для разделителя «Новые сообщения» ═══
	var gm models.GroupMember
	h.DB.Where("group_id = ? AND user_id = ?", groupID, userID).First(&gm)

	c.JSON(http.StatusOK, gin.H{
		"messages":             messages,
		"last_read_message_id": gm.LastReadMessageID,
	})
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

// CandidateUser — кандидат на добавление в группу
type CandidateUser struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Source      string `json:"source"` // "friend" | "chat"
}

// GetAddCandidates — GET /groups/:id/candidates?q=...
// Возвращает кого МОЖНО добавить: друзья + собеседники из открытых DM-чатов,
// минус те, кто уже в группе. Фильтр по q — username/display_name.
func (h *GroupHandler) GetAddCandidates(c *gin.Context) {
	groupID := c.Param("id")
	userID := c.GetUint("user_id")
	q := strings.ToLower(strings.TrimSpace(c.Query("q")))

	// вызывающий должен быть участником группы
	var isMember int64
	h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Count(&isMember)
	if isMember == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// ID уже состоящих в группе (+ сам вызывающий) — их исключаем
	excluded := map[uint]bool{userID: true}
	var memberIDs []uint
	h.DB.Table("group_members").Where("group_id = ?", groupID).Pluck("user_id", &memberIDs)
	for _, id := range memberIDs {
		excluded[id] = true
	}

	// ─── Друзья (accept-нутые) ───
	// Защита: если колонки status нет / другое значение — падаем на fallback без статуса
	sources := map[uint]string{}

	var f1, f2 []uint
	err := h.DB.Table("friendships").
		Where("user_id = ? AND status IN ?", userID, []string{"accepted", "approved"}).
		Pluck("friend_id", &f1).Error
	if err != nil {
		h.DB.Table("friendships").Where("user_id = ?", userID).Pluck("friend_id", &f1)
	}
	err = h.DB.Table("friendships").
		Where("friend_id = ? AND status IN ?", userID, []string{"accepted", "approved"}).
		Pluck("user_id", &f2).Error
	if err != nil {
		h.DB.Table("friendships").Where("friend_id = ?", userID).Pluck("user_id", &f2)
	}
	for _, id := range append(f1, f2...) {
		if !excluded[id] {
			sources[id] = "friend"
		}
	}

	// ─── Собеседники из открытых DM-чатов ───
	var convIDs []uint
	h.DB.Table("conversation_participants").Where("user_id = ?", userID).Pluck("conversation_id", &convIDs)
	if len(convIDs) > 0 {
		var contactIDs []uint
		h.DB.Table("conversation_participants").
			Where("conversation_id IN ? AND user_id <> ?", convIDs, userID).
			Pluck("user_id", &contactIDs)
		for _, id := range contactIDs {
			if excluded[id] {
				continue
			}
			if _, ok := sources[id]; !ok {
				sources[id] = "chat"
			}
		}
	}

	// ─── Резолвим профили через auth-service + фильтр по q ───
	result := make([]CandidateUser, 0, len(sources))
	for id, src := range sources {
		u := utils.GetUserByID(id)
		if u == nil {
			continue
		}
		name := u.DisplayName
		if name == "" {
			name = u.Username
		}
		if q != "" &&
			!strings.Contains(strings.ToLower(u.Username), q) &&
			!strings.Contains(strings.ToLower(name), q) {
			continue
		}
		result = append(result, CandidateUser{
			ID:          id,
			Username:    u.Username,
			DisplayName: name,
			AvatarURL:   u.AvatarURL,
			Source:      src,
		})
	}

	// сначала друзья, потом по имени
	sort.Slice(result, func(i, j int) bool {
		if result[i].Source != result[j].Source {
			return result[i].Source == "friend"
		}
		return result[i].DisplayName < result[j].DisplayName
	})

	c.JSON(http.StatusOK, gin.H{"candidates": result})
}

// MarkGroupAsRead - Пометить группу как прочитанную
// прочитано с точностью до сообщения (только «вперёд»)
func (h *GroupHandler) MarkGroupAsRead(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	groupID := c.Param("id")

	var input struct {
		MessageID uint `json:"message_id"`
	}
	_ = c.ShouldBindJSON(&input)

	targetID := input.MessageID
	if targetID > 0 {
		var cnt int64
		h.DB.Model(&models.Message{}).
			Where("id = ? AND group_id = ?", targetID, groupID).Count(&cnt)
		if cnt == 0 {
			targetID = 0
		}
	}
	if targetID == 0 {
		var lastMsgs []models.Message
		h.DB.Where("group_id = ?", groupID).Order("created_at desc").Limit(1).Find(&lastMsgs)
		if len(lastMsgs) == 0 {
			c.JSON(http.StatusOK, gin.H{"status": "no messages to mark"})
			return
		}
		targetID = lastMsgs[0].ID
	}

	var gm models.GroupMember
	if err := h.DB.Where("group_id = ? AND user_id = ?", groupID, userID).
		First(&gm).Error; err == nil && targetID <= gm.LastReadMessageID {
		c.JSON(http.StatusOK, gin.H{"status": "already read", "last_read_message_id": gm.LastReadMessageID})
		return
	}

	if err := h.DB.Model(&models.GroupMember{}).
		Where("group_id = ? AND user_id = ?", groupID, userID).
		Update("last_read_message_id", targetID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	// ═══ НОВОЕ: live-рассылка остальным участникам — у отправителей
	// галочки ✓ сменятся на ✓✓ ═══
	if h.Hub != nil {
		groupIDNum, _ := strconv.ParseUint(groupID, 10, 32)
		var memberIDs []uint
		h.DB.Table("group_members").
			Where("group_id = ? AND user_id <> ?", groupIDNum, userID).
			Pluck("user_id", &memberIDs)
		if len(memberIDs) > 0 {
			payload, _ := json.Marshal(map[string]interface{}{
				"type": "messages_read",
				"payload": map[string]interface{}{
					"group_id":             groupIDNum,
					"reader_id":            userID,
					"last_read_message_id": targetID,
				},
			})
			for _, mid := range memberIDs {
				h.Hub.SendToUser(mid, payload)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":               "updated",
		"last_read_message_id": targetID,
	})
}

// Удаление участника (только владелец) / Выход из группы
func memberEventContent(targetID uint, action string) string {
	u := utils.GetUserByID(targetID)
	name := fmt.Sprintf("User_%d", targetID)
	username := ""
	if u != nil {
		username = u.Username
		if u.DisplayName != "" {
			name = u.DisplayName
		} else {
			name = u.Username
		}
	}
	if username != "" {
		return fmt.Sprintf("Пользователь %s (@%s) %s", name, username, action)
	}
	return fmt.Sprintf("Пользователь %s %s", name, action)
}

// broadcastMemberEvent — системное сообщение в чат группы (видно всем)
func (h *GroupHandler) broadcastMemberEvent(groupID uint, actorID uint, content string) {
	gid := groupID
	sysMsg := models.Message{
		GroupID:         &gid,
		SenderID:        actorID,
		Content:         content,
		IsSystemMessage: true,
		SystemType:      "event",
		CreatedAt:       time.Now(),
	}
	if err := h.DB.Create(&sysMsg).Error; err != nil {
		return
	}

	var sender models.User
	h.DB.First(&sender, actorID)

	payload, _ := json.Marshal(map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":                sysMsg.ID,
			"group_id":          gid,
			"conversation_id":   nil,
			"sender_id":         actorID,
			"sender_username":   sender.Username,
			"sender_avatar":     sender.AvatarURL,
			"content":           content,
			"is_system_message": true,
			"system_type":       "event",
			"created_at":        sysMsg.CreatedAt,
		},
	})

	var members []uint
	h.DB.Table("group_members").Where("group_id = ?", groupID).Pluck("user_id", &members)
	for _, id := range members {
		h.Hub.SendToUser(id, payload)
	}
}

// RemoveMember — DELETE /groups/:id/members/:user_id (только владелец)
func (h *GroupHandler) RemoveMember(c *gin.Context) {
	groupID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group id"})
		return
	}
	targetID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}
	userID := c.GetUint("user_id")

	var group models.Group
	if err := h.DB.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}
	if group.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can remove members"})
		return
	}
	if uint(targetID) == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove yourself"})
		return
	}

	res := h.DB.Where("group_id = ? AND user_id = ?", groupID, targetID).
		Delete(&models.GroupMember{})
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User is not a member"})
		return
	}

	// Системное сообщение всем оставшимся: «Пользователь X (@y) был удалён из группы»
	h.broadcastMemberEvent(uint(groupID), userID,
		memberEventContent(uint(targetID), "был удалён из группы"))

	// Личное событие удалённому пользователю → плашка «Вас удалили из этой группы»
	if h.Hub != nil {
		removedPayload, _ := json.Marshal(map[string]interface{}{
			"type": "removed_from_group",
			"payload": map[string]interface{}{
				"group_id":   uint(groupID),
				"group_name": group.Name,
			},
		})
		h.Hub.SendToUser(uint(targetID), removedPayload)
	}

	c.JSON(http.StatusOK, gin.H{"status": "removed", "user_id": uint(targetID)})
}

// LeaveGroup — POST /groups/:id/leave (для всех, кроме владельца)
func (h *GroupHandler) LeaveGroup(c *gin.Context) {
	groupID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group id"})
		return
	}
	userID := c.GetUint("user_id")

	var group models.Group
	if err := h.DB.First(&group, groupID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}
	if group.OwnerID == userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Owner cannot leave the group. Delete it instead."})
		return
	}

	res := h.DB.Where("group_id = ? AND user_id = ?", groupID, userID).
		Delete(&models.GroupMember{})
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "You are not a member"})
		return
	}

	// «Пользователь X (@y) покинул группу» — всем оставшимся
	h.broadcastMemberEvent(uint(groupID), userID,
		memberEventContent(userID, "покинул группу"))

	c.JSON(http.StatusOK, gin.H{"status": "left"})
}

// parseReplyIDsLocal — "12,15,19" → []uint (для обогащения истории)
func parseReplyIDsLocal(s string) []uint {
	out := []uint{}
	if strings.TrimSpace(s) == "" {
		return out
	}
	for _, p := range strings.Split(s, ",") {
		if v, err := strconv.Atoi(strings.TrimSpace(p)); err == nil && v > 0 {
			out = append(out, uint(v))
		}
	}
	return out
}

// enrichMessages — заполняет виртуальные поля сообщений
func enrichMessages(db *gorm.DB, messages []models.Message) {
	if len(messages) == 0 {
		return
	}

	// 1. Собираем ВСЕ id, на которые есть ответы (одиночные + мульти)
	replyIDs := make([]uint, 0)
	forwardIDs := make([]uint, 0)
	for i := range messages {
		if messages[i].ReplyToID != nil {
			replyIDs = append(replyIDs, *messages[i].ReplyToID)
		}
		replyIDs = append(replyIDs, parseReplyIDsLocal(messages[i].ReplyToIDs)...)
		for _, fid := range parseReplyIDsLocal(messages[i].ReplyToIDs) {
			_ = fid
		}
		if messages[i].ForwardedFrom != nil {
			forwardIDs = append(forwardIDs, *messages[i].ForwardedFrom)
		}
	}

	originals := make(map[uint]models.Message)
	if len(replyIDs) > 0 {
		var origs []models.Message
		db.Preload("Sender").Where("id IN ?", replyIDs).Find(&origs)
		for _, o := range origs {
			originals[o.ID] = o
		}
	}

	for i := range messages {
		messages[i].SenderUsername = messages[i].Sender.Username
		messages[i].SenderAvatar = messages[i].Sender.AvatarURL

		if messages[i].ReplyToID != nil {
			if orig, ok := originals[*messages[i].ReplyToID]; ok {
				messages[i].ReplyPreview = &models.ReplyPreview{
					ID:             orig.ID,
					Content:        orig.Content,
					SenderID:       orig.SenderID,
					SenderUsername: orig.Sender.Username,
					AttachmentType: orig.AttachmentType,
				}
			}
		}

		// НОВОЕ: мульти-ответ
		if ids := parseReplyIDsLocal(messages[i].ReplyToIDs); len(ids) > 0 {
			previews := make([]models.ReplyPreview, 0, len(ids))
			for _, id := range ids {
				if orig, ok := originals[id]; ok {
					previews = append(previews, models.ReplyPreview{
						ID:             orig.ID,
						Content:        orig.Content,
						SenderID:       orig.SenderID,
						SenderUsername: orig.Sender.Username,
						AttachmentType: orig.AttachmentType,
					})
				}
			}
			messages[i].ReplyPreviews = previews
		}

		if messages[i].ForwardedFrom != nil {
			u := utils.GetUserByID(*messages[i].ForwardedFrom)
			if u != nil {
				if u.DisplayName != "" {
					messages[i].ForwardedFromName = u.DisplayName
				} else {
					messages[i].ForwardedFromName = u.Username
				}
			}
		}
	}
}
