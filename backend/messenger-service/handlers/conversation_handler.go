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

// StartChat - создает новый чат или возвращает существующий
func (h *ConversationHandler) StartChat(c *gin.Context) {
	var input StartChatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Безопасное извлечение
	userID_interface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Безопасное приведение типов
	myUserID, ok := userID_interface.(uint)
	if !ok {
		// На случай, если в контексте лежит float64 (иногда бывает при парсинге JSON)
		if val, ok := userID_interface.(float64); ok {
			myUserID = uint(val)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID format error"})
			return
		}
	}

	if myUserID == input.TargetUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot chat with yourself"})
		return
	}

	// Проверяем, существует ли уже чат между этими двумя (сложный SQL запрос)
	// Ищем чат, где есть оба участника
	var conversation models.Conversation

	// Этот запрос ищет conversation_id, который имеет записи в conversation_participants
	// и для myUserID, и для targerUserID
	query := `SELECT c.* FROM conversations c
		JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
		JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
		WHERE cp1.user_id = ? AND cp2.user_id = ?
		LIMIT 1
  	`

	result := h.DB.Raw(query, myUserID, input.TargetUserID).Scan(&conversation)

	if result.RowsAffected > 0 {
		// Чат уже есть, возвращаем его ID
		c.JSON(http.StatusOK, conversation)
		return
	}

	// Если чата нет, создаем новый
	// Примечание: Мы создаем "заглушки" User только с ID, чтобы заполнить связующую таблицу.
	// В реальном проекте GORM сам разберется с foreign keys.
	newConversation := models.Conversation{} // Пока пустая

	// Начинаем транзакцию
	tx := h.DB.Begin()

	if err := tx.Create(&newConversation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	// Вручную добавляем участников в связующую таблицу
	// GORM по умолчанию называет её conversation_participants
	// Структура: conversation_id, user_id

	participant1 := map[string]interface{}{
		"conversation_id": newConversation.ID,
		"user_id":         myUserID,
	}
	participant2 := map[string]interface{}{
		"conversation_id": newConversation.ID,
		"user_id":         input.TargetUserID,
	}

	if err := tx.Table("conversation_participants").Create(&participant1).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participant 1"})
		return
	}
	if err := tx.Table("conversation_participants").Create(&participant2).Error; err != nil {
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

	// Проверка доступа (входит ли пользователь в этот чат) - Опустим для краткости
	// но в продакшене  обязательно нужно проверять conversation_participants!

	var messages []models.Message
	// Загружаем сообщения, сортируем от старых к новым
	if err := h.DB.Where("conversation_id = ?", conversationID).
		Order("created_at desc"). // Сначала новые
		Limit(50).                // Только 50 штук
		Find(&messages).Error; err != nil {
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

	// Находим последнее сообщение в этом чате (чтобы обновить курсор до максимума)
	var lastMessage models.Message
	if err := h.DB.Where("conversation_id = ?", conversationID).Order("id desc").First(&lastMessage).Error; err != nil {
		// Если сообщений нет, нечего читать
		c.JSON(http.StatusOK, gin.H{"status": "nothing to read"})
		return
	}

	// Обновляем запись в conversation_participants
	// Устанавливаем LastReadMessageID = ID последнего сообщения
	err := h.DB.Model(&models.ConversationParticipant{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, myUserID).
		Update("last_read_message_id", lastMessage.ID).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "read", "last_read_id": lastMessage.ID})
}
