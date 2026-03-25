// backend/video-service/handlers/subscription_handler.go
package handlers

import (
	"backend/video-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SubscriptionHandler struct {
	DB *gorm.DB
}

// Subscribe - Подписаться на канал
func (h *SubscriptionHandler) Subscribe(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channelId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	subscriberID := c.GetUint("user_id")

	// Нельзя подписаться на себя
	if subscriberID == uint(channelID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot subscribe to yourself"})
		return
	}

	// Проверяем существует ли уже подписка
	var existing []models.Subscription
	h.DB.Where("subscriber_id = ? AND channel_id = ?", subscriberID, channelID).Limit(1).Find(&existing)

	if len(existing) > 0 {
		// Уже подписан - отписываемся
		h.DB.Delete(&existing[0])
		c.JSON(http.StatusOK, gin.H{"subscribed": false, "message": "Unsubscribed"})
		return
	}

	// Создаем подписку
	subscription := models.Subscription{
		SubscriberID: subscriberID,
		ChannelID:    uint(channelID),
	}

	if err := h.DB.Create(&subscription).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subscribed": true, "message": "Subscribed"})
}

// GetSubscriptionStatus - Проверить статус подписки
func (h *SubscriptionHandler) GetSubscriptionStatus(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channelId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	subscriberID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusOK, gin.H{"subscribed": false})
		return
	}

	var subscriptions []models.Subscription
	h.DB.Where("subscriber_id = ? AND channel_id = ?", subscriberID, channelID).Limit(1).Find(&subscriptions)

	c.JSON(http.StatusOK, gin.H{"subscribed": len(subscriptions) > 0})
}

// GetSubscriberCount - Получить количество подписчиков канала
func (h *SubscriptionHandler) GetSubscriberCount(c *gin.Context) {
	channelID, err := strconv.ParseUint(c.Param("channelId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid channel ID"})
		return
	}

	var count int64
	h.DB.Model(&models.Subscription{}).Where("channel_id = ?", channelID).Count(&count)

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// GetUserSubscriptions - Получить список подписок пользователя
func (h *SubscriptionHandler) GetUserSubscriptions(c *gin.Context) {
	subscriberID := c.GetUint("user_id")

	var subscriptions []models.Subscription

	if err := h.DB.Where("subscriber_id = ?", subscriberID).Find(&subscriptions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscriptions"})
		return
	}

	// Получаем ID каналов
	channelIDs := make([]uint, len(subscriptions))
	for i, sub := range subscriptions {
		channelIDs[i] = sub.ChannelID
	}

	c.JSON(http.StatusOK, gin.H{"channel_ids": channelIDs})
}
