package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/ws"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MessageHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// Вспомогательная функция для рассылки через REST-методы
func (h *MessageHandler) broadcastToConversation(convID uint, payload interface{}) {
	// 1. Сериализуем данные
	data, _ := json.Marshal(payload)

	if h.Hub == nil {
		log.Println("[WARN] Hub is nil, skip broadcast")
		return
	}

	// 2. Находим участников чата
	var userIDs []uint
	h.DB.Table("conversation_participants").
		Where("conversation_id = ?", convID).
		Pluck("user_id", &userIDs)

	// 3. Отправляем в Hub
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: userIDs,
		Data:    data,
	}
}

// 1. Отправка сообщения
func (h *MessageHandler) SendMessage(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID uint   `json:"conversation_id"`
		Content        string `json:"content"`
		ReplyToID      *uint  `json:"reply_to_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := models.Message{
		ConversationID: input.ConversationID,
		SenderID:       userID,
		Content:        input.Content,
		ReplyToID:      input.ReplyToID,
		CreatedAt:      time.Now(),
	}

	if err := h.DB.Create(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	// Отправляем WS уведомление
	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"sender_id":       msg.SenderID,
			"content":         msg.Content,
			"reply_to_id":     msg.ReplyToID,
			"created_at":      msg.CreatedAt,
		},
	}
	h.broadcastToConversation(msg.ConversationID, wsPayload)

	c.JSON(http.StatusOK, msg)
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

	// WS Event
	h.broadcastToConversation(msg.ConversationID, map[string]interface{}{
		"type": "message_updated",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"content":         input.Content,
			"is_edited":       true,
		},
	})

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

	convID := msg.ConversationID // Сохраняем ID перед удалением
	h.DB.Delete(&msg)

	// WS Event
	h.broadcastToConversation(convID, map[string]interface{}{
		"type": "message_deleted",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": convID,
		},
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 4. Закрепление (Pin)
func (h *MessageHandler) PinMessage(c *gin.Context) {
	msgID := c.Param("id")

	var msg models.Message
	if err := h.DB.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	newStatus := !msg.IsPinned
	h.DB.Model(&msg).Update("is_pinned", newStatus)

	// WS Event
	h.broadcastToConversation(msg.ConversationID, map[string]interface{}{
		"type": "message_pinned",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"is_pinned":       newStatus,
		},
	})

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
		ConversationID: input.TargetChatID,
		SenderID:       userID,
		Content:        original.Content,
		ForwardedFrom:  &original.SenderID,
		CreatedAt:      time.Now(),
	}
	h.DB.Create(&newMsg)

	// WS Event для целевого чата
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
	h.broadcastToConversation(newMsg.ConversationID, wsPayload)

	c.JSON(http.StatusOK, newMsg)
}

func (h *MessageHandler) SendAttachment(c *gin.Context) {
	userID := c.GetUint("user_id")

	convIDStr := c.PostForm("conversation_id")
	if convIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation_id required"})
		return
	}

	conversationID, err := strconv.ParseUint(convIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation_id"})
		return
	}

	// Получаем файл
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}

	// Определяем тип
	contentType := file.Header.Get("Content-Type")
	attachmentType := "file"

	switch {
	case strings.HasPrefix(contentType, "audio/"):
		attachmentType = "audio"
	case strings.HasPrefix(contentType, "image/"):
		attachmentType = "image"
	case strings.HasPrefix(contentType, "video/"):
		attachmentType = "video"
	}

	// Папка
	uploadDir := "uploads"
	_ = os.MkdirAll(uploadDir, 0755)

	filename := fmt.Sprintf(
		"%d_%d_%s",
		time.Now().Unix(),
		userID,
		file.Filename,
	)
	path := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	// Создаем сообщение
	msg := models.Message{
		ConversationID: uint(conversationID),
		SenderID:       userID,
		AttachmentURL:  path,
		AttachmentType: attachmentType,
		CreatedAt:      time.Now(),
	}

	if err := h.DB.Create(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	// WS payload
	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":              msg.ID,
			"conversation_id": msg.ConversationID,
			"sender_id":       msg.SenderID,
			"attachment_url":  msg.AttachmentURL,
			"attachment_type": msg.AttachmentType,
			"created_at":      msg.CreatedAt,
		},
	}

	h.broadcastToConversation(msg.ConversationID, wsPayload)

	c.JSON(http.StatusOK, msg)
}
