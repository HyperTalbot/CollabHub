// /backend/messenger-service/handlers/server_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ServerHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub // ДОБАВЛЕНО: для WS-уведомлений (servers_updated)
}

func NewServerHandler(db *gorm.DB, hub *ws.Hub) *ServerHandler {
	return &ServerHandler{DB: db, Hub: hub}
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

// CreateServer - Создает сервер, папку «Главная» и дефолтные каналы
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

	// 2. ═══ Папка «Главная» с одним текстовым и одним голосовым каналом ═══
	folder := models.ChannelFolder{
		ServerID: newServer.ID,
		Name:     "Главная",
		Position: 0,
	}
	if err := tx.Create(&folder).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to create default folder"})
		return
	}
	fid := folder.ID

	defaultChannels := []models.Channel{
		{
			ServerID:   newServer.ID,
			Name:       "Текстовый чат",
			Type:       models.ChannelTypeText,
			CategoryID: &fid,
			Position:   0,
		},
		{
			ServerID:   newServer.ID,
			Name:       "Голосовой канал",
			Type:       models.ChannelTypeVoice,
			CategoryID: &fid,
			Position:   1,
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

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: структура сервера (папки + каналы) одним запросом
// ═══════════════════════════════════════════════════════════════
func (h *ServerHandler) GetStructure(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)

	var cnt int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, myUserID).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var folders []models.ChannelFolder
	h.DB.Where("server_id = ?", serverID).Order("position asc, id asc").Find(&folders)

	var channels []models.Channel
	h.DB.Where("server_id = ?", serverID).Order("position asc, id asc").Find(&channels)

	c.JSON(http.StatusOK, gin.H{"folders": folders, "channels": channels})
}

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: участники сервера (с ролями и данными из auth-service)
// ═══════════════════════════════════════════════════════════════
type ServerMemberResponse struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Role        string `json:"role"`
}

