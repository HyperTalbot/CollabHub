// backend/messenger-service/handlers/chat_info_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ChatInfoHandler — информация о чате для модалки ChatHeader:
// профиль собеседника (DM) / данные группы + разложенный по папкам контент.
type ChatInfoHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// broadcastGroupUpdate — уведомляет всех участников группы об изменении
// названия/аватарки, чтобы список чатов и шапка обновились в реальном времени.
func broadcastGroupUpdate(hub *ws.Hub, db *gorm.DB, groupID uint, name, avatarURL string) {
	if hub == nil {
		return
	}
	var memberIDs []uint
	db.Model(&models.GroupMember{}).
		Where("group_id = ?", groupID).
		Pluck("user_id", &memberIDs)

	payload, _ := json.Marshal(map[string]interface{}{
		"type": "group_updated",
		"payload": map[string]interface{}{
			"id":         groupID,
			"name":       name,
			"avatar_url": avatarURL,
		},
	})
	for _, id := range memberIDs {
		hub.SendToUser(id, payload)
	}
}

// UpdateContact — PUT /contacts/:user_id
// «Изменить контакт»: переопределяет display_name собеседника
// (локально + синхронизирует auth-service, чтобы имя было общим).
func (h *ChatInfoHandler) UpdateContact(c *gin.Context) {
	userID := c.GetUint("user_id")

	targetID, err := strconv.ParseUint(c.Param("user_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}
	if uint(targetID) == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot rename yourself here"})
		return
	}

	var input struct {
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	name := strings.TrimSpace(input.DisplayName)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "display_name is required"})
		return
	}

	// Проверяем, что пользователь действительно есть у нас в чатах
	var count int64
	h.DB.Table("conversation_participants").
		Where("user_id = ?", targetID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User has no chats with you"})
		return
	}

	// 1. Локальная таблица users (используется messenger'ом для списков чатов)
	res := h.DB.Table("users").
		Where("id = ?", targetID).
		Update("display_name", name)
	localUpdated := res.Error == nil && res.RowsAffected > 0

	// 2. Глобальный профиль через auth-service (PUT /users/me токеном клиента)
	token := c.GetHeader("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	synced := false
	if token != "" {
		body, _ := json.Marshal(map[string]string{"display_name": name})
		req, err := http.NewRequest(http.MethodPut,
			"http://localhost:8080/api/v1/users/me", strings.NewReader(string(body)))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err == nil {
				resp.Body.Close()
				synced = resp.StatusCode == http.StatusOK
			}
		}
	}

	if !localUpdated && !synced {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update contact"})
		return
	}

	// Обновляем кэш пользователей в messenger и уведомления участникам DM-чатов
	utils.InvalidateUserCache(uint(targetID))
	h.notifyChatPartners(uint(targetID), userID, name)

	c.JSON(http.StatusOK, gin.H{
		"id":           uint(targetID),
		"display_name": name,
		"synced":       synced,
	})
}

// notifyChatPartners — шлёт WS-событие contact_updated всем, у кого есть
// совместные чаты с изменённым пользователем (чтобы имена обновились у всех).
func (h *ChatInfoHandler) notifyChatPartners(changedUserID, actorID uint, name string) {
	if h.Hub == nil {
		return
	}
	var partnerIDs []uint
	h.DB.Table("conversation_participants AS cp1").
		Select("cp2.user_id").
		Joins("JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id").
		Where("cp1.user_id = ? AND cp2.user_id <> ?", changedUserID, changedUserID).
		Distinct().
		Scan(&partnerIDs)

	payload, _ := json.Marshal(map[string]interface{}{
		"type": "contact_updated",
		"payload": map[string]interface{}{
			"user_id":      changedUserID,
			"display_name": name,
		},
	})
	for _, id := range partnerIDs {
		h.Hub.SendToUser(id, payload)
	}
	// Актору тоже — его собственное соединение может быть другим
	h.Hub.SendToUser(actorID, payload)
}

// UpdateGroupInfo — PUT /chats/:id/group-info
// «Изменить группу»: новое имя и/или аватарка группы.
// Доступно владельцу/админу группы; обновлённые данные рассылаются
// всем участникам по WebSocket.
func (h *ChatInfoHandler) UpdateGroupInfo(c *gin.Context) {
	userID := c.GetUint("user_id")

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group id"})
		return
	}

	var group models.Group
	if err := h.DB.Preload("Members").First(&group, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
		return
	}
	if !canEditGroup(group, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner or admin can update group"})
		return
	}

	var input struct {
		Name      *string `json:"name"`
		AvatarURL *string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Group name cannot be empty"})
			return
		}
		updates["name"] = name
		group.Name = name
	}
	if input.AvatarURL != nil {
		updates["avatar_url"] = strings.TrimSpace(*input.AvatarURL)
		group.AvatarURL = strings.TrimSpace(*input.AvatarURL)
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nothing to update"})
		return
	}

	if err := h.DB.Model(&group).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update group"})
		return
	}

	broadcastGroupUpdate(h.Hub, h.DB, group.ID, group.Name, group.AvatarURL)

	c.JSON(http.StatusOK, gin.H{
		"id":         group.ID,
		"name":       group.Name,
		"avatar_url": group.AvatarURL,
	})
}


