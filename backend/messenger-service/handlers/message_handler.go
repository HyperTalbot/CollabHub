// /backend/messenger-service/handlers/message_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/ws"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const MAX_MESSAGE_LENGTH = 4096

type MessageHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// broadcastToConversation принимает uint ID, а не указатель
func (h *MessageHandler) broadcastToConversation(convID uint, payload interface{}) {
	data, _ := json.Marshal(payload)
	if h.Hub == nil {
		return
	}
	var userIDs []uint
	h.DB.Table("conversation_participants").
		Where("conversation_id = ?", convID).
		Pluck("user_id", &userIDs)

	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: userIDs,
		Data:    data,
	}
}

// 1. Отправка сообщения
func (h *MessageHandler) SendMessage(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID *uint  `json:"conversation_id"`
		GroupID        *uint  `json:"group_id"`
		ChannelID      *uint  `json:"channel_id"`
		Content        string `json:"content"`
		ReplyToID      *uint  `json:"reply_to_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Валидация: должно быть указано хотя бы одно
	if input.ConversationID == nil && input.GroupID == nil && input.ChannelID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id, group_id or channel_id required"})
		return
	}

	// ═══ НОВОЕ: проверка членства в группе (удалённый участник не может писать) ═══
	if input.GroupID != nil {
		var isMember int64
		h.DB.Model(&models.GroupMember{}).
			Where("group_id = ? AND user_id = ?", *input.GroupID, userID).
			Count(&isMember)
		if isMember == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not a member of this group"})
			return
		}
	}

	// Разбиваем длинные сообщения на части
	messages := splitMessage(input.Content, MAX_MESSAGE_LENGTH)

	var createdMessages []models.Message

	for _, content := range messages {
		msg := models.Message{
			ConversationID: input.ConversationID,
			GroupID:        input.GroupID,
			ChannelID:      input.ChannelID,
			SenderID:       userID,
			Content:        content,
			ReplyToID:      input.ReplyToID,
			CreatedAt:      time.Now(),
		}

		if err := h.DB.Create(&msg).Error; err != nil {
			log.Printf("❌ Failed to save message: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save message"})
			return
		}

		// Загружаем отправителя
		var sender models.User
		h.DB.First(&sender, userID)

		// WebSocket уведомление
		wsPayload := map[string]interface{}{
			"type": "new_message",
			"payload": map[string]interface{}{
				"id":              msg.ID,
				"conversation_id": msg.ConversationID,
				"group_id":        msg.GroupID,
				"channel_id":      msg.ChannelID,
				"sender_id":       msg.SenderID,
				"sender_username": sender.Username,
				"sender_avatar":   sender.AvatarURL,
				"content":         msg.Content,
				"reply_to_id":     msg.ReplyToID,
				"created_at":      msg.CreatedAt,
			},
		}

		// Отправка через WebSocket
		if msg.ConversationID != nil {
			h.broadcastToConversation(*msg.ConversationID, wsPayload)
		} else if msg.GroupID != nil {
			h.broadcastToGroup(*msg.GroupID, wsPayload)
		} else if msg.ChannelID != nil {
			h.broadcastToChannel(*msg.ChannelID, wsPayload)
		}

		createdMessages = append(createdMessages, msg)
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": createdMessages,
		"count":    len(createdMessages),
	})
}

// Вспомогательная функция для разбиения сообщений
func splitMessage(content string, maxLen int) []string {
	if len(content) <= maxLen {
		return []string{content}
	}

	var messages []string
	runes := []rune(content)

	for i := 0; i < len(runes); i += maxLen {
		end := i + maxLen
		if end > len(runes) {
			end = len(runes)
		}
		messages = append(messages, string(runes[i:end]))
	}

	return messages
}

// 2. Редактирование
func (h *MessageHandler) EditMessage(c *gin.Context) {
	msgID := c.Param("id")
	userID := c.GetUint("user_id")

	var input struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(input.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Content cannot be empty"})
		return
	}

	// ═══ НОВОЕ: жёсткий лимит длины при редактировании ═══
	if utf8.RuneCountInString(input.Content) > MAX_MESSAGE_LENGTH {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Message exceeds %d characters", MAX_MESSAGE_LENGTH),
		})
		return
	}

	var msg models.Message
	if err := h.DB.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	if msg.SenderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your message"})
		return
	}

	h.DB.Model(&msg).Updates(map[string]interface{}{
		"content":   input.Content,
		"is_edited": true,
	})
	msg.Content = input.Content
	msg.IsEdited = true

	// WS Event — рассылка для ЛС, ГРУПП и КАНАЛОВ (раньше было только для ЛС)
	wsPayload := map[string]interface{}{
		"type": "message_updated",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"group_id":        msg.GroupID,
			"channel_id":      msg.ChannelID,
			"content":         input.Content,
			"is_edited":       true,
		},
	}
	switch {
	case msg.ConversationID != nil:
		h.broadcastToConversation(*msg.ConversationID, wsPayload)
	case msg.GroupID != nil:
		h.broadcastToGroup(*msg.GroupID, wsPayload)
	case msg.ChannelID != nil:
		h.broadcastToChannel(*msg.ChannelID, wsPayload)
	}

	c.JSON(http.StatusOK, msg)
}

// 3. Удаление
func (h *MessageHandler) DeleteMessage(c *gin.Context) {
	msgID := c.Param("id")
	userID := c.GetUint("user_id")

	var msg models.Message
	if err := h.DB.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	if msg.SenderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not owner"})
		return
	}

	h.DB.Delete(&msg)

	// WS Event — рассылка для ЛС, ГРУПП и КАНАЛОВ (раньше было только для ЛС)
	wsPayload := map[string]interface{}{
		"type": "message_deleted",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"group_id":        msg.GroupID,
			"channel_id":      msg.ChannelID,
		},
	}
	switch {
	case msg.ConversationID != nil:
		h.broadcastToConversation(*msg.ConversationID, wsPayload)
	case msg.GroupID != nil:
		h.broadcastToGroup(*msg.GroupID, wsPayload)
	case msg.ChannelID != nil:
		h.broadcastToChannel(*msg.ChannelID, wsPayload)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 4. Закрепление (Pin)
func (h *MessageHandler) PinMessage(c *gin.Context) {
	msgID := c.Param("id")
	userID := c.GetUint("user_id")

	var msg models.Message
	if err := h.DB.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	// Переключаем статус закрепления
	newStatus := !msg.IsPinned
	h.DB.Model(&msg).Update("is_pinned", newStatus)

	// ═══ СИНХРОНИЗАЦИЯ с таблицей pinned_messages ═══
	// ChatHeader читает закреплённые через GET /pinned (таблица pinned_messages),
	// а флаг is_pinned живёт в messages. Без этой синхронизации значок в чате
	// есть, а header пишет «Нет закрепленных сообщений».

	// ВАЖНО: Unpin делает soft-delete, а уникальный индекс idx_pinned_message
	// включает soft-deleted строки → повторный Create падал с SQLSTATE 23505.
	// Поэтому ищем через Unscoped и «воскрешаем» запись вместо вставки.
	if newStatus {
		var cnt int64
		h.DB.Unscoped().Model(&models.PinnedMessage{}).
			Where("message_id = ?", msg.ID).Count(&cnt)
		if cnt > 0 {
			h.DB.Unscoped().Model(&models.PinnedMessage{}).
				Where("message_id = ?", msg.ID).
				Updates(map[string]interface{}{
					"deleted_at":        nil,
					"pinned_at":         time.Now(),
					"pinned_by_user_id": userID,
					"conversation_id":   msg.ConversationID,
					"group_id":          msg.GroupID,
					"channel_id":        msg.ChannelID,
				})
		} else {
			h.DB.Create(&models.PinnedMessage{
				MessageID:      msg.ID,
				ConversationID: msg.ConversationID,
				GroupID:        msg.GroupID,
				ChannelID:      msg.ChannelID,
				PinnedByUserID: userID,
				PinnedAt:       time.Now(),
			})
		}
	} else {
		h.DB.Where("message_id = ?", msg.ID).Delete(&models.PinnedMessage{})
	}

	// WS Event
	var recipients []uint
	if msg.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *msg.ConversationID).
			Pluck("user_id", &recipients)
	} else if msg.GroupID != nil {
		h.DB.Table("group_members").
			Where("group_id = ?", *msg.GroupID).
			Pluck("user_id", &recipients)
	} else if msg.ChannelID != nil {
		var channel models.Channel
		h.DB.First(&channel, *msg.ChannelID)
		h.DB.Table("server_members").
			Where("server_id = ?", channel.ServerID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "message_pinned",
		"payload": map[string]interface{}{
			"message_id": msg.ID,
			"is_pinned":  newStatus,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "toggled", "is_pinned": newStatus})
}

// 5. Пересылка
func (h *MessageHandler) ForwardMessage(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		OriginalMessageID uint `json:"original_message_id"`
		TargetChatID      uint `json:"target_chat_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var original models.Message
	if err := h.DB.First(&original, input.OriginalMessageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Original not found"})
		return
	}

	newMsg := models.Message{
		ConversationID: &input.TargetChatID, // Исправлено: берем адрес
		SenderID:       userID,
		Content:        original.Content,
		ForwardedFrom:  &original.SenderID,
		CreatedAt:      time.Now(),
	}
	h.DB.Create(&newMsg)

	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":              newMsg.ID,
			"conversation_id": newMsg.ConversationID,
			"sender_id":       newMsg.SenderID,
			"content":         newMsg.Content,
			"forwarded_from":  newMsg.ForwardedFrom,
			"created_at":      newMsg.CreatedAt,
		},
	}

	if newMsg.ConversationID != nil {
		h.broadcastToConversation(*newMsg.ConversationID, wsPayload)
	}

	c.JSON(http.StatusOK, newMsg)
}

