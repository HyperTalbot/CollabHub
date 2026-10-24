// backend/messenger-service/handlers/conversation_handler.go
package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ConversationHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// Структура специально для JSON ответа списка чатов
type ConversationResponse struct {
	ID           uint          `json:"id"`
	Type         string        `json:"type"` // "dm" или "group"
	Name         string        `json:"name"` // Для групп
	AvatarURL    string        `json:"avatar_url"`
	Participants []models.User `json:"participants"`

	LastMessageContent  string    `json:"last_message_content"`
	LastMessageAt       time.Time `json:"last_message_at"`
	LastMessageSenderID uint      `json:"last_message_sender_id"`
	UnreadCount         int       `json:"unread_count"`
}

func (h *ConversationHandler) ensureUserExists(userID uint) {
	var count int64
	h.DB.Model(&models.User{}).Where("id = ?", userID).Count(&count)
	if count == 0 {
		username := utils.GetUsernameByID(userID)
		h.DB.Create(&models.User{ID: userID, Username: username})
	}
}

// StartChat - Создать/Найти ЛС
func (h *ConversationHandler) StartChat(c *gin.Context) {
	var input struct {
		TargetUserID uint `json:"target_user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	myUserID := c.GetUint("user_id")

	// ДОБАВИТЬ: Проверка блокировки
	var blockCount int64
	h.DB.Model(&models.UserBlock{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
			myUserID, input.TargetUserID, input.TargetUserID, myUserID).
		Count(&blockCount)

	if blockCount > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot start chat with blocked user"})
		return
	}

	h.ensureUserExists(myUserID)
	h.ensureUserExists(input.TargetUserID)

	// Ищем существующий
	var existingConv models.Conversation
	query := `
 SELECT c.* FROM conversations c
 JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
 JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
 WHERE cp1.user_id = ? AND cp2.user_id = ?
 LIMIT 1`

	if h.DB.Raw(query, myUserID, input.TargetUserID).Scan(&existingConv).RowsAffected > 0 {
		c.JSON(http.StatusOK, existingConv)
		return
	}

	// Создаем новый (Type больше не нужен)
	tx := h.DB.Begin()
	newConv := models.Conversation{}
	if err := tx.Create(&newConv).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "DB error"})
		return
	}

	// Добавляем участников через raw SQL или ассоциации, если настроены
	// Здесь для простоты пример через gorm association, но у нас m2m
	if err := tx.Exec("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)", newConv.ID, myUserID, newConv.ID, input.TargetUserID).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to add participants"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, newConv)
}

// GetConversations - Получить список ЛС
func (h *ConversationHandler) GetConversations(c *gin.Context) {
	userID := c.GetUint("user_id")
	var convs []models.Conversation

	// Загружаем чаты
	err := h.DB.Model(&models.Conversation{}).
		Joins("JOIN conversation_participants cp ON cp.conversation_id = conversations.id").
		Where("cp.user_id = ?", userID).
		Find(&convs).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fetch failed"})
		return
	}

	var response []ConversationResponse

	for _, conv := range convs {
		// Ищем последнее сообщение
		var lastMsg models.Message
		h.DB.Where("conversation_id = ?", conv.ID).Order("created_at DESC").Limit(1).Find(&lastMsg)

		// ИСПРАВЛЕНО: Загружаем ID участников
		var participantIDs []uint
		h.DB.Table("conversation_participants").
			Where("conversation_id = ?", conv.ID).
			Pluck("user_id", &participantIDs)

		// КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Загружаем данные через auth-service
		participants := []models.User{}
		for _, pid := range participantIDs {
			// ИСПРАВЛЕНИЕ: Сначала проверяем локальную БД
			var user models.User
			result := h.DB.First(&user, pid)

			if result.Error != nil || user.Username == "" {
				// Только если нет в БД - запрашиваем auth-service
				userInfo := utils.GetUserByID(pid)
				user = models.User{
					ID:        userInfo.ID,
					Username:  userInfo.Username,
					AvatarURL: userInfo.AvatarURL,
				}

				// ВАЖНО: Используем FirstOrCreate вместо Save
				h.DB.Where(models.User{ID: pid}).
					Assign(models.User{Username: user.Username, AvatarURL: user.AvatarURL}).
					FirstOrCreate(&user)
			}

			participants = append(participants, user)
		}

		dto := ConversationResponse{
			ID:           conv.ID,
			Type:         "dm",
			Participants: participants,
			UnreadCount:  0,
		}

		// ═══ НЕПРОЧИТАННЫЕ: сообщения после last_read_message_id текущего юзера ═══
		var cp models.ConversationParticipant
		h.DB.Where("conversation_id = ? AND user_id = ?", conv.ID, userID).First(&cp)

		var unread int64
		unreadQ := h.DB.Model(&models.Message{}).
			Where("conversation_id = ? AND sender_id <> ?", conv.ID, userID)
		if cp.LastReadMessageID > 0 {
			unreadQ = unreadQ.Where("id > ?", cp.LastReadMessageID)
		}
		unreadQ.Count(&unread)
		dto.UnreadCount = int(unread)

		if lastMsg.ID != 0 {
			dto.LastMessageContent = lastMsg.Content
			dto.LastMessageAt = lastMsg.CreatedAt
			dto.LastMessageSenderID = lastMsg.SenderID
		} else {
			dto.LastMessageAt = conv.CreatedAt
		}

		response = append(response, dto)
	}

	c.JSON(http.StatusOK, response)
}

// GetConversationByID - Получить данные конкретной беседы
func (h *ConversationHandler) GetConversationByID(c *gin.Context) {
	conversationID := c.Param("id")
	userID := c.GetUint("user_id")

	// Проверяем доступ пользователя к этой беседе
	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Получаем беседу с участниками
	var conversation models.Conversation
	if err := h.DB.Preload("Participants").First(&conversation, conversationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	c.JSON(http.StatusOK, conversation)
}

// GetMessages - Получить сообщения ЛС
func (h *ConversationHandler) GetMessages(c *gin.Context) {
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

	var messages []models.Message
	query := h.DB.Preload("Sender").Where("conversation_id = ?", conversationID)

	// Пагинация "вверх": фронт присылает before_id самого старого загруженного сообщения
	if beforeID := c.Query("before_id"); beforeID != "" {
		query = query.Where("id < ?", beforeID)
	}

	// Берём последние 50 (desc), затем разворачиваем в asc для фронта
	query.Order("created_at desc").Limit(50).Find(&messages)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	// Обогащение: sender_username, sender_avatar, reply_preview, forwarded_from_name
	enrichMessages(h.DB, messages)

	// ═══ СТАТУСЫ ПРОЧТЕНИЯ (✓ / ✓✓): last_read СОБЕСЕДНИКА ═══
	var minRead uint
	row := h.DB.Table("conversation_participants").
		Select("COALESCE(MIN(last_read_message_id), 0)").
		Where("conversation_id = ? AND user_id <> ?", conversationID, userID).
		Row()
	_ = row.Scan(&minRead)
	for i := range messages {
		messages[i].IsReadByRecipient = minRead > 0 && messages[i].ID <= minRead
	}

	// ═══ last_read_message_id — фронт рисует разделитель «Новые сообщения» ═══
	var cp models.ConversationParticipant
	h.DB.Where("conversation_id = ? AND user_id = ?", conversationID, userID).First(&cp)

	c.JSON(http.StatusOK, gin.H{
		"messages":             messages,
		"last_read_message_id": cp.LastReadMessageID,
	})
}

// с точностью до сообщения (только «вперёд»)
func (h *ConversationHandler) MarkConversationAsRead(c *gin.Context) {
	// 1. БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ID
	// Вместо ручного приведения интерфейса используем встроенный метод Gin
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conversationID := c.Param("id")

	// НОВОЕ: опциональный message_id — «прочитано ДО этого сообщения включительно».
	// Тело может отсутствовать — это не ошибка.
	var input struct {
		MessageID uint `json:"message_id"`
	}
	_ = c.ShouldBindJSON(&input)

	targetID := input.MessageID
	if targetID > 0 {
		// сообщение должно принадлежать этому чату
		var cnt int64
		h.DB.Model(&models.Message{}).
			Where("id = ? AND conversation_id = ?", targetID, conversationID).
			Count(&cnt)
		if cnt == 0 {
			targetID = 0
		}
	}

	if targetID == 0 {
		var lastMsgs []models.Message
		h.DB.Where("conversation_id = ?", conversationID).
			Order("created_at desc").Limit(1).Find(&lastMsgs)
		if len(lastMsgs) == 0 {
			c.JSON(http.StatusOK, gin.H{"status": "no messages to mark"})
			return
		}
		targetID = lastMsgs[0].ID
	}

	// Только «вперёд» — не откатываем last_read назад
	var cp models.ConversationParticipant
	if err := h.DB.Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		First(&cp).Error; err == nil && targetID <= cp.LastReadMessageID {
		c.JSON(http.StatusOK, gin.H{"status": "already read", "last_read_message_id": cp.LastReadMessageID})
		return
	}

	if err := h.DB.Model(&models.ConversationParticipant{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Update("last_read_message_id", targetID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update read status"})
		return
	}

	// ═══ НОВОЕ: уведомляем собеседника, чтобы у отправителя галочка
	// ✓ сменилась на ✓✓ в реальном времени ═══
	if h.Hub != nil {
		convIDNum, _ := strconv.ParseUint(conversationID, 10, 32)
		var partnerIDs []uint
		h.DB.Table("conversation_participants").
			Where("conversation_id = ? AND user_id <> ?", convIDNum, userID).
			Pluck("user_id", &partnerIDs)
		if len(partnerIDs) > 0 {
			payload, _ := json.Marshal(map[string]interface{}{
				"type": "messages_read",
				"payload": map[string]interface{}{
					"conversation_id":      convIDNum,
					"reader_id":            userID,
					"last_read_message_id": targetID,
				},
			})
			for _, pid := range partnerIDs {
				h.Hub.SendToUser(pid, payload)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":               "updated",
		"last_read_message_id": targetID,
	})
}

// 	// 2. Находим последнее сообщение
// 	var lastMsgs []models.Message
// 	// Используем Find + Limit(1) вместо First.
// 	// Find возвращает пустой список, а не ошибку, если записей нет.
// 	result := h.DB.Where("conversation_id = ?", conversationID).
// 		Order("created_at desc").
// 		Limit(1).
// 		Find(&lastMsgs)

// 	if result.Error != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
// 		return
// 	}

// 	// Если сообщений нет (новый чат), просто выходим с успехом
// 	if len(lastMsgs) == 0 {
// 		c.JSON(http.StatusOK, gin.H{"status": "no messages to mark"})
// 		return
// 	}

// 	lastMsg := lastMsgs[0]

// 	// 3. Обновляем запись участника
// 	if err := h.DB.Model(&models.ConversationParticipant{}).
// 		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
// 		Update("last_read_message_id", lastMsg.ID).Error; err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update read status"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{
// 		"status":               "updated",
// 		"last_read_message_id": lastMsg.ID,
// 	})
// }
