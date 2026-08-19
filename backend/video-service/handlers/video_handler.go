// backend/video-service/handlers/video_handler.go
package handlers

import (
	"backend/video-service/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VideoHandler struct {
	DB *gorm.DB
}

type CreateVideoRequest struct {
	Title        string   `json:"title" binding:"required"`
	Description  string   `json:"description"`
	VideoURL     string   `json:"video_url" binding:"required"`
	ThumbnailURL string   `json:"thumbnail_url"`
	Duration     int      `json:"duration" binding:"required"`
	Category     string   `json:"category"`
	Tags         []string `json:"tags"`
	IsPublic     bool     `json:"is_public"`
}

// CreateVideo - Загрузить видео
func (h *VideoHandler) CreateVideo(c *gin.Context) {
	userID := c.GetUint("user_id")
	username, _ := c.Get("username")

	var req CreateVideoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Преобразуем tags в JSON string
	tagsJSON := "[]"
	if len(req.Tags) > 0 {
		// Простое преобразование в JSON
		tagsJSON = `["` + req.Tags[0]
		for i := 1; i < len(req.Tags); i++ {
			tagsJSON += `","` + req.Tags[i]
		}
		tagsJSON += `"]`
	}

	video := models.Video{
		Title:        req.Title,
		Description:  req.Description,
		VideoURL:     req.VideoURL,
		ThumbnailURL: req.ThumbnailURL,
		Duration:     req.Duration,
		Category:     req.Category,
		Tags:         tagsJSON,
		UserID:       userID,
		Username:     username.(string),
		IsPublic:     req.IsPublic,
	}

	if err := h.DB.Create(&video).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create video"})
		return
	}

	c.JSON(http.StatusCreated, video)
}

// GetVideos - Получить все публичные видео
func (h *VideoHandler) GetVideos(c *gin.Context) {
	var videos []models.Video

	query := h.DB.Where("is_public = ?", true)

	// Фильтр по категории
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	// Сортировка
	sort := c.DefaultQuery("sort", "created_at")
	if sort == "views" {
		query = query.Order("view_count DESC")
	} else if sort == "likes" {
		query = query.Order("like_count DESC")
	} else {
		query = query.Order("created_at DESC")
	}

	if err := query.Find(&videos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch videos"})
		return
	}

	c.JSON(http.StatusOK, videos)
}

// GetVideoByID - Получить видео по ID
func (h *VideoHandler) GetVideoByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	var video models.Video
	if err := h.DB.First(&video, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
		return
	}

	c.JSON(http.StatusOK, video)
}

// IncrementViewCount - Увеличить счетчик просмотров
func (h *VideoHandler) IncrementViewCount(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	if err := h.DB.Model(&models.Video{}).Where("id = ?", id).UpdateColumn("view_count", gorm.Expr("view_count + ?", 1)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update view count"})
		return
	}

	// Сохраняем в историю просмотров если пользователь авторизован
	if userID, exists := c.Get("user_id"); exists {
		history := models.ViewHistory{
			UserID:   userID.(uint),
			VideoID:  uint(id),
			Duration: 0, // TODO: передавать из frontend
		}
		h.DB.Create(&history)
	}

	c.JSON(http.StatusOK, gin.H{"message": "View count updated"})
}

// SearchVideos - Поиск видео
func (h *VideoHandler) SearchVideos(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query required"})
		return
	}

	var videos []models.Video

	if err := h.DB.Where("is_public = ? AND (title ILIKE ? OR description ILIKE ?)", true, "%"+query+"%", "%"+query+"%").
		Order("created_at DESC").
		Limit(20).
		Find(&videos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	c.JSON(http.StatusOK, videos)
}

// GetUserVideos - Получить видео пользователя
func (h *VideoHandler) GetUserVideos(c *gin.Context) {
	userID := c.GetUint("user_id")

	var videos []models.Video
	if err := h.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&videos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch videos"})
		return
	}

	c.JSON(http.StatusOK, videos)
}

// DeleteVideo - Удалить видео
func (h *VideoHandler) DeleteVideo(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid video ID"})
		return
	}

	userID := c.GetUint("user_id")

	var video models.Video
	if err := h.DB.First(&video, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Video not found"})
		return
	}

	if video.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.DB.Delete(&video).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete video"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Video deleted"})
}

// GetViewHistory - Получить историю просмотров пользователя
func (h *VideoHandler) GetViewHistory(c *gin.Context) {
	userID := c.GetUint("user_id")

	var history []models.ViewHistory
	if err := h.DB.Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(50).
		Find(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch history"})
		return
	}

	// Получаем ID просмотренных видео
	videoIDs := make([]uint, len(history))
	for i, h := range history {
		videoIDs[i] = h.VideoID
	}

	c.JSON(http.StatusOK, gin.H{"video_ids": videoIDs})
}
