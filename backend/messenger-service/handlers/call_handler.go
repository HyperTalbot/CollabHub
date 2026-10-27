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

// Пороги "протухания" звонков
const (
	// ringing дольше этого = клиент умер, не вызвав /end
	staleRingingAfter = 60 * time.Second
	// active дольше этого = явно осиротевшая запись
	staleActiveAfter = 12 * time.Hour
)

type CallHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// expireStaleCalls - автоматически закрывает "зависшие" звонки,
// которые блокировали создание новых (причина вашего 409).
func (h *CallHandler) expireStaleCalls(userID uint) {
	now := time.Now()

	var stale []models.Call
	h.DB.Where(
		"(status = ? AND created_at < ?) OR (status = ? AND created_at < ?)",
		models.CallStatusRinging, now.Add(-staleRingingAfter),
		models.CallStatusActive, now.Add(-staleActiveAfter),
	).
		Where("initiator_id = ? OR receiver_id = ?", userID, userID).
		Find(&stale)

	for i := range stale {
		call := stale[i]

		wasActive := call.Status == models.CallStatusActive
		call.Status = models.CallStatusEnded
		call.EndedAt = &now
		if call.StartedAt != nil {
			call.Duration = int(now.Sub(*call.StartedAt).Seconds())
		}

		if err := h.DB.Save(&call).Error; err != nil {
			log.Printf("⚠️ Failed to expire stale call %d: %v", call.ID, err)
			continue
		}

		log.Printf("🧹 Expired stale call id=%d (was %s)", call.ID,
			map[bool]string{true: "active", false: "ringing"}[wasActive])

		// Системное сообщение в чат, чтобы история не "зависала"
		if call.StartedAt == nil {
			h.createCallMessage(call, "missed")
		} else {
			h.createCallMessage(call, "ended")
		}

		// Сообщаем обоим, чтобы закрыть зависшие модалки
		wsPayload := map[string]interface{}{
			"type": "call_ended",
			"payload": map[string]interface{}{
				"call_id":  call.ID,
				"duration": call.Duration,
				"reason":   "expired",
			},
		}
		data, _ := json.Marshal(wsPayload)
		h.Hub.Broadcast <- ws.BroadcastMessage{
			UserIDs: []uint{call.InitiatorID, call.ReceiverID},
			Data:    data,
		}
	}
}

