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
	DB *gorm.DB
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
