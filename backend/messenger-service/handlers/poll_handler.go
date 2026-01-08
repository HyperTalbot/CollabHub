// backend/messenger-service/handlers/poll_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/ws"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PollHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// CreatePoll - Создать опрос
func (h *PollHandler) CreatePoll(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID *uint    `json:"conversation_id"`
		ChannelID      *uint    `json:"channel_id"`
		GroupID        *uint    `json:"group_id"`
		Question       string   `json:"question" binding:"required"`
		Options        []string `json:"options" binding:"required,min=2,max=10"`
		MultipleChoice bool     `json:"multiple_choice"`
		ExpiresIn      int      `json:"expires_in"` // в секундах
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Создаем сообщение с опросом
	msg := models.Message{
		ConversationID: input.ConversationID,
		ChannelID:      input.ChannelID,
		GroupID:        input.GroupID,
		SenderID:       userID,
		Content:        "📊 " + input.Question,
		CreatedAt:      time.Now(),
	}

	if err := h.DB.Create(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create message"})
		return
	}

	// Создаем опрос
	poll := models.Poll{
		MessageID:      msg.ID,
		Question:       input.Question,
		CreatedBy:      userID,
		MultipleChoice: input.MultipleChoice,
		CreatedAt:      time.Now(),
	}

	if input.ExpiresIn > 0 {
		expiresAt := time.Now().Add(time.Duration(input.ExpiresIn) * time.Second)
		poll.ExpiresAt = &expiresAt
	}

	if err := h.DB.Create(&poll).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create poll"})
		return
	}

	// Создаем варианты ответа
	for _, optText := range input.Options {
		option := models.PollOption{
			PollID: poll.ID,
			Text:   optText,
		}
		h.DB.Create(&option)
	}

	// Загружаем опрос с вариантами
	h.DB.Preload("Options").First(&poll, poll.ID)

	// Обновляем сообщение
	msg.PollID = &poll.ID
	h.DB.Save(&msg)

	// WebSocket уведомление
	var recipients []uint
	if input.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *input.ConversationID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "new_poll",
		"payload": map[string]interface{}{
			"message_id": msg.ID,
			"poll":       poll,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{
		"message": msg,
		"poll":    poll,
	})
}

// VoteInPoll - Проголосовать в опросе
func (h *PollHandler) VoteInPoll(c *gin.Context) {
	userID := c.GetUint("user_id")
	pollID := c.Param("poll_id")

	var input struct {
		OptionIDs []uint `json:"option_ids" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем опрос
	var poll models.Poll
	if err := h.DB.First(&poll, pollID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	// Проверяем срок действия
	if poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "Poll expired"})
		return
	}

	// Проверяем множественный выбор
	if !poll.MultipleChoice && len(input.OptionIDs) > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only single choice allowed"})
		return
	}

	// Удаляем старые голоса пользователя
	h.DB.Where("poll_id = ? AND user_id = ?", pollID, userID).
		Delete(&models.PollVote{})

	// Добавляем новые голоса
	for _, optionID := range input.OptionIDs {
		vote := models.PollVote{
			PollID:    poll.ID,
			OptionID:  optionID,
			UserID:    userID,
			CreatedAt: time.Now(),
		}
		h.DB.Create(&vote)
	}

	// Получаем обновленные результаты
	results := h.getPollResults(poll.ID)

	// WebSocket уведомление
	var msg models.Message
	h.DB.Where("poll_id = ?", pollID).First(&msg)

	var recipients []uint
	if msg.ConversationID != nil {
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", *msg.ConversationID).
			Pluck("user_id", &recipients)
	}

	wsPayload := map[string]interface{}{
		"type": "poll_updated",
		"payload": map[string]interface{}{
			"poll_id": poll.ID,
			"results": results,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: recipients,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "voted",
		"results": results,
	})
}

// GetPollResults - Получить результаты опроса
func (h *PollHandler) GetPollResults(c *gin.Context) {
	pollID := c.Param("poll_id")

	results := h.getPollResults(parseUintParam(pollID))

	c.JSON(http.StatusOK, gin.H{"results": results})
}

func (h *PollHandler) getPollResults(pollID uint) map[uint]interface{} {
	var options []models.PollOption
	h.DB.Where("poll_id = ?", pollID).Find(&options)

	results := make(map[uint]interface{})

	for _, opt := range options {
		var votes []models.PollVote
		h.DB.Where("option_id = ?", opt.ID).Preload("User").Find(&votes)

		voters := make([]uint, len(votes))
		for i, v := range votes {
			voters[i] = v.UserID
		}

		results[opt.ID] = map[string]interface{}{
			"text":       opt.Text,
			"vote_count": len(votes),
			"voters":     voters,
		}
	}

	return results
}

// ИСПРАВЛЕННАЯ функция parseUintParam
func parseUintParam(s string) uint {
	val, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0
	}
	return uint(val)
}