// ИСПРАВЛЕННАЯ версия SendAttachment
func (h *MessageHandler) SendAttachment(c *gin.Context) {
	userID := c.GetUint("user_id")

	convIDStr := c.PostForm("conversation_id")
	groupIDStr := c.PostForm("group_id")     // ДОБАВИТЬ
	channelIDStr := c.PostForm("channel_id") // ДОБАВИТЬ

	// Получаем файл
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}

	// Определяем тип
	contentType := file.Header.Get("Content-Type")
	attachmentType := "file"
	mediaEndpoint := "/upload/file"

	switch {
	case strings.HasPrefix(contentType, "audio/"):
		attachmentType = "audio"
		mediaEndpoint = "/upload/audio"
	case strings.HasPrefix(contentType, "image/"):
		attachmentType = "image"
		mediaEndpoint = "/upload/image"
	case strings.HasPrefix(contentType, "video/"):
		attachmentType = "video"
		mediaEndpoint = "/upload/video"
	}

	// Загружаем файл в media-service
	var b bytes.Buffer
	writer := multipart.NewWriter(&b)

	// Открываем файл
	fileData, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}
	defer fileData.Close()

	// Добавляем файл в multipart
	fw, err := writer.CreateFormFile("file", file.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form"})
		return
	}

	if _, err := io.Copy(fw, fileData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy file"})
		return
	}
	writer.Close()

	// Отправляем в media-service
	token := c.GetHeader("Authorization")
	req, err := http.NewRequest("POST", "http://localhost:8088/api/v1"+mediaEndpoint, &b)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload to media service"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Media service error"})
		return
	}

	// Парсим ответ от media-service
	var uploadResp struct {
		URL      string `json:"url"`
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&uploadResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	// Создаем сообщение с медиа
	msg := models.Message{
		SenderID:       userID,
		AttachmentURL:  uploadResp.URL,
		AttachmentType: attachmentType,
		Content:        file.Filename,
		CreatedAt:      time.Now(),
	}

	// Устанавливаем правильный ID чата
	if convIDStr != "" {
		convID, _ := strconv.ParseUint(convIDStr, 10, 64)
		convIDUint := uint(convID)
		msg.ConversationID = &convIDUint
	} else if groupIDStr != "" {
		groupID, _ := strconv.ParseUint(groupIDStr, 10, 64)
		groupIDUint := uint(groupID)
		msg.GroupID = &groupIDUint
	} else if channelIDStr != "" {
		channelID, _ := strconv.ParseUint(channelIDStr, 10, 64)
		channelIDUint := uint(channelID)
		msg.ChannelID = &channelIDUint
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id, group_id or channel_id required"})
		return
	}

	if err := h.DB.Create(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	// WebSocket уведомление
	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"group_id":        msg.GroupID,
			"channel_id":      msg.ChannelID,
			"sender_id":       msg.SenderID,
			"attachment_url":  msg.AttachmentURL,
			"attachment_type": msg.AttachmentType,
			"content":         msg.Content,
			"created_at":      msg.CreatedAt,
		},
	}

	// Отправляем уведомление в зависимости от типа чата
	if msg.ConversationID != nil {
		h.broadcastToConversation(*msg.ConversationID, wsPayload)
	} else if msg.GroupID != nil {
		h.broadcastToGroup(*msg.GroupID, wsPayload)
	} else if msg.ChannelID != nil {
		h.broadcastToChannel(*msg.ChannelID, wsPayload)
	}

	c.JSON(http.StatusOK, msg)
}

// ДОБАВИТЬ недостающие broadcast методы
func (h *MessageHandler) broadcastToGroup(groupID uint, payload interface{}) {
	data, _ := json.Marshal(payload)
	if h.Hub == nil {
		return
	}
	var userIDs []uint
	h.DB.Table("group_members").
		Where("group_id = ?", groupID).
		Pluck("user_id", &userIDs)

	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: userIDs,
		Data:    data,
	}
}

func (h *MessageHandler) broadcastToChannel(channelID uint, payload interface{}) {
	data, _ := json.Marshal(payload)
	if h.Hub == nil {
		return
	}

	var channel models.Channel
	h.DB.First(&channel, channelID)

	var userIDs []uint
	h.DB.Table("server_members").
		Where("server_id = ?", channel.ServerID).
		Pluck("user_id", &userIDs)

	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: userIDs,
		Data:    data,
	}
}
