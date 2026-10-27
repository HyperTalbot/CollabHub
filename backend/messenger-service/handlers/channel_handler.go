package handlers

import (
	"backend/messenger-service/models"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

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
	// НОВОЕ: папка, в которую создаётся канал (null = корень)
	FolderID *uint `json:"folder_id"`
}

// ─── вспомогательные ───

func (h *ChannelHandler) isServerOwner(serverID uint, userID uint) bool {
	var server models.Server
	if err := h.DB.First(&server, serverID).Error; err != nil {
		return false
	}
	return server.OwnerID == userID
}

func (h *ChannelHandler) isServerMember(serverID uint, userID uint) bool {
	var cnt int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", serverID, userID).Count(&cnt)
	return cnt > 0
}

// uniqueChannelName — «Текстовый чат», «Текстовый чат (1)», ...
func (h *ChannelHandler) uniqueChannelName(serverID uint, base string) string {
	name := base
	for i := 1; i < 1000; i++ {
		var cnt int64
		h.DB.Model(&models.Channel{}).
			Where("server_id = ? AND name = ?", serverID, name).Count(&cnt)
		if cnt == 0 {
			return name
		}
		name = fmt.Sprintf("%s (%d)", base, i)
	}
	return base
}

func (h *ChannelHandler) uniqueFolderName(serverID uint, base string) string {
	name := base
	for i := 1; i < 1000; i++ {
		var cnt int64
		h.DB.Model(&models.ChannelFolder{}).
			Where("server_id = ? AND name = ?", serverID, name).Count(&cnt)
		if cnt == 0 {
			return name
		}
		name = fmt.Sprintf("%s (%d)", base, i)
	}
	return base
}

// nextSiblingPosition — следующая позиция среди папок И каналов одного родителя
func (h *ChannelHandler) nextSiblingPosition(serverID uint, parentID *uint) int {
	maxPos := -1
	var fpos []int
	fq := h.DB.Model(&models.ChannelFolder{}).Where("server_id = ? AND is_pinned = ?", serverID, false)
	if parentID == nil {
		fq = fq.Where("parent_id IS NULL")
	} else {
		fq = fq.Where("parent_id = ?", *parentID)
	}
	fq.Pluck("position", &fpos)
	for _, p := range fpos {
		if p > maxPos {
			maxPos = p
		}
	}
	var cpos []int
	cq := h.DB.Model(&models.Channel{}).Where("server_id = ? AND is_pinned = ?", serverID, false)
	if parentID == nil {
		cq = cq.Where("category_id IS NULL")
	} else {
		cq = cq.Where("category_id = ?", *parentID)
	}
	cq.Pluck("position", &cpos)
	for _, p := range cpos {
		if p > maxPos {
			maxPos = p
		}
	}
	return maxPos + 1
}

// CreateChannel - Создать канал внутри сервера (в папке или в корне)
func (h *ChannelHandler) CreateChannel(c *gin.Context) {
	var input CreateChannelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	myUserID := c.GetUint("user_id")
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if !h.isServerOwner(input.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can create channels"})
		return
	}

	// папка (если указана) должна принадлежать тому же серверу
	if input.FolderID != nil {
		var folder models.ChannelFolder
		if err := h.DB.First(&folder, *input.FolderID).Error; err != nil || folder.ServerID != input.ServerID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder_id"})
			return
		}
	}

	newChannel := models.Channel{
		ServerID:   input.ServerID,
		Name:       h.uniqueChannelName(input.ServerID, strings.TrimSpace(input.Name)),
		Type:       models.ChannelType(input.Type),
		CategoryID: input.FolderID,
		Position:   h.nextSiblingPosition(input.ServerID, input.FolderID),
	}
	if newChannel.Type == "" {
		newChannel.Type = models.ChannelTypeText
	}

	if err := h.DB.Create(&newChannel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create channel"})
		return
	}

	c.JSON(http.StatusCreated, newChannel)
}

