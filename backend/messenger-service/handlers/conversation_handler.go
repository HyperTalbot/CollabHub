package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ConversationHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

type StartChatInput struct {
	TargetUserID uint `json:"target_user_id" binding:"required"`
}

// Структура для ответа (чтобы добавить поле LastMessage)
type ConversationResponse struct {
	models.Conversation
	LastMessagesContent string    `json:"last_message_content"`
	LastMessagesAt      time.Time `json:"last_messages_at"`
	LastMessageSenderID uint      `json:"last_message_sender_id"`
	UnreadCount         int       `json:"unread_count"` // Заглушка для будущего
}

type MessagesResponse struct {
	Messages          []models.Message `json:"messages"`
	LastReadMessageID uint             `json:"last_read_message_id"`
}

type CreateGroupInput struct {
	Name           string `json:"name" binding:"required"`
	AvatarURL      string `json:"avatar_url"`
	ParticipantIDs []uint `json:"participant_ids" binding:"required"` // Список ID участников
}

// Вспомогательная функция: Проверяет, есть ли юзер в локальной БД, если нет - создает
func (h *ConversationHandler) ensureUserExists(userID uint) {
	var count int64
	h.DB.Model(&models.User{}).Where("id = ?", userID).Count(&count)
	if count == 0 {
		// Если юзера нет в локальной базе мессенджера, создаем заглушку
		username := utils.GetUsernameByID(userID) // Предполагаем, что эта утилита ходит в Auth Service
		h.DB.Create(&models.User{ID: userID, Username: username})
	}
}