// canEditGroup — группа доступна всем участникам, но менять её настройки
// может только владелец или админ.
func canEditGroup(group models.Group, userID uint) bool {
	if group.OwnerID == userID {
		return true
	}
	for _, m := range group.Members {
		if m.UserID == userID && (m.Role == "owner" || m.Role == "admin") {
			return true
		}
	}
	return false
}

type chatMediaItem struct {
	ID            uint   `json:"id"`
	URL           string `json:"url"`
	Type          string `json:"type"` // image | video | audio | file | link
	SenderName    string `json:"sender_name"`
	SenderID      uint   `json:"sender_id"`
	Message       string `json:"message,omitempty"`
	FileName      string `json:"file_name,omitempty"`
	CreatedAt     string `json:"created_at"`
}

type chatFolderCounts struct {
	Media  int `json:"media"`
	Files  int `json:"files"`
	Links  int `json:"links"`
	Voices int `json:"voices"`
}

type chatUserInfo struct {
	ID          uint   `json:"id"`
	DisplayName string `json:"display_name"`
	Username    string `json:"username"`
	Email       string `json:"email,omitempty"`
	Bio         string `json:"bio,omitempty"`
	AvatarURL   string `json:"avatar_url"`
}

// fetchUserBio вытаскивает bio из ответа auth-service (публичный роут
// /users/:id отдаёт профиль пользователя; парсим толерантно, чтобы не зависеть
// от структуры остальных полей).
var bioRegexp = regexp.MustCompile(`"bio"\s*:\s*"((?:[^"\\]|\\.)*)"`)

func fetchUserBio(userID uint) string {
	resp, err := http.Get(fmt.Sprintf("http://localhost:8080/api/v1/users/%d", userID))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	body := make([]byte, 0, 65536)
	tmp := make([]byte, 32768)
	for {
		n, readErr := resp.Body.Read(tmp)
		if n > 0 {
			body = append(body, tmp[:n]...)
		}
		if readErr != nil {
			break
		}
	}

	m := bioRegexp.FindSubmatch(body)
	if len(m) < 2 {
		return ""
	}
	return unquoteJSONString(string(m[1]))
}

func unquoteJSONString(s string) string {
	var out strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			i++
			switch s[i] {
			case 'n':
				out.WriteByte('\n')
			case 't':
				out.WriteByte('\t')
			case '"':
				out.WriteByte('"')
			case '\\':
				out.WriteByte('\\')
			default:
				out.WriteByte(s[i])
			}
			continue
		}
		out.WriteByte(s[i])
	}
	return out.String()
}

type chatGroupMember struct {
	ID          uint   `json:"id"`
	DisplayName string `json:"display_name"`
	Username    string `json:"username"`
	AvatarURL   string `json:"avatar_url"`
	Role        string `json:"role"`
}

type chatInfoResponse struct {
	Type        string            `json:"type"` // dm | group
	ID          uint              `json:"id"`
	Title       string            `json:"title"`
	AvatarURL   string            `json:"avatar_url"`
	User        *chatUserInfo     `json:"user,omitempty"`
	Members     []chatGroupMember `json:"members,omitempty"`
	MemberCount int               `json:"member_count"`
	Folders     chatFolderCounts  `json:"folders"`
	Media       []chatMediaItem   `json:"media"`
	Files       []chatMediaItem   `json:"files"`
	Links       []chatMediaItem   `json:"links"`
	Voices      []chatMediaItem   `json:"voices"`
}

var urlRegexp = regexp.MustCompile(`https?://\S+`)

// resolveUserDetails тянет display_name/email/avatar из auth-service
// (через utils.GetUserByID с кэшированием); при недоступности —
// graceful fallback к локальным данным. Bio берётся из локальной БД,
// если там заполнено (auth-service его тоже возвращает в профиле).
func (h *ChatInfoHandler) resolveUserDetails(userID uint) chatUserInfo {
	info := chatUserInfo{ID: userID}

	var local models.User
	if err := h.DB.First(&local, userID).Error; err == nil {
		info.Username = local.Username
		info.AvatarURL = local.AvatarURL
	}

	remote := utils.GetUserByID(userID)
	if remote != nil && remote.ID != 0 {
		info.ID = remote.ID
		if remote.Username != "" {
			info.Username = remote.Username
		}
		info.DisplayName = remote.DisplayName
		info.Email = remote.Email
		if remote.AvatarURL != "" {
			info.AvatarURL = remote.AvatarURL
		}
	}

	if info.DisplayName == "" {
		info.DisplayName = info.Username
	}

	info.Bio = fetchUserBio(userID)
	return info
}