func (h *ServerHandler) GetServerMembers(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)

	var cnt int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, myUserID).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	var memberIDs []uint
	h.DB.Table("server_members").Where("server_id = ?", serverID).Pluck("user_id", &memberIDs)

	members := make([]ServerMemberResponse, 0, len(memberIDs))
	for _, uid := range memberIDs {
		u := utils.GetUserByID(uid)
		if u == nil {
			continue
		}
		name := u.DisplayName
		if name == "" {
			name = u.Username
		}
		role := "member"
		if server.OwnerID == uid {
			role = "owner"
		}
		members = append(members, ServerMemberResponse{
			ID:          uid,
			Username:    u.Username,
			DisplayName: name,
			AvatarURL:   u.AvatarURL,
			Role:        role,
		})
	}

	// владелец первым
	sort.SliceStable(members, func(i, j int) bool {
		if (members[i].Role == "owner") != (members[j].Role == "owner") {
			return members[i].Role == "owner"
		}
		return members[i].DisplayName < members[j].DisplayName
	})

	c.JSON(http.StatusOK, members)
}

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: добавить участников сервера
// ═══════════════════════════════════════════════════════════════
func (h *ServerHandler) AddServerMembers(c *gin.Context) {
	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server id"})
		return
	}
	myUserID := getUserID(c)

	var cnt int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, myUserID).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		UserIDs []uint `json:"user_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	added := make([]uint, 0)
	for _, uid := range input.UserIDs {
		var exists int64
		h.DB.Table("server_members").
			Where("server_id = ? AND user_id = ?", serverID, uid).Count(&exists)
		if exists > 0 {
			continue
		}
		m := map[string]interface{}{
			"server_id": uint(serverID),
			"user_id":   uid,
		}
		if err := h.DB.Table("server_members").Create(&m).Error; err == nil {
			added = append(added, uid)
		}
	}

	// WS: добавленным пользователям — обновить список серверов
	if h.Hub != nil && len(added) > 0 {
		payload, _ := json.Marshal(map[string]interface{}{
			"type":    "servers_updated",
			"payload": map[string]interface{}{"server_id": uint(serverID)},
		})
		for _, uid := range added {
			h.Hub.SendToUser(uid, payload)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "added": added})
}

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: кандидаты для добавления (друзья + DM-собеседники,
// исключая участников сервера). Тип CandidateUser — из group_handler.go
// ═══════════════════════════════════════════════════════════════
func (h *ServerHandler) GetServerCandidates(c *gin.Context) {
	serverID := c.Param("id")
	myUserID := getUserID(c)
	q := strings.ToLower(strings.TrimSpace(c.Query("q")))

	var cnt int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, myUserID).Count(&cnt)
	if cnt == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	excluded := map[uint]bool{myUserID: true}
	var memberIDs []uint
	h.DB.Table("server_members").Where("server_id = ?", serverID).Pluck("user_id", &memberIDs)
	for _, id := range memberIDs {
		excluded[id] = true
	}

	sources := map[uint]string{}

	// Друзья
	var f1, f2 []uint
	if err := h.DB.Table("friendships").
		Where("user_id = ? AND status IN ?", myUserID, []string{"accepted", "approved"}).
		Pluck("friend_id", &f1).Error; err != nil {
		h.DB.Table("friendships").Where("user_id = ?", myUserID).Pluck("friend_id", &f1)
	}
	if err := h.DB.Table("friendships").
		Where("friend_id = ? AND status IN ?", myUserID, []string{"accepted", "approved"}).
		Pluck("user_id", &f2).Error; err != nil {
		h.DB.Table("friendships").Where("friend_id = ?", myUserID).Pluck("user_id", &f2)
	}
	for _, id := range append(f1, f2...) {
		if !excluded[id] {
			sources[id] = "friend"
		}
	}

	// DM-собеседники
	var convIDs []uint
	h.DB.Table("conversation_participants").Where("user_id = ?", myUserID).Pluck("conversation_id", &convIDs)
	if len(convIDs) > 0 {
		var contactIDs []uint
		h.DB.Table("conversation_participants").
			Where("conversation_id IN ? AND user_id <> ?", convIDs, myUserID).
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

	sort.Slice(result, func(i, j int) bool {
		if result[i].Source != result[j].Source {
			return result[i].Source == "friend"
		}
		return result[i].DisplayName < result[j].DisplayName
	})

	c.JSON(http.StatusOK, gin.H{"candidates": result})
}

// ═══════════════════════════════════════════════════════════════
// ПРИГЛАШЕНИЯ НА СЕРВЕР
// ═══════════════════════════════════════════════════════════════

// InviteToServer — POST /servers/:id/invite {user_ids}
func (h *ServerHandler) InviteToServer(c *gin.Context) {
	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server id"})
		return
	}
	myUserID := getUserID(c)

	// пригласить может только участник сервера
	if !h.isMember(uint(serverID), myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		UserIDs []uint `json:"user_ids" binding:"required"`
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

	invited := make([]uint, 0)
	for _, uid := range input.UserIDs {
		if uid == myUserID {
			continue
		}
		// уже участник?
		var isMember int64
		h.DB.Table("server_members").Where("server_id = ? AND user_id = ?", serverID, uid).Count(&isMember)
		if isMember > 0 {
			continue
		}
		// уже есть активное приглашение?
		var pending int64
		h.DB.Model(&models.ServerInvitation{}).
			Where("server_id = ? AND invitee_id = ? AND status = ?", serverID, uid, "pending").
			Count(&pending)
		if pending > 0 {
			continue
		}
		inv := models.ServerInvitation{
			ServerID:  uint(serverID),
			InviterID: myUserID,
			InviteeID: uid,
			Status:    "pending",
		}
		if err := h.DB.Create(&inv).Error; err == nil {
			invited = append(invited, uid)
		}
	}

	// WS-уведомление приглашённым
	if h.Hub != nil {
		inviterName := myUserID
		_ = inviterName
		payload, _ := json.Marshal(map[string]interface{}{
			"type": "server_invite",
			"payload": map[string]interface{}{
				"server_id":   uint(serverID),
				"server_name": server.Name,
				"inviter_id":  myUserID,
			},
		})
		for _, uid := range invited {
			h.Hub.SendToUser(uid, payload)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "invited": invited})
}

// GetMyServerInvites — GET /server-invites (входящие pending)
func (h *ServerHandler) GetMyServerInvites(c *gin.Context) {
	myUserID := getUserID(c)

	var invites []models.ServerInvitation
	h.DB.Where("invitee_id = ? AND status = ?", myUserID, "pending").
		Order("created_at desc").Find(&invites)

	type item struct {
		ID           uint      `json:"id"`
		ServerID     uint      `json:"server_id"`
		ServerName   string    `json:"server_name"`
		ServerAvatar string    `json:"server_avatar"`
		InviterID    uint      `json:"inviter_id"`
		InviterName  string    `json:"inviter_name"`
		CreatedAt    time.Time `json:"created_at"`
	}

	result := make([]item, 0, len(invites))
	for _, inv := range invites {
		var srv models.Server
		h.DB.First(&srv, inv.ServerID)
		inviterName := ""
		if u := utils.GetUserByID(inv.InviterID); u != nil {
			inviterName = u.DisplayName
			if inviterName == "" {
				inviterName = u.Username
			}
		}
		result = append(result, item{
			ID:           inv.ID,
			ServerID:     inv.ServerID,
			ServerName:   srv.Name,
			ServerAvatar: srv.AvatarURL,
			InviterID:    inv.InviterID,
			InviterName:  inviterName,
			CreatedAt:    inv.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"invites": result})
}

// AcceptServerInvite — POST /server-invites/:invite_id/accept
func (h *ServerHandler) AcceptServerInvite(c *gin.Context) {
	myUserID := getUserID(c)
	inviteID := c.Param("invite_id")

	var inv models.ServerInvitation
	if err := h.DB.First(&inv, inviteID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}
	if inv.InviteeID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your invitation"})
		return
	}
	if inv.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation already processed"})
		return
	}

	// добавляем в участники
	var exists int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", inv.ServerID, myUserID).
		Count(&exists)

	if exists == 0 {
		if err := h.DB.Table("server_members").Create(&map[string]interface{}{
			"server_id": inv.ServerID,
			"user_id":   myUserID,
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join server: " + err.Error()})
			return
		}
	}

	h.DB.Model(&inv).Update("status", "accepted")

	// WS: обновить список серверов у принявшего и у пригласившего
	if h.Hub != nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"type":    "servers_updated",
			"payload": map[string]interface{}{"server_id": inv.ServerID},
		})
		h.Hub.SendToUser(myUserID, payload)
		h.Hub.SendToUser(inv.InviterID, payload)
	}

	c.JSON(http.StatusOK, gin.H{"status": "joined", "server_id": inv.ServerID})
}

// RejectServerInvite — POST /server-invites/:invite_id/reject
func (h *ServerHandler) RejectServerInvite(c *gin.Context) {
	myUserID := getUserID(c)
	inviteID := c.Param("invite_id")

	var inv models.ServerInvitation
	if err := h.DB.First(&inv, inviteID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}
	if inv.InviteeID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your invitation"})
		return
	}
	h.DB.Model(&inv).Update("status", "rejected")
	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

// isMember — вспомогательная проверка участия
func (h *ServerHandler) isMember(serverID uint, userID uint) bool {
	var cnt int64
	h.DB.Table("server_members").Where("server_id = ? AND user_id = ?", serverID, userID).Count(&cnt)
	return cnt > 0
}
