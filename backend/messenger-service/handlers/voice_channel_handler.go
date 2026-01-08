// /backend/messenger-service/handlers/voice_channel_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/ws"
	"encoding/json" // ДОБАВИТЬ для parseUint
	"net/http"
	"strconv" // ДОБАВИТЬ

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VoiceChannelHandler struct {
	DB         *gorm.DB
	Hub        *ws.Hub
	VoiceState *ws.VoiceState
}

// JoinVoiceChannel - Присоединиться к голосовому каналу
func (h *VoiceChannelHandler) JoinVoiceChannel(c *gin.Context) {
	userID := c.GetUint("user_id")
	channelID := c.Param("id")

	var input struct {
		StreamID string `json:"stream_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем, что канал существует и это голосовой канал
	var channel models.Channel
	if err := h.DB.First(&channel, channelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}

	if channel.Type != models.ChannelTypeVoice {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not a voice channel"})
		return
	}

	// Проверяем доступ к серверу
	var count int64
	h.DB.Table("server_members").
		Where("server_id = ? AND user_id = ?", channel.ServerID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Парсим channelID в uint
	channelIDUint, err := strconv.ParseUint(channelID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	h.VoiceState.Join(uint(channelIDUint), userID)

	// Получаем список всех участников канала
	participants := h.VoiceState.GetUsers(uint(channelIDUint))

	// Уведомляем всех участников о новом пользователе
	wsPayload := map[string]interface{}{
		"type": "user_joined_voice",
		"payload": map[string]interface{}{
			"channel_id": channelIDUint,
			"user_id":    userID,
			"stream_id":  input.StreamID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: participants,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "joined",
		"participants": participants,
	})
}

// LeaveVoiceChannel - Покинуть голосовой канал
func (h *VoiceChannelHandler) LeaveVoiceChannel(c *gin.Context) {
	userID := c.GetUint("user_id")
	channelID := c.Param("id")

	channelIDUint, err := strconv.ParseUint(channelID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	// Получаем участников ДО выхода
	participants := h.VoiceState.GetUsers(uint(channelIDUint))

	// Убираем из VoiceState
	h.VoiceState.Leave(uint(channelIDUint), userID)

	// Уведомляем оставшихся участников
	wsPayload := map[string]interface{}{
		"type": "user_left_voice",
		"payload": map[string]interface{}{
			"channel_id": channelIDUint,
			"user_id":    userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: participants,
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "left"})
}

// GetVoiceChannelParticipants - Получить участников голосового канала
func (h *VoiceChannelHandler) GetVoiceChannelParticipants(c *gin.Context) {
	channelID := c.Param("id")

	channelIDUint, err := strconv.ParseUint(channelID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	participants := h.VoiceState.GetUsers(uint(channelIDUint))

	c.JSON(http.StatusOK, gin.H{
		"channel_id":   channelIDUint,
		"participants": participants,
	})
}

// VoiceSignaling - Обработка WebRTC сигналов
func (h *VoiceChannelHandler) VoiceSignaling(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ChannelID uint   `json:"channel_id" binding:"required"`
		TargetID  uint   `json:"target_id" binding:"required"`
		Type      string `json:"type" binding:"required"` // offer, answer, ice
		Data      string `json:"data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем, что оба пользователя в канале
	users := h.VoiceState.GetUsers(input.ChannelID)
	userInChannel := false
	targetInChannel := false

	for _, uid := range users {
		if uid == userID {
			userInChannel = true
		}
		if uid == input.TargetID {
			targetInChannel = true
		}
	}

	if !userInChannel || !targetInChannel {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Users not in the same voice channel"})
		return
	}

	// Отправляем сигнал целевому пользователю
	wsPayload := map[string]interface{}{
		"type": "voice_signal",
		"payload": map[string]interface{}{
			"channel_id":  input.ChannelID,
			"from_id":     userID,
			"signal_type": input.Type,
			"data":        input.Data,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{input.TargetID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}