// classifyMessage раскладывает сообщение по папкам контента.
func classifyMessage(m models.Message, senderName string) (folder string, item chatMediaItem, ok bool) {
	item = chatMediaItem{
		ID:         m.ID,
		SenderID:   m.SenderID,
		SenderName: senderName,
		CreatedAt:  m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Message:    m.Content,
	}

	switch strings.ToLower(m.AttachmentType) {
	case "image", "video":
		item.Type = strings.ToLower(m.AttachmentType)
		item.URL = m.AttachmentURL
		return "media", item, true
	case "audio":
		// Голосовые и музыкальные аудио separate from files
		item.Type = "audio"
		item.URL = m.AttachmentURL
		return "voices", item, true
	case "file":
		item.Type = "file"
		item.URL = m.AttachmentURL
		item.FileName = extractFileName(m.AttachmentURL)
		return "files", item, true
	}

	// Сообщения без вложений, но со ссылками
	if urls := urlRegexp.FindAllString(m.Content, -1); len(urls) > 0 {
		item.Type = "link"
		item.URL = urls[0]
		return "links", item, true
	}

	return "", item, false
}

func extractFileName(u string) string {
	if u == "" {
		return ""
	}
	parts := strings.Split(u, "/")
	name := parts[len(parts)-1]
	if i := strings.Index(name, "?"); i >= 0 {
		name = name[:i]
	}
	return name
}

func (h *ChatInfoHandler) buildResponse(msgs []models.Message) *chatInfoResponse {
	res := &chatInfoResponse{
		Media:  []chatMediaItem{},
		Files:  []chatMediaItem{},
		Links:  []chatMediaItem{},
		Voices: []chatMediaItem{},
	}

	for _, m := range msgs {
		senderName := m.Sender.Username
		folder, item, ok := classifyMessage(m, senderName)
		if !ok {
			continue
		}
		switch folder {
		case "media":
			res.Media = append(res.Media, item)
			res.Folders.Media++
		case "files":
			res.Files = append(res.Files, item)
			res.Folders.Files++
		case "links":
			res.Links = append(res.Links, item)
			res.Folders.Links++
		case "voices":
			res.Voices = append(res.Voices, item)
			res.Folders.Voices++
		}
	}

	// newest first
	reverse := func(s []chatMediaItem) {
		for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
			s[i], s[j] = s[j], s[i]
		}
	}
	reverse(res.Media)
	reverse(res.Files)
	reverse(res.Links)
	reverse(res.Voices)

	return res
}

// GetChatInfo GET /chats/:id/info?type=dm|group
func (h *ChatInfoHandler) GetChatInfo(c *gin.Context) {
	userID := c.GetUint("user_id")
	chatID := c.Param("id")
	chatType := c.Query("type")
	if chatType == "" {
		chatType = "dm"
	}

	id, err := strconv.ParseUint(chatID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat id"})
		return
	}

	if chatType == "group" {
		var count int64
		h.DB.Model(&models.GroupMember{}).
			Where("group_id = ? AND user_id = ?", id, userID).Count(&count)
		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}

		var group models.Group
		if err := h.DB.Preload("Members").First(&group, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Group not found"})
			return
		}

		res := h.buildResponse(h.loadMessages("group_id", group.ID))
		res.Type = "group"
		res.ID = group.ID
		res.Title = group.Name
		res.AvatarURL = group.AvatarURL
		res.MemberCount = len(group.Members)
		res.Members = []chatGroupMember{}
		for _, gm := range group.Members {
			u := h.resolveUserDetails(gm.UserID)
			res.Members = append(res.Members, chatGroupMember{
				ID:          u.ID,
				DisplayName: u.DisplayName,
				Username:    u.Username,
				AvatarURL:   u.AvatarURL,
				Role:        gm.Role,
			})
		}

		c.JSON(http.StatusOK, res)
		return
	}

	// DM
	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", id, userID).Count(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var participantIDs []uint
	h.DB.Table("conversation_participants").
		Where("conversation_id = ?", id).
		Pluck("user_id", &participantIDs)

	var partnerID uint
	for _, pid := range participantIDs {
		if pid != userID {
			partnerID = pid
			break
		}
	}
	if partnerID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Partner not found"})
		return
	}

	partner := h.resolveUserDetails(partnerID)

	res := h.buildResponse(h.loadMessages("conversation_id", uint(id)))
	res.Type = "dm"
	res.ID = uint(id)
	res.Title = partner.DisplayName
	res.AvatarURL = partner.AvatarURL
	res.User = &partner
	res.MemberCount = 2

	c.JSON(http.StatusOK, res)
}

func (h *ChatInfoHandler) loadMessages(scopeColumn string, scopeID uint) []models.Message {
	var messages []models.Message
	h.DB.Preload("Sender").
		Where(scopeColumn+" = ? AND (attachment_type <> '' OR content ~* 'https?://')", scopeID).
		Order("created_at asc").
		Limit(2000).
		Find(&messages)
	return messages
}
