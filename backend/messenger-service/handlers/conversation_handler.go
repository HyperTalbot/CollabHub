package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ConversationHandler struct {
	DB *gorm.DB
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
	var user models.User

	// Пытаемся найти пользователя по ID
	if err := h.DB.First(&user, userID).Error; err != nil {
		// Если ошибка (скорее всего RecordNotFound), значит юзера нет
		// 1. Получаем его актуальное имя из auth-service
		username := utils.GetUsernameByID(userID)

		// 2. Создаем заглушку пользователя в БД мессенджера
		// Важно: Мы принудительно ставим ID
		newUser := models.User{
			ID:       userID,
			Username: username,
		}
		// Используем Clauses для игнорирования конфликтов (на случай гонки запросов)
		// Если GORM v2 (обычно так):
		h.DB.Create(&newUser)
		// Или если есть риск дублей, можно использовать FirstOrCreate, но Create обычно достаточно здесь
	}
}

// StartChat - Создает новый чат или возвращает существующий
func (h *ConversationHandler) StartChat(c *gin.Context) {
	var input StartChatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Безопасное получение UserID из контекста
	userID_interface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	// Приведение типов (как мы делали раньше для безопасности)
	var myUserID uint
	if val, ok := userID_interface.(uint); ok {
		myUserID = val
	} else if val, ok := userID_interface.(float64); ok {
		myUserID = uint(val)
	}

	if myUserID == input.TargetUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot chat with yourself"})
		return
	}

	// === ИСПРАВЛЕНИЕ: СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ===
	// Перед тем как ссылаться на пользователей, убеждаемся, что они есть в таблице users
	h.ensureUserExists(myUserID)
	h.ensureUserExists(input.TargetUserID)
	// ===============================================

	// 1. Проверяем, существует ли уже чат
	var conversation models.Conversation
	query := `
		SELECT c.* FROM conversations c
		JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
		JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
		WHERE cp1.user_id = ? AND cp2.user_id = ?
		LIMIT 1`

	result := h.DB.Raw(query, myUserID, input.TargetUserID).Scan(&conversation)

	if result.RowsAffected > 0 {
		c.JSON(http.StatusOK, conversation)
		return
	}

	// 2. Если чата нет, создаем новый
	newConversation := models.Conversation{}

	tx := h.DB.Begin()

	if err := tx.Create(&newConversation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	// Вручную добавляем участников
	participant1 := models.ConversationParticipant{
		ConversationID: newConversation.ID,
		UserID:         myUserID,
	}
	participant2 := models.ConversationParticipant{
		ConversationID: newConversation.ID,
		UserID:         input.TargetUserID,
	}

	if err := tx.Create(&participant1).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participant 1"})
		return
	}
	if err := tx.Create(&participant2).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participant 2"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, newConversation)
}

// GetMyConversations - возвращает список всех чатов пользователя
func (h *ConversationHandler) GetMyConversations(c *gin.Context) {
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	var conversations []models.Conversation

	// Загружаем чаты, где пользователь является участником + последнее сообщение
	// GORM позволяет сделать Preload с условием
	// Preload("Participants") загрузит инфо о собеседнике
	// Preload("Messages") можно ограничить последним сообщением, но пока загрузим все (для простоты)
	// В реальном приложении тут нужна оптимизация.
	err := h.DB.Joins("JOIN conversation_participants cp ON cp.conversation_id = conversations.id").
		Where("cp.user_id = ?", myUserID).
		Preload("Participants").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(1) // Берем только 1 последнее
		}).
		Order("updated_at desc").
		Find(&conversations).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch conversation"})
		return
	}

	var response []ConversationResponse

	// ВАЖНО: Нам нужно будет обогатить Participants именами (Username) через auth-service,
	// так как здесь у нас только ID. Но пока вернем как есть.
	// ОБОГАЩЕНИЕ ДАННЫХ: Заполняем Username для каждого участника
	for i := range conversations {
		for j := range conversations[i].Participants {
			// Получаем имя из auth-service
			username := utils.GetUsernameByID(conversations[i].Participants[j].ID)
			conversations[i].Participants[j].Username = username
		}

		respItem := ConversationResponse{
			Conversation: conversations[i],
			UnreadCount:  0, // Пока 0, логику прочитанности добавим позже (нужна доп. таблица)
		}

		// === НОВАЯ ЛОГИКА ПОДСЧЕТА ===
		// 1. Узнаем, какой ID сообщения был прочитан последним этим пользователем
		var participant models.ConversationParticipant
		h.DB.Where("conversation_id = ? AND user_id = ?", conversations[i].ID, myUserID).First(&participant)

		// 2. Считаем количество сообщений, которые новее (ID больше), чем LastReadMessageID
		var count int64
		h.DB.Model(&models.Message{}).
			Where("conversation_id = ? AND id > ?", conversations[i].ID, participant.LastReadMessageID).
			Count(&count)

		respItem.UnreadCount = int(count)

		// Если сообщения есть
		if len(conversations[i].Messages) > 0 {
			respItem.LastMessagesContent = conversations[i].Messages[0].Content
			respItem.LastMessagesAt = conversations[i].Messages[0].CreatedAt
			respItem.LastMessageSenderID = conversations[i].Messages[0].SenderID

			// ВАЖНО: Мы должны вернуть ID отправителя последнего сообщения,
			// чтобы фронтенд знал, "вы" это написали или нет.
		}

		response = append(response, respItem)
	}

	c.JSON(http.StatusOK, response)
}