// StartChat - Создает новый чат или возвращает существующий
func (h *ConversationHandler) StartChat(c *gin.Context) {
	var input struct {
		TargetUserID uint `json:"target_user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	myUserID := c.GetUint("user_id")

	if myUserID == input.TargetUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Self chat not allowed"})
		return
	}

	h.ensureUserExists(myUserID)
	h.ensureUserExists(input.TargetUserID)

	// Проверка существования
	var existingConv models.Conversation
	// SQL для поиска общего приватного чата
	query := `
  SELECT c.* FROM conversations c
  JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
  JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
  WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.type = 'dm'
  LIMIT 1`

	if h.DB.Raw(query, myUserID, input.TargetUserID).Scan(&existingConv).RowsAffected > 0 {
		c.JSON(http.StatusOK, existingConv)
		return
	}

	// Создаем новый
	tx := h.DB.Begin()
	newConv := models.Conversation{Type: "dm"} // DM = Личный
	if err := tx.Create(&newConv).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "DB error"})
		return
	}

	participants := []models.ConversationParticipant{
		{ConversationID: newConv.ID, UserID: myUserID},
		{ConversationID: newConv.ID, UserID: input.TargetUserID},
	}
	if err := tx.Create(&participants).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "DB error"})
		return
	}
	tx.Commit()

	c.JSON(http.StatusCreated, newConv)
}

// GetMyConversations - возвращает список всех чатов пользователя
// func (h *ConversationHandler) GetMyConversations(c *gin.Context) {
// 	userID_interface, _ := c.Get("userID")
// 	myUserID := userID_interface.(uint)

// 	var conversations []models.Conversation

// 	// Загружаем чаты, где пользователь является участником + последнее сообщение
// 	// GORM позволяет сделать Preload с условием
// 	// Preload("Participants") загрузит инфо о собеседнике
// 	// Preload("Messages") можно ограничить последним сообщением, но пока загрузим все (для простоты)
// 	// В реальном приложении тут нужна оптимизация.
// 	err := h.DB.Joins("JOIN conversation_participants cp ON cp.conversation_id = conversations.id").
// 		Where("cp.user_id = ?", myUserID).
// 		Preload("Participants").
// 		Preload("Messages", func(db *gorm.DB) *gorm.DB {
// 			return db.Order("created_at DESC").Limit(1) // Берем только 1 последнее
// 		}).
// 		Order("updated_at desc").
// 		Find(&conversations).Error

// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch conversation"})
// 		return
// 	}

// 	var response []ConversationResponse

// 	// ВАЖНО: Нам нужно будет обогатить Participants именами (Username) через auth-service,
// 	// так как здесь у нас только ID. Но пока вернем как есть.
// 	// ОБОГАЩЕНИЕ ДАННЫХ: Заполняем Username для каждого участника
// 	for i := range conversations {
// 		for j := range conversations[i].Participants {
// 			// Получаем имя из auth-service
// 			username := utils.GetUsernameByID(conversations[i].Participants[j].ID)
// 			conversations[i].Participants[j].Username = username
// 		}

// 		respItem := ConversationResponse{
// 			Conversation: conversations[i],
// 			UnreadCount:  0, // Пока 0, логику прочитанности добавим позже (нужна доп. таблица)
// 		}

// 		// === НОВАЯ ЛОГИКА ПОДСЧЕТА ===
// 		// 1. Узнаем, какой ID сообщения был прочитан последним этим пользователем
// 		var participant models.ConversationParticipant
// 		h.DB.Where("conversation_id = ? AND user_id = ?", conversations[i].ID, myUserID).First(&participant)

// 		// 2. Считаем количество сообщений, которые новее (ID больше), чем LastReadMessageID
// 		var count int64
// 		h.DB.Model(&models.Message{}).
// 			Where("conversation_id = ? AND id > ?", conversations[i].ID, participant.LastReadMessageID).
// 			Count(&count)

// 		respItem.UnreadCount = int(count)

// 		// Если сообщения есть
// 		if len(conversations[i].Messages) > 0 {
// 			respItem.LastMessagesContent = conversations[i].Messages[0].Content
// 			respItem.LastMessagesAt = conversations[i].Messages[0].CreatedAt
// 			respItem.LastMessageSenderID = conversations[i].Messages[0].SenderID

// 			// ВАЖНО: Мы должны вернуть ID отправителя последнего сообщения,
// 			// чтобы фронтенд знал, "вы" это написали или нет.
// 		}

// 		response = append(response, respItem)
// 	}

// 	c.JSON(http.StatusOK, response)
// }

// GetMessages - Получает историю сообщений для конкретного чата
// Загружает последние 50 сообщений (пагинация)
func (h *ConversationHandler) GetMessages(c *gin.Context) {
	conversationID := c.Param("id")
	userID := c.GetUint("user_id") // Получаем ID текущего юзера

	// 1. Проверяем, является ли пользователь участником этого чата (Безопасность)
	var count int64
	h.DB.Table("conversation_participants").
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Count(&count)

	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// 2. Загружаем сообщения с данными отправителя
	var messages []models.Message

	// Preload("Sender") загружает структуру User внутри Message.
	// Убедитесь, что в models/message.go есть поле: Sender User gorm:"foreignKey:SenderID"
	result := h.DB.Preload("Sender").
		Where("conversation_id = ?", conversationID).
		Order("created_at asc"). // Сортировка от старых к новым
		Find(&messages)

	if result.Error != nil {
		// Логируем ошибку в консоль сервера, чтобы видеть причину
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// GetConversations (Объединил логику GetMy и Get)
func (h *ConversationHandler) GetConversations(c *gin.Context) {
	userID := c.GetUint("user_id")

	var convs []models.Conversation

	// Загружаем чаты + участников
	err := h.DB.Model(&models.Conversation{}).
		Joins("JOIN conversation_participants cp ON cp.conversation_id = conversations.id").
		Where("cp.user_id = ?", userID).
		Preload("Participants").
		Find(&convs).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fetch failed"})
		return
	}

	// Обогащаем данными о последнем сообщении
	// В идеале это делается сложным SQL запросом, но цикл проще для понимания и поддержки сейчас
	for i := range convs {
		var lastMsg models.Message
		// Берем последнее сообщение
		h.DB.Where("conversation_id = ?", convs[i].ID).Order("created_at DESC").Last(1).Find(&lastMsg)

		if lastMsg.ID != 0 {
			convs[i].LastMessageContent = lastMsg.Content
			convs[i].LastMessageAt = lastMsg.CreatedAt
			convs[i].LastMessageSenderID = lastMsg.SenderID // <--- ЭТО ВАЖНО ДЛЯ "ВЫ:"
		} else {
			convs[i].LastMessageAt = convs[i].CreatedAt
		}

		// Обновляем имена участников (на случай если они поменялись)
		for j := range convs[i].Participants {
			// Тут можно поставить кэширование, чтобы не бомбить auth-service
			if convs[i].Participants[j].Username == "" {
				convs[i].Participants[j].Username = utils.GetUsernameByID(convs[i].Participants[j].ID)
			}
		}
	}

	// Сортировка по времени (Новые сверху) уже на бэкенде
	// Хотя фронт тоже сортирует, бэкенд должен отдавать готовое
	// (тут пропустим реализацию sort.Slice для краткости, фронт справится)

	c.JSON(http.StatusOK, convs)
}

func (h *ConversationHandler) MarkConversationAsRead(c *gin.Context) {
	// 1. БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ID
	// Вместо ручного приведения интерфейса используем встроенный метод Gin
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conversationID := c.Param("id")

	// 2. Находим последнее сообщение
	var lastMsgs []models.Message
	// Используем Find + Limit(1) вместо First.
	// Find возвращает пустой список, а не ошибку, если записей нет.
	result := h.DB.Where("conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(1).
		Find(&lastMsgs)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Если сообщений нет (новый чат), просто выходим с успехом
	if len(lastMsgs) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "no messages to mark"})
		return
	}

	lastMsg := lastMsgs[0]

	// 3. Обновляем запись участника
	if err := h.DB.Model(&models.ConversationParticipant{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Update("last_read_message_id", lastMsg.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update read status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":               "updated",
		"last_read_message_id": lastMsg.ID,
	})
}

// CreateGroup - Создает групповой чат и уведомляет участников
func (h *ConversationHandler) CreateGroup(c *gin.Context) {
	var input CreateGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetUint("user_id") // ID создателя
	h.ensureUserExists(userID)

	tx := h.DB.Begin()

	// 1. Создаем Conversation
	newGroup := models.Conversation{
		Type:      models.ConversationTypeGroup,
		Name:      input.Name,
		AvatarURL: input.AvatarURL, // Теперь сохраняем аватарку
		OwnerID:   userID,
		CreatedAt: time.Now(),
	}

	if err := tx.Create(&newGroup).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group"})
		return
	}

	// 2. Формируем список уникальных участников (включая создателя)
	participantsMap := make(map[uint]bool)
	participantsMap[userID] = true

	for _, pid := range input.ParticipantIDs {
		h.ensureUserExists(pid)
		participantsMap[pid] = true
	}

	var participants []models.ConversationParticipant
	for pid := range participantsMap {
		participants = append(participants, models.ConversationParticipant{
			ConversationID: newGroup.ID,
			UserID:         pid,
			JoinedAt:       time.Now(),
		})
	}

	if err := tx.Create(&participants).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participants"})
		return
	}

	tx.Commit()

	// 3. ОТПРАВКА УВЕДОМЛЕНИЙ (WebSocket)
	var fullGroup models.Conversation
	h.DB.Preload("Participants").First(&fullGroup, newGroup.ID)

	// Формируем payload для сокетов
	wsData, _ := json.Marshal(map[string]interface{}{
		"type":    "new_conversation",
		"payload": fullGroup,
	})

	// Собираем ID всех участников для рассылки
	var userIDs []uint
	for pid := range participantsMap {
		userIDs = append(userIDs, pid)
	}

	// Отправляем через Hub (убедитесь, что Hub добавлен в структуру ConversationHandler!)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: userIDs,
		Data:    wsData,
	}

	c.JSON(http.StatusCreated, fullGroup)
}

// UpdateGroup - Обновить группу (Имя/Аватар)
func (h *ConversationHandler) UpdateGroup(c *gin.Context) {
	id := c.Param("id")
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	var input struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var conv models.Conversation
	if err := h.DB.First(&conv, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conversation not found"})
		return
	}

	// Проверяем: это группа?
	if conv.Type != models.ConversationTypeGroup {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot update DM chat"})
		return
	}

	// Проверяем права (Владелец)
	if conv.OwnerID != myUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can update group info"})
		return
	}

	if input.Name != "" {
		conv.Name = input.Name
	}
	if input.AvatarURL != "" {
		conv.AvatarURL = input.AvatarURL
	}

	h.DB.Save(&conv)
	c.JSON(http.StatusOK, conv)
}
