// backend/messenger-service/handlers/call_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/ws"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CallHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// InitiateCall - Инициировать звонок
func (h *CallHandler) InitiateCall(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		ConversationID uint            `json:"conversation_id" binding:"required"`
		ReceiverID     uint            `json:"receiver_id" binding:"required"`
		Type           models.CallType `json:"type" binding:"required"`
		OfferSDP       string          `json:"offer_sdp"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверка доступа к беседе
	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", input.ConversationID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Создаем звонок
	call := models.Call{
		ConversationID: input.ConversationID,
		InitiatorID:    userID,
		ReceiverID:     input.ReceiverID,
		Type:           input.Type,
		Status:         models.CallStatusRinging,
		OfferSDP:       input.OfferSDP,
		CreatedAt:      time.Now(),
	}

	if err := h.DB.Create(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call"})
		return
	}

	// Отправляем WebSocket уведомление получателю
	wsPayload := map[string]interface{}{
		"type": "incoming_call",
		"payload": map[string]interface{}{
			"call_id":         call.ID,
			"conversation_id": call.ConversationID,
			"initiator_id":    call.InitiatorID,
			"type":            call.Type,
			"offer_sdp":       call.OfferSDP,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{input.ReceiverID},
		Data:    data,
	}

	c.JSON(http.StatusOK, call)
}

// AnswerCall - Ответить на звонок
func (h *CallHandler) AnswerCall(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	// ИСПРАВЛЕНО: Сделали answer_sdp опциональным
	var input struct {
		AnswerSDP string `json:"answer_sdp"` // Убрали binding:"required"
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	if call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	if call.Status != models.CallStatusRinging {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Call is not in ringing state"})
		return
	}

	now := time.Now()
	call.Status = models.CallStatusActive

	// ИСПРАВЛЕНО: Устанавливаем AnswerSDP только если он передан
	if input.AnswerSDP != "" {
		call.AnswerSDP = input.AnswerSDP
	}

	call.StartedAt = &now

	if err := h.DB.Save(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update call"})
		return
	}

	// Уведомляем инициатора
	wsPayload := map[string]interface{}{
		"type": "call_answered",
		"payload": map[string]interface{}{
			"call_id":     call.ID,
			"answer_sdp":  call.AnswerSDP,
			"receiver_id": call.ReceiverID, // ДОБАВЛЕНО
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{call.InitiatorID},
		Data:    data,
	}

	c.JSON(http.StatusOK, call)
}

// DeclineCall - Отклонить звонок
func (h *CallHandler) DeclineCall(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	if call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	// ИСПРАВЛЕНО: Проверяем, не был ли звонок уже обработан
	if call.Status != models.CallStatusRinging {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Call already processed"})
		return
	}

	now := time.Now()
	call.Status = models.CallStatusDeclined
	call.EndedAt = &now

	if err := h.DB.Save(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update call"})
		return
	}

	// Создаём ОДНО системное сообщение
	h.createCallMessage(call, "declined")

	// ИСПРАВЛЕНО: Уведомляем ОБА пользователя о закрытии модалки
	wsPayload := map[string]interface{}{
		"type": "call_declined",
		"payload": map[string]interface{}{
			"call_id": call.ID,
		},
	}

	data, _ := json.Marshal(wsPayload)

	// Отправляем обоим участникам
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{call.InitiatorID, call.ReceiverID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "declined"})
}

// EndCall - Завершить звонок
func (h *CallHandler) EndCall(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	if call.InitiatorID != userID && call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	// ИСПРАВЛЕНО: Проверяем, не был ли звонок уже завершён
	if call.Status == models.CallStatusEnded || call.Status == models.CallStatusDeclined {
		c.JSON(http.StatusOK, gin.H{"status": "already_ended", "call": call})
		return
	}

	now := time.Now()
	call.Status = models.CallStatusEnded
	call.EndedAt = &now

	// Рассчитываем длительность только если звонок был активен
	if call.StartedAt != nil {
		call.Duration = int(now.Sub(*call.StartedAt).Seconds())
	}

	if err := h.DB.Save(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end call"})
		return
	}

	// ИСПРАВЛЕНО: Создаём сообщение ОДИН раз
	// Если звонок не был принят (StartedAt == nil), это пропущенный звонок
	if call.StartedAt == nil {
		h.createCallMessage(call, "missed")
	} else {
		h.createCallMessage(call, "ended")
	}

	// ИСПРАВЛЕНО: Уведомляем ОБА пользователя
	wsPayload := map[string]interface{}{
		"type": "call_ended",
		"payload": map[string]interface{}{
			"call_id":  call.ID,
			"duration": call.Duration,
		},
	}

	data, _ := json.Marshal(wsPayload)

	// Отправляем обоим участникам
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{call.InitiatorID, call.ReceiverID},
		Data:    data,
	}

	c.JSON(http.StatusOK, call)
}

// ICECandidate - Обмен ICE кандидатами для WebRTC
func (h *CallHandler) ICECandidate(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var input struct {
		Candidate string `json:"candidate" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	if call.InitiatorID != userID && call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	// Отправляем ICE кандидата второму участнику
	notifyUserID := call.ReceiverID
	if userID == call.ReceiverID {
		notifyUserID = call.InitiatorID
	}

	wsPayload := map[string]interface{}{
		"type": "ice_candidate",
		"payload": map[string]interface{}{
			"call_id":   call.ID,
			"candidate": input.Candidate,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{notifyUserID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

// StartScreenShare - Начать демонстрацию экрана
func (h *CallHandler) StartScreenShare(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var input struct {
		StreamID string `json:"stream_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	if call.InitiatorID != userID && call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	screenShare := models.ScreenShare{
		CallID:    call.ID,
		UserID:    userID,
		StreamID:  input.StreamID,
		IsActive:  true,
		StartedAt: time.Now(),
	}

	if err := h.DB.Create(&screenShare).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start screen share"})
		return
	}

	// Уведомляем второго участника
	notifyUserID := call.ReceiverID
	if userID == call.ReceiverID {
		notifyUserID = call.InitiatorID
	}

	wsPayload := map[string]interface{}{
		"type": "screen_share_started",
		"payload": map[string]interface{}{
			"call_id":   call.ID,
			"user_id":   userID,
			"stream_id": input.StreamID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{notifyUserID},
		Data:    data,
	}

	c.JSON(http.StatusOK, screenShare)
}

// StopScreenShare - Остановить демонстрацию экрана
func (h *CallHandler) StopScreenShare(c *gin.Context) {
	userID := c.GetUint("user_id")
	shareID := c.Param("id")

	var screenShare models.ScreenShare
	if err := h.DB.First(&screenShare, shareID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Screen share not found"})
		return
	}

	if screenShare.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your screen share"})
		return
	}

	now := time.Now()
	screenShare.IsActive = false
	screenShare.EndedAt = &now

	if err := h.DB.Save(&screenShare).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop screen share"})
		return
	}

	// Получаем call для уведомления
	var call models.Call
	h.DB.First(&call, screenShare.CallID)

	notifyUserID := call.ReceiverID
	if userID == call.ReceiverID {
		notifyUserID = call.InitiatorID
	}

	wsPayload := map[string]interface{}{
		"type": "screen_share_stopped",
		"payload": map[string]interface{}{
			"call_id": call.ID,
			"user_id": userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{notifyUserID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

// GetCallHistory - История звонков в беседе
func (h *CallHandler) GetCallHistory(c *gin.Context) {
	conversationID := c.Param("id")
	userID := c.GetUint("user_id")

	// Проверка доступа
	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var calls []models.Call
	h.DB.Where("conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(50).
		Find(&calls)

	c.JSON(http.StatusOK, gin.H{"calls": calls})
}

// VoiceSignaling - Обработка WebRTC сигналов (offer, answer, ICE)
func (h *CallHandler) VoiceSignaling(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var input struct {
		TargetID uint   `json:"target_id" binding:"required"`
		Type     string `json:"type" binding:"required"` // offer, answer, ice
		Data     string `json:"data" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var call models.Call
	if err := h.DB.First(&call, callID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Call not found"})
		return
	}

	// Проверка: пользователь должен быть участником звонка
	if call.InitiatorID != userID && call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	// Отправляем сигнал через WebSocket целевому пользователю
	wsPayload := map[string]interface{}{
		"type": "voice_signal",
		"payload": map[string]interface{}{
			"call_id":     call.ID,
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

// createCallMessage - Создаёт ОДНО системное сообщение о звонке
func (h *CallHandler) createCallMessage(call models.Call, messageType string) {
	// ИСПРАВЛЕНО: Правильная проверка существования сообщения для PostgreSQL
	var existingCount int64
	h.DB.Model(&models.Message{}).
		Where("is_system_message = ? AND system_type = ? AND system_data::text LIKE ?",
			true, "call", "%\"call_id\":"+fmt.Sprint(call.ID)+"%").
		Count(&existingCount)

	if existingCount > 0 {
		log.Printf("⚠️ Call message already exists for call_id: %d", call.ID)
		return
	}

	var content string
	systemData := map[string]interface{}{
		"call_id":   call.ID,
		"type":      call.Type,
		"initiator": call.InitiatorID,
		"receiver":  call.ReceiverID,
	}

	switch messageType {
	case "missed":
		content = "Пропущенный звонок"
		systemData["status"] = "missed"
	case "declined":
		content = "Звонок отклонён"
		systemData["status"] = "declined"
	case "ended":
		content = fmt.Sprintf("Звонок завершён (%s)", formatDuration(call.Duration))
		systemData["status"] = "ended"
		systemData["duration"] = call.Duration
	}

	systemDataJSON, _ := json.Marshal(systemData)
	systemDataStr := string(systemDataJSON)

	message := models.Message{
		ConversationID:  &call.ConversationID,
		SenderID:        call.InitiatorID,
		Content:         content,
		IsSystemMessage: true,
		SystemType:      "call",
		SystemData:      &systemDataStr, // ИСПРАВЛЕНО: Используем указатель
		CreatedAt:       time.Now(),
	}

	if err := h.DB.Create(&message).Error; err != nil {
		log.Printf("❌ Failed to create call message: %v", err)
		return
	}

	log.Printf("✅ Call message created: %s (ID: %d, Call ID: %d)", content, message.ID, call.ID)

	// Отправляем сообщение через WebSocket ОБОИМ участникам
	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":                message.ID,
			"conversation_id":   message.ConversationID,
			"sender_id":         message.SenderID,
			"content":           message.Content,
			"is_system_message": true,
			"system_type":       message.SystemType,
			"system_data":       message.SystemData,
			"created_at":        message.CreatedAt,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{call.InitiatorID, call.ReceiverID},
		Data:    data,
	}
}

// formatDuration - Красивое форматирование длительности звонка
func formatDuration(seconds int) string {
	if seconds == 0 {
		return "0 сек"
	}

	if seconds < 60 {
		return fmt.Sprintf("%d сек", seconds)
	}

	minutes := seconds / 60
	secs := seconds % 60

	if minutes < 60 {
		if secs == 0 {
			if minutes == 1 {
				return "1 мин"
			}
			return fmt.Sprintf("%d мин", minutes)
		}
		if minutes == 1 {
			return fmt.Sprintf("1 мин %d сек", secs)
		}
		return fmt.Sprintf("%d мин %d сек", minutes, secs)
	}

	hours := minutes / 60
	mins := minutes % 60

	if mins == 0 && secs == 0 {
		if hours == 1 {
			return "1 час"
		}
		return fmt.Sprintf("%d час", hours)
	}

	if hours == 1 {
		if mins == 0 {
			return fmt.Sprintf("1 час %d сек", secs)
		}
		return fmt.Sprintf("1 час %d мин", mins)
	}

	if mins == 0 {
		return fmt.Sprintf("%d час %d сек", hours, secs)
	}

	return fmt.Sprintf("%d час %d мин", hours, mins)
}