// GetMessages - Получает историю сообщений для конкретного чата
// Загружает последние 50 сообщений (пагинация)
func (h *ConversationHandler) GetMessages(c *gin.Context) {
	conversationID := c.Param("id")
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// Читаем параметр before_id (для пагинации)
	beforeIDStr := c.Query("before_id")

	// Проверка доступа (входит ли пользователь в этот чат) - Опустим для краткости
	// но в продакшене  обязательно нужно проверять conversation_participants!

	var messages []models.Message
	// Загружаем сообщения, сортируем от старых к новым
	query := h.DB.Where("conversation_id = ?", conversationID).
		Order("created_at desc"). // Сначала новые
		Limit(50)                 // Только 50 штук

	// Если передан before_id, добавляем условие "ID меньше чем..."
	if beforeIDStr != "" {
		query = query.Where("id < ?", beforeIDStr)
	}

	if err := query.Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	// Разворачиваем слайс (Reverse), чтобы фронтенд получил их в хронологическом порядке (старые -> новые)
	// В Go нет встроенного reverse для слайсов, пишем простой цикл
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	var participant models.ConversationParticipant
	h.DB.Where("conversation_id = ? AND user_id = ?", conversationID, myUserID).First(&participant)

	c.JSON(http.StatusOK, MessagesResponse{
		Messages:          messages,
		LastReadMessageID: participant.LastReadMessageID,
	})
}

func (h *ConversationHandler) MarkConversationAsRead(c *gin.Context) {
	conversationID := c.Param("id")
	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	// ИСПОЛЬЗУЕМ СЛАЙС ВМЕСТО ОДИНОЧНОЙ СТРУКТУРЫ
	var messages []models.Message

	// Используем Find вместо First.
	// Find НЕ возвращает ошибку, если записей нет, он просто вернет пустой список.
	err := h.DB.Where("conversation_id = ?", conversationID).
		Order("id desc").
		Limit(1).
		Find(&messages).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch last message"})
		return
	}

	// ПРОВЕРКА: Если список пуст, значит сообщений в чате нет
	if len(messages) == 0 {
		// Это нормальная ситуация для нового чата.
		// Просто говорим "ОК", так как обновлять нечего.
		c.JSON(http.StatusOK, gin.H{"status": "chat is empty"})
		return
	}

	lastMessage := messages[0]

	// Обновляем запись в conversation_participants
	err = h.DB.Model(&models.ConversationParticipant{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, myUserID).
		Update("last_read_message_id", lastMessage.ID).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "read", "last_read_id": lastMessage.ID})
}

// CreateGroup - Создает групповой чат
func (h *ConversationHandler) CreateGroup(c *gin.Context) {
	var input CreateGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID_interface, _ := c.Get("userID")
	myUserID := userID_interface.(uint)

	h.ensureUserExists(myUserID)

	tx := h.DB.Begin()

	// 1. Создаем Conversation
	newGroup := models.Conversation{
		Type:      models.ConversationTypeGroup,
		Name:      input.Name,
		AvatarURL: input.AvatarURL,
		OwnerID:   myUserID,
	}

	if err := tx.Create(&newGroup).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create group"})
		return
	}

	// 2. Добавляем участников (Владельца + список из input)
	participants := []models.ConversationParticipant{
		{ConversationID: newGroup.ID, UserID: myUserID},
	}

	// Убеждаемся, что все участники существуют, и добавляем их
	uniqueIDs := make(map[uint]bool)
	uniqueIDs[myUserID] = true // Себя уже добавили

	for _, pID := range input.ParticipantIDs {
		if pID != myUserID && !uniqueIDs[pID] { // Не добавляем себя дважды и дубликаты
			h.ensureUserExists(pID)
			participants = append(participants, models.ConversationParticipant{
				ConversationID: newGroup.ID,
				UserID:         pID,
			})
			uniqueIDs[pID] = true
		}
	}

	if err := tx.Create(&participants).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participants"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, newGroup)
}
