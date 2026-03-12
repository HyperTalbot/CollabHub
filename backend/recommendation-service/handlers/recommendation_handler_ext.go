// backend/recommendation-service/handlers/recommendation_handler_ext.go
package handlers

import (
	"backend/recommendation-service/models"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetSimilarContent - Получить похожий контент
func (h *RecommendationHandler) GetSimilarContent(c *gin.Context) {
	contentType := c.Param("type")
	contentID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	if limit > 50 {
		limit = 50
	}

	// 1. Находим пользователей, которые лайкнули этот контент
	var userIDs []uint
	h.DB.Model(&models.View{}).
		Where("content_type = ? AND content_id = ? AND liked = ?", contentType, contentID, true).
		Pluck("user_id", &userIDs)

	if len(userIDs) == 0 {
		c.JSON(http.StatusOK, []ContentRecommendation{})
		return
	}

	// 2. Находим что еще они лайкнули
	var similar []models.View
	h.DB.Model(&models.View{}).
		Where("user_id IN ?", userIDs).
		Where("liked = ?", true).
		Where("NOT (content_type = ? AND content_id = ?)", contentType, contentID).
		Group("content_type, content_id").
		Select("content_type, content_id, COUNT(*) as watch_time").
		Order("watch_time DESC").
		Limit(limit).
		Find(&similar)

	recommendations := make([]ContentRecommendation, 0)
	for _, view := range similar {
		recommendations = append(recommendations, ContentRecommendation{
			ContentType: view.ContentType,
			ContentID:   view.ContentID,
			Score:       float64(view.WatchTime),
			Reason:      "similar_content",
		})
	}

	c.JSON(http.StatusOK, recommendations)
}

// RecalculateAllPreferences - Пересчитать предпочтения всех пользователей
func (h *RecommendationHandler) RecalculateAllPreferences(c *gin.Context) {
	// Получаем всех пользователей с просмотрами
	var userIDs []uint
	h.DB.Model(&models.View{}).
		Distinct("user_id").
		Pluck("user_id", &userIDs)

	count := 0
	for _, userID := range userIDs {
		h.calculateUserPreferences(userID)
		count++
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "recalculated",
		"count":  count,
	})
}

// GetStats - Получить статистику
func (h *RecommendationHandler) GetStats(c *gin.Context) {
	var stats struct {
		TotalViews        int64 `json:"total_views"`
		TotalInteractions int64 `json:"total_interactions"`
		TotalUsers        int64 `json:"total_users"`
		TrendingItems     int64 `json:"trending_items"`
	}

	h.DB.Model(&models.View{}).Count(&stats.TotalViews)
	h.DB.Model(&models.Interaction{}).Count(&stats.TotalInteractions)
	h.DB.Model(&models.View{}).Distinct("user_id").Count(&stats.TotalUsers)
	h.DB.Model(&models.TrendingContent{}).Count(&stats.TrendingItems)

	// Статистика по типам контента
	var contentStats []struct {
		ContentType models.ContentType `json:"content_type"`
		Count       int64              `json:"count"`
	}

	h.DB.Model(&models.View{}).
		Select("content_type, COUNT(*) as count").
		Group("content_type").
		Scan(&contentStats)

	c.JSON(http.StatusOK, gin.H{
		"stats":         stats,
		"content_stats": contentStats,
	})
}

// Cron job методы (без gin.Context)
func (h *RecommendationHandler) UpdateTrendingScoresJob() {
	now := time.Now()
	hourAgo := now.Add(-1 * time.Hour)
	dayAgo := now.Add(-24 * time.Hour)
	weekAgo := now.Add(-7 * 24 * time.Hour)

	type TrendingData struct {
		ContentType models.ContentType
		ContentID   uint
		ViewsHour   int64
		ViewsDay    int64
		ViewsWeek   int64
		Engagement  float64
	}

	var trendingData []TrendingData
	h.DB.Raw(`
        SELECT 
            content_type,
            content_id,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_hour,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_day,
            COUNT(CASE WHEN created_at > ? THEN 1 END) as views_week,
            AVG(CASE WHEN liked THEN 1 ELSE 0 END) * 100 as engagement
        FROM views
        GROUP BY content_type, content_id
        HAVING COUNT(*) > 0
    `, hourAgo, dayAgo, weekAgo).Scan(&trendingData)

	for _, data := range trendingData {
		score := float64(data.ViewsHour)*10 +
			float64(data.ViewsDay)*2 +
			float64(data.ViewsWeek)*0.5 +
			data.Engagement

		h.DB.Where(
			"content_type = ? AND content_id = ?",
			data.ContentType, data.ContentID,
		).Assign(models.TrendingContent{
			ContentType:     data.ContentType,
			ContentID:       data.ContentID,
			ViewsHour:       data.ViewsHour,
			ViewsDay:        data.ViewsDay,
			ViewsWeek:       data.ViewsWeek,
			EngagementScore: data.Engagement,
			TrendingScore:   score,
		}).FirstOrCreate(&models.TrendingContent{})
	}
}

func (h *RecommendationHandler) RecalculateAllPreferencesJob() {
	var userIDs []uint
	h.DB.Model(&models.View{}).
		Distinct("user_id").
		Pluck("user_id", &userIDs)

	for _, userID := range userIDs {
		h.calculateUserPreferences(userID)
	}
}

func (h *RecommendationHandler) CleanupOldInteractions() {
	// Удаляем взаимодействия старше 90 дней
	threshold := time.Now().Add(-90 * 24 * time.Hour)

	result := h.DB.Where("created_at < ?", threshold).Delete(&models.Interaction{})

	if result.Error == nil {
		log.Printf("🧹 Cleaned up %d old interactions", result.RowsAffected)
	}
}