// endActiveCallsInConversation — завершает все незавершённые звонки в беседе
// (ringing/active) и уведомляет участников через WebSocket. Используется при
// повторном вызове: новый звонок в той же беседе закрывает старый, чтобы
// пользователь никогда не упирался в 409 из-за "зависшего" звонка.
func (h *CallHandler) endActiveCallsInConversation(conversationID, endedBy uint) {
	now := time.Now()

	var existing []models.Call
	h.DB.Where("conversation_id = ? AND status IN ?", conversationID,
		[]models.CallStatus{models.CallStatusRinging, models.CallStatusActive}).
		Find(&existing)

	for i := range existing {
		call := existing[i]
		wasActive := call.Status == models.CallStatusActive

		call.Status = models.CallStatusEnded
		call.EndedAt = &now
		if call.StartedAt != nil {
			call.Duration = int(now.Sub(*call.StartedAt).Seconds())
		}

		if err := h.DB.Save(&call).Error; err != nil {
			log.Printf("⚠️ Failed to close previous call %d: %v", call.ID, err)
			continue
		}

		log.Printf("🔄 Closed previous call %d (was %s) in conversation %d by user %d",
			call.ID,
			map[bool]string{true: "active", false: "ringing"}[wasActive],
			conversationID, endedBy)

		// Системное сообщение в чат (missed/ended)
		if call.StartedAt == nil {
			h.createCallMessage(call, "missed")
		} else {
			h.createCallMessage(call, "ended")
		}

		// Закрываем зависшие модалки у обоих участников
		wsPayload := map[string]interface{}{
			"type": "call_ended",
			"payload": map[string]interface{}{
				"call_id":  call.ID,
				"duration": call.Duration,
				"ended_by": endedBy,
				"reason":   "superseded",
			},
		}
		data, _ := json.Marshal(wsPayload)
		h.Hub.Broadcast <- ws.BroadcastMessage{
			UserIDs: []uint{call.InitiatorID, call.ReceiverID},
			Data:    data,
		}
	}
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

	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", input.ConversationID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Не даём звонить самому себе
	if input.ReceiverID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Нельзя позвонить самому себе"})
		return
	}

	// ═══ ШАГ 1: чистим "зависшие" звонки этого пользователя ═══
	h.expireStaleCalls(userID)

	// ═══ ШАГ 2: повторный вызов в этой беседе закрывает старый ═══
	// Раньше здесь был 409 — и если старый звонок "зависал" (клиент умер,
	// не вызвав /end), пользователь навсегда терял возможность звонить.
	// Теперь старый ringing/active автоматически завершается, участники
	// получают call_ended, а новый звонок создаётся без ошибки.
	h.endActiveCallsInConversation(input.ConversationID, userID)

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
		log.Printf("❌ Failed to create call: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create call"})
		return
	}

	// Данные инициатора — имя в тосте и в модалке принимающего
	var initiator struct {
		Username  string `json:"username"`
		AvatarURL string `json:"avatar_url"`
	}
	h.DB.Table("users").Select("username, avatar_url").Where("id = ?", userID).Scan(&initiator)

	receiverOnline := h.Hub.IsUserOnline(input.ReceiverID)
	if !receiverOnline {
		log.Printf("⚠️ Receiver %d OFFLINE — call %d will ring out", input.ReceiverID, call.ID)
	}

	wsPayload := map[string]interface{}{
		"type": "incoming_call",
		"payload": map[string]interface{}{
			"call_id":          call.ID,
			"conversation_id":  call.ConversationID,
			"initiator_id":     call.InitiatorID,
			"initiator_name":   initiator.Username,
			"initiator_avatar": initiator.AvatarURL,
			"type":             call.Type,
			"offer_sdp":        call.OfferSDP,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{input.ReceiverID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{
		"id":              call.ID,
		"conversation_id": call.ConversationID,
		"initiator_id":    call.InitiatorID,
		"receiver_id":     call.ReceiverID,
		"type":            call.Type,
		"status":          call.Status,
		"receiver_online": receiverOnline,
		"created_at":      call.CreatedAt,
	})
}

// AnswerCall - Ответить на звонок
func (h *CallHandler) AnswerCall(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var input struct {
		AnswerSDP string `json:"answer_sdp"`
	}

	// Тело опциональное: фронтенд шлёт {}, ответный SDP придёт через /signal
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("ℹ️ AnswerCall: пустое тело (%v) — продолжаем без SDP", err)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Звонок уже завершён или отклонён"})
		return
	}

	now := time.Now()
	call.Status = models.CallStatusActive
	if input.AnswerSDP != "" {
		call.AnswerSDP = input.AnswerSDP
	}
	call.StartedAt = &now

	if err := h.DB.Save(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update call"})
		return
	}

	// Триггер для инициатора создать offer (убирает гонку)
	wsPayload := map[string]interface{}{
		"type": "call_answered",
		"payload": map[string]interface{}{
			"call_id":     call.ID,
			"from_id":     call.ReceiverID,
			"receiver_id": call.ReceiverID,
			"answer_sdp":  call.AnswerSDP,
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

	h.createCallMessage(call, "declined")

	wsPayload := map[string]interface{}{
		"type": "call_declined",
		"payload": map[string]interface{}{
			"call_id": call.ID,
		},
	}

	data, _ := json.Marshal(wsPayload)
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

	if call.Status == models.CallStatusEnded || call.Status == models.CallStatusDeclined {
		// Идемпотентно: второй участник тоже жмёт "завершить"
		c.JSON(http.StatusOK, gin.H{"status": "already_ended", "call": call})
		return
	}

	now := time.Now()
	call.Status = models.CallStatusEnded
	call.EndedAt = &now

	if call.StartedAt != nil {
		call.Duration = int(now.Sub(*call.StartedAt).Seconds())
	}

	if err := h.DB.Save(&call).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to end call"})
		return
	}

	if call.StartedAt == nil {
		h.createCallMessage(call, "missed")
	} else {
		h.createCallMessage(call, "ended")
	}

	wsPayload := map[string]interface{}{
		"type": "call_ended",
		"payload": map[string]interface{}{
			"call_id":  call.ID,
			"duration": call.Duration,
			"ended_by": userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{call.InitiatorID, call.ReceiverID},
		Data:    data,
	}

	c.JSON(http.StatusOK, call)
}

// ICECandidate - обмен ICE-кандидатами (legacy)
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

	notifyUserID := call.ReceiverID
	if userID == call.ReceiverID {
		notifyUserID = call.InitiatorID
	}

	wsPayload := map[string]interface{}{
		"type": "ice_candidate",
		"payload": map[string]interface{}{
			"call_id":     call.ID,
			"from_id":     userID,
			"signal_type": "ice",
			"data":        input.Candidate,
			"candidate":   input.Candidate,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{notifyUserID},
		Data:    data,
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

// VoiceSignaling - основной канал WebRTC-сигнализации (offer / answer / ice)
func (h *CallHandler) VoiceSignaling(c *gin.Context) {
	userID := c.GetUint("user_id")
	callID := c.Param("id")

	var input struct {
		TargetID uint   `json:"target_id" binding:"required"`
		Type     string `json:"type" binding:"required"`
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

	if call.InitiatorID != userID && call.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your call"})
		return
	}

	// Адресат — строго второй участник звонка (защита от подмены target_id)
	target := call.ReceiverID
	if userID == call.ReceiverID {
		target = call.InitiatorID
	}

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
		UserIDs: []uint{target},
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

// createCallMessage - создаёт ОДНО системное сообщение о звонке
func (h *CallHandler) createCallMessage(call models.Call, messageType string) {
	var existingCount int64
	h.DB.Model(&models.Message{}).
		Where("is_system_message = ? AND system_type = ? AND system_data::text LIKE ?",
			true, "call", "%\"call_id\":"+fmt.Sprint(call.ID)+"%").
		Count(&existingCount)

	if existingCount > 0 {
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
		SystemData:      &systemDataStr,
		CreatedAt:       time.Now(),
	}

	if err := h.DB.Create(&message).Error; err != nil {
		log.Printf("❌ Failed to create call message: %v", err)
		return
	}

	log.Printf("✅ Call message created: %s (call_id: %d)", content, call.ID)

	var sender models.User
	h.DB.Table("users").Select("username, avatar_url").Where("id = ?", call.InitiatorID).Scan(&sender)

	wsPayload := map[string]interface{}{
		"type": "new_message",
		"payload": map[string]interface{}{
			"id":                message.ID,
			"conversation_id":   message.ConversationID,
			"sender_id":         message.SenderID,
			"sender_username":   sender.Username,
			"sender_avatar":     sender.AvatarURL,
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