// GetChannelsByServerID - Список каналов сервера
func (h *ChannelHandler) GetChannelsByServerID(c *gin.Context) {
	serverID := c.Param("id") // ФИКС: в роуте параметр :id, а не :server_id

	if serverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "server id is required"})
		return
	}
	if _, err := strconv.ParseUint(serverID, 10, 64); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server id format"})
		return
	}

	userID := c.GetUint("user_id")
	if !h.isServerMember(uint(mustAtoi(serverID)), userID) {
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

func mustAtoi(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

// GetChannelMessages - История сообщений канала (с обогащением)
func (h *ChannelHandler) GetChannelMessages(c *gin.Context) {
	channelID := c.Param("id")
	userID := c.GetUint("user_id")

	var channel models.Channel
	if err := h.DB.First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if !h.isServerMember(channel.ServerID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var messages []models.Message
	query := h.DB.Preload("Sender").Where("channel_id = ?", channelID)
	if beforeID := c.Query("before_id"); beforeID != "" {
		query = query.Where("id < ?", beforeID)
	}
	query.Order("created_at desc").Limit(50).Find(&messages)

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	enrichMessages(h.DB, messages)

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// DeleteChannel - Удалить канал (только владелец)
func (h *ChannelHandler) DeleteChannel(c *gin.Context) {
	channelID := c.Param("id")
	myUserID := c.GetUint("user_id")
	if myUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var channel models.Channel
	if err := h.DB.First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if !h.isServerOwner(channel.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
		return
	}

	h.DB.Delete(&channel)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: ПАПКИ (бесконечная вложенность, как в проводнике)
// ═══════════════════════════════════════════════════════════════

// CreateFolder — POST /servers/:id/folders
func (h *ChannelHandler) CreateFolder(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	var input struct {
		ServerID uint   `json:"server_id" binding:"required"`
		Name     string `json:"name" binding:"required"`
		ParentID *uint  `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.isServerOwner(input.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can manage structure"})
		return
	}
	if input.ParentID != nil {
		var parent models.ChannelFolder
		if err := h.DB.First(&parent, *input.ParentID).Error; err != nil || parent.ServerID != input.ServerID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent_id"})
			return
		}
	}

	folder := models.ChannelFolder{
		ServerID: input.ServerID,
		ParentID: input.ParentID,
		Name:     h.uniqueFolderName(input.ServerID, strings.TrimSpace(input.Name)),
		Position: h.nextSiblingPosition(input.ServerID, input.ParentID),
	}
	if err := h.DB.Create(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder"})
		return
	}
	c.JSON(http.StatusCreated, folder)
}

// RenameFolder — PUT /folders/:id
func (h *ChannelHandler) RenameFolder(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	var folder models.ChannelFolder
	if err := h.DB.First(&folder, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}
	if !h.isServerOwner(folder.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can manage structure"})
		return
	}
	var input struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(input.Name)
	h.DB.Model(&folder).Update("name", name)
	folder.Name = name
	c.JSON(http.StatusOK, folder)
}

// RenameChannel — PUT /channels/:id
func (h *ChannelHandler) RenameChannel(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	var channel models.Channel
	if err := h.DB.First(&channel, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	if !h.isServerOwner(channel.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can manage structure"})
		return
	}
	var input struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(input.Name)
	h.DB.Model(&channel).Update("name", name)
	channel.Name = name
	c.JSON(http.StatusOK, channel)
}

// DeleteFolder — DELETE /folders/:id (каскадно: вложенные папки и каналы)
func (h *ChannelHandler) DeleteFolder(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	var folder models.ChannelFolder
	if err := h.DB.First(&folder, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}
	if !h.isServerOwner(folder.ServerID, myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can manage structure"})
		return
	}

	// BFS по вложенным папкам
	toDelete := []uint{folder.ID}
	for i := 0; i < len(toDelete); i++ {
		var sub []uint
		h.DB.Model(&models.ChannelFolder{}).
			Where("parent_id = ?", toDelete[i]).Pluck("id", &sub)
		toDelete = append(toDelete, sub...)
	}

	h.DB.Where("category_id IN ?", toDelete).Delete(&models.Channel{})
	h.DB.Where("id IN ?", toDelete).Delete(&models.ChannelFolder{})

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "folders": toDelete})
}

// ═══════════════════════════════════════════════════════════════
// НОВОЕ: закрепить / порядок
// ═══════════════════════════════════════════════════════════════

// TogglePinItem — POST /servers/:id/pin {item_type: folder|channel, item_id}
func (h *ChannelHandler) TogglePinItem(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server id"})
		return
	}
	if !h.isServerMember(uint(serverID), myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		ItemType string `json:"item_type" binding:"required"` // folder | channel
		ItemID   uint   `json:"item_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	switch input.ItemType {
	case "folder":
		var f models.ChannelFolder
		if err := h.DB.First(&f, input.ItemID).Error; err != nil || f.ServerID != uint(serverID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		newVal := !f.IsPinned
		h.DB.Model(&f).Update("is_pinned", newVal)
		c.JSON(http.StatusOK, gin.H{"is_pinned": newVal})
	case "channel":
		var ch models.Channel
		if err := h.DB.First(&ch, input.ItemID).Error; err != nil || ch.ServerID != uint(serverID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
			return
		}
		newVal := !ch.IsPinned
		h.DB.Model(&ch).Update("is_pinned", newVal)
		c.JSON(http.StatusOK, gin.H{"is_pinned": newVal})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_type must be folder or channel"})
	}
}

type siblingItem struct {
	Type     string
	ID       uint
	Position int
}

// ReorderItem — POST /servers/:id/reorder {item_type, item_id, direction: up|down}
// Меняет позицию среди соседей (папки + каналы одного родителя).
func (h *ChannelHandler) ReorderItem(c *gin.Context) {
	myUserID := c.GetUint("user_id")
	serverID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server id"})
		return
	}
	if !h.isServerOwner(uint(serverID), myUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can reorder"})
		return
	}

	var input struct {
		ItemType  string `json:"item_type" binding:"required"` // folder | channel
		ItemID    uint   `json:"item_id" binding:"required"`
		Direction string `json:"direction" binding:"required"` // up | down
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// определяем родителя элемента
	var parentID *uint
	switch input.ItemType {
	case "folder":
		var f models.ChannelFolder
		if err := h.DB.First(&f, input.ItemID).Error; err != nil || f.ServerID != uint(serverID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		parentID = f.ParentID
	case "channel":
		var ch models.Channel
		if err := h.DB.First(&ch, input.ItemID).Error; err != nil || ch.ServerID != uint(serverID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
			return
		}
		parentID = ch.CategoryID
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_type must be folder or channel"})
		return
	}

	// соседи (не закреплённые) — папки + каналы
	var sibs []siblingItem
	var folders []models.ChannelFolder
	fq := h.DB.Model(&models.ChannelFolder{}).
		Where("server_id = ? AND is_pinned = ?", uint(serverID), false)
	if parentID == nil {
		fq = fq.Where("parent_id IS NULL")
	} else {
		fq = fq.Where("parent_id = ?", *parentID)
	}
	fq.Order("position asc, id asc").Find(&folders)
	for _, f := range folders {
		sibs = append(sibs, siblingItem{Type: "folder", ID: f.ID, Position: f.Position})
	}

	var chans []models.Channel
	cq := h.DB.Model(&models.Channel{}).
		Where("server_id = ? AND is_pinned = ?", uint(serverID), false)
	if parentID == nil {
		cq = cq.Where("category_id IS NULL")
	} else {
		cq = cq.Where("category_id = ?", *parentID)
	}
	cq.Order("position asc, id asc").Find(&chans)
	for _, ch := range chans {
		sibs = append(sibs, siblingItem{Type: "channel", ID: ch.ID, Position: ch.Position})
	}

	sort.SliceStable(sibs, func(i, j int) bool {
		if sibs[i].Position != sibs[j].Position {
			return sibs[i].Position < sibs[j].Position
		}
		return sibs[i].ID < sibs[j].ID
	})

	idx := -1
	for i, s := range sibs {
		if s.Type == input.ItemType && s.ID == input.ItemID {
			idx = i
			break
		}
	}
	if idx == -1 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found among siblings"})
		return
	}

	target := idx - 1
	if input.Direction == "down" {
		target = idx + 1
	}
	if target < 0 || target >= len(sibs) {
		c.JSON(http.StatusOK, gin.H{"status": "noop"})
		return
	}

	sibs[idx], sibs[target] = sibs[target], sibs[idx]

	// записываем новые позиции всем соседям
	for i, s := range sibs {
		if s.Type == "folder" {
			h.DB.Model(&models.ChannelFolder{}).Where("id = ?", s.ID).Update("position", i)
		} else {
			h.DB.Model(&models.Channel{}).Where("id = ?", s.ID).Update("position", i)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
