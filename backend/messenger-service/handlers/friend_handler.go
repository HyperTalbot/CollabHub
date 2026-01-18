// backend/messenger-service/handlers/friend_handler.go

package handlers

import (
	"backend/messenger-service/models"
	"backend/messenger-service/utils"
	"backend/messenger-service/ws"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FriendHandler struct {
	DB  *gorm.DB
	Hub *ws.Hub
}

// // SearchUsers - Поиск пользователей по username или display_name
// func (h *FriendHandler) SearchUsers(c *gin.Context) {
// 	query := c.Query("q")
// 	currentUserID := c.GetUint("user_id")

// 	if query == "" || len(query) < 2 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Query too short (min 2 chars)"})
// 		return
// 	}

// 	// Поиск через auth-service
// 	users := utils.SearchUsers(query)

// 	// Фильтруем текущего пользователя и добавляем статусы дружбы
// 	var results []map[string]interface{}
// 	for _, user := range users {
// 		if user.ID != currentUserID {
// 			friendStatus := h.getFriendshipStatus(currentUserID, user.ID)

// 			results = append(results, map[string]interface{}{
// 				"id":                user.ID,
// 				"username":          user.Username,
// 				"display_name":      user.DisplayName,
// 				"avatar_url":        user.AvatarURL,
// 				"friendship_status": friendStatus,
// 			})
// 		}
// 	}

// 	c.JSON(http.StatusOK, gin.H{
// 		"query":   query,
// 		"results": results,
// 		"count":   len(results),
// 	})
// }

// SendFriendRequest - Отправить запрос в друзья
func (h *FriendHandler) SendFriendRequest(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input struct {
		FriendID uint `json:"friend_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if userID == input.FriendID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot add yourself"})
		return
	}

	// Проверяем, нет ли уже запроса
	var existing models.Friendship
	result := h.DB.Where(
		"(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, input.FriendID, input.FriendID, userID,
	).First(&existing)

	if result.Error == nil {
		if existing.Status == models.FriendshipAccepted {
			c.JSON(http.StatusConflict, gin.H{"error": "Already friends"})
			return
		}
		if existing.Status == models.FriendshipPending {
			c.JSON(http.StatusConflict, gin.H{"error": "Request already sent"})
			return
		}
	}

	// Создаём запрос
	friendship := models.Friendship{
		UserID:    userID,
		FriendID:  input.FriendID,
		Status:    models.FriendshipPending,
		CreatedAt: time.Now(),
	}

	if err := h.DB.Create(&friendship).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
		return
	}

	// Загружаем данные отправителя
	sender := utils.GetUserByID(userID)
	// WebSocket уведомление получателю
	wsPayload := map[string]interface{}{
		"type": "friend_request",
		"payload": map[string]interface{}{
			"friendship_id": friendship.ID,
			"from_user_id":  userID,
			"from_username": sender.Username,
			"from_avatar":   sender.AvatarURL,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{input.FriendID},
		Data:    data,
	}

	c.JSON(http.StatusOK, friendship)
}

// AcceptFriendRequest - Принять запрос в друзья
func (h *FriendHandler) AcceptFriendRequest(c *gin.Context) {
	userID := c.GetUint("user_id")
	friendshipID := c.Param("id")

	var friendship models.Friendship
	if err := h.DB.First(&friendship, friendshipID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	// Проверяем, что запрос адресован текущему пользователю
	if friendship.FriendID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your request"})
		return
	}

	if friendship.Status != models.FriendshipPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request already processed"})
		return
	}

	// Принимаем запрос
	friendship.Status = models.FriendshipAccepted
	h.DB.Save(&friendship)

	// Уведомляем отправителя
	wsPayload := map[string]interface{}{
		"type": "friend_request_accepted",
		"payload": map[string]interface{}{
			"friendship_id": friendship.ID,
			"user_id":       userID,
		},
	}

	data, _ := json.Marshal(wsPayload)
	h.Hub.Broadcast <- ws.BroadcastMessage{
		UserIDs: []uint{friendship.UserID},
		Data:    data,
	}

	c.JSON(http.StatusOK, friendship)
}

// RejectFriendRequest - Отклонить запрос в друзья
func (h *FriendHandler) RejectFriendRequest(c *gin.Context) {
	userID := c.GetUint("user_id")
	friendshipID := c.Param("id")

	var friendship models.Friendship
	if err := h.DB.First(&friendship, friendshipID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if friendship.FriendID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not your request"})
		return
	}

	// Удаляем запрос
	h.DB.Delete(&friendship)

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

// RemoveFriend - Удалить из друзей
func (h *FriendHandler) RemoveFriend(c *gin.Context) {
	userID := c.GetUint("user_id")
	friendID := c.Param("friend_id")

	var friendship models.Friendship
	result := h.DB.Where(
		"((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = ?",
		userID, friendID, friendID, userID, models.FriendshipAccepted,
	).First(&friendship)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Friendship not found"})
		return
	}

	h.DB.Delete(&friendship)

	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

// GetFriends - Получить список друзей
func (h *FriendHandler) GetFriends(c *gin.Context) {
	userID := c.GetUint("user_id")

	var friendships []models.Friendship
	h.DB.Where(
		"(user_id = ? OR friend_id = ?) AND status = ?",
		userID, userID, models.FriendshipAccepted,
	).Find(&friendships)

	// Формируем список друзей
	friendIDs := make([]uint, 0)
	for _, f := range friendships {
		if f.UserID == userID {
			friendIDs = append(friendIDs, f.FriendID)
		} else {
			friendIDs = append(friendIDs, f.UserID)
		}
	}

	// Загружаем данные друзей из auth-service
	var friends []map[string]interface{}
	for _, friendID := range friendIDs {
		friendData := utils.GetUserByID(friendID)

		friends = append(friends, map[string]interface{}{
			"id":           friendData.ID,
			"username":     friendData.Username,
			"display_name": friendData.DisplayName,
			"avatar_url":   friendData.AvatarURL,
			"status":       "online", // TODO: Реальный статус
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"friends": friends,
		"count":   len(friends),
	})
}

// GetFriendRequests - Получить входящие запросы в друзья
func (h *FriendHandler) GetFriendRequests(c *gin.Context) {
	userID := c.GetUint("user_id")

	var friendships []models.Friendship
	h.DB.Where("friend_id = ? AND status = ?", userID, models.FriendshipPending).
		Order("created_at DESC").
		Find(&friendships)

	// Загружаем данные отправителей
	var requests []map[string]interface{}
	for _, f := range friendships {
		userData := utils.GetUserByID(f.UserID)

		requests = append(requests, map[string]interface{}{
			"friendship_id": f.ID,
			"user_id":       userData.ID,
			"username":      userData.Username,
			"display_name":  userData.DisplayName,
			"avatar_url":    userData.AvatarURL,
			"created_at":    f.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"requests": requests,
		"count":    len(requests),
	})
}

// backend/messenger-service/handlers/friend_handler.go

// getFriendshipStatus - Вспомогательная функция для проверки статуса дружбы
func (h *FriendHandler) getFriendshipStatus(userID, friendID uint) string {
	var friendship models.Friendship

	// ИСПРАВЛЕНО: используем Take вместо First (не логирует record not found)
	err := h.DB.Where(
		"(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, friendID, friendID, userID,
	).Take(&friendship).Error

	// Если запись не найдена - это нормально
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "none"
		}
		// Логируем только реальные ошибки
		fmt.Printf("⚠️ Database error in getFriendshipStatus: %v\n", err)
		return "none"
	}

	// Проверяем статус
	switch friendship.Status {
	case models.FriendshipAccepted:
		return "friends"
	case models.FriendshipPending:
		if friendship.UserID == userID {
			return "request_sent"
		}
		return "request_received"
	default:
		return "none"
	}
}
