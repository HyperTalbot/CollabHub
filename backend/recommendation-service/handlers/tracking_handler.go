// backend/recommendation-service/handlers/tracking_handler.go
package handlers

import (
	"backend/recommendation-service/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TrackingHandler struct {
	DB *gorm.DB
}

// TrackView - Трекинг просмотра контента
func (h *RecommendationHandler) TrackView(c *gin.Context) {
	var req struct {
		ContentType     models.ContentType `json:"content_type" binding:"required"`
		ContentID       uint               `json:"content_id" binding:"required"`
		WatchTime       int                `json:"watch_time"`
		ContentDuration int                `json:"content_duration"`
		Progress        float64            `json:"progress"` // ИСПРАВЛЕНО: float64
		Completed       bool               `json:"completed"`
		Skipped         bool               `json:"skipped"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := uint(0)
	if uid, exists := c.Get("userID"); exists {
		switch v := uid.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case int:
			userID = uint(v)
		}
	}

	// 1. Создаем или обновляем View
	var view models.View
	result := h.DB.Where("user_id = ? AND content_type = ? AND content_id = ?",
		userID, req.ContentType, req.ContentID).First(&view)

	if result.Error != nil {
		// Создаем новый
		view = models.View{
			UserID:          userID,
			ContentType:     req.ContentType,
			ContentID:       req.ContentID,
			WatchTime:       req.WatchTime,
			ContentDuration: req.ContentDuration,
			Progress:        req.Progress, // ИСПРАВЛЕНО
			Completed:       req.Completed,
			Skipped:         req.Skipped,
			RepeatView:      0,
		}
	} else {
		// Обновляем существующий
		view.WatchTime += req.WatchTime
		view.Progress = req.Progress // ИСПРАВЛЕНО
		view.Completed = req.Completed
		view.RepeatView++
	}

	view.EngagementScore = view.CalculateEngagementScore()

	if result.Error != nil {
		h.DB.Create(&view)
	} else {
		h.DB.Save(&view)
	}

	// 2. Записываем interaction
	nullMetadata := (*string)(nil) // ИСПРАВЛЕНО: используем nil вместо пустой строки
	interaction := models.Interaction{
		UserID:          userID,
		ContentType:     req.ContentType,
		ContentID:       req.ContentID,
		InteractionType: "view", // ИСПРАВЛЕНО: string
		SessionID:       c.GetHeader("X-Session-ID"),
		DeviceType:      c.GetHeader("X-Device-Type"),
		Platform:        c.GetHeader("X-Platform"),
		Metadata:        nullMetadata, // ИСПРАВЛЕНО
	}

	h.DB.Create(&interaction)

	c.JSON(http.StatusOK, gin.H{"message": "view tracked"})
}

// TrackInteraction - Трекинг взаимодействий
func (h *RecommendationHandler) TrackInteraction(c *gin.Context) {
	var req struct {
		ContentType     models.ContentType `json:"content_type" binding:"required"`
		ContentID       uint               `json:"content_id" binding:"required"`
		InteractionType string             `json:"interaction_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := uint(0)
	if uid, exists := c.Get("userID"); exists {
		switch v := uid.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case int:
			userID = uint(v)
		}
	}

	// 1. Обновляем View с флагами взаимодействия
	var view models.View
	result := h.DB.Where("user_id = ? AND content_type = ? AND content_id = ?",
		userID, req.ContentType, req.ContentID).First(&view)

	if result.Error == nil {
		switch req.InteractionType {
		case "like":
			view.Liked = true
		case "comment":
			view.Commented = true
		case "share":
			view.Shared = true
		}

		view.EngagementScore = view.CalculateEngagementScore()
		h.DB.Save(&view)
	}

	// 2. Записываем interaction
	nullMetadata := (*string)(nil) // ИСПРАВЛЕНО
	interaction := models.Interaction{
		UserID:          userID,
		ContentType:     req.ContentType,
		ContentID:       req.ContentID,
		InteractionType: req.InteractionType, // ИСПРАВЛЕНО: string
		SessionID:       c.GetHeader("X-Session-ID"),
		DeviceType:      c.GetHeader("X-Device-Type"),
		Platform:        c.GetHeader("X-Platform"),
		Metadata:        nullMetadata, // ИСПРАВЛЕНО
	}

	h.DB.Create(&interaction)

	c.JSON(http.StatusOK, gin.H{"message": "interaction tracked"})
}
